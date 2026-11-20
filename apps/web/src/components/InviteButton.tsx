import { useState } from 'react';
import { shareRoom } from '../lib/invite.ts';
import { haptic } from '../lib/telegram.ts';

type Props = { code: string; compact?: boolean };

// «Позвать друзей» — главная кнопка роста, показываем её везде, где уместно
export const InviteButton = ({ code, compact }: Props) => {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    haptic('medium');
    const result = await shareRoom(code);
    if (result === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={onClick}
      className={`rounded-2xl bg-emerald-500 font-semibold text-white transition active:scale-95 ${compact ? 'px-3 py-2 text-sm' : 'w-full py-4 text-lg'}`}
    >
      {copied ? '✅ Ссылка скопирована' : '📨 Позвать друзей'}
    </button>
  );
};
