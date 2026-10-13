import React from 'react';
import type { GameMode } from '../types';
import type { ReviewState } from '../spacedRepetition';
import { dueCount, knownCount } from '../mapRecall/progress';

/**
 * The start rail's progress summary: "Due today 7 · Known 42" for the current
 * mode, from the review store shared with Canal Recall.
 */
export const ProgressLine: React.FC<{
  states: readonly ReviewState[];
  mode: GameMode;
  cityId?: string;
  now?: number;
}> = ({ states, mode, cityId, now = Date.now() }) => {
  const due = dueCount(states, mode, now, cityId);
  const known = knownCount(states, mode, cityId);
  return <p data-testid="progress-line" className="text-xs text-white/65 text-center leading-relaxed">
    {!due && !known
      ? <>Nothing due · 0 known yet — start with canals</>
      : <>
        {due ? <>Due today <strong className="font-bold text-[#8a4a18]">{due}</strong></> : 'Nothing due'}
        {' · '}Known <strong className="font-bold text-white">{known}</strong>
      </>}
  </p>;
};
