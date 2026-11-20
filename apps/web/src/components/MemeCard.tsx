import type { MemeCardDto, Rarity } from '@meme/shared';

// Рамка зависит от редкости карты
const frameByRarity: Record<Rarity, string> = {
  COMMON: 'ring-1 ring-white/15',
  RARE: 'ring-2 ring-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.45)]',
  LEGENDARY: 'ring-2 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.6)]',
};

const rarityLabel: Record<Rarity, string | null> = {
  COMMON: null,
  RARE: 'редкая',
  LEGENDARY: 'легендарная',
};

type Props = {
  card: MemeCardDto;
  selected?: boolean;
  dimmed?: boolean;
  corner?: string; // маленькая метка в углу, например «авто»
  compact?: boolean; // мелкое превью: от метки пака остаётся только иконка
  onClick?: () => void;
};

export const MemeCard = ({ card, selected, dimmed, corner, compact, onClick }: Props) => {
  const label = rarityLabel[card.rarity];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-bg-secondary text-left transition active:scale-95 ${frameByRarity[card.rarity]} ${dimmed ? 'opacity-40' : ''}`}
    >
      {card.imageUrl ? (
        <img src={card.imageUrl} alt={card.text ?? ''} loading="lazy" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center p-2 text-center text-sm">{card.text}</span>
      )}

      {label && (
        <span className="absolute left-1 top-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {label}
        </span>
      )}

      {corner && (
        <span className="absolute right-1 top-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          {corner}
        </span>
      )}

      {/* Метка платного пака — карта рекламирует свой пак */}
      {card.pack.isPaid && compact && card.pack.iconUrl && (
        <img src={card.pack.iconUrl} alt={card.pack.title} className="absolute bottom-1 right-1 size-4 rounded-full" />
      )}
      {card.pack.isPaid && !compact && (
        <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 truncate bg-black/65 px-1.5 py-1 text-[10px] text-white">
          {card.pack.iconUrl && <img src={card.pack.iconUrl} alt="" className="size-3.5 rounded-full" />}
          {card.pack.title}
        </span>
      )}

      {selected && (
        <span className="absolute inset-0 flex items-start justify-end rounded-xl ring-4 ring-inset ring-accent">
          <span className="m-1 flex size-6 items-center justify-center rounded-full bg-accent text-sm text-accent-text">
            ✓
          </span>
        </span>
      )}
    </button>
  );
};
