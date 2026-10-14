// Junction road markings for the own ground (pure): what the street graph
// says a Dutch junction paints, drawn as flat draped marks.
//
// User 2026-10-14 (Singelgracht / Nassaukade junction): "road painting in
// ownground still not there" — the cross-sections drew centre and edge lines,
// cycle-lane edges and zebras, but nothing *at* a junction: the painted cycle
// lanes stopped dead at its edge and no arm had a stop line or give-way
// teeth. The extract carries ways only (no node tags: no highway=give_way,
// stop or traffic_signals nodes), so the marks are read from the ways:
//
//   - signalised junction (a footway/cycleway crossing tagged
//     crossing=traffic_signals or crossing:signals=yes within SIGNAL_REACH_M
//     of the node): a stop line across each arm's inbound lanes, before its
//     crossing when one is mapped;
//   - otherwise an arm of a lower class than the junction's highest gives way:
//     haaientanden (shark teeth) across its inbound lanes, apex toward the
//     approaching driver (Amsterdam marks priority by class; equal classes
//     carry no marks: rechts voorrang);
//   - exits (service), woonerven (living_street) and tram/bus ways get none;
//   - a painted cycle lane runs on through the junction to its straight-through
//     partner: red, with block markings (blokmarkering) along both edges where
//     a side arm opens on that side, a plain lane edge where none does;
//   - a separate cycle path crossing a carriageway at a node without a
//     crossing way: block markings along both edges over the gap the path
//     leaves, red between them when the road crossed is a side street.
//
// Everything here is a prior read from the graph, so it is drawn in the
// city's standard sizes (CROW): teeth 0.5 m base × 0.6 m with 0.25 m gaps,
// stop line 0.4 m, blocks 0.4 m with 0.4 m gaps.

import { drapeTriangles, type MeshArrays } from './drape.js';
import type { HeightFn, Vec2 } from './surface.js';

/** OSM highway classes by priority (higher wins); unknown and paths 0. */
export const CLASS_RANK: Readonly<Record<string, number>> = {
  motorway: 7, trunk: 6, primary: 5, secondary: 4, tertiary: 3, unclassified: 2, busway: 2, road: 1, residential: 1, living_street: 0, service: 0,
};
export const rankOf = (hw: string | undefined): number => CLASS_RANK[(hw ?? '').replace(/_link$/, '')] ?? 0;

/** Arms of these classes never carry a mouth marking (exits, woonerven, tram/bus lanes). */
const UNMARKED = new Set(['service', 'living_street', 'busway', 'track', 'road']);

/** A crossing within this distance of a junction node makes it signalised, metres. */
export const SIGNAL_REACH_M = 30;
/** How far up an arm a mapped crossing still sets the stop line / teeth position, metres. */
export const CROSSING_REACH_M = 20;

export const TEETH = { base: 0.5, height: 0.6, gap: 0.25 } as const;
export const STOP_LINE_M = 0.4;
export const BLOCK = { size: 0.4, gap: 0.4 } as const;

export type MouthMark = 'stop' | 'giveWay' | null;

/** Which marking an arm's mouth gets, from its class, the junction's best other class and whether it is signalised. */
export function mouthMarking(hw: string, otherBest: number, signalised: boolean): MouthMark {
  const base = hw.replace(/_link$/, '');
  if (UNMARKED.has(base) || !(base in CLASS_RANK)) return null;
  if (signalised) return 'stop';
  return rankOf(base) < otherBest ? 'giveWay' : null;
}

/** Is a way a signalised crossing (by its own tags)? */
export const isSignalCrossing = (tags: Record<string, string>) => tags.crossing === 'traffic_signals' || tags['crossing:signals'] === 'yes';

/** A local frame on the ground: origin, `u` along (unit), `n` = u rotated +90°. */
export interface MarkFrame { o: Vec2; u: Vec2 }
const at = (f: MarkFrame, a: number, b: number): Vec2 => [f.o[0] + f.u[0] * a - f.u[1] * b, f.o[1] + f.u[1] * a + f.u[0] * b];

function flatQuad(m: MeshArrays, q: readonly Vec2[], height: HeightFn, lift: number): void {
  drapeTriangles(m, q.flatMap(p => [p[0], p[1]]), q.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3], height, lift, 1);
}

/**
 * Shark teeth across the lateral range [l0, l1] (in `n`), base on the line
 * u = 0, apex at u = +TEETH.height (toward the driver who must give way).
 * Returns the number of teeth.
 */
export function sharkTeeth(m: MeshArrays, f: MarkFrame, l0: number, l1: number, height: HeightFn, lift: number): number {
  const span = l1 - l0, pitch = TEETH.base + TEETH.gap;
  const n = Math.floor((span + TEETH.gap) / pitch);
  if (n < 1) return 0;
  const start = l0 + (span - (n * pitch - TEETH.gap)) / 2;
  for (let i = 0; i < n; i++) {
    const b0 = start + i * pitch, b1 = b0 + TEETH.base;
    flatQuad(m, [at(f, 0, b0), at(f, 0, b1), at(f, TEETH.height, (b0 + b1) / 2)], height, lift);
  }
  return n;
}

/** A solid bar u ∈ [0, width] across [l0, l1]. */
export function bar(m: MeshArrays, f: MarkFrame, l0: number, l1: number, width: number, height: HeightFn, lift: number): void {
  if (l1 - l0 < 0.2) return;
  flatQuad(m, [at(f, 0, l0), at(f, 0, l1), at(f, width, l1), at(f, width, l0)], height, lift);
}

/** Square blocks along the segment a → b (BLOCK.size, BLOCK.gap), centred across it. Returns the count. */
export function blocks(m: MeshArrays, a: Vec2, b: Vec2, height: HeightFn, lift: number, size: number = BLOCK.size, gap: number = BLOCK.gap): number {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < size) return 0;
  const u: Vec2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len], pitch = size + gap;
  const n = Math.floor((len + gap) / pitch), start = (len - (n * pitch - gap)) / 2;
  for (let i = 0; i < n; i++) {
    const f: MarkFrame = { o: [a[0] + u[0] * (start + i * pitch), a[1] + u[1] * (start + i * pitch)], u };
    flatQuad(m, [at(f, 0, -size / 2), at(f, size, -size / 2), at(f, size, size / 2), at(f, 0, size / 2)], height, lift);
  }
  return n;
}

/** A flat strip of `width` from a to b (a cycle lane carried through a junction). */
export function strip(m: MeshArrays, a: Vec2, b: Vec2, width: number, height: HeightFn, lift: number): void {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 0.3) return;
  const f: MarkFrame = { o: a, u: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] };
  flatQuad(m, [at(f, 0, -width / 2), at(f, len, -width / 2), at(f, len, width / 2), at(f, 0, width / 2)], height, lift);
}

/** Station (metres from the polyline start) where segment p→q first crosses the polyline, or null. */
export function crossingStation(line: readonly Vec2[], p: Vec2, q: Vec2): number | null {
  let s = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], b = line[i + 1], rx = b[0] - a[0], ry = b[1] - a[1], sx = q[0] - p[0], sy = q[1] - p[1];
    const d = rx * sy - ry * sx, l = Math.hypot(rx, ry);
    if (Math.abs(d) > 1e-9) {
      const t = ((p[0] - a[0]) * sy - (p[1] - a[1]) * sx) / d, v = ((p[0] - a[0]) * ry - (p[1] - a[1]) * rx) / d;
      if (t >= 0 && t <= 1 && v >= 0 && v <= 1) return s + t * l;
    }
    s += l;
  }
  return null;
}
