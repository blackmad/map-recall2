/**
 * A projecting window box (intent `windowBox`): one long glazed box standing proud of the wall across a span of bays on
 * one storey, its glass in a pale frame split into lights by mullions and one transom. Stadsloket Zuidoost (2019
 * panorama w03-241): an 18 m glass band about 1.6 m tall on the first window storey over the arcade, standing out of
 * the brick in a pale grey frame, where the windows of every other bay are punched; the punched grid, oriels (a stone
 * bay per bay) and glazed storeys (the whole storey, flush) cannot say it.
 *
 * Measures are fractions (the intent contract has no metric fields): the box's sill and height of its storey, how far
 * it stands proud of its height. Geometry: the frame body from inside the wall solid (`BOX_BACK_M`; the bays behind it
 * should be blind, `openBays`) to its depth; the glass a sheet 6 cm in front of the frame's face inside a frame margin;
 * mullions and the transom 6 cm in front of the glass, so no two faces are coplanar or 2-3 cm apart.
 *
 * GWL-terrein, Haarlemmerweg 217-283 (issue #65, 2021 panoramas w02-0, w04/w05/w06-360): an enclosed access gallery
 * runs the whole 90 m park front as one dark-framed glass band on a pale concrete deck, rising from the fifth storey into
 * the sixth. Opt-in, each absent = byte-identical: `spread` continues the box over every other panel of the group at
 * full panel width (the front is several 3DBAG panels with entrance notches), `frame` gives the box its own frame
 * colour (dark anodised, where the punched windows are white), `deck` hangs a slab under the box, and `sill + h` may
 * run up to 2 storeys (the band rises into the storey above).
 */
import type {PanelCtx} from './compose.ts';

/** Intent (`walls[i].windowBox`). */
export interface WindowBoxIntent {
  /** the storey it sits on (1 = first floor) */
  storey: number;
  /** [first, last] bay of the span on the main panel (of `baysPerStorey`, from the viewer's left) */
  bays: [number, number];
  /** sill above the storey's floor, as a fraction of the storey (default 0.25) */
  sill?: number;
  /** height as a fraction of the storey (default 0.45) */
  h?: number;
  /** how far the box's face stands in front of the wall, as a fraction of its height (default 0.25) */
  proud?: number;
  /** glass lights across the box (default: one per 1.1 m) */
  lights?: number;
  /** a transom splitting the lights into two rows (default true) */
  transom?: boolean;
  /** continue the box over every other panel of the group, at full panel width (the main panel keeps `bays`) */
  spread?: boolean;
  /** the box frame's own colour (#rrggbb or swatch; default the group's frame colour) */
  frame?: string;
  /** a slab under the box: `h` of the storey tall (0.05..0.8), standing `out` of its own height further than the box (0..2, default 0.3), in `colour` (default the group's stone) */
  deck?: {h: number; out?: number; colour?: string};
}

/** Fitted (LargeGroupFit `windowBox`): the intent's fractions with defaults, drawn in the frame and glass slots. */
export interface WindowBoxFit { storey: number; bays: [number, number]; sill: number; h: number; proud: number; lights?: number; transom: boolean; frame: string; glass: string;
  spread?: boolean; deck?: {h: number; out: number; slot: string};
  /** with `spread` and `lights`: the main panel's light pitch (m), carried to the other panels */
  lightM?: number }

export const WINDOW_BOX = {sill: 0.25, h: 0.45, proud: 0.25, lightM: 1.1, margin: 0.1, glassOut: 0.06, barOut: 0.06, bar: 0.07, deckOut: 0.3, deckInto: 0.05} as const;
/** The frame body's back: inside the wall solid (the large tier's reveals are 0.18 m deep). */
export const BOX_BACK_M = -0.1;

