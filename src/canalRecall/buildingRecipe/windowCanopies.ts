/**
 * Lettered window canopies (`windowCanopies`, PC Hooftstraat 2024-12-11: Saint Laurent 101 and Prada 63 hang a small
 * canopy with the house name over each first-floor window, Chopard 53 a black one): over every window of one upper
 * storey a short rigid canopy, its sloped top running from the wall `over` m over the window head down to a vertical
 * valance `projection` m out, and optionally the `sign` lettered across each valance (signage.ts strokes, 3 mm proud
 * of the valance). Facade frame (x along the front, y up, z outward), after the library has built the openings; a front
 * without `windowCanopies` is untouched (byte-identical).
 *
 * Measured on the PC Hooftstraat strips at 40 px/m: canopies 0.08-0.12 m wider than the window each side, the valance
 * 0.22-0.3 m deep, the top 0.25-0.35 m over the head, projecting about 0.45 m (seen in the obliques).
 */
import * as T from 'three';
import type {CanalHouseRecipe} from '../canalhouseRecipes.ts';
import {SIGN_TEXT, type CanalHouseIntent, type FrontIntent} from './intent.ts';
import type {FitReport} from './fit.ts';
import {frontEnds} from './historicPasses.ts';
import {letteringGeometry} from './signage.ts';

export interface WindowCanopiesIntent {
  /** 0-based upper storey whose windows carry a canopy (1 = the first floor). */
  storey: number;
  /** Canopy fabric/panel colour, #rrggbb measured on the strip. */
  colour: string;
  /** Lettering across every valance (house name as signed), in `textColour`. Absent = plain canopies. */
  sign?: {text: string; textColour: string};
  /** Metres the canopy stands out from the wall (0.25..1.0, default 0.45). */
  projection?: number;
  /** Valance depth in metres (0.15..0.45, default 0.26). */
  valance?: number;
  /** Strip evidence (what the photo shows). */
  evidence?: string;
}

export const WINDOW_CANOPY = {projection: 0.45, valance: 0.26, over: 0.3, past: 0.1, fall: 0.18, thick: 0.03, letterProud: 0.003, letterShare: 0.62, letterSpan: 0.86} as const;

const storeyOf = (id: string) => Number(/(?:^|-)s(\d+)-b\d+[ab]?$/.exec(id)?.[1] ?? NaN);
const KEYS = ['storey', 'colour', 'sign', 'projection', 'valance', 'evidence'];

export function windowCanopyProblems(f: FrontIntent, at: string): string[] {
  const v = f.windowCanopies as unknown as Record<string, unknown> | undefined, p: string[] = [];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return [`${at}.windowCanopies: {storey, colour, sign?, projection?, valance?, evidence?}`];
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) p.push(`${at}.windowCanopies.${k}: unknown field (one of ${KEYS.join(', ')})`);
  if (!Number.isInteger(v.storey) || (v.storey as number) < 1 || (v.storey as number) >= f.storeys) p.push(`${at}.windowCanopies.storey: an upper storey index 1..${f.storeys - 1}`);
  const hex = (x: unknown) => typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x);
  if (!hex(v.colour)) p.push(`${at}.windowCanopies.colour: #rrggbb`);
  if (v.sign !== undefined) {
    const s = v.sign as Record<string, unknown>;
    if (!s || typeof s !== 'object' || Object.keys(s).some(k => !['text', 'textColour'].includes(k))) p.push(`${at}.windowCanopies.sign: {text, textColour}`);
    else {
      if (typeof s.text !== 'string' || !SIGN_TEXT.test(s.text)) p.push(`${at}.windowCanopies.sign.text: 1..40 of A-Z a-z 0-9 & ' - . space`);
      if (!hex(s.textColour)) p.push(`${at}.windowCanopies.sign.textColour: #rrggbb`);
    }
  }
  const num = (k: string, lo: number, hi: number) => { if (v[k] !== undefined && !(typeof v[k] === 'number' && (v[k] as number) >= lo && (v[k] as number) <= hi)) p.push(`${at}.windowCanopies.${k}: ${lo}..${hi} m`); };
  num('projection', 0.25, 1.0);
  num('valance', 0.15, 0.45);
  if (v.evidence !== undefined && typeof v.evidence !== 'string') p.push(`${at}.windowCanopies.evidence: a string`);
  return p;
}

/** One canopy per window of the storey: [x0, x1] along the front and the head (y) it hangs over, facade metres. */
export function canopySpans(openings: {id: string; kind: string; leftM: number; widthM: number; bottomM: number; heightM: number}[], storey: number, x0: number, x1: number): {x0: number; x1: number; head: number}[] {
  const lo = Math.min(x0, x1) + 0.02, hi = Math.max(x0, x1) - 0.02;
  return openings.filter(o => o.kind === 'window' && storeyOf(o.id) === storey)
    .sort((a, b) => a.leftM - b.leftM)
    .map(o => ({x0: Math.max(lo, o.leftM - WINDOW_CANOPY.past), x1: Math.min(hi, o.leftM + o.widthM + WINDOW_CANOPY.past), head: o.bottomM + o.heightM}));
}

