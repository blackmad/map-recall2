// Surveyed ground over mapped water (pure): the plein bridges the water mask must not cut.
//
// User 2026-10-30 at the Muntplein ("what is happening with the roads here"): blue water patches showed through the
// klinker beside the Muntsluis. The Muntplein is one 60 m wide bridge over the Singel; BGT surveys it as ground road
// (relatieve hoogteligging 0, one partition with no water in it), the measured deck (BRU0001, bridges.json) is a 7 m
// strip, and elevation-v1's water polygon runs on under the whole plein. The road layers are cut by the water mask
// minus the decks (groundCell CUT_CHANNEL 1), so every road triangle over the Singel outside the 7 m strip was
// discarded and the canal showed through.
//
// Rule: a BGT ground polygon (h = 0, any class) whose interior lies over mapped water where the relief stands at street
// height above that water (AHN sees a deck, not a canal) is a deck: its ring joins the water mask's deck rings, so the
// mask never cuts it. Samples on a WET_STEP_M grid count only WET_INSET_M inside both the polygon and the water (the
// quay slivers where OSM water and BGT road disagree by a metre stay cut, as before), and only where the relief is
// WET_CLEAR_M over the water level (over open canal the smoothed relief stays within ~1.2 m of the water, at the
// Muntplein it is 2.6 m over it). WET_MIN_SAMPLES of them make the polygon a deck. Then the narrow polygons of the
// same plein (a fietspad, a kerb strip: too narrow for the inset) join where they lie over the water at street height
// within WET_NEAR_M of a deck found so (WET_NEAR_SAMPLES samples on a 1 m grid): the Muntplein's cycle path stayed cut.

import { decodeRoadLine, type RoadSurface } from './roadCells.js';
import type { Vec2 } from './surface.js';

export const WET_STEP_M = 2;
export const WET_INSET_M = 1.5;
export const WET_CLEAR_M = 2;
export const WET_MIN_SAMPLES = 3;
export const WET_NEAR_M = 3;
export const WET_NEAR_SAMPLES = 2;
export const WET_NEAR_ROUNDS = 4;

const inRing = (r: readonly Vec2[], x: number, y: number): boolean => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

export interface WetGroundInput {
  /** Inside a mapped water polygon. */
  wet: (x: number, y: number) => boolean;
  /** Relief (the land surface without decks). */
  ground: (x: number, y: number) => number;
  /** Water surface level there. */
  waterZ: (x: number, y: number) => number;
  /** Bounding box of the water polygons (polygons wholly outside it are skipped unsampled). */
  waterBox?: readonly [number, number, number, number] | null;
}

/** Outer rings of the ground polygons (h = 0) that stand over water as a deck (see the header). */
export function wetGroundRings(surfaces: readonly RoadSurface[], input: WetGroundInput): Vec2[][] {
  const out: Vec2[][] = [], wb = input.waterBox;
  if (wb === null) return out;
  for (const s of surfaces) {
    if (s.h !== 0 || !s.r.length) continue;
    const rings = s.r.map(decodeRoadLine), o = rings[0];
    if (o.length < 3) continue;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of o) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 - x0 < 2 * WET_INSET_M || y1 - y0 < 2 * WET_INSET_M) continue;
    if (wb && (x1 < wb[0] || x0 > wb[2] || y1 < wb[1] || y0 > wb[3])) continue;
    const inside = (x: number, y: number) => inRing(o, x, y) && !rings.slice(1).some(h => inRing(h, x, y));
    const deep = (x: number, y: number) => inside(x, y) && input.wet(x, y);
    let n = 0;
    for (let x = Math.ceil(x0 / WET_STEP_M) * WET_STEP_M; x <= x1 && n < WET_MIN_SAMPLES; x += WET_STEP_M) {
      for (let y = Math.ceil(y0 / WET_STEP_M) * WET_STEP_M; y <= y1 && n < WET_MIN_SAMPLES; y += WET_STEP_M) {
        if (!deep(x, y)) continue;
        const d = WET_INSET_M;
        if (!(deep(x + d, y) && deep(x - d, y) && deep(x, y + d) && deep(x, y - d))) continue;
        if (input.ground(x, y) - input.waterZ(x, y) >= WET_CLEAR_M) n++;
      }
    }
    if (n >= WET_MIN_SAMPLES) out.push(o);
  }
  if (!out.length) return out;
  // Then the plein's narrow polygons beside a deck found so far, repeated while it grows (a fietspad beside a kerb strip
  // beside the carriageway deck), at most WET_NEAR_ROUNDS times.
  const boxOf = (r: readonly Vec2[]) => r.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
  const decks = out.map(r => ({ r, box: boxOf(r) }));
  const nearDeck = (x: number, y: number) => decks.some(({ r, box }) => x >= box[0] - WET_NEAR_M && x <= box[2] + WET_NEAR_M && y >= box[1] - WET_NEAR_M && y <= box[3] + WET_NEAR_M
    && [[0, 0], [WET_NEAR_M, 0], [-WET_NEAR_M, 0], [0, WET_NEAR_M], [0, -WET_NEAR_M]].some(([dx, dy]) => inRing(r, x + dx, y + dy)));
  const rest = surfaces.filter(s => s.h === 0 && s.r.length).map(s => s.r.map(decodeRoadLine)).filter(rings => rings[0].length >= 3 && !out.some(f => f.length === rings[0].length && f[0][0] === rings[0][0][0] && f[0][1] === rings[0][0][1]));
  for (let round = 0; round < WET_NEAR_ROUNDS; round++) {
    let grew = false;
    for (let i = rest.length - 1; i >= 0; i--) {
      const rings = rest[i], o = rings[0], [x0, y0, x1, y1] = boxOf(o);
      if (!decks.some(({ box }) => !(x1 < box[0] - WET_NEAR_M || x0 > box[2] + WET_NEAR_M || y1 < box[1] - WET_NEAR_M || y0 > box[3] + WET_NEAR_M))) continue;
      let n = 0;
      for (let x = Math.ceil(x0); x <= x1 && n < WET_NEAR_SAMPLES; x++) for (let y = Math.ceil(y0); y <= y1 && n < WET_NEAR_SAMPLES; y++) {
        if (!inRing(o, x, y) || rings.slice(1).some(h => inRing(h, x, y)) || !input.wet(x, y)) continue;
        if (input.ground(x, y) - input.waterZ(x, y) >= WET_CLEAR_M && nearDeck(x, y)) n++;
      }
      if (n < WET_NEAR_SAMPLES) continue;
      out.push(o); decks.push({ r: o, box: boxOf(o) }); rest.splice(i, 1); grew = true;
    }
    if (!grew) break;
  }
  return out;
}
