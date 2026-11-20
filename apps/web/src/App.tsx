import { useEffect, useState } from 'react';
import type { Me } from '@meme/shared';
import { api, ApiError } from './lib/api.ts';
import { HomeScreen } from './screens/HomeScreen.tsx';

export const App = () => {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error) {
    return <p className="p-6 text-center text-hint">{error}</p>;
  }
  if (!me) {
    return <p className="p-6 text-center text-hint">Загрузка…</p>;
  }
  return <HomeScreen me={me} />;
};