export function windowBoxProblems(wb: unknown, at: string, baysPerStorey: number | undefined, storeys: number | undefined): string[] {
  const out: string[] = [];
  if (!wb || typeof wb !== 'object' || Array.isArray(wb)) return [`${at}: object {storey, bays, sill, h, proud, lights, transom}`];
  const a = wb as Record<string, unknown>;
  for (const k of Object.keys(a)) if (!['storey', 'bays', 'sill', 'h', 'proud', 'lights', 'transom', 'spread', 'frame', 'deck'].includes(k)) out.push(`${at}.${k}: unknown field (storey, bays, sill, h, proud, lights, transom, spread, frame, deck)`);
  if (!Number.isInteger(a.storey) || (a.storey as number) < 1 || (a.storey as number) > 39) out.push(`${at}.storey: upper storey 1..39`);
  else if (storeys !== undefined && (a.storey as number) >= storeys) out.push(`${at}.storey: under storeys ${storeys}`);
  const b = a.bays;
  if (!Array.isArray(b) || b.length !== 2 || !b.every(x => Number.isInteger(x) && x >= 0) || b[1] < b[0]) out.push(`${at}.bays: [first, last] bay`);
  else if (baysPerStorey === undefined) out.push(`${at}.bays needs baysPerStorey`);
  else if (b[1] >= baysPerStorey) out.push(`${at}.bays: last bay under baysPerStorey ${baysPerStorey}`);
  const num = (v: unknown, k: string, lo: number, hi: number) => { if (v !== undefined && !(typeof v === 'number' && v >= lo && v <= hi)) out.push(`${at}.${k}: number ${lo}..${hi}`); };
  num(a.sill, 'sill', 0, 0.8); num(a.h, 'h', 0.15, 1.95); num(a.proud, 'proud', 0.1, 1);
  if (a.lights !== undefined && !(Number.isInteger(a.lights) && (a.lights as number) >= 1 && (a.lights as number) <= 60)) out.push(`${at}.lights: integer 1..60`);
  if (a.transom !== undefined && typeof a.transom !== 'boolean') out.push(`${at}.transom: boolean`);
  if (a.spread !== undefined && typeof a.spread !== 'boolean') out.push(`${at}.spread: boolean`);
  if (a.frame !== undefined && !(typeof a.frame === 'string' && /^(#[0-9a-f]{6}|[a-z-]+)$/i.test(a.frame))) out.push(`${at}.frame: #rrggbb or a swatch`);
  if (a.deck !== undefined) {
    const d = a.deck as Record<string, unknown>;
    if (!d || typeof d !== 'object' || Array.isArray(d)) out.push(`${at}.deck: object {h, out, colour}`);
    else {
      for (const k of Object.keys(d)) if (!['h', 'out', 'colour'].includes(k)) out.push(`${at}.deck.${k}: unknown field (h, out, colour)`);
      if (!(typeof d.h === 'number' && d.h >= 0.05 && d.h <= 0.8)) out.push(`${at}.deck.h: number 0.05..0.8 of the storey`);
      if (d.out !== undefined && !(typeof d.out === 'number' && d.out >= 0 && d.out <= 2)) out.push(`${at}.deck.out: number 0..2`);
      if (d.colour !== undefined && !(typeof d.colour === 'string' && /^(#[0-9a-f]{6}|[a-z-]+)$/i.test(d.colour))) out.push(`${at}.deck.colour: #rrggbb or a swatch`);
    }
  }
  // a box rising into the storey above (an access gallery over a split level) needs that storey: up to 2 storeys
  const lim = typeof a.h === 'number' && a.h > 0.95 ? 2 : 1;
  if (typeof a.sill === 'number' && typeof a.h === 'number' && a.sill + a.h > lim) out.push(`${at}: sill + h within the storey (<= 1)${lim === 2 ? ' and the one above (<= 2)' : ''}`);
  else if (lim === 2 && storeys !== undefined && Number.isInteger(a.storey) && (a.storey as number) + 1 >= storeys) out.push(`${at}.h: over 0.95 rises into the storey above; storey ${a.storey} is the top one`);
  return out;
}

export function fitWindowBox(wb: WindowBoxIntent, slots: {frame: string; glass: string; deck?: string}, mainWidthM?: number, bays?: number): WindowBoxFit {
  const span = mainWidthM && bays ? (mainWidthM * (wb.bays[1] - wb.bays[0] + 1)) / bays : 0;
  return {...(wb.spread && wb.lights && span > 0 ? {lightM: +(span / wb.lights).toFixed(3)} : {}),storey: wb.storey, bays: [wb.bays[0], wb.bays[1]], sill: wb.sill ?? WINDOW_BOX.sill, h: wb.h ?? WINDOW_BOX.h, proud: wb.proud ?? WINDOW_BOX.proud,
    ...(wb.lights !== undefined ? {lights: wb.lights} : {}), transom: wb.transom ?? true, frame: slots.frame, glass: slots.glass,
    ...(wb.spread ? {spread: true} : {}), ...(wb.deck && slots.deck ? {deck: {h: wb.deck.h, out: wb.deck.out ?? WINDOW_BOX.deckOut, slot: slots.deck}} : {})};
}

/** The box rectangle [u0, u1, v0, v1] on a panel of `bays` even bays from uMin to uMax, on the storey lines `levels`. */
export function windowBoxRect(uMin: number, uMax: number, levels: number[], wb: Pick<WindowBoxFit, 'storey' | 'bays' | 'sill' | 'h'>, bays: number, full = false): [number, number, number, number] | null {
  const f = levels[wb.storey], t = levels[wb.storey + 1];
  if (f === undefined || t === undefined || t - f < 1) return null;
  const W = uMax - uMin, H = t - f;
  if (full) return [uMin, uMax, f + wb.sill * H, f + (wb.sill + wb.h) * H];
  return [uMin + (wb.bays[0] * W) / bays, uMin + ((wb.bays[1] + 1) * W) / bays, f + wb.sill * H, f + (wb.sill + wb.h) * H];
}

/**
 * Draws the box on the main panel (on another panel of the group, with `spread`, at full width: `full`); returns the
 * glass lights drawn (0 = none). With `deck`, a slab under the box from inside the wall to `out` x its height beyond
 * the box face, its top 5 cm up inside the frame body (no coplanar faces).
 */
export function drawWindowBox(c: PanelCtx, levels: number[], wb: WindowBoxFit, bays: number, topM: number, full = false): number {
  const p = c.p, r = windowBoxRect(p.uMin, p.uMax, levels, wb, bays, full);
  if (!r) return 0;
  const [u0, u1, v0, v1] = r;
  if (v1 > topM || u1 - u0 < 1) return 0;
  const B = WINDOW_BOX, depth = Math.max(0.2, wb.proud * (v1 - v0)), m = B.margin, part = c.part();
  c.box(wb.frame, u0, u1, v0, v1, BOX_BACK_M, depth, part);
  if (wb.deck) {
    const H = levels[wb.storey + 1] - levels[wb.storey], dh = wb.deck.h * H;
    c.box(wb.deck.slot, u0, u1, v0 - dh, v0 + B.deckInto, BOX_BACK_M, depth + Math.max(0.1, wb.deck.out * dh), part);
  }
  const g = depth + B.glassOut, gu0 = u0 + m, gu1 = u1 - m, gv0 = v0 + m * 1.5, gv1 = v1 - m;
  c.box(wb.glass, gu0, gu1, gv0, gv1, depth - 0.02, g, part);
  const lights = (full ? undefined : wb.lights) ?? Math.max(1, Math.round((gu1 - gu0) / (full && wb.lightM ? wb.lightM : B.lightM))), step = (gu1 - gu0) / lights, bar = B.bar;
  for (let k = 1; k < lights; k++) { const u = gu0 + k * step; c.box(wb.frame, u - bar / 2, u + bar / 2, gv0, gv1, g - 0.02, g + B.barOut, part); }
  if (wb.transom) { const v = (gv0 + gv1) / 2; c.box(wb.frame, gu0, gu1, v - bar / 2, v + bar / 2, g - 0.02, g + 2 * B.barOut, part); }
  return lights;
}
