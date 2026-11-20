import type { PlayerDto, RoomStateDto } from '@meme/shared';

type Props = {
  state: RoomStateDto;
  status?: (p: PlayerDto) => string | null; // подпись справа, например «✓ походил»
};

const Avatar = ({ p }: { p: PlayerDto }) =>
  p.photoUrl ? (
    <img src={p.photoUrl} alt="" className="size-9 rounded-full" />
  ) : (
    <div className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-text">
      {p.isBot ? '🤖' : p.name[0]}
    </div>
  );

export const PlayerList = ({ state, status }: Props) => (
  <ul className="flex flex-col gap-1.5">
    {state.players.map((p) => (
      <li
        key={p.id}
        className={`flex items-center gap-3 rounded-xl bg-bg-secondary px-3 py-2 ${p.connected || p.isBot ? '' : 'opacity-50'}`}
      >
        <Avatar p={p} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {p.name}
            {p.id === state.youId && <span className="text-hint"> (ты)</span>}
            {p.isHost && ' 👑'}
          </p>
          {p.controlledByBot && <p className="text-xs text-hint">вышел — за него играет бот</p>}
        </div>
        {status?.(p) && <span className="text-sm text-hint">{status(p)}</span>}
        {state.status !== 'LOBBY' && <span className="w-6 text-right text-lg font-black">{p.score}</span>}
      </li>
    ))}
  </ul>
);
