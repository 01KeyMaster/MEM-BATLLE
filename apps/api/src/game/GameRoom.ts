// Игровой движок одной комнаты. Сервер — единственный источник истины:
// он раздаёт карты, держит таймеры, считает голоса и очки.
import {
  GAME,
  type MemeCardDto,
  type RoomStateDto,
  type RoomStatus,
  type RoundPhase,
} from '@meme/shared';
import type { GameStore } from './store.ts';
import { pickRandom, shuffle, type Random } from './random.ts';

export type RoomUser = { id: string; name: string; photoUrl: string | null };
export type Situation = { id: string | null; text: string };

type Player = {
  id: string; // id RoomPlayer в базе
  userId: string | null; // null у ботов
  name: string;
  photoUrl: string | null;
  isBot: boolean;
  controlledByBot: boolean;
  connected: boolean;
  seat: number;
  score: number;
  hand: MemeCardDto[];
  drawPile: MemeCardDto[];
  discard: MemeCardDto[];
  leaveTimer?: NodeJS.Timeout;
};

type Play = { playId: string; card: MemeCardDto };

type Round = {
  id: string;
  number: number;
  phase: RoundPhase;
  situation: Situation;
  deadline: number;
  plays: Map<string, Play>; // playerId → карта
  order: string[]; // порядок показа (playerId), случайный
  votes: Map<string, string>; // voterId → playId
  voteCounts: Map<string, number>; // playId → голосов
  winnerIds: string[];
};

export type Timings = {
  play: number;
  vote: number;
  results: number;
  lobbyGrace: number;
  abandonGrace: number;
  botMinDelay: number;
  botMaxDelay: number;
};

const DEFAULT_TIMINGS: Timings = {
  play: GAME.PLAY_SECONDS * 1000,
  vote: GAME.VOTE_SECONDS * 1000,
  results: GAME.RESULTS_SECONDS * 1000,
  lobbyGrace: GAME.LOBBY_GRACE_SECONDS * 1000,
  abandonGrace: GAME.ABANDON_GRACE_SECONDS * 1000,
  botMinDelay: 1500,
  botMaxDelay: 5000,
};

export type GameRoomDeps = {
  store: GameStore;
  loadDeck: (userId: string) => Promise<MemeCardDto[]>;
  loadSituations: (userIds: string[]) => Promise<Situation[]>;
  onChange: (room: GameRoom) => void;
  onClosed: (room: GameRoom) => void;
  timings?: Partial<Timings>;
  random?: Random;
};

export type ActionResult = { ok: true } | { ok: false; error: string };
const ok: ActionResult = { ok: true };
const err = (error: string): ActionResult => ({ ok: false, error });

export class GameRoom {
  status: RoomStatus = 'LOBBY';
  hostUserId: string | null;
  players: Player[] = [];
  round: Round | null = null;
  winnerIds: string[] = [];

  private situations: Situation[] = [];
  private situationPool: Situation[] = [];
  private phaseTimer?: NodeJS.Timeout;
  private abandonTimer?: NodeJS.Timeout;
  private botTimers = new Set<NodeJS.Timeout>();
  private queue: Promise<unknown> = Promise.resolve();
  private readonly t: Timings;
  private readonly random: Random;

  constructor(
    readonly id: string,
    readonly code: string,
    hostUserId: string,
    readonly winScore: number,
    private readonly deps: GameRoomDeps,
  ) {
    this.hostUserId = hostUserId;
    this.t = { ...DEFAULT_TIMINGS, ...deps.timings };
    this.random = deps.random ?? Math.random;
  }

  // Все действия выполняются строго по очереди — так не бывает гонок,
  // даже если два игрока нажали кнопку в одну и ту же миллисекунду.
  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private changed() {
    this.deps.onChange(this);
  }

  private player(userId: string) {
    return this.players.find((p) => p.userId === userId);
  }

  private get humans() {
    return this.players.filter((p) => !p.isBot);
  }

  // ── Лобби ──────────────────────────────────────────────────

