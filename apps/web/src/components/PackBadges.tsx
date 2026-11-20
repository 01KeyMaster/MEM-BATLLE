import type { PackDto } from '@meme/shared';

// Бейджи пака: «сверхсмешной», спонсор, цена/владение
export const PackBadges = ({ pack }: { pack: PackDto }) => (
  <div className="flex flex-wrap items-center gap-1.5 text-xs">
    {pack.owned ? (
      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-400">
        {pack.isBase ? 'бесплатный' : 'есть у тебя'}
      </span>
    ) : (
      <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-amber-300">⭐ {pack.priceStars}</span>
    )}
    {pack.tier === 'SUPER' && (
      <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-fuchsia-300">🔥 сверхсмешной</span>
    )}
    {pack.sponsor && (
      <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-hint">
        {pack.sponsor.logoUrl && <img src={pack.sponsor.logoUrl} alt="" className="size-3.5 rounded-full" />}
        при поддержке {pack.sponsor.name}
      </span>
    )}
  </div>
);
