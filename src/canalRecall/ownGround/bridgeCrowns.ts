// Pinned deck crowns (pure data), shared by test:own-ground and the bridge-fidelity e2e.
// `crownM` is the height of the highest deck-profile station over the higher of the two approach-end relief
// heights (DeckSurface.ends), in metres, as the streamed cells build it (read 2026-10-14). `tolM` is the allowed drift.
export interface PinnedCrown { crownM: number; tolM: number }

export const CROWN_TOL_M = 0.05;

export const PINNED_CROWNS: Readonly<Record<string, PinnedCrown>> = {
  // The Seven Bridges down the Reguliersgracht
  BRU0031: { crownM: 2.14, tolM: CROWN_TOL_M },
  BRU0032: { crownM: 2.02, tolM: CROWN_TOL_M },
  BRU0039: { crownM: 1.70, tolM: CROWN_TOL_M },
  BRU0074: { crownM: 1.79, tolM: CROWN_TOL_M },
  BRU0073: { crownM: 1.30, tolM: CROWN_TOL_M },
  BRU0072: { crownM: 1.50, tolM: CROWN_TOL_M },
  // Side views
  BRU0009: { crownM: 1.66, tolM: CROWN_TOL_M }, // Torensluis
  BRU0038: { crownM: 1.61, tolM: CROWN_TOL_M },
};

/** Crown over the higher approach end from a deck's surface heights at its profile stations. */
export function crownOverHigherEnd(stationHeights: ArrayLike<number>, ends: readonly [number, number]): number {
  let crown = -Infinity;
  for (let i = 0; i < stationHeights.length; i++) crown = Math.max(crown, stationHeights[i]);
  return crown - Math.max(ends[0], ends[1]);
}
