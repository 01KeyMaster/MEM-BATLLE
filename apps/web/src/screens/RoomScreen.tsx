// Комната: лобби → ход → голосование → итоги раунда → финал.
import { useEffect, useState } from 'react';
import { GAME, type MemeCardDto, type RoomStateDto, type TablePlayDto } from '@meme/shared';
import { useRoom, type RoomConnection } from '../lib/useRoom.ts';
import { haptic, hapticNotify } from '../lib/telegram.ts';
import { MemeCard } from '../components/MemeCard.tsx';
import { Timer } from '../components/Timer.tsx';
import { InviteButton } from '../components/InviteButton.tsx';
import { PlayerList } from '../components/PlayerList.tsx';
import { pointsTo } from '../lib/plural.ts';

type Props = { code: string; onExit: () => void };

export const RoomScreen = ({ code, onExit }: Props) => {
  const room = useRoom(code);
  const { state, error, closed, connected } = room;

  const leave = () => {
    room.send({ type: 'room.leave' });
    onExit();
  };

  if (closed) {
    return (
      <Centered>
        <p className="text-lg">{closed}</p>
        <PrimaryButton onClick={onExit}>На главную</PrimaryButton>
      </Centered>
    );
  }
  if (!state) {
    return (
      <Centered>
        <p className="text-hint">{error ?? 'Подключаюсь к комнате…'}</p>
        {error && <PrimaryButton onClick={onExit}>На главную</PrimaryButton>}
      </Centered>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4 pb-24">
      {!connected && (
        <p className="rounded-xl bg-amber-500/20 p-2 text-center text-sm text-amber-300">
          Связь пропала, переподключаюсь…
        </p>
      )}

      {state.status === 'LOBBY' && <Lobby room={room} state={state} onLeave={leave} />}
      {state.status === 'PLAYING' && state.round?.phase === 'PLAYING' && <PlayPhase room={room} state={state} />}
      {state.status === 'PLAYING' && state.round?.phase === 'VOTING' && <VotePhase room={room} state={state} />}
      {state.status === 'PLAYING' && state.round?.phase === 'RESULTS' && <RoundResults room={room} state={state} />}
      {state.status === 'FINISHED' && <GameOver state={state} onExit={onExit} />}

      {state.status === 'PLAYING' && (
        <button onClick={leave} className="mt-auto text-sm text-hint">
          Выйти из игры (за тебя доиграет бот)
        </button>
      )}

      {error && (
        <p className="fixed inset-x-4 bottom-6 mx-auto max-w-md rounded-xl bg-red-600/90 p-3 text-center text-sm text-white">
          {error}
        </p>
      )}
    </main>
  );
};

type PhaseProps = { room: RoomConnection; state: RoomStateDto };

// ── Лобби ─────────────────────────────────────────────────────

const Lobby = ({ room, state, onLeave }: PhaseProps & { onLeave: () => void }) => {
  const me = state.players.find((p) => p.id === state.youId);
  const missing = GAME.MIN_PLAYERS - state.players.length;

  return (
    <>
      <header>
        <h1 className="text-2xl font-black">Комната</h1>
        <p className="text-sm text-hint">
          Игроков {state.players.length} из {GAME.MAX_PLAYERS} · игра {pointsTo(state.winScore)}
        </p>
      </header>

      <InviteButton code={state.code} />

      <PlayerList state={state} />

      {me?.isHost ? (
        <PrimaryButton
          disabled={missing > 0}
          onClick={() => {
            haptic('heavy');
            room.send({ type: 'room.start' });
          }}
        >
          {missing > 0 ? `Нужно ещё ${missing} — позови друзей` : '🚀 Начать игру'}
        </PrimaryButton>
      ) : (
        <p className="text-center text-hint">Ждём, когда хозяин начнёт игру…</p>
      )}

      <button onClick={onLeave} className="text-sm text-hint">
        Выйти из комнаты
      </button>
    </>
  );
};

// ── Шапка раунда: номер, ситуация, таймер ─────────────────────

const RoundHeader = ({ room, state, total }: PhaseProps & { total: number }) => {
  const round = state.round!;
  return (
    <>
      <p className="text-sm text-hint">
        Раунд {round.number} · играем {pointsTo(state.winScore)}
      </p>
      <div className="rounded-2xl bg-white p-4 text-center text-lg font-bold text-neutral-900 shadow-lg">
        {round.situation}
      </div>
      {round.phase !== 'RESULTS' && <Timer deadline={round.deadline} clockOffset={room.clockOffset} total={total} />}
    </>
  );
};

// ── Фаза ходов ─────────────────────────────────────────────────

const PlayPhase = ({ room, state }: PhaseProps) => {
  const [selected, setSelected] = useState<MemeCardDto | null>(null);
  const myCardId = state.round!.myPlayCardId;
  // Положенной карты уже нет в руке — показываем ту, что выбрали
  const myCard = selected?.id === myCardId ? selected : null;

  useEffect(() => setSelected(null), [state.round?.number]);

  return (
    <>
      <RoundHeader room={room} state={state} total={GAME.PLAY_SECONDS} />

      {myCardId ? (
        <>
          <p className="text-center font-semibold">Карта положена. Ждём остальных…</p>
          {myCard && <div className="mx-auto w-32"><MemeCard card={myCard} /></div>}
          <PlayerList state={state} status={(p) => (p.hasPlayed ? '✓' : '…')} />
        </>
      ) : (
        <>
          <p className="text-center font-semibold">Выбери самый подходящий мем</p>
          <div className="grid grid-cols-3 gap-2">
            {state.hand.map((card) => (
              <MemeCard
                key={card.id}
                card={card}
                selected={selected?.id === card.id}
                onClick={() => {
                  haptic();
                  setSelected(card);
                }}
              />
            ))}
          </div>
          <PrimaryButton
            disabled={!selected}
            onClick={() => {
              hapticNotify('success');
              room.send({ type: 'game.play', cardId: selected!.id });
            }}
          >
            Положить карту
          </PrimaryButton>
        </>
      )}
    </>
  );
};

// ── Голосование ─────────────────────────────────────────────────

const VotePhase = ({ room, state }: PhaseProps) => {
  const [selected, setSelected] = useState<string | null>(null);
  const round = state.round!;
  const voted = round.myVotePlayId;

  return (
    <>
      <RoundHeader room={room} state={state} total={GAME.VOTE_SECONDS} />
      <p className="text-center font-semibold">
        {voted ? 'Голос принят ✅ Ждём остальных…' : 'Голосуй за самый смешной мем'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {round.plays.map((play) => (
          <div key={play.playId} className="relative">
            <MemeCard
              card={play.card}
              selected={(voted ?? selected) === play.playId}
              dimmed={play.mine || (Boolean(voted) && voted !== play.playId)}
              corner={play.mine ? 'твоя' : undefined}
              onClick={
                play.mine || voted
                  ? undefined
                  : () => {
                      haptic();
                      setSelected(play.playId);
                    }
              }
            />
          </div>
        ))}
      </div>
      {!voted && (
        <PrimaryButton
          disabled={!selected}
          onClick={() => {
            hapticNotify('success');
            room.send({ type: 'game.vote', playId: selected! });
          }}
        >
          Голосовать
        </PrimaryButton>
      )}
    </>
  );
};

// ── Итоги раунда ────────────────────────────────────────────────

const RoundResults = ({ room, state }: PhaseProps) => {
  const round = state.round!;
  const name = (id?: string) => state.players.find((p) => p.id === id)?.name ?? '?';
  const sorted = [...round.plays].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
  const iWon = round.winnerIds.includes(state.youId);

  useEffect(() => {
    if (iWon) hapticNotify('success');
  }, [iWon]);

  return (
    <>
      <RoundHeader room={room} state={state} total={GAME.RESULTS_SECONDS} />
      <h2 className="text-center text-xl font-black">
        {round.winnerIds.length === 0
          ? 'Никто не проголосовал 🤷'
          : iWon
            ? '🏆 Твой мем победил! +1'
            : `🏆 Победа: ${round.winnerIds.map((id) => name(id)).join(', ')}`}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {sorted.map((play: TablePlayDto) => (
          <div key={play.playId} className={`flex flex-col gap-1 ${play.isWinner ? '' : 'opacity-70'}`}>
            <MemeCard card={play.card} corner={play.isWinner ? '🏆' : undefined} />
            <p className="truncate text-center text-sm">
              {name(play.authorId)} · <b>{play.votes}</b> 👍
            </p>
            {/* TODO этап 7: кнопка «Купить этот пак» у победившей платной карты */}
          </div>
        ))}
      </div>
      <PlayerList state={state} />
      <NextRoundIn deadline={round.deadline} clockOffset={room.clockOffset} />
    </>
  );
};

const NextRoundIn = ({ deadline, clockOffset }: { deadline: number; clockOffset: number }) => {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.ceil((deadline - Date.now() - clockOffset) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline, clockOffset]);
  return <p className="text-center text-sm text-hint">Дальше через {left}…</p>;
};

// ── Конец игры ──────────────────────────────────────────────────

const GameOver = ({ state, onExit }: { state: RoomStateDto; onExit: () => void }) => {
  const iWon = state.winnerIds.includes(state.youId);
  const winners = state.players.filter((p) => state.winnerIds.includes(p.id));

  useEffect(() => {
    hapticNotify(iWon ? 'success' : 'warning');
  }, [iWon]);

  return (
    <>
      <div className="py-6 text-center">
        <p className="text-6xl">{iWon ? '🎉' : '🏁'}</p>
        <h1 className="mt-2 text-3xl font-black">{iWon ? 'Ты победил!' : 'Игра окончена'}</h1>
        <p className="text-hint">Победитель: {winners.map((w) => w.name).join(', ')}</p>
      </div>
      <PlayerList state={{ ...state, players: [...state.players].sort((a, b) => b.score - a.score) }} />
      {/* TODO этап 7: «Купить этот пак» для победившей платной карты */}
      <PrimaryButton onClick={onExit}>На главную</PrimaryButton>
    </>
  );
};

// ── Мелкие общие элементы ───────────────────────────────────────

const Centered = ({ children }: { children: React.ReactNode }) => (
  <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
    {children}
  </main>
);

const PrimaryButton = ({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="w-full rounded-2xl bg-accent py-4 text-lg font-semibold text-accent-text transition active:scale-95 disabled:opacity-50"
  >
    {children}
  </button>
);
