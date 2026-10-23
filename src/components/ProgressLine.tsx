import React from 'react';
import type { GameMode } from '../types';
import type { ReviewState } from '../spacedRepetition';
import { dueCount, knownCount } from '../mapRecall/progress';
import { useT } from '../i18n/useT';

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
  const t = useT();
  const due = dueCount(states, mode, now, cityId);
  const known = knownCount(states, mode, cityId);
  return <p data-testid="progress-line" className="text-xs text-white/65 text-center leading-relaxed">
    {!due && !known
      ? <>{t('quiz.nothingDue')}</>
      : <>
        {due ? <>{t('quiz.dueTodayLabel')} <strong className="font-bold text-[#8a4a18]">{due}</strong></> : t('quiz.nothingDueShort')}
        {' · '}Known <strong className="font-bold text-white">{known}</strong>
      </>}
  </p>;
};
