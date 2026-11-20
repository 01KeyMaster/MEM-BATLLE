// Тесты движка: целые партии с ускоренными таймерами и хранилищем в памяти.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MemeCardDto } from '@meme/shared';
import { GameRoom, type GameRoomDeps } from './GameRoom.ts';
import type { GameStore } from './store.ts';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const card = (id: string): MemeCardDto => ({
  id, imageUrl: null, text: id, rarity: 'COMMON',
  pack: { id: 'base', title: 'Базовый', iconUrl: null, isPaid: false },
});

const memoryStore = () => {
  let n = 0;
  const id = (p: string) => `${p}${++n}`;
  const log = { votes: 0, plays: 0, gameEnds: [] as string[][] };
  const store: GameStore = {
    addPlayer: async () => id('player'),
    removePlayer: async () => {},
    updatePlayer: async () => {},
    updateRoom: async () => {},
    createRound: async () => id('round'),
    createPlay: async () => { log.plays++; return id('play'); },
    startVoting: async () => {},
    createVote: async () => { log.votes++; },
    finishRound: async () => {},
    recordRoundWins: async () => {},
    recordGameEnd: async (_u, winners) => { log.gameEnds.push(winners); },
  };
  return { store, log };
};

const makeRoom = (opts: Partial<GameRoomDeps> = {}, winScore = 2) => {
  const { store, log } = memoryStore();
  let closed = false;
  const room = new GameRoom('room1', 'CODE1234', 'u1', winScore, {
    store,
    // У каждого игрока своя колода из 24 карт
    loadDeck: async (userId) => Array.from({ length: 24 }, (_, i) => card(`${userId}-c${i}`)),
    loadSituations: async () => [{ id: 's1', text: 'Ситуация 1' }, { id: 's2', text: 'Ситуация 2' }],
    onChange: () => {},
    onClosed: () => { closed = true; },
    timings: { play: 80, vote: 80, results: 20, lobbyGrace: 30, abandonGrace: 50, botMinDelay: 1, botMaxDelay: 5 },
    ...opts,
  });
  return { room, log, isClosed: () => closed };
};

const join3 = async (room: GameRoom) => {
  for (const u of ['u1', 'u2', 'u3']) {
    assert.deepEqual(await room.join({ id: u, name: u, photoUrl: null }), { ok: true });
  }
};

test('нельзя начать игру меньше чем втроём и не хозяину', async () => {
  const { room } = makeRoom();
  await room.join({ id: 'u1', name: 'u1', photoUrl: null });
  await room.join({ id: 'u2', name: 'u2', photoUrl: null });
  assert.equal((await room.start('u1')).ok, false);
  await room.join({ id: 'u3', name: 'u3', photoUrl: null });
  assert.equal((await room.start('u2')).ok, false); // не хозяин
  assert.equal((await room.start('u1')).ok, true);
  assert.equal(room.snapshotFor('u1').hand.length, 6);
  room.dispose();
});

test('полный раунд: ходы, анонимное голосование, очко победителю', async () => {
  const { room } = makeRoom();
  await join3(room);
  await room.start('u1');

  // Пока идут ходы, карт на столе не видно
  for (const u of ['u1', 'u2', 'u3']) {
    const hand = room.snapshotFor(u).hand;
    assert.equal((await room.play(u, hand[0]!.id)).ok, true);
  }
  // Все походили — сразу голосование
  const s1 = room.snapshotFor('u1');
  assert.equal(s1.round?.phase, 'VOTING');
  assert.equal(s1.round?.plays.length, 3);
  assert.equal(s1.round?.plays[0]?.authorId, undefined, 'авторы скрыты при голосовании');

  const playOf = (u: string) => room.snapshotFor(u).round!.plays.find((p) => p.mine)!.playId;
  // За свою карту голосовать нельзя
  assert.equal((await room.vote('u1', playOf('u1'))).ok, false);
  // u1 и u3 голосуют за u2, u2 — за u1
  await room.vote('u1', playOf('u2'));
  await room.vote('u3', playOf('u2'));
  assert.equal((await room.vote('u3', playOf('u1'))).ok, false, 'второй голос не принимается');
  await room.vote('u2', playOf('u1'));

  const res = room.snapshotFor('u2');
  assert.equal(res.round?.phase, 'RESULTS');
  const u2 = res.players.find((p) => p.name === 'u2')!;
  assert.equal(u2.score, 1);
  assert.deepEqual(res.round?.winnerIds, [u2.id]);
  // Добрал карту: снова 6
  assert.equal(res.hand.length, 6);
  room.dispose();
});