  join(user: RoomUser): Promise<ActionResult> {
    return this.run(async () => {
      if (this.status === 'ABANDONED') return err('Комната закрыта');
      const existing = this.player(user.id);

      if (existing) {
        // Вернулся (перезагрузил страницу, пропала сеть)
        clearTimeout(existing.leaveTimer);
        existing.connected = true;
        existing.name = user.name;
        existing.photoUrl = user.photoUrl;
        if (existing.controlledByBot && this.status === 'PLAYING') {
          existing.controlledByBot = false; // забирает место у бота
          await this.deps.store.updatePlayer(existing.id, { controlledByBot: false, leftAt: null });
        }
        this.cancelAbandon();
        this.changed();
        return ok;
      }

      if (this.status !== 'LOBBY') return err('Игра уже идёт — дождись следующей');
      if (this.players.length >= GAME.MAX_PLAYERS) return err('Комната заполнена');

      const taken = new Set(this.players.map((p) => p.seat));
      const seat = [...Array(GAME.MAX_PLAYERS).keys()].find((s) => !taken.has(s))!;
      const id = await this.deps.store.addPlayer(this.id, { userId: user.id, seat, isBot: false });
      this.players.push({
        id, userId: user.id, name: user.name, photoUrl: user.photoUrl,
        isBot: false, controlledByBot: false, connected: true, seat, score: 0,
        hand: [], drawPile: [], discard: [],
      });
      this.players.sort((a, b) => a.seat - b.seat);

      if (!this.hostUserId || !this.player(this.hostUserId)) await this.setHost(user.id);
      this.cancelAbandon();
      this.changed();
      return ok;
    });
  }

  // Соединение оборвалось (закрыл приложение, пропала сеть)
  disconnect(userId: string): Promise<void> {
    return this.run(async () => {
      const p = this.player(userId);
      if (!p) return;
      p.connected = false;

      if (this.status === 'LOBBY') {
        // Даём время вернуться, потом освобождаем место
        p.leaveTimer = setTimeout(() => void this.run(() => this.removeFromLobby(p)), this.t.lobbyGrace);
      } else if (this.status === 'PLAYING') {
        await this.handOverToBot(p);
      }
      this.checkAbandon();
      this.changed();
    });
  }

  // Игрок нажал «Выйти»
  leave(userId: string): Promise<void> {
    return this.run(async () => {
      const p = this.player(userId);
      if (!p) return;
      p.connected = false;
      if (this.status === 'LOBBY') {
        await this.removeFromLobby(p);
        return;
      }
      if (this.status === 'PLAYING') {
        await this.handOverToBot(p);
        await this.deps.store.updatePlayer(p.id, { leftAt: new Date() });
      }
      this.checkAbandon();
      this.changed();
    });
  }

  private async removeFromLobby(p: Player) {
    if (this.status !== 'LOBBY' || p.connected || !this.players.includes(p)) return;
    clearTimeout(p.leaveTimer);
    this.players = this.players.filter((x) => x !== p);
    await this.deps.store.removePlayer(p.id);

    if (this.humans.length === 0) {
      await this.close('ABANDONED');
      return;
    }
    if (p.userId === this.hostUserId) {
      const next = this.humans.find((h) => h.connected) ?? this.humans[0]!;
      await this.setHost(next.userId!);
    }
    this.changed();
  }

  private async setHost(userId: string) {
    this.hostUserId = userId;
    await this.deps.store.updateRoom(this.id, { hostId: userId });
  }

  // ── Начало игры ────────────────────────────────────────────

  start(userId: string): Promise<ActionResult> {
    return this.run(async () => {
      if (userId !== this.hostUserId) return err('Начать игру может только хозяин комнаты');
      if (this.status !== 'LOBBY') return err('Игра уже началась');
      if (this.players.length < GAME.MIN_PLAYERS) {
        return err(`Нужно минимум ${GAME.MIN_PLAYERS} игрока`);
      }

      // Раздаём каждому его собственную колоду
      for (const p of this.players) {
        const deck = shuffle(await this.deps.loadDeck(p.userId ?? ''), this.random);
        p.hand = deck.slice(0, GAME.HAND_SIZE);
        p.drawPile = deck.slice(GAME.HAND_SIZE);
        p.discard = [];
        p.score = 0;
      }
      const humanIds = this.humans.map((h) => h.userId!);
      this.situations = await this.deps.loadSituations(humanIds);
      if (this.situations.length === 0) return err('Нет карт ситуаций');

      this.status = 'PLAYING';
      await this.deps.store.updateRoom(this.id, { status: 'PLAYING', startedAt: new Date() });
      await this.startRound();
      return ok;
    });
  }

