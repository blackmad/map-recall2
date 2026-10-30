/**
 * Balcony bands (GitHub #126, the band fronts of post-war and recent housing: Bos en Lommer's gallery flats, the
 * 12-storey slab at Burgemeester Hogguerstraat 063809, Dulcie Septemberpad 242968): on each listed storey one
 * continuous floor slab across the whole wall, `deep` of the storey out from it, with a parapet along its front edge
 * `rail` of the storey tall (a solid upstand, a glass panel or a bar rail) and a cheek at each end. The storey's own
 * row (ribbon glazing, punched windows, a loggia band) stays behind the band: this component never cuts the wall.
 * Unlike `balconies` (a balcony per bay that replaces the bay's window, joined into runs only over punched windows)
 * the band is one slab per storey per panel, drawn over every panel of the group, so ribbon glazing keeps its full
 * width behind it. Drawn after the openings, under the cornice.
 *
 * Intent (per wall group, `balconyBands`): {storeys, deep?, rail?, kind?, colour?, railColour?}
 *   storeys    1..storeys-1: the floor lines the slabs sit on (0 = ground has none);
 *   deep       projection as a fraction of an upper storey (0.1..0.7, default 0.4: 1.2 m on a 3 m storey);
 *   rail       parapet height as a fraction of an upper storey (0.12..0.5, default 0.33: 1.0 m);
 *   kind       'solid' (an upstand in the slab colour, default), 'glass' (a glass panel between thin posts) or 'bars';
 *   colour     the slab (and solid parapet) colour, measured from the slab edges (default the group's stone colour);
 *   railColour the posts and top rail of a glass or bar parapet (default the group's frame colour).
 * Absent: nothing is drawn and the mesh is byte-identical.
 */
import {solid, type PanelCtx} from './compose.ts';
import {fitsPanel, rectPoly} from './panels.ts';
import type {V3} from './mesh.ts';

export type BalconyBandKind = 'solid' | 'glass' | 'bars';
export interface BalconyBandsIntent {storeys: number[]; deep?: number; rail?: number; kind?: BalconyBandKind; colour?: string; railColour?: string}
export interface BalconyBandsFit {storeys: number[]; deep: number; rail: number; kind: BalconyBandKind; slab: string; railSlot: string; glass: string}

/** Defaults and dimensions (m): slab thickness, parapet wall, rail and post sections, post spacing, the shortest run drawn. */
export const BALCONY_BAND = {deep: 0.4, rail: 0.33, slabM: 0.22, wallM: 0.1, topM: 0.06, postW: 0.05, postEveryM: 1.5, maxPosts: 48, minRunM: 1.5, minDeepM: 0.5, maxDeepM: 2.4} as const;
export const BALCONY_BAND_KINDS: readonly BalconyBandKind[] = ['solid', 'glass', 'bars'];
const FIELDS = ['storeys', 'deep', 'rail', 'kind', 'colour', 'railColour'];
const HEX = /^#[0-9a-fA-F]{6}$/;

export function balconyBandsProblems(b: unknown, at: string, storeys: number | undefined): string[] {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return [`${at}: object {${FIELDS.join(', ')}}`];
  const a = b as Record<string, unknown>, out: string[] = [];
  for (const k of Object.keys(a)) if (!FIELDS.includes(k)) out.push(`${at}.${k}: unknown field (${FIELDS.join(', ')})`);
  const st = a.storeys;
  if (!Array.isArray(st) || !st.length) out.push(`${at}.storeys: list of storeys 1..storeys-1 (the slab sits on its floor line)`);
  else {
    if (st.some(s => !Number.isInteger(s) || s < 1 || s > 39 || (storeys !== undefined && s > storeys - 1))) out.push(`${at}.storeys: storeys 1..${storeys !== undefined ? storeys - 1 : 'storeys-1'}`);
    if (new Set(st).size !== st.length) out.push(`${at}.storeys: a storey is listed twice`);
  }
  const frac = (k: string, lo: number, hi: number) => { const v = a[k]; if (v !== undefined && (typeof v !== 'number' || !(v >= lo && v <= hi))) out.push(`${at}.${k}: a fraction ${lo}..${hi} of a storey`); };
  frac('deep', 0.1, 0.7); frac('rail', 0.12, 0.5);
  if (a.kind !== undefined && !BALCONY_BAND_KINDS.includes(a.kind as BalconyBandKind)) out.push(`${at}.kind: one of ${BALCONY_BAND_KINDS.join(', ')}`);
  for (const k of ['colour', 'railColour']) if (a[k] !== undefined && (typeof a[k] !== 'string' || !HEX.test(a[k] as string))) out.push(`${at}.${k}: #rrggbb`);
  return out;
}

