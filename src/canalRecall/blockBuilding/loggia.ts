/**
 * Loggia look, shared by every lane that cuts recessed balconies (lane large-kit-gaps-20261121; the kit-vs-hand test on
 * Valkenburgerstraat 69-165 found the Koerierstersplein loggias' brown brick backs and white rails behind a white render
 * front, which `loggiaBands` drew as dark glass slots). Two opt-in parts on top of the existing loggia geometry
 * (compose `WinParams.loggia`, systems.ts `LOGGIA` / `LOGGIA_BAND`):
 *
 * - `lining`: the loggia's own wall colour. The side returns, soffit, floor and back wall are drawn in it instead of
 *   the cut wall's slot (a brown or coloured brick back inside a render front, a painted back wall in a post-war slab).
 * - `back: "door-window"`: the back is a wall (in the lining, else the wall) with a glazed balcony door and a window
 *   beside it, instead of glazed leaves across the whole back (`LOGGIA_DOOR_WINDOW`, fractions of the opening).
 *
 * The rail colour stays the loggia's existing `colour` (a rail slot of its own). Intent fields are proportions and
 * colours only. Pure: validation, defaults and the compose back items; no geometry or I/O here.
 */

/** Back-wall kinds: `glazed` (the existing glazed leaves; default) or a wall with a balcony door and a window. */
export const LOGGIA_BACKS = ['glazed', 'door-window'] as const;
export type LoggiaBack = typeof LOGGIA_BACKS[number];

/** The intent's loggia-look fields (on `walls[].loggias`, `walls[].houses[].loggias` and `walls[].loggiaBands[]`). */
export interface LoggiaLookIntent {
  /** the loggia's returns, soffit, floor and back wall in this colour (#rrggbb); absent: the cut wall's, byte-identical */
  lining?: string;
  /** `door-window`: a wall back with a balcony door and a window (cells only; bands have their own `back` rows) */
  back?: LoggiaBack;
}

/** A glazed opening in a loggia's back wall, fractions of the opening's width (`u`, from the left) and height (`v`). */
export interface LoggiaBackItem { u: [number, number]; v: [number, number]; door?: boolean }

/**
 * Balcony door left, window right (1985-2004 Amsterdam housing loggias, Koerierstersplein 2018 crop w03-57: a door about
 * a third of the opening wide to the soffit's line and a window of about 0.4 over a parapet-high sill).
 */
export const LOGGIA_DOOR_WINDOW: LoggiaBackItem[] = [
  {u: [0.1, 0.4], v: [0, 0.88], door: true},
  {u: [0.5, 0.9], v: [0.36, 0.88]},
];

const HEX = /^#[0-9a-f]{6}$/i;

/** Problems with the loggia-look fields of one loggia entry at `at`; `cells` = per-cell loggias (bands take no `back` kind). */
export function loggiaLookProblems(v: {lining?: unknown; back?: unknown} | undefined, at: string, cells: boolean): string[] {
  const p: string[] = [];
  if (!v) return p;
  if (v.lining !== undefined && !(typeof v.lining === 'string' && HEX.test(v.lining))) p.push(`${at}.lining: #rrggbb`);
  if (cells && v.back !== undefined && !(LOGGIA_BACKS as readonly unknown[]).includes(v.back)) p.push(`${at}.back: one of ${LOGGIA_BACKS.join('|')}`);
  return p;
}

/** The back items for a back kind (undefined: the glazed leaves, byte-identical). */
export function loggiaBackItems(back: LoggiaBack | undefined): LoggiaBackItem[] | undefined {
  return back === 'door-window' ? LOGGIA_DOOR_WINDOW.map(i => ({...i, u: [...i.u] as [number, number], v: [...i.v] as [number, number]})) : undefined;
}

/**
 * Rectangle minus rectangles: the parts of [u0, u1] x [v0, v1] not covered by `holes` ([a, b, lo, hi]), as rectangles
 * cut in horizontal strips at every hole edge, runs that repeat strip to strip merged upward. Used for a loggia back
 * wall round its door and window and for face panels round their windows (facePanels.ts). Pieces narrower or lower
 * than `min` are dropped.
 */
export function rectMinusRects(u0: number, u1: number, v0: number, v1: number, holes: [number, number, number, number][], min = 0.02): [number, number, number, number][] {
  const hs = holes.filter(h => h[1] > u0 && h[0] < u1 && h[3] > v0 && h[2] < v1);
  const ys = [...new Set([v0, v1, ...hs.flatMap(h => [Math.max(v0, h[2]), Math.min(v1, h[3])])])].sort((a, b) => a - b);
  const out: [number, number, number, number][] = [];
  let open = new Map<string, [number, number, number, number]>();
  for (let i = 0; i + 1 < ys.length; i++) {
    const lo = ys[i], hi = ys[i + 1];
    if (hi - lo < 1e-6) continue;
    let pieces: [number, number][] = [[u0, u1]];
    for (const [a, b, l, h] of hs) {
      if (!(l < hi - 1e-6 && h > lo + 1e-6)) continue;
      pieces = pieces.flatMap(([x, y]) => (b <= x || a >= y ? [[x, y]] : [[x, Math.min(a, y)], [Math.max(b, x), y]]).filter(([s, t]) => t - s > 1e-6)) as [number, number][];
    }
    const next = new Map<string, [number, number, number, number]>();
    for (const [x, y] of pieces) {
      const key = `${x.toFixed(4)}:${y.toFixed(4)}`, run = open.get(key);
      if (run && Math.abs(run[3] - lo) < 1e-6) { run[3] = hi; next.set(key, run); open.delete(key); } else next.set(key, [x, y, lo, hi]);
    }
    for (const r of open.values()) out.push(r);
    open = next;
  }
  for (const r of open.values()) out.push(r);
  return out.filter(r => r[1] - r[0] >= min && r[3] - r[2] >= min).sort((a, b) => a[2] - b[2] || a[0] - b[0]);
}
