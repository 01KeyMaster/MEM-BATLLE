// Seed: базовый бесплатный пак + демо-платный пак с картинками-заглушками.
// Запуск: pnpm db:seed. Можно запускать повторно — данные обновятся, а не задублируются.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from 'dotenv';
import { GAME } from '@meme/shared';
import { createPrisma, CardType, Rarity, PackTier } from '../src/index.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
config({ path: path.join(ROOT, '.env'), quiet: true });

const prisma = createPrisma();
const UPLOADS_DIR = path.resolve(ROOT, process.env.UPLOADS_DIR ?? 'uploads');

// ── Тексты-заглушки ──────────────────────────────────────────

const BASE_MEMES = [
  'Кот в шоке', 'Это фиаско, братан', 'Спокойствие, только спокойствие',
  'Я у мамы молодец', 'Ну всё, приехали', 'Делаю вид, что работаю',
  'Внутренний голос: не надо', 'Профессионал своего дела', 'Это было неожиданно',
  'Сижу, никого не трогаю', 'План был идеален', 'Ожидание / реальность',
  'Сделал всё, что мог', 'Когда понял, что пятница', 'Подозрительно тихо',
  'Ой, всё', 'Гениально, но зачем', 'Время пить чай',
  'Утро понедельника', 'Мой мозг в 3 часа ночи', 'Я сам в шоке',
  'Хьюстон, у нас проблемы', 'Без комментариев', 'Держу в курсе',
  'Так и задумано', 'Король вечеринки', 'Мне норм',
  'Тот самый взгляд', 'Ладно, сдаюсь', 'Всё под контролем',
];

const BASE_SITUATIONS = [
  'Когда сказал маме, что уже вышел, а сам ещё в душе',
  'Когда учитель говорит: «Это будет на контрольной»',
  'Когда открыл холодильник в пятый раз за час',
  'Когда друг говорит: «Я буду через 5 минут»',
  'Когда случайно лайкнул фото трёхлетней давности',
  'Когда проснулся за минуту до будильника',
  'Когда курьер звонит, а ты в наушниках',
  'Когда код заработал, и ты не знаешь почему',
  'Когда пришёл на работу, а сегодня выходной',
  'Когда в группе пишут «срочно все сюда»',
  'Когда зарплата пришла и тут же ушла',
  'Когда кто-то ест твою еду из общего холодильника',
  'Когда скачал приложение ради одной скидки',
  'Когда сказал «я на диете» и увидел пиццу',
  'Когда ищешь телефон с телефоном в руке',
  'Когда сосед начинает ремонт в 8 утра в субботу',
  'Когда открыл тетрадь за 5 минут до экзамена',
  'Когда забыл, зачем зашёл в комнату',
  'Когда интернет пропал на самом интересном месте',
  'Когда тебе ответили «ок.» с точкой',
  'Когда вспомнил неловкий момент из 2015 года',
  'Когда бабушка спрашивает, почему ты такой худой',
  'Когда начальник пишет «есть минутка?»',
  'Когда дедлайн завтра, а ты только открыл файл',
  'Когда в магазине сказали «касса свободна»',
  'Когда кот смотрит на тебя в 4 утра',
  'Когда ты единственный, кто сделал домашку',
  'Когда автобус уехал прямо перед тобой',
  'Когда друг включил свою музыку в машине',
  'Когда обновление телефона длится 2 часа',
  'Когда в чате прочитали, но не ответили',
  'Когда пришёл в гости, а там все незнакомые',
  'Когда случайно включил фронтальную камеру',
  'Когда официант говорит «приятного аппетита», а ты «и вам»',
  'Когда выиграл спор с самим собой',
  'Когда на фото все красивые, кроме тебя',
  'Когда мама нашла твой дневник',
  'Когда отпуск закончился, а ты не отдохнул',
  'Когда в 23:59 вспомнил про задание',
  'Когда тебя добавили в чат «Родители класса»',
];

const DEMO_MEMES: { text: string; rarity: Rarity }[] = [
  { text: 'Созвон, который мог быть письмом', rarity: Rarity.COMMON },
  { text: 'Ответь всем', rarity: Rarity.COMMON },
  { text: 'Кофе номер пять', rarity: Rarity.COMMON },
  { text: 'Принтер снова сломался', rarity: Rarity.COMMON },
  { text: 'Пятничный деплой', rarity: Rarity.RARE },
  { text: 'Отпуск одобрен', rarity: Rarity.RARE },
  { text: 'Босс в отпуске', rarity: Rarity.LEGENDARY },
];

const DEMO_SITUATIONS = [
  'Когда совещание продлили ещё на час',
  'Когда коллега жарит рыбу в офисной микроволновке',
];

