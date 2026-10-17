/**
 * Staircase lights (trappenhuisraam): a tall narrow glazed strip on the portiek's axis that runs through the storeys,
 * lighting the common stair. The 1933 Spaarndammerbuurt rows (Houtrijkstraat 381-401, Polanenstraat 222-242,
 * Hembrugstraat 21-27) set a 0.5 m glass-block ladder, white bars every 0.6 m, from the door canopy to under the eaves.
 *
 * `FrontIntent.stairLight`: `{axis, breadth, from: [storey, share], to: [storey, share], pane?, twin?}`. The light is
 * centred on an axis of the shared grid; its foot and head are given as a storey and a share of that storey's height
 * over its floor, so the light follows the fitted storeys. `pane`: metres between the ladder's bars (absent: one light);
 * `twin`: two lights this far apart (Hembrugstraat 21: two slits). Absent = byte-identical.
 */
import type {CanalhouseOpening} from '../canalhouseRecipes.ts';

export interface StairLightIntent {
  /** Axis of the shared window grid the light stands on (0 .. grid - 1). */
  axis: number;
  /** Metres across one light (0.12 .. 1.2). */
  breadth: number;
  /** The light's foot: [storey index, share of that storey's height over its floor]. */
  from: [number, number];
  /** The light's head: [storey index, share of that storey's height over its floor]. */
  to: [number, number];
  /** Metres from one ladder bar to the next (0.15 .. 1.2); absent = one undivided light. */
  pane?: number;
  /** Two lights side by side, this many metres of wall apart (0.05 .. 1.5); absent = one light. */
  twin?: number;
}

const KEYS = ['axis', 'breadth', 'from', 'to', 'pane', 'twin'];
const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const level = (v: unknown, storeys: number) => Array.isArray(v) && v.length === 2 && Number.isInteger(v[0]) && v[0] >= 0 && v[0] < storeys && num(v[1], 0, 1);

/** Problems with `stairLight` on one front (`grid`: the shared grid's axis count). */
export function stairLightProblems(s: unknown, storeys: number, grid: number, repeated: boolean, at: string): string[] {
  const a = `${at}.stairLight`;
  if (!s || typeof s !== 'object' || Object.keys(s).some(k => !KEYS.includes(k))) return [`${a}: {axis, breadth, from: [storey, share], to: [storey, share], pane?, twin?}`];
  const o = s as Record<string, unknown>, p: string[] = [];
  if (!(Number.isInteger(o.axis) && (o.axis as number) >= 0 && (o.axis as number) < grid)) p.push(`${a}.axis: an axis of the shared grid, 0..${grid - 1}`);
  if (!num(o.breadth, 0.12, 1.2)) p.push(`${a}.breadth: 0.12..1.2 m`);
  if (!level(o.from, storeys)) p.push(`${a}.from: [storey 0..${storeys - 1}, share 0..1]`);
  if (!level(o.to, storeys)) p.push(`${a}.to: [storey 0..${storeys - 1}, share 0..1]`);
  else if (level(o.from, storeys)) { const f = o.from as number[], t = o.to as number[]; if (t[0] + t[1] <= f[0] + f[1] + 0.5) p.push(`${a}: the head must stand at least half a storey over the foot`); }
  if (o.pane !== undefined && !num(o.pane, 0.15, 1.2)) p.push(`${a}.pane: 0.15..1.2 m between bars`);
  if (o.twin !== undefined && !num(o.twin, 0.05, 1.5)) p.push(`${a}.twin: 0.05..1.5 m between the two lights`);
  if (repeated) p.push(`${a}: not on a repeated front`);
  return p;
}

/**
 * The light's openings, viewer-left metres in the front's frame (before the module placement and mirror). `floors`:
 * storey floor heights from the ground (index = storey; one more entry for the top of the last storey).
 */
export function stairLightOpenings(s: StairLightIntent, centre: number, floors: number[], width: number): CanalhouseOpening[] {
  const at = ([st, share]: [number, number]) => floors[st] + (floors[st + 1] - floors[st]) * share;
  const bottom = at(s.from), top = at(s.to), h = top - bottom;
  const n = s.twin !== undefined ? 2 : 1, span = n * s.breadth + (n - 1) * (s.twin ?? 0);
  const left0 = Math.min(Math.max(centre - span / 2, 0.1), width - span - 0.1);
  const bars = s.pane ? Math.max(0, Math.round(h / s.pane) - 1) : 0;
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return Array.from({length: n}, (_, k) => ({
    id: `stair-light-${k}`, kind: 'window' as const, leftM: r(left0 + k * (s.breadth + (s.twin ?? 0))), bottomM: r(bottom), widthM: s.breadth, heightM: r(h), trimWidthM: 0.05,
    ...(bars ? {horizontalBars: Array.from({length: bars}, (_, i) => r((i + 1) / (bars + 1))), horizontalBarWidthsM: Array(bars).fill(0.04)} : {}),
  }));
}
