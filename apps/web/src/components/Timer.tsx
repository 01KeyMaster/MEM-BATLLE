import { useEffect, useState } from 'react';

type Props = {
  deadline: number; // время сервера, мс
  clockOffset: number; // поправка на часы телефона
  total: number; // длительность фазы, сек — для полоски
};

// Обратный отсчёт с полоской. Время берём с сервера, а не считаем сами.
export const Timer = ({ deadline, clockOffset, total }: Props) => {
  const left = () => Math.max(0, Math.ceil((deadline - (Date.now() + clockOffset)) / 1000));
  const [seconds, setSeconds] = useState(left);

  useEffect(() => {
    setSeconds(left());
    const id = setInterval(() => setSeconds(left()), 250);
    return () => clearInterval(id);
  }, [deadline, clockOffset]);

  const percent = Math.min(100, (seconds / total) * 100);
  const urgent = seconds <= 5;

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-secondary">
        <div
          className={`h-full rounded-full transition-all duration-300 ${urgent ? 'bg-red-500' : 'bg-accent'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={`w-8 text-right font-mono font-bold ${urgent ? 'text-red-400' : ''}`}>{seconds}</span>
    </div>
  );
};
