import { useEffect, useState } from 'react';
import type { Me } from '@meme/shared';
import { api, ApiError } from './lib/api.ts';
import { showBackButton } from './lib/telegram.ts';
import { HomeScreen } from './screens/HomeScreen.tsx';
import { DeckScreen } from './screens/DeckScreen.tsx';

export type Screen = 'home' | 'deck';

export const App = () => {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('home');

  // При запуске узнаём, кто мы. Сервер проверит initData и создаст пользователя.
  useEffect(() => {
    api<Me>('/me')
      .then(setMe)
      .catch((err) => {
        setError(err instanceof ApiError && err.status === 401
          ? 'Открой игру через бота @mem_fight_bot в Telegram'
          : 'Не удалось подключиться к серверу');
      });
  }, []);

  // Кнопка «Назад» Telegram видна на всех экранах, кроме главного
  useEffect(() => {
    if (screen === 'home') return;
    return showBackButton(() => setScreen('home'));
  }, [screen]);

  if (error) {
    return <p className="p-6 text-center text-hint">{error}</p>;
  }
  if (!me) {
    return <p className="p-6 text-center text-hint">Загрузка…</p>;
  }

  if (screen === 'deck') {
    return (
      <>
        <BrowserBack onBack={() => setScreen('home')} />
        <DeckScreen />
      </>
    );
  }
  return <HomeScreen me={me} onNavigate={setScreen} />;
};

// В Safari нет кнопки «Назад» Telegram — показываем свою
const BrowserBack = ({ onBack }: { onBack: () => void }) =>
  window.Telegram?.WebApp.initData ? null : (
    <button onClick={onBack} className="px-4 pt-3 text-sm text-accent">
      ← Назад
    </button>
  );
