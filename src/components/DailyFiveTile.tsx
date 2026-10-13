import React from 'react';
import { formatDay } from '../mapRecall/dailyFive';

/**
 * The start rail's "Daily five": today's date and the streak, or "Done today"
 * once finished (it is the same five all day, so it cannot be replayed).
 */
export const DailyFiveTile: React.FC<{
  today: string;
  streak: number;
  done: boolean;
  nearHome: boolean;
  onStart: () => void;
}> = ({ today, streak, done, nearHome, onStart }) => {
  const where = nearHome ? 'near home' : 'near the centre';
  return <button
    type="button"
    data-testid="daily-five"
    data-done={done ? 'yes' : 'no'}
    aria-disabled={done}
    onClick={done ? undefined : onStart}
    className="qf-daily-tile enamel-tile flex w-full items-center gap-3 px-3.5 py-3 text-left cursor-pointer"
  >
    <span className="text-xl text-[#8a4a18]" aria-hidden>✦</span>
    <span className="min-w-0 flex-1">
      <span className="enamel-brand block text-lg text-white">Daily five</span>
      <span className="block text-xs text-white/65 mt-0.5">
        {done ? <>Done today · streak {streak}</> : <>{formatDay(today)} · five mixed places {where}</>}
      </span>
    </span>
    {!done && streak > 0 && <span data-testid="daily-streak" className="enamel-chip shrink-0 px-2 py-0.5 text-xs font-bold whitespace-nowrap">Streak {streak}</span>}
  </button>;
};