  // ── Раунд: фаза ходов ──────────────────────────────────────

  private nextSituation(): Situation {
    if (this.situationPool.length === 0) this.situationPool = shuffle(this.situations, this.random);
    return this.situationPool.pop()!;
  }

  private async startRound() {
    const number = (this.round?.number ?? 0) + 1;
    const situation = this.nextSituation();
    const deadline = Date.now() + this.t.play;
    const id = await this.deps.store.createRound(this.id, number, situation.id, new Date(deadline));

    this.round = {
      id, number, phase: 'PLAYING', situation, deadline,
      plays: new Map(), order: [], votes: new Map(), voteCounts: new Map(), winnerIds: [],
    };
    this.setPhaseTimer(this.t.play, () => this.endPlayPhase());
    this.scheduleBots();
    this.changed();
  }

  play(userId: string, cardId: string): Promise<ActionResult> {
    return this.run(async () => {
      const p = this.player(userId);
      if (!p) return err('Ты не в этой комнате');
      const res = await this.playCard(p, cardId);
      if (res.ok) await this.maybeEndPlayPhase();
      return res;
    });
  }

  private async playCard(p: Player, cardId: string): Promise<ActionResult> {
    const r = this.round;
    if (this.status !== 'PLAYING' || !r || r.phase !== 'PLAYING') return err('Сейчас нельзя ходить');
    if (r.plays.has(p.id)) return err('Ты уже положил карту');
    // Карта должна быть у игрока в руке — клиенту не доверяем
    const card = p.hand.find((c) => c.id === cardId);
    if (!card) return err('Этой карты нет у тебя в руке');

    p.hand = p.hand.filter((c) => c !== card);
    p.discard.push(card);
    const playId = await this.deps.store.createPlay(r.id, p.id, card.id, p.isBot || p.controlledByBot);
    r.plays.set(p.id, { playId, card });
    this.changed();
    return ok;
  }

  private async maybeEndPlayPhase() {
    if (this.round?.phase === 'PLAYING' && this.round.plays.size === this.players.length) {
      await this.endPlayPhase();
    }
  }

  private async endPlayPhase() {
    const r = this.round;
    if (!r || r.phase !== 'PLAYING') return;
    clearTimeout(this.phaseTimer);
    this.clearBotTimers();

    // Кто не успел — кладём случайную карту из руки
    for (const p of this.players) {
      if (!r.plays.has(p.id)) {
        const card = pickRandom(p.hand, this.random);
        if (card) await this.playCard(p, card.id);
      }
    }

    r.order = shuffle([...r.plays.keys()], this.random); // анонимно и вперемешку
    r.phase = 'VOTING';
    r.deadline = Date.now() + this.t.vote;
    await this.deps.store.startVoting(r.id, new Date(r.deadline), r.order.map((pid) => r.plays.get(pid)!.playId));
    this.setPhaseTimer(this.t.vote, () => this.endVoting());
    this.scheduleBots();
    this.changed();
  }

  // ── Раунд: голосование ─────────────────────────────────────

  vote(userId: string, playId: string): Promise<ActionResult> {
    return this.run(async () => {
      const p = this.player(userId);
      if (!p) return err('Ты не в этой комнате');
      const res = await this.castVote(p, playId);
      if (res.ok) await this.maybeEndVoting();
      return res;
    });
  }

  private async castVote(p: Player, playId: string): Promise<ActionResult> {
    const r = this.round;
    if (this.status !== 'PLAYING' || !r || r.phase !== 'VOTING') return err('Сейчас нельзя голосовать');
    if (r.votes.has(p.id)) return err('Ты уже проголосовал');
    const exists = [...r.plays.values()].some((pl) => pl.playId === playId);
    if (!exists) return err('Такой карты нет на столе');
    if (r.plays.get(p.id)?.playId === playId) return err('За свою карту голосовать нельзя');

    r.votes.set(p.id, playId);
    await this.deps.store.createVote(r.id, p.id, playId);
    this.changed();
    return ok;
  }