// ── Генерация SVG-заглушек ──────────────────────────────────

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

// Разбиваем подпись на строки по ~14 символов, чтобы влезла в карточку
const wrap = (text: string, max = 14) => {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if ((line + ' ' + word).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
};

const placeholderSvg = (text: string, index: number) => {
  const hue = (index * 47) % 360; // у каждой карты свой цвет
  const lines = wrap(text)
    .map((l, i) => `<tspan x="200" dy="${i === 0 ? 0 : 44}">${escapeXml(l)}</tspan>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
  <rect width="400" height="500" rx="24" fill="hsl(${hue},70%,45%)"/>
  <circle cx="200" cy="170" r="90" fill="hsl(${hue},70%,65%)"/>
  <text x="200" y="195" font-size="80" text-anchor="middle" fill="#fff" font-family="sans-serif">?</text>
  <text x="200" y="340" font-size="34" font-weight="700" text-anchor="middle" fill="#fff" font-family="sans-serif">${lines}</text>
</svg>`;
};

// Пишет SVG в uploads и возвращает URL, по которому его будет отдавать API
const writePlaceholder = async (packSlug: string, file: string, text: string, index: number) => {
  const dir = path.join(UPLOADS_DIR, 'cards', packSlug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, file), placeholderSvg(text, index));
  return `/uploads/cards/${packSlug}/${file}`;
};

// ── Заполнение базы ─────────────────────────────────────────

type CardSeed = {
  id: string;
  type: CardType;
  text: string;
  rarity?: Rarity;
  imageUrl?: string;
};

const upsertPack = async (
  pack: { slug: string; title: string; description: string; priceStars: number; tier: PackTier; isBase: boolean; sortOrder: number },
  cards: CardSeed[],
) => {
  const saved = await prisma.pack.upsert({
    where: { slug: pack.slug },
    update: pack,
    create: pack,
  });

  for (const card of cards) {
    const data = {
      packId: saved.id,
      type: card.type,
      text: card.text,
      rarity: card.rarity ?? Rarity.COMMON,
      imageUrl: card.imageUrl ?? null,
      source: 'Заглушка, сгенерирована seed-скриптом',
      license: 'own',
    };
    await prisma.card.upsert({ where: { id: card.id }, update: data, create: { id: card.id, ...data } });
  }
  return saved;
};

const pad = (n: number) => String(n + 1).padStart(2, '0');

const main = async () => {
  if (BASE_MEMES.length < GAME.DECK_SIZE) {
    throw new Error(`В базовом паке должно быть минимум ${GAME.DECK_SIZE} мем-карт`);
  }

  // Базовый пак
  const baseCards: CardSeed[] = [];
  for (const [i, text] of BASE_MEMES.entries()) {
    baseCards.push({
      id: `base-meme-${pad(i)}`,
      type: CardType.MEME,
      text,
      imageUrl: await writePlaceholder('base', `meme-${pad(i)}.svg`, text, i),
    });
  }
  BASE_SITUATIONS.forEach((text, i) =>
    baseCards.push({ id: `base-sit-${pad(i)}`, type: CardType.SITUATION, text }),
  );

  await upsertPack(
    { slug: 'base', title: 'Базовый', description: 'Бесплатный пак, есть у всех', priceStars: 0, tier: PackTier.STANDARD, isBase: true, sortOrder: 0 },
    baseCards,
  );

  // Демо-платный пак — пригодится на этапе магазина
  const demoCards: CardSeed[] = [];
  for (const [i, m] of DEMO_MEMES.entries()) {
    demoCards.push({
      id: `office-meme-${pad(i)}`,
      type: CardType.MEME,
      text: m.text,
      rarity: m.rarity,
      imageUrl: await writePlaceholder('office', `meme-${pad(i)}.svg`, m.text, i + 100),
    });
  }
  DEMO_SITUATIONS.forEach((text, i) =>
    demoCards.push({ id: `office-sit-${pad(i)}`, type: CardType.SITUATION, text }),
  );

  await upsertPack(
    { slug: 'office', title: 'Офисные будни', description: 'Демо-пак для теста магазина', priceStars: 50, tier: PackTier.STANDARD, isBase: false, sortOrder: 10 },
    demoCards,
  );

  const [packs, memes, situations] = await Promise.all([
    prisma.pack.count(),
    prisma.card.count({ where: { type: CardType.MEME } }),
    prisma.card.count({ where: { type: CardType.SITUATION } }),
  ]);
  console.log(`✅ Seed готов: паков ${packs}, мем-карт ${memes}, ситуаций ${situations}`);
  console.log(`🖼  Картинки-заглушки: ${UPLOADS_DIR}/cards`);
};

main()
  .catch((err) => {
    console.error('❌ Ошибка seed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