type V3 = [number, number, number];
/** Push triangle a-b-c wound so its normal points away from `c0` (outward from a convex solid). */
function tri(values: number[], a: V3, b: V3, c: V3, c0: V3) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const m = [(a[0] + b[0] + c[0]) / 3 - c0[0], (a[1] + b[1] + c[1]) / 3 - c0[1], (a[2] + b[2] + c[2]) / 3 - c0[2]];
  if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] >= 0) values.push(...a, ...b, ...c); else values.push(...a, ...c, ...b);
}
/** A closed convex prism: the (z, y) section `pts` swept from x0 to x1, every face wound outward. */
export function prism(values: number[], pts: [number, number][], x0: number, x1: number) {
  const n = pts.length, c0: V3 = [(x0 + x1) / 2, pts.reduce((s, p) => s + p[1], 0) / n, pts.reduce((s, p) => s + p[0], 0) / n];
  for (let i = 0; i < n; i++) {
    const [za, ya] = pts[i], [zb, yb] = pts[(i + 1) % n];
    tri(values, [x0, ya, za], [x0, yb, zb], [x1, yb, zb], c0);
    tri(values, [x0, ya, za], [x1, yb, zb], [x1, ya, za], c0);
  }
  for (let i = 1; i + 1 < n; i++) for (const x of [x0, x1]) tri(values, [x, pts[0][1], pts[0][0]], [x, pts[i][1], pts[i][0]], [x, pts[i + 1][1], pts[i + 1][0]], c0);
}

/** Canopy section in (z, y) for a canopy whose top meets the wall at `top`: sloped top, then the valance at the nose. */
export function canopySection(top: number, projection: number, valance: number): {top: [number, number][]; valance: [number, number][]; nose: number} {
  const {fall, thick} = WINDOW_CANOPY, nose = top - fall;
  return {
    top: [[-0.005, top - thick], [projection - thick, nose - thick], [projection - thick, nose], [-0.005, top]],
    valance: [[projection - thick, nose - valance], [projection, nose - valance], [projection, nose], [projection - thick, nose]],
    nose,
  };
}

export function addWindowCanopies(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): {canopies: number; letteringTris: number} {
  let canopies = 0, letteringTris = 0;
  for (const front of intent.fronts) {
    const wc = front.windowCanopies;
    if (!wc) continue;
    const elevation = recipe.elevations.find(e => e.id === front.id), f = fit.fronts.find(x => x.id === front.id);
    if (!elevation || !f) continue;
    const {facade, A, B} = frontEnds(group, recipe, f);
    const projection = wc.projection ?? WINDOW_CANOPY.projection, valance = wc.valance ?? WINDOW_CANOPY.valance;
    const body: number[] = [], letters: number[] = [];
    for (const s of canopySpans(elevation.openings.value, wc.storey, A.x, B.x)) {
      const sec = canopySection(s.head + WINDOW_CANOPY.over, projection, valance);
      prism(body, sec.top, s.x0, s.x1);
      prism(body, sec.valance, s.x0, s.x1);
      canopies++;
      if (wc.sign) {
        const w = s.x1 - s.x0, l = letteringGeometry({text: wc.sign.text, heightM: valance * WINDOW_CANOPY.letterShare, maxWidthM: w * WINDOW_CANOPY.letterSpan}, f.mirrored);
        const cx = (s.x0 + s.x1) / 2, cy = sec.nose - valance / 2, z = projection + WINDOW_CANOPY.letterProud;
        for (let i = 0; i < l.positions.length; i += 3) letters.push(l.positions[i] + cx, l.positions[i + 1] + cy, l.positions[i + 2] + z);
        letteringTris += l.triangles;
      }
    }
    if (!body.length) continue;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(body, 3)); g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshStandardMaterial({color: wc.colour, roughness: 0.9}));
    m.name = `window-canopies/${front.id}`; m.userData = {component: 'window-canopies', surface: 'awning', pandId: intent.pandId};
    facade.add(m);
    if (letters.length) {
      const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(letters, 3)); lg.computeVertexNormals();
      const lm = new T.Mesh(lg, new T.MeshStandardMaterial({color: wc.sign!.textColour, roughness: 0.6}));
      lm.name = 'sign/lettering'; lm.userData = {component: 'sign', surface: 'sign', pandId: intent.pandId};
      facade.add(lm);
    }
  }
  return {canopies, letteringTris};
}
