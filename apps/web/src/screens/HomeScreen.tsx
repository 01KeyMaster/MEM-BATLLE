import type { Me } from '@meme/shared';
import type { Screen } from '../App.tsx';
import { haptic, startParam } from '../lib/telegram.ts';

type Props = {
  me: Me;
  onNavigate: (screen: Screen) => void;
};

type MenuItem = { label: string; screen?: Screen; stage?: number };

// Главный экран
export const HomeScreen = ({ me, onNavigate }: Props) => {
  const buttons: MenuItem[] = [
    { label: '👥 Играть с друзьями', stage: 4 },
    { label: '🔍 Найти игру', stage: 6 },
    { label: '🎁 Пробник дня', stage: 8 },
  ];

  const secondary: MenuItem[] = [
    { label: '🃏 Мои паки и колода', screen: 'deck' },
    { label: '🛒 Магазин', stage: 7 },
  ];

  const open = (item: MenuItem) => {
    haptic();
    if (item.screen) onNavigate(item.screen);
  };

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
        {buttons.map((item) => (
          <button
            key={item.label}
            onClick={() => open(item)}
            className="rounded-2xl bg-accent px-4 py-4 text-lg font-semibold text-accent-text transition active:scale-95"
          >
            {item.label}
            {item.stage && <span className="block text-xs font-normal opacity-70">скоро · этап {item.stage}</span>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {secondary.map((item) => (
          <button
            key={item.label}
            onClick={() => open(item)}
            className="rounded-2xl bg-bg-secondary px-3 py-4 font-semibold transition active:scale-95"
          >
            {item.label}
            {item.stage && <span className="block text-xs font-normal text-hint">скоро · этап {item.stage}</span>}
          </button>
        ))}
      </div>

      {startParam && <p className="text-center text-xs text-hint">startapp: {startParam}</p>}
    </main>
  );
};