  private async maybeEndVoting() {
    if (this.round?.phase === 'VOTING' && this.round.votes.size === this.players.length) {
      await this.endVoting();
    }
  }

  private async endVoting() {
    const r = this.round;
    if (!r || r.phase !== 'VOTING') return;
    clearTimeout(this.phaseTimer);
    this.clearBotTimers();

    // Считаем голоса
    for (const playId of r.votes.values()) r.voteCounts.set(playId, (r.voteCounts.get(playId) ?? 0) + 1);
    const max = Math.max(0, ...r.voteCounts.values());

    // Очко получают все лидеры (ничья — всем). Если голосов нет — никому.
    r.winnerIds = max === 0 ? [] : [...r.plays.entries()]
      .filter(([, pl]) => (r.voteCounts.get(pl.playId) ?? 0) === max)
      .map(([playerId]) => playerId);

    const winners = this.players.filter((p) => r.winnerIds.includes(p.id));
    for (const w of winners) {
      w.score += 1;
      await this.deps.store.updatePlayer(w.id, { score: w.score });
    }
    await this.deps.store.finishRound(
      r.id,
      [...r.plays.entries()].map(([playerId, pl]) => ({
        playId: pl.playId,
        votes: r.voteCounts.get(pl.playId) ?? 0,
        isWinner: r.winnerIds.includes(playerId),
      })),
    );
    await this.deps.store.recordRoundWins(winners.filter((w) => w.userId).map((w) => w.userId!));

    // Каждый добирает по карте
    for (const p of this.players) this.drawCard(p);

    r.phase = 'RESULTS';
    r.deadline = Date.now() + this.t.results;
    const gameOver = this.players.some((p) => p.score >= this.winScore);
    this.setPhaseTimer(this.t.results, () => (gameOver ? this.finishGame() : this.startRound()));
    this.changed();
  }

  private drawCard(p: Player) {
    if (p.drawPile.length === 0) {
      // Колода кончилась — замешиваем сыгранные карты (кроме тех, что в руке)
      p.drawPile = shuffle(p.discard, this.random);
      p.discard = [];
    }
    const card = p.drawPile.shift();
    if (card) p.hand.push(card);
  }

  // ── Конец игры ─────────────────────────────────────────────

  private async finishGame() {
    clearTimeout(this.phaseTimer);
    this.clearBotTimers();
    const top = Math.max(...this.players.map((p) => p.score));
    const winners = this.players.filter((p) => p.score === top);
    this.winnerIds = winners.map((w) => w.id);
    this.status = 'FINISHED';

    for (const w of winners) await this.deps.store.updatePlayer(w.id, { isWinner: true });
    await this.deps.store.updateRoom(this.id, { status: 'FINISHED', finishedAt: new Date() });
    await this.deps.store.recordGameEnd(
      this.humans.map((h) => h.userId!),
      winners.filter((w) => w.userId).map((w) => w.userId!),
    );
    this.changed();

    // Через 10 минут убираем комнату из памяти
    this.phaseTimer = setTimeout(() => this.deps.onClosed(this), 10 * 60 * 1000);
  }

  // ── Боты и вышедшие игроки ─────────────────────────────────

  private async handOverToBot(p: Player) {
    if (p.controlledByBot) return;
    p.controlledByBot = true;
    await this.deps.store.updatePlayer(p.id, { controlledByBot: true });
    this.scheduleBots();
  }

