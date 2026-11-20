import { z } from 'zod';
import { GAME } from './constants.ts';

export const RaritySchema = z.enum(['COMMON', 'RARE', 'LEGENDARY']);
export type Rarity = z.infer<typeof RaritySchema>;

export const PackTierSchema = z.enum(['STANDARD', 'SUPER']);
export type PackTier = z.infer<typeof PackTierSchema>;

// Метка пака на карте (для платных паков — «реклама» пака)
export type PackLabel = {
  id: string;
  title: string;
  iconUrl: string | null;
  isPaid: boolean;
};

export type MemeCardDto = {
  id: string;
  imageUrl: string | null;
  text: string | null;
  rarity: Rarity;
  pack: PackLabel;
};

export type SponsorDto = {
  name: string;
  logoUrl: string | null;
  url: string | null;
};

export type PackDto = {
  id: string;
  slug: string;
  title: string;
  description: string;
  iconUrl: string | null;
  priceStars: number;
  tier: PackTier;
  isBase: boolean;
  owned: boolean;
  sponsor: SponsorDto | null;
  memes: MemeCardDto[]; // в магазине всегда видно, что внутри
  situationsCount: number;
};

// Колода, как её видит игрок
export type DeckDto = {
  chosenIds: string[];      // что игрок выбрал сам (может быть < 24)
  cards: MemeCardDto[];     // итоговые 24 карты для игры
  autoFilledIds: string[];  // какие из них добавлены из базового пака
};

// Сохранение колоды: уникальные id, не больше 24
export const SaveDeckSchema = z.object({
  cardIds: z
    .array(z.string().min(1).max(64))
    .max(GAME.DECK_SIZE, `Не больше ${GAME.DECK_SIZE} карт`)
    .refine((ids) => new Set(ids).size === ids.length, 'Карты в колоде не должны повторяться'),
});
export type SaveDeckInput = z.infer<typeof SaveDeckSchema>;
