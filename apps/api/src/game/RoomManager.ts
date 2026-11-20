// Хранит активные комнаты в памяти и связывает движок с базой.
import type { PrismaClient } from '@meme/db';
import type { MemeCardDto } from '@meme/shared';
import type { CollectionService } from '../services/collection.ts';
import { GameRoom, type Situation, type Timings } from './GameRoom.ts';
import { createPrismaGameStore } from './store.ts';
import { generateRoomCode } from './random.ts';

type Options = {
  prisma: PrismaClient;
  collection: CollectionService;
  winScore: number;
  onChange: (room: GameRoom) => void;
  timings?: Partial<Timings>;
};

export const createRoomManager = ({ prisma, collection, winScore, onChange, timings }: Options) => {
  const rooms = new Map<string, GameRoom>(); // code → комната
  const store = createPrismaGameStore(prisma);

  // Колода игрока (у ботов, без userId, — базовая колода)
  const loadDeck = async (userId: string): Promise<MemeCardDto[]> => {
    if (!userId) {
      const base = await prisma.card.findMany({
        where: { type: 'MEME', isActive: true, pack: { isBase: true, isActive: true } },
        include: { pack: true },
        orderBy: { id: 'asc' },
      });
      return base.map((c) => ({
        id: c.id, imageUrl: c.imageUrl, text: c.text, rarity: c.rarity,
        pack: { id: c.pack.id, title: c.pack.title, iconUrl: c.pack.iconUrl, isPaid: c.pack.priceStars > 0 },
      }));
    }
    return (await collection.getDeck(userId)).cards;
  };

  // Ситуации: из базовых паков + из паков, которые есть у кого-то из игроков
  const loadSituations = async (userIds: string[]): Promise<Situation[]> => {
    const owned = await prisma.userPack.findMany({ where: { userId: { in: userIds } }, select: { packId: true } });
    const cards = await prisma.card.findMany({
      where: {
        type: 'SITUATION',
        isActive: true,
        pack: { isActive: true, OR: [{ isBase: true }, { id: { in: owned.map((o) => o.packId) } }] },
      },
      select: { id: true, text: true },
    });
    // TODO этап 10: свои ситуации хозяина комнаты
    return cards.filter((c) => c.text).map((c) => ({ id: c.id, text: c.text! }));
  };

  const register = (id: string, code: string, hostUserId: string) => {
    const room = new GameRoom(id, code, hostUserId, winScore, {
      store, loadDeck, loadSituations, onChange, timings,
      onClosed: (r) => {
        r.dispose();
        rooms.delete(r.code);
      },
    });
    rooms.set(code, room);
    return room;
  };

  return {
    // Новая комната с друзьями
    async create(hostUserId: string) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateRoomCode();
        const exists = await prisma.room.findUnique({ where: { code } });
        if (exists) continue;
        const row = await prisma.room.create({
          data: { code, mode: 'FRIENDS', hostId: hostUserId, winScore },
        });
        return register(row.id, code, hostUserId);
      }
      throw new Error('Не удалось придумать код комнаты');
    },

    get: (code: string) => rooms.get(code),

    // После перезапуска сервера игры из памяти потеряны — закрываем их в базе
    async closeStale() {
      const { count } = await prisma.room.updateMany({
        where: { status: { in: ['LOBBY', 'PLAYING'] } },
        data: { status: 'ABANDONED', finishedAt: new Date() },
      });
      return count;
    },

    disposeAll() {
      for (const room of rooms.values()) room.dispose();
      rooms.clear();
    },
  };
};

export type RoomManager = ReturnType<typeof createRoomManager>;
