// Подключение к комнате по WebSocket. Само переподключается при обрыве сети.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, RoomStateDto, ServerMessage } from '@meme/shared';
import { authHeader } from './api.ts';
import { hapticNotify } from './telegram.ts';

export type RoomConnection = {
  state: RoomStateDto | null;
  error: string | null;
  connected: boolean;
  closed: string | null; // причина, если комната закрыта
  clockOffset: number; // разница часов сервера и телефона
  send: (msg: ClientMessage) => void;
};

const wsUrl = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

export const useRoom = (code: string): RoomConnection => {
  const [state, setState] = useState<RoomStateDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [closed, setClosed] = useState<string | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let stopped = false;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout>;
    let pingTimer: ReturnType<typeof setInterval>;
    let errorTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const socket = new WebSocket(wsUrl());
      socketRef.current = socket;

      socket.onopen = () => {
        retry = 0;
        setConnected(true);
        // Авторизация первым сообщением (в адресе её не передаём — адреса попадают в логи)
        socket.send(JSON.stringify({ type: 'auth', auth: authHeader() } satisfies ClientMessage));
        socket.send(JSON.stringify({ type: 'room.join', code } satisfies ClientMessage));
        // Пинг раз в 25 сек, чтобы туннель/прокси не обрывали тихое соединение
        pingTimer = setInterval(() => socket.send(JSON.stringify({ type: 'ping' })), 25_000);
      };

      socket.onmessage = (event) => {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        if (msg.type === 'room.state') {
          setState(msg.state);
          setClockOffset(msg.state.serverNow - Date.now());
        } else if (msg.type === 'error') {
          hapticNotify('error');
          setError(msg.message);
          clearTimeout(errorTimer);
          errorTimer = setTimeout(() => setError(null), 3500);
        } else if (msg.type === 'room.closed') {
          setClosed(msg.reason);
          stopped = true;
        }
      };

      socket.onclose = (event) => {
        clearInterval(pingTimer);
        setConnected(false);
        // 4001 — не авторизован, 4000 — игра открыта в другом окне: не переподключаемся
        if (stopped || event.code === 4001 || event.code === 4000) {
          if (event.code === 4000) setClosed('Игра открыта на другом устройстве');
          if (event.code === 4001) setClosed('Не удалось войти — открой игру через бота');
          return;
        }
        retry += 1;
        retryTimer = setTimeout(connect, Math.min(1000 * 2 ** retry, 10_000));
      };
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(errorTimer);
      clearInterval(pingTimer);
      socketRef.current?.close();
    };
  }, [code]);

  const send = useCallback((msg: ClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
  }, []);

  return { state, error, connected, closed, clockOffset, send };
};
