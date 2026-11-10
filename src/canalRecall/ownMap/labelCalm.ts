// Label budget (#161 lever 3, `?labelCalm=1`, default off): a calmer chase-cam frame carries few names. After the
// placement has chosen its winners, POI labels are thinned to a budget; street, water and neighbourhood names (the
// geography the player is learning, already screened by labelPolicy.ts) are never touched. Nothing is added, so a name
// that labelPolicy withheld cannot come back through here.
//
//  - at most CALM_POI_MAX POI labels on screen, the ones nearest the corridor first (a screen-space proxy: the chase
//    camera looks along the rider's street, so the corridor is the centre column and the lower half);
//  - none in the top third of the frame (they sit on the far skyline);
//  - a shop or venue name only within CALM_SHOP_M (ground metres) of the rider, i.e. the camera target. Not eye depth: the chase camera sits 250-350 m from its target
//    (zoom 17.5, pitch 60), so every point is deeper than 150 m and an eye-depth rule removed every shop (the l3 zero-label run, 2026-11-10); a signature landmark (`landmark`) keeps its long reach.

import type { PlacedLabel } from './labels';

export const CALM_POI_MAX = 6;
export const CALM_SHOP_M = 150;
export const CALM_TOP_SHARE = 1 / 3;
/** Fewer than this many shop names on screen reads as empty: the nearest ones beyond the reach come back (never top third). */
export const CALM_POI_MIN = 3;

export interface CalmLabelInput {
  width: number;
  height: number;
  /** Ground distance from the rider (camera target) to the label's anchor, metres; null when unknown (kept). */
  distanceOf: (label: PlacedLabel) => number | null;
  /** Signature landmarks (reachable from far away). */
  isLandmark: (label: PlacedLabel) => boolean;
  /** The game's own point labels (the answered street, ferry landings): never thinned. */
  isGamePoint?: (label: PlacedLabel) => boolean;
  max?: number;
  /** Top up to this many shop names (and landmarks) from beyond the reach when the street is short of them. */
  min?: number;
  shopM?: number;
}

/** 0 on the corridor axis (centre column, bottom of the frame) rising toward the top corners. Lower wins. */
export function corridorDistance(x: number, y: number, width: number, height: number): number {
  return Math.abs(x - width / 2) / (width / 2) + 0.6 * (1 - y / height);
}

export function calmLabels(placed: readonly PlacedLabel[], input: CalmLabelInput): PlacedLabel[] {
  const max = input.max ?? CALM_POI_MAX, shopM = input.shopM ?? CALM_SHOP_M, min = Math.min(input.min ?? CALM_POI_MIN, max);
  const keep = new Set<PlacedLabel>();
  const pois: PlacedLabel[] = [], beyond: { l: PlacedLabel; d: number }[] = [];
  let landmarks = 0;
  for (const l of placed) {
    if (l.kind !== 'poi' || l.x === undefined || l.y === undefined || input.isGamePoint?.(l)) { keep.add(l); continue; }
    // Signature landmarks are the point of the ride: exempt from the top third, the reach and the cap (they are few).
    if (input.isLandmark(l)) { keep.add(l); landmarks++; continue; }
    if (l.y < input.height * CALM_TOP_SHARE) continue;
    const dist = input.distanceOf(l);
    if (dist !== null && dist > shopM) { beyond.push({ l, d: dist }); continue; }
    pois.push(l);
  }
  const byCorridor = (a: PlacedLabel, b: PlacedLabel) => corridorDistance(a.x!, a.y!, input.width, input.height) - corridorDistance(b.x!, b.y!, input.width, input.height) || (a.id < b.id ? -1 : 1);
  pois.sort(byCorridor);
  const shown = pois.slice(0, max);
  for (const l of shown) keep.add(l);
  // A street with one name on it reads as empty: top up to the minimum with the nearest shops beyond the reach.
  const missing = min - shown.length - landmarks;
  if (missing > 0) for (const { l } of beyond.sort((a, b) => a.d - b.d || (a.l.id < b.l.id ? -1 : 1)).slice(0, missing)) keep.add(l);
  return placed.filter(l => keep.has(l));
}

/** On by default since 2026-11-10 (chase-camera ride check, landmarks exempt, floor of 3); `?labelCalm=0` turns it off. */
export function labelCalmFlag(): boolean {
  const g = globalThis as { __canalRecallLabelCalm?: boolean | string; location?: { search?: string } };
  const asked = g.__canalRecallLabelCalm ?? (typeof URLSearchParams === 'function' ? new URLSearchParams(g.location?.search ?? '').get('labelCalm') : null);
  return !(asked === false || asked === '0' || asked === 'false' || asked === 'off');
}
