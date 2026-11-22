/**
 * Segmental window hoods (`segmentalHoods`, Cornelis Schuytstraat 9-15, 1897): a white moulded segmental hood over each window of the
 * listed storeys, standing on short drops (ears) either side, over a square-headed window. The kit could only draw a
 * segmental window head with an arch ring, which arches the glass; on these rows the glass is square and the hood
 * stands clear above the jack-block head.
 *
 * Facade frame (x along the front, y up, z outward), after the library has built the openings; a front without
 * `segmentalHoods` is untouched (byte-identical). Per window: a curved band `height` m deep whose underside rises from the
 * springing (`gap` m over the window head) by `rise` m at the centre (parabolic, close to the circular arc at these
 * rises), running `past` m beyond each jamb, `proud` m out from the wall; with `ears`, a block under each end dropping
 * `ears` m below the springing. Colour: the stone colour (painted: `palette.stoneMaterial`).
 *
 * Measured on the 2022-03-21 strip of Cornelis Schuytstraat 7-15 at 40 px/m: hoods 0.10-0.14 m past the window each
 * side, the band about 0.15 m deep, rising 0.2-0.25 m, springing 0.05-0.1 m over the head, the ears 0.12-0.18 m long.
 */
import * as T from 'three';
import type {CanalHouseRecipe} from '../canalhouseRecipes.ts';
import type {CanalHouseIntent, FrontIntent} from './intent.ts';
import type {FitReport} from './fit.ts';
import {frontEnds} from './historicPasses.ts';

export interface SegmentalHoodsIntent {
  /** Storey indices whose windows carry a hood (0 = the ground storey). */
  storeys: number[];
  /** Arc rise at the centre, metres (0.05..0.6, default 0.22). */
  rise?: number;
  /** Band depth, metres (0.06..0.4, default 0.15). */
  height?: number;
  /** Metres the hood runs past each jamb (0..0.4, default 0.12). */
  past?: number;
  /** Springing height over the window head, metres (0..0.5, default 0.07). */
  gap?: number;
  /** Metres proud of the wall (0.04..0.3, default 0.09). */
  proud?: number;
  /** Drop of the end blocks under the springing, metres (0..0.5, default 0.15; 0 = no ears). */
  ears?: number;
}

export const SEGMENTAL_HOOD = {rise: 0.22, height: 0.15, past: 0.12, gap: 0.07, proud: 0.09, ears: 0.15, earWidth: 0.11, segments: 8} as const;
const KEYS = ['storeys', 'rise', 'height', 'past', 'gap', 'proud', 'ears'];
const RANGES: Record<string, [number, number]> = {rise: [0.05, 0.6], height: [0.06, 0.4], past: [0, 0.4], gap: [0, 0.5], proud: [0.04, 0.3], ears: [0, 0.5]};

export function segmentalHoodProblems(f: FrontIntent, at: string): string[] {
  const v = (f as {segmentalHoods?: unknown}).segmentalHoods as Record<string, unknown> | undefined, p: string[] = [];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return [`${at}.segmentalHoods: {storeys, rise?, height?, past?, gap?, proud?, ears?}`];
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) p.push(`${at}.segmentalHoods.${k}: unknown field (one of ${KEYS.join(', ')})`);
  if (!Array.isArray(v.storeys) || !v.storeys.length || v.storeys.some(s => !Number.isInteger(s) || s < 0 || s >= f.storeys)) p.push(`${at}.segmentalHoods.storeys: storey indices 0..${f.storeys - 1}`);
  for (const [k, [lo, hi]] of Object.entries(RANGES)) if (v[k] !== undefined && !(typeof v[k] === 'number' && (v[k] as number) >= lo && (v[k] as number) <= hi)) p.push(`${at}.segmentalHoods.${k}: ${lo}..${hi} m`);
  return p;
}

const storeyOf = (id: string) => Number(/(?:^|-)s(\d+)-b\d+[ab]?$/.exec(id)?.[1] ?? NaN);