test('ничья: очко всем лидерам', async () => {
  const { room } = makeRoom();
  await join3(room);
  await room.start('u1');
  for (const u of ['u1', 'u2', 'u3']) await room.play(u, room.snapshotFor(u).hand[0]!.id);
  const playOf = (u: string) => room.snapshotFor(u).round!.plays.find((p) => p.mine)!.playId;
  // Каждый получает по 1 голосу
  await room.vote('u1', playOf('u2'));
  await room.vote('u2', playOf('u3'));
  await room.vote('u3', playOf('u1'));
  const scores = room.snapshotFor('u1').players.map((p) => p.score);
  assert.deepEqual(scores, [1, 1, 1]);
  room.dispose();
});

test('чужую карту или карту не из руки положить нельзя', async () => {
  const { room } = makeRoom();
  await join3(room);
  await room.start('u1');
  const otherCard = room.snapshotFor('u2').hand[0]!.id;
  assert.equal((await room.play('u1', otherCard)).ok, false);
  assert.equal((await room.play('u1', 'fake')).ok, false);
  room.dispose();
});

test('не успел — карта кладётся сама; игра идёт до победы', async () => {
  const { room, log } = makeRoom();
  await join3(room);
  await room.start('u1');
  // Никто ничего не делает: таймеры сами кладут карты, голосов нет → очков нет
  await sleep(250);
  assert.ok(log.plays >= 3, 'карты положены автоматически');
  assert.equal(room.snapshotFor('u1').players.every((p) => p.score === 0), true);
  room.dispose();
});

test('вышел посреди игры — играет бот, вернулся — снова сам', async () => {
  const { room, log } = makeRoom({}, 2);
  await join3(room);
  await room.start('u1');
  await room.disconnect('u3');
  assert.equal(room.snapshotFor('u1').players[2]!.controlledByBot, true);

  // u1 и u2 ходят, бот за u3 тоже
  await room.play('u1', room.snapshotFor('u1').hand[0]!.id);
  await room.play('u2', room.snapshotFor('u2').hand[0]!.id);
  await sleep(30);
  assert.equal(room.snapshotFor('u1').round?.phase, 'VOTING');

  // Бот голосует сам
  await sleep(30);
  assert.ok(log.votes >= 1);

  await room.join({ id: 'u3', name: 'u3', photoUrl: null });
  assert.equal(room.snapshotFor('u1').players[2]!.controlledByBot, false);
  room.dispose();
});

test('в начатую игру новый игрок не попадёт', async () => {
  const { room } = makeRoom();
  await join3(room);
  await room.start('u1');
  assert.equal((await room.join({ id: 'u9', name: 'u9', photoUrl: null })).ok, false);
  room.dispose();
});

test('хозяин ушёл из лобби — хозяином становится следующий', async () => {
  const { room } = makeRoom();
  await join3(room);
  await room.leave('u1');
  const s = room.snapshotFor('u2');
  assert.equal(s.players.length, 2);
  assert.equal(s.players.find((p) => p.isHost)?.name, 'u2');
  room.dispose();
});

test('все ушли — комната закрывается', async () => {
  const { room, isClosed } = makeRoom();
  await join3(room);
  await room.start('u1');
  for (const u of ['u1', 'u2', 'u3']) await room.disconnect(u);
  await sleep(120);
  assert.equal(isClosed(), true);
  assert.equal(room.status, 'ABANDONED');
});

test('партия до победы с ботами за всех', async () => {
  const { room, log } = makeRoom({}, 2);
  await join3(room);
  await room.start('u1');
  // Все трое «вышли» — за всех играют боты, но комната ещё не закрыта (abandonGrace)
  // Поэтому проверяем на версии с долгим abandonGrace
  room.dispose();

  const long = makeRoom({ timings: { play: 50, vote: 50, results: 5, lobbyGrace: 30, abandonGrace: 60_000, botMinDelay: 1, botMaxDelay: 3 } }, 2);
  await join3(long.room);
  await long.room.start('u1');
  for (const u of ['u1', 'u2', 'u3']) await long.room.disconnect(u);
  for (let i = 0; i < 100 && long.room.status !== 'FINISHED'; i++) await sleep(20);
  assert.equal(long.room.status, 'FINISHED');
  assert.ok(long.room.players.some((p) => p.score >= 2));
  assert.equal(long.log.gameEnds.length, 1, 'статистика записана один раз');
  long.room.dispose();
  void log;
});
