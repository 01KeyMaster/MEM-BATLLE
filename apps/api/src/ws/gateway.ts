// WebSocket: живое соединение игрока с комнатой.
// Порядок: подключился → прислал {type:'auth'} → прислал {type:'room.join'} → играет.
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { PrismaClient, User } from '@meme/db';
import { ClientMessageSchema, type ServerMessage } from '@meme/shared';
import { AuthError, parseAuthHeader, upsertTelegramUser } from '../auth/plugin.ts';
import type { GameRoom } from '../game/GameRoom.ts';
import type { RoomManager } from '../game/RoomManager.ts';

const AUTH_TIMEOUT_MS = 5000;

type Connection = { socket: WebSocket; user: User; room: GameRoom };

export const createGateway = () => {
  // Одно соединение на игрока в комнате: roomCode → userId → соединение
  const connections = new Map<string, Map<string, Connection>>();

  const send = (socket: WebSocket, msg: ServerMessage) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
  };

  // Каждому игроку — его личная версия состояния (своя рука, свой голос)
  const broadcast = (room: GameRoom) => {
    const conns = connections.get(room.code);
    if (!conns) return;
    for (const { socket, user } of conns.values()) {
      send(socket, { type: 'room.state', state: room.snapshotFor(user.id) });
    }
    if (room.status === 'ABANDONED') {
      for (const { socket } of conns.values()) send(socket, { type: 'room.closed', reason: 'Комната закрыта' });
      connections.delete(room.code);
    }
  };

  const register = (app: FastifyInstance, deps: { prisma: PrismaClient; rooms: RoomManager }) => {
    app.get('/ws', { websocket: true }, (socket, request) => {
      let user: User | null = null;
      let conn: Connection | null = null;

      // Не прислал авторизацию за 5 секунд — отключаем
      const authTimer = setTimeout(() => socket.close(4001, 'auth timeout'), AUTH_TIMEOUT_MS);

      const fail = (message: string) => send(socket, { type: 'error', message });

      // Сообщения одного игрока обрабатываем строго по очереди:
      // иначе room.join может обогнать ещё не проверенный auth
      let queue = Promise.resolve();
      socket.on('message', (raw) => {
        queue = queue.then(() => handle(raw.toString()));
      });

      const handle = async (raw: string) => {
        let data: unknown;
        try {
          data = JSON.parse(raw);
        } catch {
          return fail('Неверный формат сообщения');
        }
        const parsed = ClientMessageSchema.safeParse(data);
        if (!parsed.success) return fail('Неверное сообщение');
        const msg = parsed.data;

        try {
          if (msg.type === 'ping') return send(socket, { type: 'pong' });

          if (msg.type === 'auth') {
            if (user) return;
            try {
              const authData = parseAuthHeader(msg.auth);
              user = await upsertTelegramUser(deps.prisma, authData.user);
            } catch (e) {
              if (e instanceof AuthError) {
                request.log.warn({ reason: e.message }, 'ws auth failed');
                return socket.close(4001, 'unauthorized');
              }
              throw e;
            }
            if (user.isBanned) return socket.close(4003, 'banned');
            clearTimeout(authTimer);
            return;
          }

          if (!user) return fail('Сначала авторизуйся');

          if (msg.type === 'room.join') {
            const room = deps.rooms.get(msg.code);
            if (!room) return fail('Комната не найдена или уже закрыта');
            // Переходит в другую комнату — из старой выходит
            if (conn && conn.room !== room) {
              connections.get(conn.room.code)?.delete(user.id);
              void conn.room.disconnect(user.id);
              conn = null;
            }
            const res = await room.join({
              id: user.id,
              name: user.firstName,
              photoUrl: user.photoUrl,
            });
            if (!res.ok) return fail(res.error);

            // Если игрок открыл игру второй раз — старое соединение закрываем
            const roomConns = connections.get(room.code) ?? new Map<string, Connection>();
            const previous = roomConns.get(user.id);
            if (previous && previous.socket !== socket) previous.socket.close(4000, 'replaced');
            conn = { socket, user, room };
            roomConns.set(user.id, conn);
            connections.set(room.code, roomConns);
            return send(socket, { type: 'room.state', state: room.snapshotFor(user.id) });
          }

          if (!conn) return fail('Сначала зайди в комнату');
          const { room } = conn;

          if (msg.type === 'room.leave') {
            connections.get(room.code)?.delete(user.id);
            conn = null;
            await room.leave(user.id);
            return;
          }

          const result =
            msg.type === 'room.start' ? await room.start(user.id)
            : msg.type === 'game.play' ? await room.play(user.id, msg.cardId)
            : await room.vote(user.id, msg.playId);
          if (!result.ok) fail(result.error);
        } catch (e) {
          request.log.error(e, 'ws handler error');
          fail('Ошибка сервера');
        }
      };

      socket.on('close', () => {
        clearTimeout(authTimer);
        if (!conn || !user) return;
        const roomConns = connections.get(conn.room.code);
        // Закрылось именно актуальное соединение (а не заменённое новым)
        if (roomConns?.get(user.id)?.socket === socket) {
          roomConns.delete(user.id);
          void conn.room.disconnect(user.id);
        }
      });
    });
  };

  return { register, broadcast };
};