  // Бот кладёт случайную карту и голосует случайно (не за свою)
  private scheduleBots() {
    const r = this.round;
    if (!r || this.status !== 'PLAYING') return;
    const { number, phase } = r;

    for (const p of this.players.filter((x) => x.isBot || x.controlledByBot)) {
      const delay = this.t.botMinDelay + this.random() * (this.t.botMaxDelay - this.t.botMinDelay);
      const timer = setTimeout(() => {
        this.botTimers.delete(timer);
        void this.run(async () => {
          // Пока ждали, раунд мог смениться, а игрок — вернуться
          if (this.round?.number !== number || this.round.phase !== phase) return;
          if (!(p.isBot || p.controlledByBot)) return;

          if (phase === 'PLAYING' && !r.plays.has(p.id)) {
            const card = pickRandom(p.hand, this.random);
            if (card) await this.playCard(p, card.id);
            await this.maybeEndPlayPhase();
          }
          if (phase === 'VOTING' && !r.votes.has(p.id)) {
            const own = r.plays.get(p.id)?.playId;
            const options = [...r.plays.values()].filter((pl) => pl.playId !== own);
            const choice = pickRandom(options, this.random);
            if (choice) await this.castVote(p, choice.playId);
            await this.maybeEndVoting();
          }
        });
      }, delay);
      this.botTimers.add(timer);
    }
  }

  private clearBotTimers() {
    for (const t of this.botTimers) clearTimeout(t);
    this.botTimers.clear();
  }

  private setPhaseTimer(ms: number, fn: () => Promise<void>) {
    clearTimeout(this.phaseTimer);
    this.phaseTimer = setTimeout(() => void this.run(fn), ms);
  }

  // Все люди ушли — ждём немного и закрываем комнату
  private checkAbandon() {
    if (this.humans.some((h) => h.connected) || this.abandonTimer) return;
    if (this.status === 'FINISHED') return;
    this.abandonTimer = setTimeout(
      () => void this.run(async () => {
        if (!this.humans.some((h) => h.connected)) await this.close('ABANDONED');
      }),
      this.t.abandonGrace,
    );
  }

  private cancelAbandon() {
    clearTimeout(this.abandonTimer);
    this.abandonTimer = undefined;
  }

  private async close(status: RoomStatus) {
    clearTimeout(this.phaseTimer);
    this.cancelAbandon();
    this.clearBotTimers();
    for (const p of this.players) clearTimeout(p.leaveTimer);
    this.status = status;
    await this.deps.store.updateRoom(this.id, { status, finishedAt: new Date() });
    this.changed();
    this.deps.onClosed(this);
  }

  // Остановить все таймеры (при выключении сервера)
  dispose() {
    clearTimeout(this.phaseTimer);
    this.cancelAbandon();
    this.clearBotTimers();
    for (const p of this.players) clearTimeout(p.leaveTimer);
  }

  // ── Что видит конкретный игрок ─────────────────────────────

  isMember(userId: string) {
    return Boolean(this.player(userId));
  }

  snapshotFor(userId: string): RoomStateDto {
    const me = this.player(userId);
    const r = this.round;
    const showResults = r?.phase === 'RESULTS';

    return {
      code: this.code,
      status: this.status,
      winScore: this.winScore,
      youId: me?.id ?? '',
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        photoUrl: p.photoUrl,
        isBot: p.isBot,
        controlledByBot: p.controlledByBot,
        connected: p.connected,
        isHost: p.userId !== null && p.userId === this.hostUserId,
        score: p.score,
        hasPlayed: Boolean(r?.plays.has(p.id)),
        hasVoted: Boolean(r?.votes.has(p.id)),
      })),
      round: r && {
        number: r.number,
        phase: r.phase,
        situation: r.situation.text,
        deadline: r.deadline,
        // Пока идут ходы — карты на столе не показываем никому
        plays: r.phase === 'PLAYING' ? [] : r.order.map((playerId) => {
          const pl = r.plays.get(playerId)!;
          return {
            playId: pl.playId,
            card: pl.card,
            mine: playerId === me?.id,
            // Авторы и голоса открываются только на итогах раунда
            ...(showResults && {
              authorId: playerId,
              votes: r.voteCounts.get(pl.playId) ?? 0,
              isWinner: r.winnerIds.includes(playerId),
            }),
          };
        }),
        myPlayCardId: me ? r.plays.get(me.id)?.card.id ?? null : null,
        myVotePlayId: me ? r.votes.get(me.id) ?? null : null,
        winnerIds: showResults ? r.winnerIds : [],
      },
      hand: me?.hand ?? [],
      winnerIds: this.winnerIds,
      serverNow: Date.now(),
    };
  }
}
