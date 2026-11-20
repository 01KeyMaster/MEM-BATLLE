// Импорт твоих паков из папки content/packs в базу.
// Запуск: pnpm content:import            — все паки
//         pnpm content:import office     — один пак (по имени папки)
//
// Структура пака:
//   content/packs/<slug>/pack.json       — описание пака и список мемов
//   content/packs/<slug>/situations.txt  — ситуации, по одной на строку (# — комментарий)
//   content/packs/<slug>/memes/*.webp    — картинки (webp/png/jpg/svg, до 1 МБ)
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';
import { createPrisma } from '../src/index.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
config({ path: path.join(ROOT, '.env'), quiet: true });

const CONTENT_DIR = path.resolve(ROOT, process.env.CONTENT_DIR ?? 'content');
const UPLOADS_DIR = path.resolve(ROOT, process.env.UPLOADS_DIR ?? 'uploads');
const MAX_IMAGE_BYTES = 1024 * 1024;
const IMAGE_EXT = new Set(['.webp', '.png', '.jpg', '.jpeg', '.svg']);

// ── Формат pack.json ─────────────────────────────────────────

const LicenseFields = {
  source: z.string().min(1, 'укажи source — откуда картинка'),
  license: z.string().min(1, 'укажи license'),
  author: z.string().optional(),
};

const PackFileSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  priceStars: z.number().int().min(0).default(0),
  tier: z.enum(['STANDARD', 'SUPER']).default('STANDARD'),
  isBase: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(100),
  iconFile: z.string().optional(),
  sponsor: z
    .object({ name: z.string().min(1), logoFile: z.string().optional(), url: z.string().url().optional() })
    .optional(),
  // Значения по умолчанию для всех мемов пака (можно переопределить у каждого)
  defaults: z.object(LicenseFields).partial().default({}),
  memes: z
    .array(
      z.object({
        file: z.string().min(1),
        text: z.string().optional(),
        rarity: z.enum(['COMMON', 'RARE', 'LEGENDARY']).default('COMMON'),
        ...z.object(LicenseFields).partial().shape,
      }),
    )
    .default([]),
});

// ── Помощники ────────────────────────────────────────────────

const prisma = createPrisma();
const errors: string[] = [];
const fail = (pack: string, msg: string) => errors.push(`[${pack}] ${msg}`);

const shortHash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 10);

// Копирует картинку в uploads и возвращает публичный URL
const publishImage = async (slug: string, srcPath: string, label: string) => {
  const ext = path.extname(srcPath).toLowerCase();
  if (!IMAGE_EXT.has(ext)) {
    fail(slug, `${label}: формат ${ext} не поддерживается (нужен webp/png/jpg/svg)`);
    return null;
  }
  if (!existsSync(srcPath)) {
    fail(slug, `${label}: файл не найден ${path.relative(ROOT, srcPath)}`);
    return null;
  }
  const { size } = await stat(srcPath);
  if (size > MAX_IMAGE_BYTES) {
    fail(slug, `${label}: файл ${(size / 1024 / 1024).toFixed(1)} МБ, максимум 1 МБ — сожми его`);
    return null;
  }
  const destDir = path.join(UPLOADS_DIR, 'cards', slug);
  await mkdir(destDir, { recursive: true });
  const fileName = path.basename(srcPath);
  await copyFile(srcPath, path.join(destDir, fileName));
  return `/uploads/cards/${slug}/${fileName}`;
};

// ── Импорт одного пака ──────────────────────────────────────

