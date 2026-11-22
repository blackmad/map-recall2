/**
 * Window trim (lane kit-batch-2005b-20261122, Rode Kruisstraat 2's care home, 2019; crops w03-262 2024-08-29 and
 * w01-77L 2019-12-11): two things the large kit could not say about a punched brick front.
 *
 *   windowHeads  a hood over each punched window: a head strip (WinParams.headSlot, 0.12 m tall, 0.08 m proud, 6 cm past
 *                each jamb) in its own colour, with an optional leg `drop` m long down each side, the grey aluminium
 *                hoods with turned-down ends of recent Dutch brick housing; on `storeys` (0 = ground; default all).
 *   julietRails  a Juliet rail (frans balkon): a top rail and vertical bars `h` m tall across the foot of the opening,
 *                standing just proud of the wall, in its own colour. On every punched window of `storeys`, and on the
 *                `bayWindows` entries marked `rail: true` (a French window between casements).
 *
 * Intent (per wall group): windowHeads {colour, drop?, storeys?}; julietRails {colour, h?, storeys?}; bayWindows
 * pattern entries take `rail: true` (needs julietRails). brick-bay-grid only. Absent: nothing changes, byte-identical.
 */
import type { Row, Slot, WinParams } from './spec.ts';

export const WINDOW_TRIM = {
  /** leg section (m) under each end of the head */
  legW: 0.05, legOut: 0.05,
  /** rail: default height (m), top rail height, bar section, bar pitch (m), the plane the rail stands in (m out from the wall) */
  railH: 0.9, topH: 0.05, barW: 0.025, barPitchM: 0.14, out0: 0.04, out1: 0.07,
  /** the narrowest opening (m) that takes a rail */
  minRailW: 0.4,
} as const;

export interface WindowHeadsIntent { colour: string; drop?: number; storeys?: number[] }
export interface JulietRailsIntent { colour: string; h?: number; storeys?: number[] }
export interface WindowHeadsFit { slot: Slot; drop: number; storeys?: number[] }
export interface JulietRailsFit { slot: Slot; h: number; storeys?: number[] }

const HEX = /^#[0-9a-fA-F]{6}$/;
const storeysOk = (s: unknown) => s === undefined || (Array.isArray(s) && s.length > 0 && s.every(q => Number.isInteger(q) && q >= 0 && q <= 39));

export function windowHeadsProblems(v: unknown, at: string): string[] {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return [`${at}: object {colour, drop?, storeys?}`];
  const a = v as Record<string, unknown>, out: string[] = [];
  for (const k of Object.keys(a)) if (!['colour', 'drop', 'storeys'].includes(k)) out.push(`${at}.${k}: unknown field (colour, drop, storeys)`);
  if (typeof a.colour !== 'string' || !HEX.test(a.colour)) out.push(`${at}.colour: #rrggbb`);
  if (a.drop !== undefined && !(typeof a.drop === 'number' && a.drop >= 0.05 && a.drop <= 0.8)) out.push(`${at}.drop: 0.05..0.8 m`);
  if (!storeysOk(a.storeys)) out.push(`${at}.storeys: list of storeys 0..39`);
  return out;
}

export function julietRailsProblems(v: unknown, at: string): string[] {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return [`${at}: object {colour, h?, storeys?}`];
  const a = v as Record<string, unknown>, out: string[] = [];
  for (const k of Object.keys(a)) if (!['colour', 'h', 'storeys'].includes(k)) out.push(`${at}.${k}: unknown field (colour, h, storeys)`);
  if (typeof a.colour !== 'string' || !HEX.test(a.colour)) out.push(`${at}.colour: #rrggbb`);
  if (a.h !== undefined && !(typeof a.h === 'number' && a.h >= 0.4 && a.h <= 1.3)) out.push(`${at}.h: 0.4..1.3 m`);
  if (!storeysOk(a.storeys)) out.push(`${at}.storeys: list of storeys 0..39`);
  return out;
}

export const fitWindowHeads = (w: WindowHeadsIntent, slot: Slot): WindowHeadsFit => ({ slot, drop: w.drop ?? 0, ...(w.storeys ? { storeys: [...w.storeys] } : {}) });
export const fitJulietRails = (w: JulietRailsIntent, slot: Slot): JulietRailsFit => ({ slot, h: w.h ?? WINDOW_TRIM.railH, ...(w.storeys ? { storeys: [...w.storeys] } : {}) });

/** The window with its head hood (and legs). */
export const headed = (win: WinParams, h: WindowHeadsFit): WinParams => ({ ...win, headSlot: h.slot, ...(h.drop > 0 ? { headDrop: h.drop } : {}) });
/** The window with a Juliet rail. */
export const railed = (win: WinParams, r: JulietRailsFit): WinParams => ({ ...win, juliet: { h: r.h, slot: r.slot } });

/**
 * Apply `fn` to every punched window of a row: the row's own, each in a per-bay cycle, and each `win` item. Loggias,
 * arched openings and door leaves (no sill slot and the door glass) are left alone.
 */
export function mapRowWindows(r: Row, fn: (w: WinParams) => WinParams): Row {
  const ok = (w: WinParams | undefined) => !!w && !w.loggia && !w.arch;
  if (r.cycle) return { ...r, cycle: r.cycle.map(x => mapRowWindows(x, fn)) };
  if (r.kind === 'punched' && ok(r.win)) return { ...r, win: fn(r.win!) };
  if (r.kind === 'items' && r.items) return { ...r, items: r.items.map(fl => fl.map(it => (it.kind === 'win' && ok(it.win) ? { ...it, win: fn(it.win!) } : it))) };
  return r;
}

type Box = (slot: Slot, u0: number, u1: number, v0: number, v1: number, d0: number, d1: number) => void;

/** Draw the hood legs and the Juliet rail of one opening [u0, u1] x [v0, v1] (both opt-in on WinParams). Returns boxes drawn. */
export function drawWindowTrim(box: Box, u0: number, u1: number, v0: number, v1: number, w: WinParams): number {
  const T = WINDOW_TRIM;
  let n = 0;
  if (w.headSlot && w.headDrop) {
    const lo = Math.max(v0, v1 - w.headDrop);
    box(w.headSlot, u0 - 0.06, u0 - 0.06 + T.legW, lo, v1, 0, T.legOut);
    box(w.headSlot, u1 + 0.06 - T.legW, u1 + 0.06, lo, v1, 0, T.legOut);
    n += 2;
  }
  if (w.juliet && u1 - u0 >= T.minRailW) {
    const top = Math.min(v1 - 0.1, v0 + w.juliet.h), s = w.juliet.slot;
    if (top - v0 >= 0.3) {
      const bars = Math.max(2, Math.round((u1 - u0) / T.barPitchM));
      for (let k = 1; k < bars; k++) { const u = u0 + (u1 - u0) * k / bars; box(s, u - T.barW / 2, u + T.barW / 2, v0, top - T.topH, T.out0, T.out1 - 0.01); n++; }
      box(s, u0, u1, top - T.topH, top, T.out0, T.out1);
      box(s, u0, u1, v0, v0 + T.topH, T.out0, T.out1);
      n += 2;
    }
  }
  return n;
}
