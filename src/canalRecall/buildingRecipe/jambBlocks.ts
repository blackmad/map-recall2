/**
 * Jamb blocks (`jambBlocks`, Eerste Helmersstraat 116-122, 1893): short white stone blocks bonded into the brick beside
 * each window, `count` on each jamb, evenly spaced up the opening (the block-and-start dressing of the Helmersbuurt
 * rows: three a side on every storey, the white keystones and sills of the same rows above and below them). Facade frame
 * (x along the front, y up, z outward), after the library has built the openings; a front without `jambBlocks` is
 * untouched.
 *
 * Block k of `count` is centred at (k + 0.5) / count of the window's height, `rise` metres high, running `reach` metres
 * out from the jamb (from the window's outer edge; it overlaps the frame by 2 cm), 4.2 cm proud (3 cm sits in the audit's
 * tight z-fight band over the wall), in the stone colour
 * (painted: `palette.stoneMaterial`). Windows of the listed `storeys` only (default every storey).
 * Measured on the 2024-11-29 strip of Eerste Helmersstraat 108-138 at 40 px/m: 116-118 three blocks a jamb, 0.12 m high,
 * reaching 0.14 m, at 0.17, 0.48 and 0.81 of the storey-2 window (7.6-9.7 m).
 */
import * as T from 'three';
import type {CanalHouseRecipe} from '../canalhouseRecipes.ts';
import type {CanalHouseIntent, FrontIntent} from './intent.ts';
import type {FitReport} from './fit.ts';
import {frontEnds} from './historicPasses.ts';

export const JAMB_BLOCKS = {proudM: 0.042, overlapM: 0.02, maxCount: 6, minRiseM: 0.05, maxRiseM: 0.5, minReachM: 0.04, maxReachM: 0.5} as const;

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

/** The (x0, x1, y0, y1) of every jamb block of the windows of the listed storeys (facade metres, left to right, bottom up). */
export function jambBlockBoxes(openings: {id: string; kind: string; leftM: number; widthM: number; bottomM: number; heightM: number}[], jb: NonNullable<FrontIntent['jambBlocks']>): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (const o of openings) {
    const s = storeyOf(o.id);
    if (o.kind !== 'window' || !Number.isFinite(s) || (jb.storeys && !jb.storeys.includes(s))) continue;
    for (let k = 0; k < jb.count; k++) {
      const y = o.bottomM + o.heightM * (k + 0.5) / jb.count, y0 = y - jb.rise / 2, y1 = y + jb.rise / 2;
      out.push([o.leftM - jb.reach, o.leftM + JAMB_BLOCKS.overlapM, y0, y1], [o.leftM + o.widthM - JAMB_BLOCKS.overlapM, o.leftM + o.widthM + jb.reach, y0, y1]);
    }
  }
  return out;
}

export function jambBlockProblems(f: FrontIntent, at: string): string[] {
  const v = f.jambBlocks as Record<string, unknown> | undefined, p: string[] = [];
  if (!v || typeof v !== 'object' || Object.keys(v).some(k => !['count', 'rise', 'reach', 'storeys'].includes(k))) return [`${at}.jambBlocks: {count, rise, reach, storeys?}`];
  if (!(Number.isInteger(v.count) && (v.count as number) >= 1 && (v.count as number) <= JAMB_BLOCKS.maxCount)) p.push(`${at}.jambBlocks.count: 1..${JAMB_BLOCKS.maxCount} blocks a jamb`);
  const num = (k: string, lo: number, hi: number) => { if (!(typeof v[k] === 'number' && (v[k] as number) >= lo && (v[k] as number) <= hi)) p.push(`${at}.jambBlocks.${k}: ${lo}..${hi} m`); };
  num('rise', JAMB_BLOCKS.minRiseM, JAMB_BLOCKS.maxRiseM);
  num('reach', JAMB_BLOCKS.minReachM, JAMB_BLOCKS.maxReachM);
  if (v.storeys !== undefined && (!Array.isArray(v.storeys) || !v.storeys.length || v.storeys.some(s => !Number.isInteger(s) || s < 0 || s >= f.storeys))) p.push(`${at}.jambBlocks.storeys: storey indices 0..${f.storeys - 1}`);
  return p;
}

export function addJambBlocks(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): number {
  let added = 0;
  const palette = recipe.palette.value;
  for (const front of intent.fronts) {
    const jb = front.jambBlocks;
    if (!jb) continue;
    const elevation = recipe.elevations.find(e => e.id === front.id), f = fit.fronts.find(x => x.id === front.id);
    if (!elevation || !f) continue;
    const {facade} = frontEnds(group, recipe, f);
    const values: number[] = [];
    for (const [x0, x1, y0, y1] of jambBlockBoxes(elevation.openings.value, jb)) { box(values, x0, x1, y0, y1, -0.005, JAMB_BLOCKS.proudM); added++; }
    if (!values.length) continue;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(values, 3)); g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshStandardMaterial({color: palette.stone ?? palette.trim, roughness: 1}));
    m.name = `jamb-blocks/${front.id}`; m.userData = {component: 'jamb-blocks', surface: 'stone', pandId: intent.pandId};
    facade.add(m);
  }
  return added;
}
