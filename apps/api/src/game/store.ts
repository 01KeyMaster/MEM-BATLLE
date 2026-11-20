// Запись игровых событий в базу. Движок работает с интерфейсом GameStore,
// поэтому в тестах вместо Postgres можно подставить хранилище в памяти.
import type { PrismaClient } from '@meme/db';
import type { RoomStatus } from '@meme/shared';

export type NewPlayer = { userId: string | null; seat: number; isBot: boolean; botName?: string };

export interface GameStore {
  addPlayer(roomId: string, player: NewPlayer): Promise<string>;
  removePlayer(playerId: string): Promise<void>;
  updatePlayer(
    playerId: string,
    data: { score?: number; controlledByBot?: boolean; leftAt?: Date | null; isWinner?: boolean },
  ): Promise<void>;
  updateRoom(
    roomId: string,
    data: { status?: RoomStatus; hostId?: string | null; startedAt?: Date; finishedAt?: Date },
  ): Promise<void>;
  createRound(roomId: string, number: number, situationCardId: string | null, playDeadline: Date): Promise<string>;
  createPlay(roundId: string, playerId: string, cardId: string, isAuto: boolean): Promise<string>;
  startVoting(roundId: string, voteDeadline: Date, playIdsInOrder: string[]): Promise<void>;
  createVote(roundId: string, voterId: string, playId: string): Promise<void>;
  finishRound(roundId: string, results: { playId: string; votes: number; isWinner: boolean }[]): Promise<void>;
  recordRoundWins(userIds: string[]): Promise<void>;
  recordGameEnd(userIds: string[], winnerUserIds: string[]): Promise<void>;
}

export const createPrismaGameStore = (prisma: PrismaClient): GameStore => ({
  async addPlayer(roomId, p) {
    const row = await prisma.roomPlayer.create({
      data: { roomId, userId: p.userId, seat: p.seat, isBot: p.isBot, botName: p.botName ?? null },
    });
    return row.id;
  },
  async removePlayer(playerId) {
    await prisma.roomPlayer.delete({ where: { id: playerId } });
  },
  async updatePlayer(playerId, data) {
    await prisma.roomPlayer.update({ where: { id: playerId }, data });
  },
  async updateRoom(roomId, data) {
    await prisma.room.update({ where: { id: roomId }, data });
  },
  async createRound(roomId, number, situationCardId, playDeadline) {
    const row = await prisma.round.create({ data: { roomId, number, situationCardId, playDeadline } });
    return row.id;
  },
  async createPlay(roundId, playerId, cardId, isAuto) {
    const row = await prisma.play.create({ data: { roundId, playerId, cardId, isAuto } });
    return row.id;
  },
  async startVoting(roundId, voteDeadline, playIds) {
    await prisma.$transaction([
      prisma.round.update({ where: { id: roundId }, data: { status: 'VOTING', voteDeadline } }),
      ...playIds.map((id, i) => prisma.play.update({ where: { id }, data: { displayOrder: i } })),
    ]);
  },
  async createVote(roundId, voterId, playId) {
    await prisma.vote.create({ data: { roundId, voterId, playId } });
  },
  async finishRound(roundId, results) {
    await prisma.$transaction([
      prisma.round.update({ where: { id: roundId }, data: { status: 'FINISHED', finishedAt: new Date() } }),
      ...results.map((r) =>
        prisma.play.update({ where: { id: r.playId }, data: { votesCount: r.votes, isWinner: r.isWinner } }),
      ),
    ]);
  },
  async recordRoundWins(userIds) {
    if (userIds.length === 0) return;
    await prisma.user.updateMany({ where: { id: { in: userIds } }, data: { roundsWon: { increment: 1 } } });
  },
  async recordGameEnd(userIds, winnerUserIds) {
    const now = new Date();
    await prisma.$transaction([
      prisma.user.updateMany({ where: { id: { in: userIds } }, data: { gamesPlayed: { increment: 1 } } }),
      prisma.user.updateMany({ where: { id: { in: winnerUserIds } }, data: { gamesWon: { increment: 1 } } }),
      // Первая сыгранная игра — понадобится для рефералки (этап 8)
      prisma.user.updateMany({ where: { id: { in: userIds }, firstGameAt: null }, data: { firstGameAt: now } }),
    ]);
  },
});
