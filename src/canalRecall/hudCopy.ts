// Words the canvas HUD draws, kept out of hud.js so they can be checked.
//
// Gameplay clarity review 2026-10-17: a bare "0 / 0 · 0 pts" on the plaque
// read as a mystery fraction. "named" says what the left number counts.

export interface TallyInput {
  correct: number;
  attempts: number;
  points: number;
  /** Points off (calm mode): the tally is the fraction alone. */
  gamey: boolean;
  /** Tight layouts (the merged phone plaque) drop the spaces. */
  compact?: boolean;
}

export function scoreTally({ correct, attempts, points, gamey, compact = false }: TallyInput): string {
  const fraction = compact ? `${correct}/${attempts} named` : `${correct} / ${attempts} named`;
  if (!gamey) return fraction;
  return compact ? `${fraction} · ${points} pts` : `${fraction}  ·  ${points} pts`;
}

/** The camera zoom flash. A lone "65%" read as a loading bar. */
export function zoomBadgeText(zoom: number): string {
  return `Zoom ${Math.round(zoom * 100)}%`;
}
