/**
 * White head-line pier blocks (`pierBlocks`, Den Texstraat 7-27, 1872-84): at the head line of each listed storey a white
 * stone block stands on every pier between two window axes and on each end pier, alternating long and short and kept
 * inside the reveals (`long` / `short` metres, never wider than the pier less 0.1 m); optionally a continuous row of
 * small dentil blocks (`dentils`) under the cornice, over the top storey's heads. Facade frame, after the library has built
 * the openings; a front without `pierBlocks` is untouched (byte-identical).
 *
 * Measured on the 2024-12-04 strip of Den Texstraat 7-27 at 40 px/m: blocks 0.55 m and 0.28 m long, 0.3 m high, their
 * foot 0.05 m over the window heads of the ground, first and second storeys, one on each pier; dentils 0.2 m wide at
 * a 0.45 m pitch, 0.2 m high, in a row just under the cornice.
 */
import * as T from 'three';
import type {CanalHouseRecipe} from '../canalhouseRecipes.ts';
import type {CanalHouseIntent, FrontIntent} from './intent.ts';
import type {FitReport} from './fit.ts';
import {frontEnds} from './historicPasses.ts';

export const PIER_BLOCKS = {proudM: 0.045, long: 0.55, short: 0.28, rise: 0.3, over: 0.05, minPierM: 0.2, insetM: 0.05, minLong: 0.2, maxLong: 1.2, minRise: 0.1, maxRise: 0.6} as const;

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
type Opening = {id: string; kind: string; leftM: number; widthM: number; bottomM: number; heightM: number};
export type Block = {x0: number; x1: number; y0: number; y1: number};

/**
 * The blocks of a front, facade metres: per listed storey (default every storey with windows) one block centred on each
 * pier (the gap between neighbouring windows, and between a front end and the outer window), alternating long and short
 * from the left, `over` m over the storey's highest window head, at most the pier width less 0.1 m wide.
 */
export function pierBlockRects(openings: Opening[], pb: NonNullable<FrontIntent['pierBlocks']>, x0: number, x1: number): Block[] {
  const by = new Map<number, {l: number; r: number; head: number}[]>();
  for (const o of openings) {
    const s = storeyOf(o.id);
    if (o.kind !== 'window' || !Number.isFinite(s) || (pb.storeys && !pb.storeys.includes(s))) continue;
    (by.get(s) ?? by.set(s, []).get(s)!).push({l: o.leftM, r: o.leftM + o.widthM, head: o.bottomM + o.heightM});
  }
  const out: Block[] = [], lo = Math.min(x0, x1), hi = Math.max(x0, x1), long = pb.long ?? PIER_BLOCKS.long, short = pb.short ?? PIER_BLOCKS.short, rise = pb.rise ?? PIER_BLOCKS.rise;
  for (const [, ws] of [...by].sort((a, b) => a[0] - b[0])) {
    ws.sort((a, b) => a.l - b.l);
    const y = Math.max(...ws.map(w => w.head)) + (pb.over ?? PIER_BLOCKS.over);
    const piers: [number, number][] = [[lo, ws[0].l], ...ws.slice(1).map((w, k) => [ws[k].r, w.l] as [number, number]), [ws.at(-1)!.r, hi]];
    piers.forEach(([a, b], k) => {
      const room = b - a - 2 * PIER_BLOCKS.insetM;
      if (room < PIER_BLOCKS.minPierM) return;
      const w = Math.min(k % 2 === 0 ? long : short, room), c = (a + b) / 2;
      out.push({x0: c - w / 2, x1: c + w / 2, y0: y, y1: y + rise});
    });
  }
  return out;
}

/** The dentil row over the highest listed storey's heads (facade metres): blocks of `block` metres at `pitch`, `rise` high, from 0.1 m inside each end. */
export function dentilRects(openings: Opening[], pb: NonNullable<FrontIntent['pierBlocks']>, x0: number, x1: number): Block[] {
  const d = pb.dentils;
  if (!d) return [];
  const heads = openings.filter(o => o.kind === 'window' && Number.isFinite(storeyOf(o.id)) && (!pb.storeys || pb.storeys.includes(storeyOf(o.id)))).map(o => o.bottomM + o.heightM);
  if (!heads.length) return [];
  const y = Math.max(...heads) + (pb.over ?? PIER_BLOCKS.over) + (pb.rise ?? PIER_BLOCKS.rise) + 0.04, lo = Math.min(x0, x1) + 0.1, hi = Math.max(x0, x1) - 0.1, out: Block[] = [];
  for (let x = lo; x + d.block <= hi + 1e-9; x += d.pitch) out.push({x0: x, x1: x + d.block, y0: y, y1: y + d.rise});
  return out;
}

export function pierBlockProblems(f: FrontIntent, at: string): string[] {
  const v = f.pierBlocks as Record<string, unknown> | undefined, p: string[] = [];
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !['storeys', 'long', 'short', 'rise', 'over', 'dentils'].includes(k))) return [`${at}.pierBlocks: {storeys?, long?, short?, rise?, over?, dentils?}`];
  const num = (k: string, lo: number, hi: number) => { if (v[k] !== undefined && !(typeof v[k] === 'number' && (v[k] as number) >= lo && (v[k] as number) <= hi)) p.push(`${at}.pierBlocks.${k}: ${lo}..${hi} m`); };
  num('long', PIER_BLOCKS.minLong, PIER_BLOCKS.maxLong); num('short', 0.1, PIER_BLOCKS.maxLong); num('rise', PIER_BLOCKS.minRise, PIER_BLOCKS.maxRise); num('over', 0, 1);
  if (v.storeys !== undefined && (!Array.isArray(v.storeys) || !v.storeys.length || v.storeys.some(s => !Number.isInteger(s) || s < 0 || s >= f.storeys))) p.push(`${at}.pierBlocks.storeys: storey indices 0..${f.storeys - 1}`);
  if (v.dentils !== undefined) {
    const d = v.dentils as Record<string, unknown>;
    if (!d || typeof d !== 'object' || Array.isArray(d) || Object.keys(d).some(k => !['pitch', 'block', 'rise'].includes(k)) || !['pitch', 'block', 'rise'].every(k => typeof d[k] === 'number' && (d[k] as number) > 0.05 && (d[k] as number) < 1.5)) p.push(`${at}.pierBlocks.dentils: {pitch, block, rise} each 0.05..1.5 m`);
    else if ((d.block as number) >= (d.pitch as number)) p.push(`${at}.pierBlocks.dentils.block: under the pitch`);
  }
  return p;
}

export function addPierBlocks(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): number {
  let added = 0;
  const palette = recipe.palette.value;
  for (const front of intent.fronts) {
    const pb = front.pierBlocks;
    if (!pb) continue;
    const elevation = recipe.elevations.find(e => e.id === front.id), f = fit.fronts.find(x => x.id === front.id);
    if (!elevation || !f) continue;
    const {facade, A, B} = frontEnds(group, recipe, f), values: number[] = [];
    for (const b of [...pierBlockRects(elevation.openings.value, pb, A.x, B.x), ...dentilRects(elevation.openings.value, pb, A.x, B.x)]) { box(values, b.x0, b.x1, b.y0, b.y1, -0.005, PIER_BLOCKS.proudM); added++; }
    if (!values.length) continue;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(values, 3)); g.computeVertexNormals();
    const m = new T.Mesh(g, new T.MeshStandardMaterial({color: palette.stone, roughness: 1}));
    m.name = `pier-blocks/${front.id}`; m.userData = {component: 'pier-blocks', surface: 'stone', pandId: intent.pandId};
    facade.add(m);
  }
  return added;
}
