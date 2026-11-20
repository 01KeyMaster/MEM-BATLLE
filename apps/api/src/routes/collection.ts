import type { FastifyInstance } from 'fastify';
import { SaveDeckSchema } from '@meme/shared';
import { toMemeCardDto, type CollectionService } from '../services/collection.ts';

export const collectionRoutes = async (
  app: FastifyInstance,
  { collection }: { collection: CollectionService },
) => {
  // Все активные паки + отметка, какие уже есть у игрока
  app.get('/packs', async (request) => collection.listPacks(request.user.id));

  // Карты, из которых можно собрать колоду
  app.get('/collection', async (request) => {
    const cards = await collection.availableMemes(request.user.id);
    return cards.map(toMemeCardDto);
  });

  app.get('/deck', async (request) => collection.getDeck(request.user.id));

  app.put('/deck', async (request, reply) => {
    // Клиенту не доверяем: проверяем формат и принадлежность каждой карты
    const parsed = SaveDeckSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Неверные данные' });
    }
    const result = await collection.saveDeck(request.user.id, parsed.data.cardIds);
    if (!result.ok) return reply.code(400).send({ error: result.error });
    return collection.getDeck(request.user.id);
  });
};
