import type { Me } from '@meme/shared';
import { haptic, startParam } from '../lib/telegram.ts';

type Props = { me: Me };

// Главный экран. Кнопки заработают на следующих этапах.
export const HomeScreen = ({ me }: Props) => {
  const buttons = [
    { label: '👥 Играть с друзьями', stage: 4 },
    { label: '🔍 Найти игру', stage: 6 },
    { label: '🎁 Пробник дня', stage: 8 },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-4">
      <header className="flex items-center gap-3">
        {me.photoUrl ? (
          <img src={me.photoUrl} alt="" className="size-12 rounded-full" />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-full bg-accent text-xl text-accent-text">
            {me.firstName[0]}
          </div>
        )}
        <div>
          <h1 className="text-lg font-bold">Привет, {me.firstName}!</h1>
          <p className="text-sm text-hint">
            Игр: {me.stats.gamesPlayed} · Побед: {me.stats.gamesWon}
            {me.isAdmin && ' · 👑 админ'}
          </p>
        </div>
      </header>

      <h2 className="text-center text-3xl font-black">Мем-батл 🃏</h2>

      <div className="flex flex-col gap-3">
        {buttons.map(({ label, stage }) => (
          <button
            key={label}
            onClick={() => haptic()}
            className="rounded-2xl bg-accent px-4 py-4 text-lg font-semibold text-accent-text active:scale-95 transition"
          >
            {label}
            <span className="block text-xs font-normal opacity-70">скоро · этап {stage}</span>
          </button>
        ))}
      </div>

      {startParam && (
        <p className="text-center text-xs text-hint">startapp: {startParam}</p>
      )}
    </main>
  );
};
