/**
 * Face panels for the large kit (lane large-kit-gaps-20261121): flat panels in their own colour and finish laid over a
 * span of bays and storeys of a group's main panel, round the windows they frame. The kit-vs-hand test (Valkenburgerstraat
 * 69-165, Rapenburgerstraat crop w07-149) found the white rendered panel standing 0.2 m proud of the brick round two tall
 * gridded windows, and a maroon panel beside it, where the kit had one wall colour per group and drew both flush.
 *
 * Two intent keys share this module, with different defaults:
 * - `renderPanels`: one panel over the whole span, `proud` (0.2 m), rendered (the stucco slot): a framed render bay, a
 *   white panel round a window stack, a coloured block in a brick front.
 * - `accentPanels`: one panel per bay and storey cell, `flush` (5 cm), a smooth panel (the stone cell): coloured spandrel
 *   panels under windows, glass-block or enamel panels, a coloured pier strip.
 *
 * Per entry: `bays` and `storeys` [first, last] (bays count along the main panel, across a row split's houses), `along`
 * [from, to] of the first and last bay's pitch (default [0, 1]; below 0 or above 1 reaches into the neighbour), `up`
 * [from, to] of the first and last storey (default [0, 1]), `colour`, `finish` (render, brick, panel) and `relief`
 * (flush, proud, deep). Openings inside a panel stay open: the panel is the rectangle minus the cut windows, each piece a
 * closed box, clipped to where the wall stands. Absent: byte-identical.
 */
import { intervals, stripBox, type Cell, type PanelCtx } from './compose.ts';
import { rectMinusRects } from './loggia.ts';

export const FACE_PANEL_FINISHES = ['render', 'brick', 'panel'] as const;
export const FACE_PANEL_RELIEFS = ['flush', 'proud', 'deep'] as const;
/** Relief depths (m) in front of the wall: a flush accent clears the facing layer, a proud panel reads at riding range. */
export const FACE_PANEL_RELIEF_M: Record<typeof FACE_PANEL_RELIEFS[number], number> = { flush: 0.05, proud: 0.2, deep: 0.35 };
export const FACE_PANEL_KEYS = ['renderPanels', 'accentPanels'] as const;
export type FacePanelKey = typeof FACE_PANEL_KEYS[number];
export const FACE_PANEL_DEFAULTS: Record<FacePanelKey, { finish: typeof FACE_PANEL_FINISHES[number]; relief: typeof FACE_PANEL_RELIEFS[number]; each: boolean }> = {
  renderPanels: { finish: 'render', relief: 'proud', each: false },
  accentPanels: { finish: 'panel', relief: 'flush', each: true },
};

export interface FacePanelIntent {
  bays: [number, number];
  storeys: [number, number];
  colour: string;
  finish?: typeof FACE_PANEL_FINISHES[number];
  relief?: typeof FACE_PANEL_RELIEFS[number];
  /** one panel per bay and storey cell (accent default) instead of one over the span (render default) */
  each?: boolean;
  along?: [number, number];
  up?: [number, number];
}
export interface FacePanelFit { bays: [number, number]; storeys: [number, number]; along: [number, number]; up: [number, number]; outM: number; each: boolean; slot: string }

const HEX = /^#[0-9a-f]{6}$/i;
const KEYS = ['bays', 'storeys', 'colour', 'finish', 'relief', 'each', 'along', 'up'];

/** Problems with one face-panel list at `at` (`bays` = the group's bays per storey when known). */
export function facePanelsProblems(list: unknown, at: string, bays?: number): string[] {
  if (list === undefined) return [];
  if (!Array.isArray(list) || !list.length || list.length > 16) return [`${at}: 1..16 entries {bays, storeys, colour, finish?, relief?, each?, along?, up?}`];
  const p: string[] = [];
  list.forEach((e: Record<string, unknown>, k) => {
    const a = `${at}[${k}]`;
    if (!e || typeof e !== 'object' || Array.isArray(e)) { p.push(`${a}: object`); return; }
    for (const key of Object.keys(e)) if (!KEYS.includes(key)) p.push(`${a}.${key}: unknown field (${KEYS.join(', ')})`);
    const pair = (v: unknown, key: string, max: number) => { if (!Array.isArray(v) || v.length !== 2 || !v.every(x => Number.isInteger(x) && x >= 0 && x <= max) || v[1] < v[0]) p.push(`${a}.${key}: [first, last] integers 0..${max}, first <= last`); };
    pair(e.bays, 'bays', bays !== undefined ? bays - 1 : 120); pair(e.storeys, 'storeys', 39);
    const frac = (v: unknown, key: string, lo: number, hi: number) => { if (v !== undefined && !(Array.isArray(v) && v.length === 2 && v.every(x => typeof x === 'number' && x >= lo && x <= hi))) p.push(`${a}.${key}: [from, to] fractions ${lo}..${hi}`); };
    frac(e.along, 'along', -0.5, 1.5); frac(e.up, 'up', 0, 1);
    if (Array.isArray(e.storeys) && Array.isArray(e.up) && e.storeys[0] === e.storeys[1] && !((e.up[1] as number) - (e.up[0] as number) >= 0.05)) p.push(`${a}.up: to - from >= 0.05 on one storey`);
    if (Array.isArray(e.bays) && Array.isArray(e.along) && e.bays[0] === e.bays[1] && !((e.along[1] as number) - (e.along[0] as number) >= 0.05)) p.push(`${a}.along: to - from >= 0.05 on one bay`);
    if (!(typeof e.colour === 'string' && HEX.test(e.colour))) p.push(`${a}.colour: #rrggbb`);
    if (e.finish !== undefined && !(FACE_PANEL_FINISHES as readonly unknown[]).includes(e.finish)) p.push(`${a}.finish: one of ${FACE_PANEL_FINISHES.join('|')}`);
    if (e.relief !== undefined && !(FACE_PANEL_RELIEFS as readonly unknown[]).includes(e.relief)) p.push(`${a}.relief: one of ${FACE_PANEL_RELIEFS.join('|')}`);
    if (e.each !== undefined && typeof e.each !== 'boolean') p.push(`${a}.each: true or false`);
  });
  return p;
}