const importPack = async (slug: string) => {
  const dir = path.join(CONTENT_DIR, 'packs', slug);
  if (!/^[a-z0-9-]+$/.test(slug)) {
    fail(slug, 'имя папки — только маленькие латинские буквы, цифры и дефис');
    return;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path.join(dir, 'pack.json'), 'utf8'));
  } catch (err) {
    fail(slug, `не читается pack.json: ${err instanceof Error ? err.message : err}`);
    return;
  }
  const parsed = PackFileSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) fail(slug, `pack.json → ${issue.path.join('.')}: ${issue.message}`);
    return;
  }
  const data = parsed.data;
  const errorsBefore = errors.length;

  // Ситуации
  const situationsPath = path.join(dir, 'situations.txt');
  const situations = existsSync(situationsPath)
    ? (await readFile(situationsPath, 'utf8'))
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
    : [];
  for (const s of situations) if (s.length > 200) fail(slug, `ситуация длиннее 200 символов: «${s.slice(0, 40)}…»`);

  // Картинки
  const iconUrl = data.iconFile ? await publishImage(slug, path.join(dir, data.iconFile), 'иконка') : null;
  const sponsorLogoUrl = data.sponsor?.logoFile
    ? await publishImage(slug, path.join(dir, data.sponsor.logoFile), 'логотип спонсора')
    : null;

  type MemeEntry = (typeof data.memes)[number] & {
    source: string;
    license: string;
    author?: string;
    imageUrl: string | null;
  };
  const memes: MemeEntry[] = [];
  const seenFiles = new Set<string>();
  for (const m of data.memes) {
    if (seenFiles.has(m.file)) fail(slug, `мем ${m.file} указан дважды`);
    seenFiles.add(m.file);
    const source = m.source ?? data.defaults.source;
    const license = m.license ?? data.defaults.license;
    if (!source || !license) fail(slug, `мем ${m.file}: нет source/license (укажи у мема или в defaults)`);
    const imageUrl = await publishImage(slug, path.join(dir, 'memes', m.file), `мем ${m.file}`);
    memes.push({ ...m, source: source ?? '', license: license ?? '', author: m.author ?? data.defaults.author, imageUrl });
  }

  // Проверка: есть ли в папке memes картинки, которые забыли описать
  const memesDir = path.join(dir, 'memes');
  if (existsSync(memesDir)) {
    for (const f of await readdir(memesDir)) {
      if (IMAGE_EXT.has(path.extname(f).toLowerCase()) && !seenFiles.has(f)) {
        console.warn(`⚠️  [${slug}] картинка ${f} лежит в memes/, но не описана в pack.json — пропущена`);
      }
    }
  }

  if (errors.length > errorsBefore) return; // в этом паке ошибки — в базу не пишем

  const packData = {
    title: data.title,
    description: data.description,
    priceStars: data.priceStars,
    tier: data.tier,
    isBase: data.isBase,
    isActive: data.isActive,
    sortOrder: data.sortOrder,
    iconUrl,
    sponsorName: data.sponsor?.name ?? null,
    sponsorLogoUrl,
    sponsorUrl: data.sponsor?.url ?? null,
  };

  await prisma.$transaction(async (tx) => {
    const pack = await tx.pack.upsert({ where: { slug }, update: packData, create: { slug, ...packData } });

    const cards = [
      ...memes.map((m) => ({
        id: `${slug}--${path.parse(m.file).name}`,
        type: 'MEME' as const,
        text: m.text ?? null,
        rarity: m.rarity,
        imageUrl: m.imageUrl,
        source: m.source,
        license: m.license,
        author: m.author ?? null,
      })),
      ...situations.map((text) => ({
        id: `${slug}--sit-${shortHash(text)}`,
        type: 'SITUATION' as const,
        text,
        rarity: 'COMMON' as const,
        imageUrl: null,
        source: 'текст автора',
        license: 'own',
        author: null,
      })),
    ];

    for (const card of cards) {
      const fields = { ...card, packId: pack.id, isActive: true };
      await tx.card.upsert({ where: { id: card.id }, update: fields, create: fields });
    }

    // Карты, которые убрали из папки, не удаляем (они есть в истории игр), а выключаем
    const { count } = await tx.card.updateMany({
      where: { packId: pack.id, id: { notIn: cards.map((c) => c.id) }, isActive: true },
      data: { isActive: false },
    });

    console.log(
      `✅ ${slug}: «${data.title}» — мемов ${memes.length}, ситуаций ${situations.length}` +
        (count ? `, выключено старых карт ${count}` : ''),
    );
  });
};

// ── Запуск ──────────────────────────────────────────────────

const main = async () => {
  const packsDir = path.join(CONTENT_DIR, 'packs');
  if (!existsSync(packsDir)) {
    console.error(`❌ Нет папки ${path.relative(ROOT, packsDir)}. Пример: content-example/packs`);
    process.exit(1);
  }
  const only = process.argv[2];
  const slugs = only
    ? [only]
    : (await readdir(packsDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);

  for (const slug of slugs) await importPack(slug);

  if (errors.length) {
    console.error('\n❌ Ошибки (эти паки не загружены):');
    for (const e of errors) console.error('   ' + e);
    process.exitCode = 1;
  }
};

main().finally(() => prisma.$disconnect());
