// «Мои паки и колода»: сборка колоды из 24 карт + список паков.
import { useEffect, useMemo, useState } from 'react';
import { GAME, fillDeck, type DeckDto, type MemeCardDto, type PackDto } from '@meme/shared';
import { api } from '../lib/api.ts';
import { haptic, hapticNotify } from '../lib/telegram.ts';
import { MemeCard } from '../components/MemeCard.tsx';
import { PackBadges } from '../components/PackBadges.tsx';

type Tab = 'deck' | 'collection' | 'packs';

const tabs: { id: Tab; label: string }[] = [
  { id: 'deck', label: 'Колода' },
  { id: 'collection', label: 'Коллекция' },
  { id: 'packs', label: 'Паки' },
];

export const DeckScreen = () => {
  const [tab, setTab] = useState<Tab>('deck');
  const [packs, setPacks] = useState<PackDto[]>([]);
  const [collection, setCollection] = useState<MemeCardDto[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api<PackDto[]>('/packs'), api<MemeCardDto[]>('/collection'), api<DeckDto>('/deck')])
      .then(([p, c, d]) => {
        setPacks(p);
        setCollection(c);
        setSavedIds(d.chosenIds);
        setChosen(d.chosenIds);
      })
      .catch(() => setMessage('Не удалось загрузить карты'))
      .finally(() => setLoading(false));
  }, []);

  // Предпросмотр итоговой колоды — по тем же правилам, что и на сервере
  const preview = useMemo(() => {
    const byId = new Map(collection.map((c) => [c.id, c]));
    const baseIds = packs.filter((p) => p.isBase).flatMap((p) => p.memes.map((m) => m.id));
    const filled = fillDeck(chosen, new Set(byId.keys()), baseIds);
    return {
      cards: filled.finalIds.map((id) => byId.get(id)!).filter(Boolean),
      auto: new Set(filled.autoFilledIds),
    };
  }, [chosen, collection, packs]);

  const dirty = chosen.join() !== savedIds.join();
  const chosenSet = new Set(chosen);

  const toggle = (id: string) => {
    if (chosenSet.has(id)) {
      haptic('light');
      setChosen(chosen.filter((c) => c !== id));
      return;
    }
    if (chosen.length >= GAME.DECK_SIZE) {
      hapticNotify('warning');
      setMessage(`В колоде максимум ${GAME.DECK_SIZE} карт — сначала убери какую-нибудь`);
      return;
    }
    haptic('light');
    setMessage(null);
    setChosen([...chosen, id]);
  };

  const save = async () => {
    setSaving(true);
    try {
      const deck = await api<DeckDto>('/deck', { method: 'PUT', body: JSON.stringify({ cardIds: chosen }) });
      setSavedIds(deck.chosenIds);
      setChosen(deck.chosenIds);
      hapticNotify('success');
      setMessage('Колода сохранена ✅');
    } catch (err) {
      hapticNotify('error');
      setMessage(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  // Коллекция по пакам: { pack, cards }
  const groups = useMemo(() => {
    const map = new Map<string, { title: string; cards: MemeCardDto[] }>();
    for (const card of collection) {
      const group = map.get(card.pack.id) ?? { title: card.pack.title, cards: [] };
      group.cards.push(card);
      map.set(card.pack.id, group);
    }
    return [...map.values()];
  }, [collection]);

  if (loading) return <p className="p-6 text-center text-hint">Загрузка…</p>;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4 pb-28">
      <h1 className="text-2xl font-black">Мои паки и колода</h1>

      {/* Вкладки */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-bg-secondary p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg py-2 text-sm font-semibold transition ${tab === t.id ? 'bg-accent text-accent-text' : 'text-hint'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-hint">
        Выбрано <b className="text-text">{chosen.length}</b> из {GAME.DECK_SIZE}
        {chosen.length < GAME.DECK_SIZE && ` · ещё ${GAME.DECK_SIZE - chosen.length} добавятся из базового пака`}
      </p>

      {tab === 'deck' && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {preview.cards.map((card) => (
              <MemeCard
                key={card.id}
                card={card}
                corner={preview.auto.has(card.id) ? 'авто' : undefined}
                dimmed={preview.auto.has(card.id)}
                onClick={preview.auto.has(card.id) ? undefined : () => toggle(card.id)}
              />
            ))}
          </div>
          <p className="text-center text-xs text-hint">
            Нажми на карту, чтобы убрать её. Добавлять карты — во вкладке «Коллекция».
          </p>
        </>
      )}

      {tab === 'collection' &&
        groups.map((group) => (
          <section key={group.title} className="flex flex-col gap-2">
            <h2 className="font-bold">
              {group.title} <span className="text-sm font-normal text-hint">· {group.cards.length}</span>
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {group.cards.map((card) => (
                <MemeCard
                  key={card.id}
                  card={card}
                  selected={chosenSet.has(card.id)}
                  onClick={() => toggle(card.id)}
                />
              ))}
            </div>
          </section>
        ))}

      {tab === 'packs' &&
        packs.map((pack) => (
          <section key={pack.id} className="flex flex-col gap-2 rounded-2xl bg-bg-secondary p-3">
            <div className="flex items-center gap-2">
              {pack.iconUrl && <img src={pack.iconUrl} alt="" className="size-8 rounded-full" />}
              <div className="min-w-0">
                <h2 className="truncate font-bold">{pack.title}</h2>
                <p className="text-xs text-hint">
                  {pack.memes.length} мемов · {pack.situationsCount} ситуаций
                </p>
              </div>
            </div>
            {pack.description && <p className="text-sm text-hint">{pack.description}</p>}
            <PackBadges pack={pack} />
            {/* Всегда показываем, что внутри пака */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {pack.memes.map((card) => (
                <div key={card.id} className="w-20 shrink-0">
                  <MemeCard card={card} dimmed={!pack.owned} compact />
                </div>
              ))}
            </div>
            {!pack.owned && <p className="text-xs text-hint">Купить можно будет в магазине (этап 7)</p>}
          </section>
        ))}

      {message && (
        <p className="fixed inset-x-4 bottom-24 mx-auto max-w-md rounded-xl bg-black/80 p-3 text-center text-sm text-white">
          {message}
        </p>
      )}

      {dirty && (
        <div className="fixed inset-x-0 bottom-0 bg-bg/90 p-4 backdrop-blur">
          <button
            onClick={save}
            disabled={saving}
            className="mx-auto block w-full max-w-md rounded-2xl bg-accent py-4 text-lg font-semibold text-accent-text disabled:opacity-60"
          >
            {saving ? 'Сохраняю…' : 'Сохранить колоду'}
          </button>
        </div>
      )}
    </main>
  );
};
