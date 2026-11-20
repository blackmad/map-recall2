/**
 * Wall features for blank and glazed office fronts (lane houthavens-memel-wiborg-20261120, Danzigerbocht 45):
 *
 * - `signs`: more than one painted or mounted lettering on a group's main panel, each in its own band
 *   (`along` / `up` fractions of the panel), as the black base's yellow 45, stencilled FIGHT DISTRICT and DAILY PAPER.
 * - `wallLights`: a framed glazed slot or a single window standing on a blank (cladding) wall, `along` / `up`
 *   fractions of the main panel, with mullions and transoms: the base's two-storey glazed slot and its small square
 *   window. Drawn proud of the wall (frame 8 cm, glass 5 cm), clear of cladding lines at 3.5-4 cm.
 * - `terraces`: white layered terrace floors over glazed storeys: a pale slab projecting across every panel of the
 *   group at each listed storey's floor line, with an open rail, and optionally a thin canopy roof at the top.
 *
 * Intent contract (no metric fields but `deep`): fractions of the main panel for `along` / `up`, storey indices for
 * terraces. Every field is opt-in; absent, a group draws nothing new (byte-identical).
 */
import {fitsPanel, rectPoly} from './panels.ts';
import {intervals, type PanelCtx} from './compose.ts';

export interface WallSignIntent { text: string; colour?: string; along: [number, number]; up: [number, number] }
export interface WallLightIntent { along: [number, number]; up: [number, number]; lights?: number; rows?: number }
/** `posts`: columns about every `posts` m (2..12) along each panel, from the foot to the roof line, under the slab fronts */
/** `wrap`: the slabs (not the rails or canopy) run on `deep` past each panel end, so the slabs of two fronts meet round a corner
 *  instead of ending in two loose fins (252692) */
/** `glassRail`: the rail sheet is the group's glazing under a slab-coloured top bar (a glass balustrade, 252692), not a sheet
 *  in the terrace colour */
export interface TerraceIntent { storeys: number[]; deep?: number; colour?: string; rail?: boolean; roof?: boolean; posts?: number; wrap?: boolean; glassRail?: boolean }

export interface WallLightFit { along: [number, number]; up: [number, number]; lights: number; rows: number }
export interface TerraceFit { storeys: number[]; deep: number; rail: boolean; roof: boolean; slot: string; railSlot: string; posts?: number; wrap?: boolean }

export const WALL_LIGHT = {frame: 0.08, glass: 0.05, bar: 0.06, minM: 0.4} as const;
export const TERRACE = {deep: 1.6, slab: 0.28, railH: 1.0, roofDeep: 2.2, roofSlab: 0.22, post: 0.35} as const;

const frac = (a: unknown, gap: number) => Array.isArray(a) && a.length === 2 && a.every(x => typeof x === 'number' && x >= 0 && x <= 1) && (a[1] as number) - (a[0] as number) >= gap;
const intIn = (x: unknown, lo: number, hi: number) => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;

export function signsProblems(input: unknown, at: string): string[] {
  if (!Array.isArray(input) || !input.length || input.length > 6) return [`${at}: list of 1..6 {text, colour, along, up}`];
  const out: string[] = [];
  input.forEach((s, k) => {
    const w = `${at}[${k}]`;
    if (!s || typeof s !== 'object' || Array.isArray(s)) { out.push(`${w}: object {text, colour, along, up}`); return; }
    for (const key of Object.keys(s)) if (!['text', 'colour', 'along', 'up'].includes(key)) out.push(`${w}.${key}: unknown field (text, colour, along, up)`);
    const r = s as Record<string, unknown>;
    if (typeof r.text !== 'string' || !r.text.trim() || r.text.length > 40) out.push(`${w}.text: 1..40 characters`);
    if (!frac(r.along, 0.05)) out.push(`${w}.along: [from, to] fractions 0..1 of the panel width, at least 0.05 apart`);
    if (!frac(r.up, 0.02) || (r.up as number[])[1] - (r.up as number[])[0] > 0.6) out.push(`${w}.up: [from, to] fractions 0..1 of the panel height, 0.02..0.6 apart`);
  });
  return out;
}

export function wallLightsProblems(input: unknown, at: string): string[] {
  if (!Array.isArray(input) || !input.length || input.length > 12) return [`${at}: list of 1..12 {along, up, lights, rows}`];
  const out: string[] = [];
  input.forEach((s, k) => {
    const w = `${at}[${k}]`;
    if (!s || typeof s !== 'object' || Array.isArray(s)) { out.push(`${w}: object {along, up, lights, rows}`); return; }
    for (const key of Object.keys(s)) if (!['along', 'up', 'lights', 'rows'].includes(key)) out.push(`${w}.${key}: unknown field (along, up, lights, rows)`);
    const r = s as Record<string, unknown>;
    if (!frac(r.along, 0.02)) out.push(`${w}.along: [from, to] fractions 0..1 of the panel width, at least 0.02 apart`);
    if (!frac(r.up, 0.02)) out.push(`${w}.up: [from, to] fractions 0..1 of the panel height, at least 0.02 apart`);
    if (r.lights !== undefined && !intIn(r.lights, 1, 8)) out.push(`${w}.lights: 1..8 columns`);
    if (r.rows !== undefined && !intIn(r.rows, 1, 8)) out.push(`${w}.rows: 1..8 rows`);
  });
  return out;
}

