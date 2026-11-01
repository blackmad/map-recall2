/**
 * A recessed loggia on an ordinary front (Transvaalbuurt 1922 rows, Colensostraat 13-28 and Vaalrivierstraat 15-21, #158):
 * on the upper storey, the window of one axis is replaced by an opening cut `deep` metres into the wall, from a solid
 * brick parapet `rail` metres over the storey floor to the storey's head line (or `head`), as wide as the axis's window
 * (`bayFill`), glazed at its back in `lights` lights (the flat's doors and windows behind the loggia). Two mirrored pands
 * put their halves against one party wall so the loggia reads as one across it.
 *
 * `FrontIntent.loggia`: `{storeys, axes, deep, rail, head?, lights?}`. The opening is a rectangular recessed opening
 * (canalhouseOpeningRecess.ts): the joinery moves back by `deep`, brick jambs, soffit and sill line the cavity. Large
 * buildings have their own `loggias`/`loggiaBands` (largeIntent.ts); this is the canal-house kit's. Absent = byte-identical.
 */
import type {CanalhouseOpening} from '../canalhouseRecipes.ts';

export interface FrontLoggiaIntent {
  /** 0-based storeys (>= 1) whose window on `axes` is a loggia. */
  storeys: number[];
  /** Axes of the shared grid (0 .. grid - 1). */
  axes: number[];
  /** Metres from the facade to the glazed back (0.3 .. 1.5). */
  deep: number;
  /** Metres of solid parapet over the storey floor, the loggia's sill (0.3 .. 1.6). */
  rail: number;
  /** The opening's head as a share of the storey height (0.5 .. 0.98); absent = the storey's head line. */
  head?: number;
  /** Glazed lights across the back (1 .. 6, default 2). */
  lights?: number;
}

const KEYS = ['storeys', 'axes', 'deep', 'rail', 'head', 'lights'];
const num = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const ints = (v: unknown, lo: number, hi: number) => Array.isArray(v) && v.length > 0 && v.every((x, i) => Number.isInteger(x) && x >= lo && x <= hi && (i === 0 || x > v[i - 1]));

/** Problems with `loggia` on one front (`grid`: the shared grid's axis count). */
export function frontLoggiaProblems(l: unknown, storeys: number, grid: number, at: string): string[] {
  const a = `${at}.loggia`;
  if (!l || typeof l !== 'object' || Object.keys(l).some(k => !KEYS.includes(k))) return [`${a}: {storeys, axes, deep, rail, head?, lights?}`];
  const o = l as Record<string, unknown>, p: string[] = [];
  if (!ints(o.storeys, 1, storeys - 1)) p.push(`${a}.storeys: ascending upper storeys, 1..${storeys - 1}`);
  if (!ints(o.axes, 0, grid - 1)) p.push(`${a}.axes: ascending axes of the shared grid, 0..${grid - 1}`);
  if (!num(o.deep, 0.3, 1.5)) p.push(`${a}.deep: 0.3..1.5 m`);
  if (!num(o.rail, 0.3, 1.6)) p.push(`${a}.rail: 0.3..1.6 m of parapet over the storey floor`);
  if (o.head !== undefined && !num(o.head, 0.5, 0.98)) p.push(`${a}.head: 0.5..0.98 of the storey height`);
  if (o.lights !== undefined && !(Number.isInteger(o.lights) && (o.lights as number) >= 1 && (o.lights as number) <= 6)) p.push(`${a}.lights: 1..6`);
  return p;
}

/** Is the window of `axis` on storey `s` a loggia? */
export const isLoggia = (l: FrontLoggiaIntent | undefined, s: number, axis: number | null): l is FrontLoggiaIntent =>
  !!l && axis !== null && l.storeys.includes(s) && l.axes.includes(axis);

/** The loggia opening of one axis: `centre` and `width` of the axis's window, `floor` and `height` of its storey, `headShare` the storey's head line. */
export function frontLoggiaOpening(l: FrontLoggiaIntent, id: string, centre: number, width: number, floor: number, height: number, headShare: number): CanalhouseOpening {
  const r = (v: number) => Math.round(v * 1000) / 1000;
  const bottom = floor + Math.min(l.rail, height * 0.6), top = floor + height * (l.head ?? headShare), lights = l.lights ?? 2;
  return {id, kind: 'window', leftM: r(centre - width / 2), bottomM: r(bottom), widthM: r(width), heightM: r(top - bottom), trimWidthM: 0.06,
    verticalBars: Array.from({length: lights - 1}, (_, k) => r((k + 1) / lights)), horizontalBars: [],
    recessM: l.deep, recessReturns: {glazedSides: [], soffitSurface: 'wall'}, frameSurface: 'trim', barSurface: 'trim'};
}
