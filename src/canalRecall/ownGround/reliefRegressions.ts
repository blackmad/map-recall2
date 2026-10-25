// Named relief regressions for the own ground (pure; used by scripts/own-ground/check-ground-cells.ts).
//
// The ground-height field must stay level where the street is level: the 2 m AHN field once drew Stationsplein's
// metro and bike-garage stairwells as 3–4 m craters in the paving, the bike-garage works as a sunken block, and
// the fill under Centraal's glass roofs rose 4 m toward the viaduct's track bed beside the IJ-side road (issue #53).
// A spot samples the relief on a 1 m grid within `radiusM` and bounds the 2–98 % height spread (before the fix:
// 2.11, 1.57 and 3.20 m; after: 0.44, 0.76 and 1.17 m, the last the real step from the quay up to the hall).

export interface ReliefSpot {
  id: string;
  label: string;
  /** [lng, lat]. */
  at: [number, number];
  radiusM: number;
  /** Largest 2–98 % spread of the relief heights in the disc, metres. */
  maxSpreadM: number;
}

export const RELIEF_SPOTS: readonly ReliefSpot[] = [
  { id: 'stationsplein-stairwells', label: 'Stationsplein before Centraal: metro and bike-garage stairwells (were 3.7–4.5 m craters)', at: [4.8998, 52.3781], radiusM: 30, maxSpreadM: 0.8 },
  { id: 'stationsplein-west-works', label: 'Stationsplein west: the bike-garage works AHN flew over (staleRelief.ts, was a 2 m sunken block)', at: [4.899289, 52.378061], radiusM: 15, maxSpreadM: 1 },
  { id: 'ijzijde-busstation', label: 'Centraal IJ side, under the bus-station roof south of the Michiel de Ruijtertunnel ramp (the fill rose toward the track bed)', at: [4.8999, 52.3800], radiusM: 20, maxSpreadM: 1.5 },
];

/** 2 % and 98 % relief heights on a 1 m grid in a disc of the local frame, and their spread. */
export function reliefSpread(ground: (x: number, y: number) => number, centre: [number, number], radiusM: number): { p02: number; p98: number; spread: number; samples: number } {
  const z: number[] = [];
  for (let dy = -radiusM; dy <= radiusM; dy++) for (let dx = -radiusM; dx <= radiusM; dx++) if (dx * dx + dy * dy <= radiusM * radiusM) z.push(ground(centre[0] + dx, centre[1] + dy));
  z.sort((a, b) => a - b);
  const q = (f: number) => z[Math.floor(f * (z.length - 1))];
  return { p02: +q(0.02).toFixed(2), p98: +q(0.98).toFixed(2), spread: +(q(0.98) - q(0.02)).toFixed(2), samples: z.length };
}