export interface HoodSpan {x0: number; x1: number; spring: number}
/** One hood per window of the listed storeys: its ends and springing line (facade metres), left to right. */
export function hoodSpans(openings: {id: string; kind: string; leftM: number; widthM: number; bottomM: number; heightM: number}[], wh: SegmentalHoodsIntent): HoodSpan[] {
  const past = wh.past ?? SEGMENTAL_HOOD.past, gap = wh.gap ?? SEGMENTAL_HOOD.gap;
  return openings.filter(o => o.kind === 'window' && wh.storeys.includes(storeyOf(o.id)))
    .sort((a, b) => a.bottomM - b.bottomM || a.leftM - b.leftM)
    .map(o => ({x0: o.leftM - past, x1: o.leftM + o.widthM + past, spring: o.bottomM + o.heightM + gap}));
}

type V3 = [number, number, number];
/** A closed hexahedron from its front quad (z = z1) and back quad (z = z0), corners [x, y] bl, br, tr, tl; faces wound outward. */
function hexa(values: number[], c: [number, number][], z0: number, z1: number) {
  const [bl, br, tr, tl] = c;
  const q = (a: V3, b: V3, cc: V3, d: V3) => values.push(...a, ...b, ...cc, ...a, ...cc, ...d);
  const F = (p: [number, number]): V3 => [p[0], p[1], z1], B = (p: [number, number]): V3 => [p[0], p[1], z0];
  q(F(bl), F(br), F(tr), F(tl)); // front
  q(B(bl), B(tl), B(tr), B(br)); // back
  q(B(tl), F(tl), F(tr), B(tr)); // top
  q(B(bl), B(br), F(br), F(bl)); // bottom
  q(B(bl), F(bl), F(tl), B(tl)); // left
  q(B(br), B(tr), F(tr), F(br)); // right
}

/** Triangle positions of one hood (band segments plus ears), facade frame. */
export function hoodGeometry(s: HoodSpan, wh: SegmentalHoodsIntent): number[] {
  const rise = wh.rise ?? SEGMENTAL_HOOD.rise, h = wh.height ?? SEGMENTAL_HOOD.height, proud = wh.proud ?? SEGMENTAL_HOOD.proud, ears = wh.ears ?? SEGMENTAL_HOOD.ears;
  const n = SEGMENTAL_HOOD.segments, c = (s.x0 + s.x1) / 2, hw = (s.x1 - s.x0) / 2, under = (x: number) => s.spring + rise * (1 - ((x - c) / hw) ** 2);
  const values: number[] = [];
  for (let i = 0; i < n; i++) {
    const xa = s.x0 + (s.x1 - s.x0) * i / n, xb = s.x0 + (s.x1 - s.x0) * (i + 1) / n;
    hexa(values, [[xa, under(xa)], [xb, under(xb)], [xb, under(xb) + h], [xa, under(xa) + h]], -0.005, proud);
  }
  if (ears > 0) for (const [xa, xb] of [[s.x0, s.x0 + SEGMENTAL_HOOD.earWidth], [s.x1 - SEGMENTAL_HOOD.earWidth, s.x1]]) hexa(values, [[xa, s.spring - ears], [xb, s.spring - ears], [xb, s.spring + 0.01], [xa, s.spring + 0.01]], -0.005, proud * 0.9);
  return values;
}

export function addSegmentalHoods(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): number {
  let added = 0;
  const palette = recipe.palette.value;
  for (const front of intent.fronts) {
    const wh = (front as {segmentalHoods?: SegmentalHoodsIntent}).segmentalHoods;
    if (!wh) continue;
    const elevation = recipe.elevations.find(e => e.id === front.id), f = fit.fronts.find(x => x.id === front.id);
    if (!elevation || !f) continue;
    const {facade} = frontEnds(group, recipe, f);
    const values: number[] = [];
    for (const s of hoodSpans(elevation.openings.value, wh)) { values.push(...hoodGeometry(s, wh)); added++; }
    if (!values.length) continue;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(values, 3)); g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshStandardMaterial({color: palette.stone ?? palette.trim, roughness: 1}));
    m.name = `segmental-hoods/${front.id}`; m.userData = {component: 'segmental-hoods', surface: 'stone', pandId: intent.pandId};
    facade.add(m);
  }
  return added;
}
