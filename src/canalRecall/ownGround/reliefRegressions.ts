// Named relief regressions for the own ground (pure; used by scripts/own-ground/check-ground-cells.ts).
//
// The ground-height field must stay level where the street is level: the 2 m AHN field once drew Stationsplein's
// metro and bike-garage stairwells as 3–4 m craters in the paving, the bike-garage works as a sunken block, and
// the fill under Centraal's glass roofs rose 4 m toward the viaduct's track bed beside the IJ-side road (issue #53).
// A spot samples the relief on a 1 m grid within `radiusM` and bounds the 2–98 % height spread (before the fix:
// 2.11, 1.57 and 3.20 m; after: 0.44, 0.76 and 1.17 m, the last the real step from the quay up to the hall).
// Issue #57: the passage under the rail viaduct west of Centraal (railViaducts.ts) was a saddle 3.7 m over the street
// (spread 1.00 m, the walls' 4 m step gone: −0.01 and 0.02 m); after: 0.07 m, steps 4.98 and 4.99 m.

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
  // Issue #57: the Droogbak - De Ruijterkade passage under the rail viaduct west of Centraal (railViaducts.ts), filled
  // from the track bed into a saddle the road climbed over.
  { id: 'centraal-west-viaduct-floor', label: 'Centraal west: the road and channel under the rail viaduct over the Droogbak passage (was a saddle up toward the track bed)', at: [4.89611, 52.38046], radiusM: 15, maxSpreadM: 0.5 },
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

/**
 * A wall the relief must keep: the ground `lowAt` stays at least `minDropM` under the ground `highAt` (issue #57: the
 * passage floor under the viaduct against the track bed behind the abutment block).
 */
export interface ReliefStep { id: string; label: string; lowAt: [number, number]; highAt: [number, number]; minDropM: number }

export const RELIEF_STEPS: readonly ReliefStep[] = [
  { id: 'centraal-west-viaduct-west-wall', label: 'Centraal west: the passage floor 3 m inside the west abutment, against the track bed 30 m behind it', lowAt: [4.8957157, 52.3806077], highAt: [4.8952942, 52.3807559], minDropM: 4 },
  { id: 'centraal-west-viaduct-east-wall', label: 'Centraal west: the passage floor 3 m inside the east abutment, against the platforms 30 m behind it', lowAt: [4.8965009, 52.3803143], highAt: [4.896917, 52.3801605], minDropM: 4 },
];
