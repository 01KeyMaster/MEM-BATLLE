// Что есть у игрока: паки, карты, колода. Источник правды — только база.
import type { Prisma, PrismaClient } from '@meme/db';
import type { DeckDto, MemeCardDto, PackDto } from '@meme/shared';
import { fillDeck } from '@meme/shared';

const cardWithPack = { pack: true } satisfies Prisma.CardInclude;
type CardWithPack = Prisma.CardGetPayload<{ include: typeof cardWithPack }>;

export const toMemeCardDto = (card: CardWithPack): MemeCardDto => ({
  id: card.id,
  imageUrl: card.imageUrl,
  text: card.text,
  rarity: card.rarity,
  pack: {
    id: card.pack.id,
    title: card.pack.title,
    iconUrl: card.pack.iconUrl,
    isPaid: card.pack.priceStars > 0,
  },
});

// Карты подходят для игры, только если активны и карта, и её пак
const playableMeme = {
  type: 'MEME',
  isActive: true,
  pack: { isActive: true },
} satisfies Prisma.CardWhereInput;

export const createCollectionService = (prisma: PrismaClient) => {
  // id паков, которые принадлежат игроку (базовые — у всех)
  const ownedPackIds = async (userId: string) => {
    const [base, bought] = await Promise.all([
      prisma.pack.findMany({ where: { isBase: true, isActive: true }, select: { id: true } }),
      prisma.userPack.findMany({ where: { userId }, select: { packId: true } }),
    ]);
    // TODO этап 9: добавить сезонные паки по активному пропуску
    return new Set([...base.map((p) => p.id), ...bought.map((p) => p.packId)]);
  };

  // Все мем-карты, которые игрок может положить в колоду
  const availableMemes = async (userId: string) => {
    const packIds = [...(await ownedPackIds(userId))];
    return prisma.card.findMany({
      where: {
        ...playableMeme,
        OR: [
          { packId: { in: packIds } },
          { owners: { some: { userId } } }, // отдельные карты (рефералка и т.п.)
        ],
      },
      include: cardWithPack,
      orderBy: [{ pack: { sortOrder: 'asc' } }, { id: 'asc' }],
    });
  };

  const baseMemeIds = async () => {
    const cards = await prisma.card.findMany({
      where: { ...playableMeme, pack: { isActive: true, isBase: true } },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    return cards.map((c) => c.id);
  };

  const listPacks = async (userId: string): Promise<PackDto[]> => {
    const owned = await ownedPackIds(userId);
    const packs = await prisma.pack.findMany({
      where: { isActive: true },
      include: {
        cards: { where: { isActive: true }, orderBy: { id: 'asc' } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return packs.map((pack) => ({
      id: pack.id,
      slug: pack.slug,
      title: pack.title,
      description: pack.description,
      iconUrl: pack.iconUrl,
      priceStars: pack.priceStars,
      tier: pack.tier,
      isBase: pack.isBase,
      owned: owned.has(pack.id),
      sponsor: pack.sponsorName
        ? { name: pack.sponsorName, logoUrl: pack.sponsorLogoUrl, url: pack.sponsorUrl }
        : null,
      memes: pack.cards
        .filter((c) => c.type === 'MEME')
        .map((c) => toMemeCardDto({ ...c, pack })),
      situationsCount: pack.cards.filter((c) => c.type === 'SITUATION').length,
    }));
  };

  const getDeck = async (userId: string): Promise<DeckDto> => {
    const [deck, available, baseIds] = await Promise.all([
      prisma.deck.findUnique({
        where: { userId },
        include: { cards: { orderBy: { position: 'asc' } } },
      }),
      availableMemes(userId),
      baseMemeIds(),
    ]);

    const chosenIds = deck?.cards.map((c) => c.cardId) ?? [];
    const byId = new Map(available.map((c) => [c.id, c]));
    const filled = fillDeck(chosenIds, new Set(byId.keys()), baseIds);

    return {
      chosenIds: chosenIds.filter((id) => byId.has(id)),
      cards: filled.finalIds.map((id) => toMemeCardDto(byId.get(id)!)),
      autoFilledIds: filled.autoFilledIds,
    };
  };

  const saveDeck = async (userId: string, cardIds: string[]) => {
    const available = new Set((await availableMemes(userId)).map((c) => c.id));
    const foreign = cardIds.filter((id) => !available.has(id));
    if (foreign.length > 0) {
      return { ok: false as const, error: 'В колоде есть карты, которых у тебя нет' };
    }

    // Перезаписываем колоду целиком в одной транзакции
    await prisma.$transaction(async (tx) => {
      const deck = await tx.deck.upsert({ where: { userId }, update: {}, create: { userId } });
      await tx.deckCard.deleteMany({ where: { deckId: deck.id } });
      await tx.deckCard.createMany({
        data: cardIds.map((cardId, position) => ({ deckId: deck.id, cardId, position })),
      });
      await tx.deck.update({ where: { id: deck.id }, data: { updatedAt: new Date() } });
    });
    return { ok: true as const };
  };

  return { ownedPackIds, availableMemes, listPacks, getDeck, saveDeck };
};

export type CollectionService = ReturnType<typeof createCollectionService>;
