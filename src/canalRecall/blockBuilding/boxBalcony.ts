/**
 * Box balconies (Haarlemmerweg 778-938 "Pepper", MVRDV 2023): closed trays that project from a wall on scattered
 * (storey, bay) cells, each a floor slab with a solid parapet on its front and both sides, in one dark colour. The
 * photographed tower carries them in no repeating rhythm, so the intent lists the cells per storey (`storeyBays`)
 * instead of an every/first pattern. Drawn on the group's main panel after the openings, under the cornice.
 *
 * Intent (per wall group, `boxBalconies`): {storeyBays: {"<storey>": [bay, ...]}, deep?, wide?, rail?, colour?}
 *   storey 1..storeys-1 (the floor line the tray sits on; 0 = ground has none), bay 0..baysPerStorey-1 (viewer's left);
 *   deep  = projection as a fraction of that storey's height (0.2..0.7, default 0.5: 1.5 m on a 3 m storey);
 *   wide  = the tray's width as a fraction of the bay pitch (0.4..1, default 0.85);
 *   rail  = the solid parapet's height as a fraction of the storey (0.15..0.5, default 0.35);
 *   colour = the trays' own colour (default the group's frame colour).
 * Absent: nothing is drawn and the mesh is byte-identical.
 */
import {solid, type PanelCtx} from './compose.ts';
import {fitsPanel, rectPoly} from './panels.ts';
import type {V3} from './mesh.ts';

export interface BoxBalconyIntent {storeyBays: Record<string, number[]>; deep?: number; wide?: number; rail?: number; colour?: string}
export interface BoxBalconyFit {cells: {storey: number; bay: number}[]; deep: number; wide: number; rail: number; slot: string}

export const BOX_BALCONY = {deep: 0.5, wide: 0.85, rail: 0.35, slabM: 0.24, wallM: 0.12, minDeepM: 0.6, maxDeepM: 2.2} as const;
const FIELDS = ['storeyBays', 'deep', 'wide', 'rail', 'colour'];
const HEX = /^#[0-9a-fA-F]{6}$/;

export function boxBalconyProblems(b: unknown, at: string, baysPerStorey: number | undefined, storeys: number | undefined): string[] {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return [`${at}: object {${FIELDS.join(', ')}}`];
  const a = b as Record<string, unknown>, out: string[] = [];
  for (const k of Object.keys(a)) if (!FIELDS.includes(k)) out.push(`${at}.${k}: unknown field (${FIELDS.join(', ')})`);
  const sb = a.storeyBays;
  if (!sb || typeof sb !== 'object' || Array.isArray(sb) || !Object.keys(sb).length) out.push(`${at}.storeyBays: {"<storey>": [bay, ...]} with at least one storey`);
  else for (const [k, v] of Object.entries(sb as Record<string, unknown>)) {
    const s = Number(k);
    if (!Number.isInteger(s) || s < 1 || (storeys !== undefined && s > storeys - 1)) out.push(`${at}.storeyBays.${k}: a storey 1..${storeys !== undefined ? storeys - 1 : 'storeys-1'} (the tray sits on its floor line)`);
    if (!Array.isArray(v) || !v.length || v.some(x => !Number.isInteger(x) || x < 0 || (baysPerStorey !== undefined && x >= baysPerStorey))) out.push(`${at}.storeyBays.${k}: bay indices 0..${baysPerStorey !== undefined ? baysPerStorey - 1 : 'bays-1'}`);
    else if (new Set(v).size !== v.length) out.push(`${at}.storeyBays.${k}: a bay is listed twice`);
  }
  const frac = (k: string, lo: number, hi: number) => { const v = a[k]; if (v !== undefined && (typeof v !== 'number' || !(v >= lo && v <= hi))) out.push(`${at}.${k}: a fraction ${lo}..${hi}`); };
  frac('deep', 0.2, 0.7); frac('wide', 0.4, 1); frac('rail', 0.15, 0.5);
  if (a.colour !== undefined && (typeof a.colour !== 'string' || !HEX.test(a.colour))) out.push(`${at}.colour: #rrggbb`);
  return out;
}

export function fitBoxBalconies(b: BoxBalconyIntent, slot: string): BoxBalconyFit {
  const cells = Object.entries(b.storeyBays).flatMap(([s, bays]) => bays.map(bay => ({storey: Number(s), bay})))
    .sort((x, y) => x.storey - y.storey || x.bay - y.bay);
  return {cells, deep: b.deep ?? BOX_BALCONY.deep, wide: b.wide ?? BOX_BALCONY.wide, rail: b.rail ?? BOX_BALCONY.rail, slot};
}

/** One tray's plan and heights on the panel's (u, v, d) axes, or null when its storey does not exist. */
export function boxBalconyRect(uMin: number, uMax: number, bays: number, levels: number[], f: BoxBalconyFit, cell: {storey: number; bay: number}):
  {u0: number; u1: number; floor: number; top: number; d: number} | null {
  const lo = levels[cell.storey], hi = levels[cell.storey + 1];
  if (lo === undefined || hi === undefined || !(hi - lo > 1.5)) return null;
  const H = hi - lo, W = (uMax - uMin) / bays, uc = uMin + (cell.bay + 0.5) * W, half = (f.wide * W) / 2;
  const d = Math.min(BOX_BALCONY.maxDeepM, Math.max(BOX_BALCONY.minDeepM, f.deep * H));
  return {u0: uc - half, u1: uc + half, floor: lo, top: lo + f.rail * H, d};
}

/** Draw the trays of one group on its main panel; returns the number drawn. */
export function drawBoxBalconies(c: PanelCtx, levels: number[], f: BoxBalconyFit, bays: number, topM: number): number {
  const p = c.p, S = BOX_BALCONY.slabM, T = BOX_BALCONY.wallM;
  let n = 0;
  for (const cell of f.cells) {
    const r = boxBalconyRect(p.uMin, p.uMax, bays, levels, f, cell);
    if (!r || r.top > topM || !fitsPanel(p, rectPoly(r.u0, r.u1, r.floor - S, r.top))) continue;
    const part = c.part();
    const box = (u0: number, u1: number, v0: number, v1: number, d0: number, d1: number) => solid(c, f.slot, (i, j, k) => c.P(i ? u1 : u0, j ? v1 : v0, k ? d1 : d0) as V3, part);
    box(r.u0, r.u1, r.floor - S, r.floor, 0, r.d);                 // slab under the floor line
    box(r.u0, r.u1, r.floor, r.top, r.d - T, r.d);                  // front parapet
    box(r.u0, r.u0 + T, r.floor, r.top, 0, r.d - T);                // side parapets, back to the wall
    box(r.u1 - T, r.u1, r.floor, r.top, 0, r.d - T);
    n++;
  }
  return n;
}
