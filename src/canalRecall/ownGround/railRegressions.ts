// Named railway-track regressions (pure; scripts/own-ground/check-ground-cells.ts railRegressions, ownGround.test.ts).
//
// Three player notes on build 04e3c88 (rideamsterdam.nl, 2026-10-30), lane rail-look 2026-10-31:
//   1. "train tracks buried by surface": Piet Heinkade by the Kattenburgerstraat. The beds faded in and out under the
//      land: a chord between stations 12 m (24 m far) apart over a 5 m (10 m) land grid that bulged between them.
//   2. "more bad train tracks": Piet Heinkade by Club Panama. A dark blotch across the tracks on the embankment's
//      flank, where the land rose across the bed (the bed stood level at its centreline's height) and drew over it.
//   3. "ooof, these rails look really bad": the Oostertoegang east of Centraal. Bridge decks as separate tilted slabs:
//      each bridge way rode the line between the relief at its own two ends, which the DTM fill smears under a deck.
//
// `buried`: what a camera straight above sees on the bed's top (centreline and 1.2 m either side, every metre along
// every track near the spot, where the rails-only raster draws the bed): the share where a ground fill (land, a park
// or square surface) wins. Streets (a level crossing) and other decks are not counted.
// `deckBreaks`: along every rail (not tram) bridge way near the spot and 4 m on past each end, the topmost ballast every metre: the
// largest step between neighbouring samples and the steepest 4 m slope.

import { GROUND_LAYERS, type BuiltCell, type GroundLayer } from './groundCell.js';
import { layerOfId, rasterLayerIds } from '../overviewTiles/raster.js';
import type { RailWay } from './railTracks.js';
import type { Vec2 } from './surface.js';

export interface RailSpot {
  id: string;
  label: string;
  /** The note, verbatim, and where it came from. */
  note: string;
  at: [number, number];
  radiusM: number;
  /** After the fix: largest buried share of the bed top (each LOD). */
  maxBuried: number;
  /** The pin is live: the build without railProfile.ts levels and floor buries at least this share (at LOD 1). */
  minBuriedBefore: number;
  /** Bridge decks (note 3): largest step between metre samples and steepest 4 m slope along the decks, after. */
  deck?: { maxStepM: number; maxSlope: number; /** The pin is live: the old build's steepest slope is at least this. */ minSlopeBefore: number };
}

export const RAIL_SPOTS: readonly RailSpot[] = [
  { id: 'rail-kattenburgerstraat', label: 'Piet Heinkade by the Kattenburgerstraat: the corridor east of the Dijksgracht', note: 'train tracks buried by surface (player, build 04e3c88, 2026-10-30)', at: [4.9195, 52.3762], radiusM: 110, maxBuried: 0.005, minBuriedBefore: 0.03 },
  { id: 'rail-club-panama', label: 'Piet Heinkade by Club Panama / Panamalaan: the tracks on the embankment flank', note: 'more bad train tracks (player, build 04e3c88, 2026-10-30)', at: [4.9302, 52.3743], radiusM: 110, maxBuried: 0.005, minBuriedBefore: 0.1 },
  { id: 'rail-oostertoegang', label: 'Oostertoegang east of Centraal: the rail bridges over the road and the Oosterdok mouth', note: 'ooof, these rails look really bad (player, build 04e3c88, 2026-10-30)', at: [4.9040, 52.3776], radiusM: 90, maxBuried: 0.005, minBuriedBefore: 0.08, deck: { maxStepM: 0.3, maxSlope: 0.08, minSlopeBefore: 0.2 } },
];

/** Ground fills that must never draw over a bed. */
export const RAIL_COVERS: ReadonlySet<GroundLayer> = new Set<GroundLayer>(['land', 'park', 'wood', 'square', 'parking', 'lawn', 'garden', 'bed', 'shrub', 'bark', 'sand', 'parkGravel', 'parkPath', 'hedge', 'pond']);

const RES = 0.25;

