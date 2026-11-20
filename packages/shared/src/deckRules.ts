// Чистые правила колоды — без базы, их легко тестировать.
import { GAME } from './constants.ts';

export type FilledDeck = {
  finalIds: string[];      // итоговые карты (ровно DECK_SIZE, если хватает базовых)
  autoFilledIds: string[]; // добавлены автоматически из базового пака
  droppedIds: string[];    // выбраны раньше, но больше недоступны (пак выключен и т.п.)
};

/**
 * Собирает итоговую колоду:
 * 1) оставляет выбранные карты, которые игроку всё ещё доступны;
 * 2) добирает до 24 картами базового пака, которых ещё нет в колоде.
 */
export const fillDeck = (
  chosenIds: string[],
  availableIds: ReadonlySet<string>,
  baseIds: string[],
  size: number = GAME.DECK_SIZE,
): FilledDeck => {
  const droppedIds = chosenIds.filter((id) => !availableIds.has(id));
  const kept = [...new Set(chosenIds.filter((id) => availableIds.has(id)))].slice(0, size);

  const inDeck = new Set(kept);
  const autoFilledIds = baseIds.filter((id) => !inDeck.has(id)).slice(0, size - kept.length);

  return { finalIds: [...kept, ...autoFilledIds], autoFilledIds, droppedIds };
};

// Карты, которые нельзя положить в колоду (не принадлежат игроку)
export const findForeignCards = (ids: string[], availableIds: ReadonlySet<string>) =>
  ids.filter((id) => !availableIds.has(id));
