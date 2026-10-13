import React from 'react';
import { formatDistance } from '../utils/geo';
import type { DistanceUnit } from '../types';

export type BonusPhase = 'offer' | 'active' | 'done' | 'skipped';

export interface BonusPinState {
  roundNumber: number;
  name: string;
  /** "the Concertgebouw". */
  label: string;
  center: [number, number];
  phase: BonusPhase;
  guess?: [number, number];
  distanceMeters?: number;
  points?: number;
}

/**
 * The answer card's bonus line, under the result: "Bonus · where is the
 * Concertgebouw?", then "Tap the map", then the distance and points. The answer
 * is already on the map, so asking about a nearby place spoils nothing. One
 * line in the card's header column, so the folded card stays as tall as it was.
 */
export const BonusPinPanel: React.FC<{
  bonus: BonusPinState | null;
  unit: DistanceUnit;
  onStart: () => void;
  onSkip: () => void;
}> = ({ bonus, unit, onStart, onSkip }) => {
  if (!bonus || bonus.phase === 'skipped') return null;
  const skip = <button type="button" onClick={onSkip} className="qf-bonus-skip text-white/55 hover:text-white cursor-pointer">Skip</button>;
  if (bonus.phase === 'offer') {
    return <div data-testid="bonus-pin" data-phase="offer" className="qf-bonus-line">
      <button type="button" onClick={onStart} className="qf-bonus-start cursor-pointer">
        <span className="font-bold text-[#8a4a18]">Bonus</span> · where is {bonus.label}?
      </button>
      {skip}
    </div>;
  }
  if (bonus.phase === 'active') {
    return <div data-testid="bonus-pin" data-phase="active" className="qf-bonus-line" role="status">
      <span className="font-semibold text-white"><span className="text-[#8a4a18]">Tap the map</span> where {bonus.label} is</span>
      {skip}
    </div>;
  }
  return <div data-testid="bonus-pin" data-phase="done" className="qf-bonus-line">
    <span className="font-bold text-[#8a4a18] whitespace-nowrap">Bonus <span data-testid="bonus-points">+{(bonus.points ?? 0).toLocaleString('en-US')}</span></span>
    <span className="text-white/75">{bonus.name} · off by {formatDistance(bonus.distanceMeters ?? 0, unit)}</span>
  </div>;
};
