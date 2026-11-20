// Протокол игры по WebSocket: что клиент шлёт серверу и что получает в ответ.
import { z } from 'zod';
import type { MemeCardDto } from './cards.ts';

// ── Клиент → сервер ─────────────────────────────────────────

export const ClientMessageSchema = z.discriminatedUnion('type', [
  // Первое сообщение после подключения: та же строка, что и в заголовке Authorization
  z.object({ type: z.literal('auth'), auth: z.string().min(1).max(4096) }),
  z.object({ type: z.literal('room.join'), code: z.string().regex(/^[A-Za-z0-9]{4,16}$/) }),
  z.object({ type: z.literal('room.leave') }),
  z.object({ type: z.literal('room.start') }),
  z.object({ type: z.literal('game.play'), cardId: z.string().min(1).max(64) }),
  z.object({ type: z.literal('game.vote'), playId: z.string().min(1).max(64) }),
  z.object({ type: z.literal('ping') }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ── Сервер → клиент ─────────────────────────────────────────

export type RoomStatus = 'LOBBY' | 'PLAYING' | 'FINISHED' | 'ABANDONED';
export type RoundPhase = 'PLAYING' | 'VOTING' | 'RESULTS';

export type PlayerDto = {
  id: string;
  name: string;
  photoUrl: string | null;
  isBot: boolean;
  controlledByBot: boolean; // игрок вышел — за него играет бот
  connected: boolean;
  isHost: boolean;
  score: number;
  hasPlayed: boolean;
  hasVoted: boolean;
};

export type TablePlayDto = {
  playId: string;
  card: MemeCardDto;
  mine: boolean;
  // Открываются только на экране итогов раунда
  authorId?: string;
  votes?: number;
  isWinner?: boolean;
};

export type RoundDto = {
  number: number;
  phase: RoundPhase;
  situation: string;
  deadline: number; // время окончания фазы (мс, Date.now())
  plays: TablePlayDto[]; // пусто, пока идёт фаза PLAYING
  myPlayCardId: string | null;
  myVotePlayId: string | null;
  winnerIds: string[];
};

export type RoomStateDto = {
  code: string;
  status: RoomStatus;
  winScore: number;
  youId: string;
  players: PlayerDto[];
  round: RoundDto | null;
  hand: MemeCardDto[];
  winnerIds: string[]; // победители игры
  serverNow: number;   // для синхронизации таймера
};

export type ServerMessage =
  | { type: 'room.state'; state: RoomStateDto }
  | { type: 'error'; message: string }
  | { type: 'room.closed'; reason: string }
  | { type: 'pong' };

// Настройки для клиента (ссылки-приглашения)
export type AppConfigDto = {
  botUsername: string;
  miniAppShortName: string | null;
};
