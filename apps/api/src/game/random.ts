import { randomInt } from 'node:crypto';

export type Random = () => number; // как Math.random: [0, 1)

// Перемешивание Фишера–Йетса (возвращает новый массив)
export const shuffle = <T>(items: readonly T[], random: Random = Math.random): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
};

export const pickRandom = <T>(items: readonly T[], random: Random = Math.random): T | undefined =>
  items[Math.floor(random() * items.length)];

// Код комнаты для ссылки: без похожих символов (0/O, 1/l/I)
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
export const generateRoomCode = (length = 8) =>
  Array.from({ length }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