export function terracesProblems(input: unknown, at: string, storeys: number): string[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return [`${at}: object {storeys, deep, colour, rail, roof}`];
  const out: string[] = [], r = input as Record<string, unknown>;
  for (const key of Object.keys(r)) if (!['storeys', 'deep', 'colour', 'rail', 'roof', 'posts', 'wrap', 'glassRail'].includes(key)) out.push(`${at}.${key}: unknown field (storeys, deep, colour, rail, roof, posts, wrap, glassRail)`);
  if (r.posts !== undefined && !(typeof r.posts === 'number' && r.posts >= 2 && r.posts <= 12)) out.push(`${at}.posts: column spacing 2..12 m`);
  if (!Array.isArray(r.storeys) || !r.storeys.length || !r.storeys.every(s => intIn(s, 1, Math.max(1, storeys - 1)))) out.push(`${at}.storeys: upper storey indices 1..${storeys - 1}`);
  if (r.deep !== undefined && !(typeof r.deep === 'number' && r.deep >= 0.3 && r.deep <= 3)) out.push(`${at}.deep: 0.3..3 m`);
  for (const b of ['rail', 'roof', 'wrap', 'glassRail']) if (r[b] !== undefined && typeof r[b] !== 'boolean') out.push(`${at}.${b} must be true or false`);
  if (r.glassRail === true && r.rail === false) out.push(`${at}.glassRail: needs the rail (rail false draws none)`);
  return out;
}

/** Framed glazed slots and windows on the main panel. Returns the lights drawn. */
export function drawWallLights(c: PanelCtx, lights: readonly WallLightFit[], slots: {frame: string; glass: string}): number {
  const p = c.p, W = p.uMax - p.uMin, H = p.vMax - p.vMin, {frame: fo, glass: go, bar} = WALL_LIGHT;
  let n = 0;
  for (const l of lights) {
    const u0 = p.uMin + W * l.along[0], u1 = p.uMin + W * l.along[1], v0 = p.vMin + H * l.up[0], v1 = p.vMin + H * l.up[1];
    if (u1 - u0 < WALL_LIGHT.minM || v1 - v0 < WALL_LIGHT.minM || !fitsPanel(p, rectPoly(u0, u1, v0, v1))) continue;
    let part = c.part();
    c.quadRaw(slots.glass, u0 + bar, v0 + bar, u1 - bar, v1 - bar, go, part);
    part = c.part();
    c.box(slots.frame, u0, u1, v0, v0 + bar, 0, fo, part); c.box(slots.frame, u0, u1, v1 - bar, v1, 0, fo, part);
    c.box(slots.frame, u0, u0 + bar, v0 + bar, v1 - bar, 0, fo, part); c.box(slots.frame, u1 - bar, u1, v0 + bar, v1 - bar, 0, fo, part);
    for (let k = 1; k < l.lights; k++) { const u = u0 + (u1 - u0) * k / l.lights; c.box(slots.frame, u - bar / 2, u + bar / 2, v0 + bar, v1 - bar, 0, fo, part); }
    for (let k = 1; k < l.rows; k++) { const v = v0 + (v1 - v0) * k / l.rows; c.box(slots.frame, u0 + bar, u1 - bar, v - bar / 2, v + bar / 2, 0, fo, part); }
    n++;
  }
  return n;
}

/** Terrace floors at the listed storeys' floor lines (and a canopy roof at `roofM`), across the panel where it stands. */
export function drawTerraces(c: PanelCtx, levels: readonly number[], t: TerraceFit, roofM: number): number {
  const p = c.p, {slab, railH, roofSlab} = TERRACE;
  // `wrap`: a stretch that reaches a panel end runs on `deep` past it (the corner square of two fronts' slabs)
  const ends = (a: number, b: number): [number, number] => t.wrap ? [a - (a - p.uMin < 0.05 ? t.deep : 0), b + (p.uMax - b < 0.05 ? t.deep : 0)] : [a, b];
  let n = 0;
  for (const st of t.storeys) {
    const v = levels[st];
    if (v === undefined || v - slab < p.vMin + 0.5 || v + railH > roofM + 0.01) continue;
    for (const [a0, b0] of intervals(p, v - slab, v + railH)) {
      if (b0 - a0 < 1) continue;
      const [a, b] = ends(a0, b0);
      let part = c.part();
      c.box(t.slot, a, b, v - slab, v, 0.01, t.deep, part);
      if (t.rail) {
        part = c.part();
        // a thin closed sheet (a single quad's edges would be open edges to the shell gate)
        c.box(t.railSlot, a0 + 0.05, b0 - 0.05, v, v + railH - 0.05, t.deep - 0.05, t.deep - 0.03, part);
        c.box(t.slot, a0, b0, v + railH - 0.05, v + railH, t.deep - 0.07, t.deep, part);
      }
      n++;
    }
  }
  if (t.posts) {
    // columns at the slab front, evenly spaced about every `posts` m across each stretch of wall that stands foot to roof
    const lo = Math.max(p.vMin, 0), w = TERRACE.post;
    for (const [a, b] of intervals(p, lo + 0.05, roofM - 0.05)) {
      if (b - a < 2) continue;
      const n = Math.max(1, Math.round((b - a) / t.posts));
      for (let k = 0; k <= n; k++) {
        const u = Math.min(b - w / 2, Math.max(a + w / 2, a + (b - a) * k / n));
        c.box(t.slot, u - w / 2, u + w / 2, lo, roofM, t.deep - w - 0.05, t.deep - 0.05, c.part());
      }
    }
  }
  if (t.roof && roofM - p.vMin > 3) {
    for (const [a0, b0] of intervals(p, roofM - roofSlab - 0.4, roofM - 0.02)) {
      if (b0 - a0 < 1) continue;
      c.box(t.slot, a0, b0, roofM - roofSlab, roofM, 0.01, TERRACE.roofDeep, c.part());
      n++;
    }
  }
  return n;
}