/** Points every `step` m along a polyline with the unit left normal there. */
function walk(pts: readonly Vec2[], step: number, f: (x: number, y: number, nx: number, ny: number, s: number) => void, extend = 0): void {
  let s = 0;
  const seg = (a: Vec2, b: Vec2, from: number, to: number) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    for (let t = from; t <= to; t += step) f(a[0] + dx / l * t, a[1] + dy / l * t, nx, ny, s + t);
  };
  if (extend > 0) { const a = pts[0], b = pts[1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; seg(a, b, -extend, -step / 2); void l; }
  for (let i = 0; i + 1 < pts.length; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg(pts[i], pts[i + 1], 0, l); s += l; }
  if (extend > 0) { const a = pts[pts.length - 2], b = pts[pts.length - 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg(a, b, l + step / 2, l + extend); }
}

/** Share of bed-top samples near `centre` where a ground fill wins over the ballast or rails. */
export function buriedShare(cells: readonly BuiltCell[], rails: readonly RailWay[], centre: Vec2, radiusM: number): { samples: number; buried: number; share: number } {
  const half = radiusM + 5, w = Math.round(2 * half / RES), x0 = centre[0] - half, y0 = centre[1] - half;
  const others = new Set<GroundLayer>(GROUND_LAYERS.filter(l => l !== 'ballast' && l !== 'track'));
  const railOnly = rasterLayerIds(cells, x0, y0, w, w, RES, others), all = rasterLayerIds(cells, x0, y0, w, w, RES);
  const at = (x: number, y: number) => { const px = Math.floor((x - x0) / RES), py = Math.floor((y0 + w * RES - y) / RES); return px >= 0 && py >= 0 && px < w && py < w ? py * w + px : -1; };
  let samples = 0, buried = 0;
  for (const r of rails) walk(r.points, 1, (x, y, nx, ny) => {
    if (Math.hypot(x - centre[0], y - centre[1]) > radiusM) return;
    for (const o of [-1.2, 0, 1.2]) {
      const k = at(x + nx * o, y + ny * o);
      if (k < 0 || !railOnly[k]) continue;
      samples++;
      if (RAIL_COVERS.has(layerOfId(all[k]) as GroundLayer)) buried++;
    }
  });
  return { samples, buried, share: samples ? buried / samples : 0 };
}

/** Topmost z of `layer` per raster texel (−∞: none). */
function zRaster(cells: readonly BuiltCell[], layer: GroundLayer, x0: number, y0: number, w: number, h: number): Float32Array {
  const z = new Float32Array(w * h).fill(-Infinity), top = y0 + h * RES;
  for (const cell of cells) {
    const m = cell.layers[layer];
    if (!m) continue;
    const p = m.positions, idx = m.indices;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ax = (p[a] - x0) / RES, ay = (top - p[a + 1]) / RES, bx = (p[b] - x0) / RES, by = (top - p[b + 1]) / RES, cx = (p[c] - x0) / RES, cy = (top - p[c + 1]) / RES;
      const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
      const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
      const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (minX > maxX || minY > maxY || Math.abs(d) < 1e-9) continue;
      for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
        const sx = px + 0.5, sy = py + 0.5, u = ((by - cy) * (sx - cx) + (cx - bx) * (sy - cy)) / d, v = ((cy - ay) * (sx - cx) + (ax - cx) * (sy - cy)) / d;
        if (u < 0 || v < 0 || u + v > 1) continue;
        const zz = u * p[a + 2] + v * p[b + 2] + (1 - u - v) * p[c + 2], i = py * w + px;
        if (zz > z[i]) z[i] = zz;
      }
    }
  }
  return z;
}

/** Along each bridge way near `centre` (and 4 m past its ends): the largest step and steepest 4 m slope of the bed top. */
export function deckBreaks(cells: readonly BuiltCell[], rails: readonly RailWay[], centre: Vec2, radiusM: number, trace?: (way: RailWay, zs: number[]) => void): { ways: number; maxStepM: number; maxSlope: number; worst: string } {
  const half = radiusM + 60, w = Math.round(2 * half / RES), x0 = centre[0] - half, y0 = centre[1] - half;
  const z = zRaster(cells, 'ballast', x0, y0, w, w);
  const at = (x: number, y: number) => { const px = Math.floor((x - x0) / RES), py = Math.floor((y0 + w * RES - y) / RES); return px >= 0 && py >= 0 && px < w && py < w ? z[py * w + px] : -Infinity; };
  let ways = 0, maxStepM = 0, maxSlope = 0, worst = '';
  for (const r of rails) {
    // A tram's own bed over a road bridge rides that bridge's measured deck (its hump): rail decks only.
    if (!r.bridge || r.kind === 'tram' || !r.points.some(p => Math.hypot(p[0] - centre[0], p[1] - centre[1]) < radiusM)) continue;
    ways++;
    const zs: number[] = [];
    walk(r.points, 1, (x, y) => { zs.push(at(x, y)); }, 4);
    trace?.(r, zs);
    for (let i = 1; i < zs.length; i++) {
      if (!Number.isFinite(zs[i]) || !Number.isFinite(zs[i - 1])) continue;
      const step = Math.abs(zs[i] - zs[i - 1]);
      if (step > maxStepM) { maxStepM = step; worst = `step ${step.toFixed(2)} m on the ${r.kind} bridge way from ${r.points[0].map(v => v.toFixed(0))}`; }
      if (i >= 4 && Number.isFinite(zs[i - 4])) { const sl = Math.abs(zs[i] - zs[i - 4]) / 4; if (sl > maxSlope) maxSlope = sl; }
    }
  }
  return { ways, maxStepM: +maxStepM.toFixed(2), maxSlope: +maxSlope.toFixed(3), worst };
}