/** The block-kit slot for a panel finish (largeCompile `largeMaterialSlot`: render -> stucco, brick -> brick, panel -> stone cell). */
export function facePanelSlot(finish: typeof FACE_PANEL_FINISHES[number], tag: string): string {
  return `${finish === 'render' ? 'render' : finish === 'brick' ? 'painted' : 'clad'}@${tag}`;
}

/** Fit one list: defaults by key, the colour put into `palette` under its own slot (`<finish>@<fp|ap><group>k<k>`). */
export function fitFacePanels(list: FacePanelIntent[], key: FacePanelKey, group: number, palette: Record<string, string>): FacePanelFit[] {
  const D = FACE_PANEL_DEFAULTS[key];
  return list.map((e, k) => {
    const slot = facePanelSlot(e.finish ?? D.finish, `${key === 'renderPanels' ? 'fp' : 'ap'}${group}k${k}`);
    palette[slot] = e.colour.toLowerCase();
    return { bays: [e.bays[0], e.bays[1]], storeys: [e.storeys[0], e.storeys[1]], along: e.along ? [e.along[0], e.along[1]] : [0, 1], up: e.up ? [e.up[0], e.up[1]] : [0, 1],
      outM: FACE_PANEL_RELIEF_M[e.relief ?? D.relief], each: e.each ?? D.each, slot };
  });
}

/**
 * The panel rectangles [u0, u1, v0, v1] of one fit from the main panel's cells (bays and storeys the panel does not have
 * are skipped; a span needs its first and last bay and storey). Pure.
 */
export function facePanelRects(cells: Cell[], f: FacePanelFit): [number, number, number, number][] {
  const at = (bay: number, floor: number) => cells.filter(c => c.bay === bay && c.floor === floor);
  const ext = (cs: Cell[]) => (cs.length ? { u0: Math.min(...cs.map(c => c.u0)), u1: Math.max(...cs.map(c => c.u1)), v0: Math.min(...cs.map(c => c.v0)), v1: Math.max(...cs.map(c => c.v1)) } : null);
  const rect = (b0: number, b1: number, s0: number, s1: number): [number, number, number, number] | null => {
    const bayA = ext(cells.filter(c => c.bay === b0 && c.floor >= s0 && c.floor <= s1)), bayB = ext(cells.filter(c => c.bay === b1 && c.floor >= s0 && c.floor <= s1));
    const stA = ext(cells.filter(c => c.floor === s0 && c.bay >= b0 && c.bay <= b1)), stB = ext(cells.filter(c => c.floor === s1 && c.bay >= b0 && c.bay <= b1));
    if (!bayA || !bayB || !stA || !stB) return null;
    const u0 = bayA.u0 + f.along[0] * (bayA.u1 - bayA.u0), u1 = bayB.u0 + f.along[1] * (bayB.u1 - bayB.u0);
    const v0 = stA.v0 + f.up[0] * (stA.v1 - stA.v0), v1 = stB.v0 + f.up[1] * (stB.v1 - stB.v0);
    return u1 - u0 > 0.1 && v1 - v0 > 0.1 ? [+u0.toFixed(3), +u1.toFixed(3), +v0.toFixed(3), +v1.toFixed(3)] : null;
  };
  const out: [number, number, number, number][] = [];
  if (!f.each) { const r = rect(f.bays[0], f.bays[1], f.storeys[0], f.storeys[1]); if (r) out.push(r); return out; }
  for (let s = f.storeys[0]; s <= f.storeys[1]; s++) for (let b = f.bays[0]; b <= f.bays[1]; b++) { if (!at(b, s).length) continue; const r = rect(b, b, s, s); if (r) out.push(r); }
  return out;
}

/**
 * Draw the fits on one panel (the group's main panel): each rectangle, clipped under `top`, minus the openings already
 * cut there, as closed boxes `outM` proud, only where the wall stands across the piece. Returns the boxes drawn.
 */
export function drawFacePanels(c: PanelCtx, cells: Cell[], fits: FacePanelFit[], top: number): number {
  const holes = [...c.holes.values()].flat().map(h => [h[0], h[1], h[2], h[3]] as [number, number, number, number]);
  let n = 0;
  for (const f of fits) for (const [u0, u1, v0, v1raw] of facePanelRects(cells, f)) {
    const v1 = Math.min(v1raw, top);
    if (v1 - v0 < 0.1) continue;
    for (const [a, b, lo, hi] of rectMinusRects(u0, u1, v0, v1, holes, 0.06)) {
      for (const [s0, s1] of intervals(c.p, lo, hi, 0.25)) {
        const x = Math.max(a, s0), y = Math.min(b, s1);
        if (y - x >= 0.06) { stripBox(c, f.slot, x, y, lo, hi, f.outM); n++; }
      }
    }
  }
  return n;
}
