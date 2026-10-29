/**
 * Iron wall anchors (`wallAnchors`, De Pijp 1882-1893 rows: Albert Cuypstraat 138-162, Van Woustraat 32-46): the
 * forged anchor heads (muurankers) that tie each floor's beams to the front, a dark cross on every pier between two
 * window axes and on the end piers by the party walls, just over the window heads of each listed storey. Facade frame
 * (x along the front, y up, z outward), after the library has built the openings; a front without `wallAnchors` is
 * untouched.
 *
 * Each anchor is a vertical bar `size` metres tall (0.06 m wide) crossed by a bar 0.55 x `size` wide (0.05 m high),
 * centred `over` metres over the storey's highest window head, 4.2 cm proud (the jamb blocks' depth: 3 cm sits in the
 * audit's z-fight band), in the door colour (black iron). Measured on the 2022-03-21 strip of Albert Cuypstraat 144-162
 * at 40 px/m: heads 0.3-0.4 m tall, 0.3-0.4 m over the window heads (6.7-6.8 m over 6.4 m), on every pier and 0.25-0.35 m
 * in from each party wall.
 */
import * as T from 'three';
import type {CanalHouseRecipe} from '../canalhouseRecipes.ts';
import type {CanalHouseIntent, FrontIntent} from './intent.ts';
import type {FitReport} from './fit.ts';
import {frontEnds} from './historicPasses.ts';

export const WALL_ANCHORS = {proudM: 0.042, barM: 0.06, crossM: 0.05, crossShare: 0.55, size: 0.36, over: 0.35, minSize: 0.15, maxSize: 0.8, minOver: 0.05, maxOver: 1.2} as const;

type V3 = [number, number, number];
function box(values: number[], x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const q = (a: V3, b: V3, c: V3, d: V3) => values.push(...a, ...b, ...c, ...a, ...c, ...d);
  q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  q([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]);
  q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
  q([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
}

const storeyOf = (id: string) => Number(/(?:^|-)s(\d+)-b\d+[ab]?$/.exec(id)?.[1] ?? NaN);

/**
 * The anchor centres (x, y) of a front, facade metres: per listed storey (default every storey above the ground), one
 * on each pier between neighbouring windows (the midpoint of the gap) and one on each end pier, halfway between the
 * front end (`x0`, `x1`) and the outer window, all `over` metres over the storey's highest window head.
 */
export function wallAnchorCentres(openings: {id: string; kind: string; leftM: number; widthM: number; bottomM: number; heightM: number}[], wa: NonNullable<FrontIntent['wallAnchors']>, x0: number, x1: number): [number, number][] {
  const by = new Map<number, {l: number; r: number; head: number}[]>();
  for (const o of openings) {
    const s = storeyOf(o.id);
    if (o.kind !== 'window' || !Number.isFinite(s) || s < 1 || (wa.storeys && !wa.storeys.includes(s))) continue;
    (by.get(s) ?? by.set(s, []).get(s)!).push({l: o.leftM, r: o.leftM + o.widthM, head: o.bottomM + o.heightM});
  }
  const out: [number, number][] = [];
  for (const [, ws] of [...by].sort((a, b) => a[0] - b[0])) {
    ws.sort((a, b) => a.l - b.l);
    const y = Math.max(...ws.map(w => w.head)) + (wa.over ?? WALL_ANCHORS.over);
    const xs = [(Math.min(x0, x1) + ws[0].l) / 2, ...ws.slice(1).map((w, k) => (ws[k].r + w.l) / 2), (ws.at(-1)!.r + Math.max(x0, x1)) / 2];
    for (const x of xs) out.push([x, y]);
  }
  return out;
}

export function wallAnchorProblems(f: FrontIntent, at: string): string[] {
  const v = f.wallAnchors as Record<string, unknown> | undefined, p: string[] = [];
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !['storeys', 'size', 'over'].includes(k))) return [`${at}.wallAnchors: {storeys?, size?, over?}`];
  const num = (k: string, lo: number, hi: number) => { if (v[k] !== undefined && !(typeof v[k] === 'number' && (v[k] as number) >= lo && (v[k] as number) <= hi)) p.push(`${at}.wallAnchors.${k}: ${lo}..${hi} m`); };
  num('size', WALL_ANCHORS.minSize, WALL_ANCHORS.maxSize);
  num('over', WALL_ANCHORS.minOver, WALL_ANCHORS.maxOver);
  if (v.storeys !== undefined && (!Array.isArray(v.storeys) || !v.storeys.length || v.storeys.some(s => !Number.isInteger(s) || s < 1 || s >= f.storeys))) p.push(`${at}.wallAnchors.storeys: upper storey indices 1..${f.storeys - 1}`);
  return p;
}

export function addWallAnchors(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): number {
  let added = 0;
  const palette = recipe.palette.value;
  for (const front of intent.fronts) {
    const wa = front.wallAnchors;
    if (!wa) continue;
    const elevation = recipe.elevations.find(e => e.id === front.id), f = fit.fronts.find(x => x.id === front.id);
    if (!elevation || !f) continue;
    const {facade, A, B} = frontEnds(group, recipe, f);
    const size = wa.size ?? WALL_ANCHORS.size, half = size / 2, cross = size * WALL_ANCHORS.crossShare / 2, values: number[] = [];
    for (const [x, y] of wallAnchorCentres(elevation.openings.value, wa, A.x, B.x)) {
      box(values, x - WALL_ANCHORS.barM / 2, x + WALL_ANCHORS.barM / 2, y - half, y + half, -0.005, WALL_ANCHORS.proudM);
      box(values, x - cross, x + cross, y - WALL_ANCHORS.crossM / 2, y + WALL_ANCHORS.crossM / 2, -0.005, WALL_ANCHORS.proudM);
      added++;
    }
    if (!values.length) continue;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(values, 3)); g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshStandardMaterial({color: palette.door, roughness: 1}));
    m.name = `wall-anchors/${front.id}`; m.userData = {component: 'wall-anchors', surface: 'door', pandId: intent.pandId};
    facade.add(m);
  }
  return added;
}