export function fitBalconyBands(b: BalconyBandsIntent, slots: {slab: string; rail: string; glass: string}): BalconyBandsFit {
  return {storeys: [...new Set(b.storeys)].sort((x, y) => x - y), deep: b.deep ?? BALCONY_BAND.deep, rail: b.rail ?? BALCONY_BAND.rail, kind: b.kind ?? 'solid', slab: slots.slab, railSlot: slots.rail, glass: slots.glass};
}

/** An upper storey's height (m): the first full upper storey, as the other storey-fraction components measure it. */
const unitOf = (levels: number[], top: number) => (levels.length > 2 ? levels[2] - levels[1] : top - (levels[1] ?? 0));

/**
 * The bands of one panel (pure): per listed storey that exists under `topM`, the runs along u where the slab and its
 * parapet fit the panel outline (a stepped or gabled panel breaks the run), each at least `minRunM` long, with the
 * floor line, the parapet top and the projection in metres.
 */
export function balconyBandRuns(p: {uMin: number; uMax: number}, levels: number[], f: BalconyBandsFit, topM: number, fits: (u0: number, u1: number, v0: number, v1: number) => boolean):
  {storey: number; u0: number; u1: number; floor: number; top: number; d: number}[] {
  const unit = unitOf(levels, topM), d = Math.min(BALCONY_BAND.maxDeepM, Math.max(BALCONY_BAND.minDeepM, f.deep * unit)), rh = f.rail * unit, S = BALCONY_BAND.slabM;
  const out: {storey: number; u0: number; u1: number; floor: number; top: number; d: number}[] = [];
  for (const s of f.storeys) {
    const lo = levels[s];
    if (lo === undefined || s < 1 || lo + rh > topM - 0.1) continue;
    const W = p.uMax - p.uMin, n = Math.max(1, Math.ceil(W / 0.5));
    let start: number | null = null;
    const close = (end: number) => { if (start !== null && end - start >= BALCONY_BAND.minRunM) out.push({storey: s, u0: start, u1: end, floor: lo, top: lo + rh, d}); start = null; };
    for (let i = 0; i < n; i++) {
      const a = p.uMin + (W * i) / n, b = p.uMin + (W * (i + 1)) / n;
      if (fits(a + 0.01, b - 0.01, lo - S, lo + rh)) { if (start === null) start = a; } else close(a);
    }
    close(p.uMax);
  }
  return out;
}

/** Draw the bands on one panel of the group; returns the runs drawn. */
export function drawBalconyBands(c: PanelCtx, levels: number[], f: BalconyBandsFit, topM: number): number {
  const p = c.p, S = BALCONY_BAND.slabM, T = BALCONY_BAND.wallM, R = BALCONY_BAND.topM, P = BALCONY_BAND.postW;
  const runs = balconyBandRuns(p, levels, f, topM, (u0, u1, v0, v1) => fitsPanel(p, rectPoly(u0, u1, v0, v1)));
  for (const r of runs) {
    const part = c.part();
    const box = (slot: string, u0: number, u1: number, v0: number, v1: number, d0: number, d1: number) => solid(c, slot, (i, j, k) => c.P(i ? u1 : u0, j ? v1 : v0, k ? d1 : d0) as V3, part);
    box(f.slab, r.u0, r.u1, r.floor - S, r.floor, 0, r.d);                                     // the slab under the floor line
    if (f.kind === 'solid') {
      box(f.slab, r.u0, r.u1, r.floor, r.top, r.d - T, r.d);                                   // the upstand along the front edge
      box(f.slab, r.u0, r.u0 + T, r.floor, r.top, 0, r.d - T);                                 // the cheeks back to the wall
      box(f.slab, r.u1 - T, r.u1, r.floor, r.top, 0, r.d - T);
      continue;
    }
    // glass or bars: a top rail and end posts in the rail colour; glass fills the front between them, bars are posts
    box(f.railSlot, r.u0, r.u1, r.top - R, r.top, r.d - R, r.d);
    box(f.railSlot, r.u0, r.u0 + P, r.floor, r.top - R, 0, r.d);
    box(f.railSlot, r.u1 - P, r.u1, r.floor, r.top - R, 0, r.d);
    const posts = Math.min(BALCONY_BAND.maxPosts, Math.max(1, Math.round((r.u1 - r.u0) / BALCONY_BAND.postEveryM)));
    for (let k = 1; k < posts; k++) { const u = r.u0 + ((r.u1 - r.u0) * k) / posts; box(f.railSlot, u - P / 2, u + P / 2, r.floor, r.top - R, r.d - R, r.d); }
    if (f.kind === 'glass') box(f.glass, r.u0 + P, r.u1 - P, r.floor + 0.04, r.top - R, r.d - R * 0.7, r.d - R * 0.3);
    else box(f.railSlot, r.u0 + P, r.u1 - P, r.floor + 0.08, r.floor + 0.08 + R, r.d - R, r.d);   // the bar rail's bottom rail
  }
  return runs.length;
}
