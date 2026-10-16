/**
 * Glazed tile panels (`tilePanels`, Bellamybuurt 1915 rows: Hasebroekstraat 56-70): on every pier of the listed storeys
 * (the wall between two windows of the storey, and between the front ends and its outer windows), at the windows'
 * mid-height, a row of glazed tile diamonds between two patterned brick courses. Facade frame (x along the front, y up,
 * z outward), after the library has built the openings; a front without `tilePanels` is untouched.
 *
 * Sizes (measured on the 2024-12-11 strip of Hasebroekstraat 56-70 at 40 px/m): diamonds 0.22 m across (corner to corner),
 * 0.32 m apart, 2 cm proud; the courses 0.12 m high, 1.5 cm proud, their centres 0.28 m above and below the diamond row;
 * a pier narrower than 0.45 m carries nothing, at most three diamonds per pier. The tile colour is a measured tint
 * (drawn as measured, like the glass-block band), the courses default to the palette's band brick, else the wall.
 */
import * as T from 'three';
import type {CanalHouseRecipe} from '../canalhouseRecipes.ts';
import type {CanalHouseIntent} from './intent.ts';
import type {FitReport} from './fit.ts';
import {frontEnds} from './historicPasses.ts';

export const TILE_PANELS = {diamondM: 0.22, pitchM: 0.32, proudM: 0.02, courseM: 0.12, courseProudM: 0.015, courseOffsetM: 0.28, minPierM: 0.45, maxPerPier: 3,
  /** `place: sills` (Hasebroekstraat 90-114): 0.14 m squares, 0.3 m apart, centred 0.25 m under the sill. */
  squareM: 0.14, squarePitchM: 0.3, sillGapM: 0.25} as const;

type V3 = [number, number, number];

/** A flat polygon (x, y in the facade plane, convex, in order) extruded from z0 to z1. */
function slab(values: number[], pts: [number, number][], z0: number, z1: number) {
  const push = (a: V3, b: V3, c: V3) => values.push(...a, ...b, ...c);
  for (let i = 1; i + 1 < pts.length; i++) push([pts[0][0], pts[0][1], z1], [pts[i][0], pts[i][1], z1], [pts[i + 1][0], pts[i + 1][1], z1]);
  // sides (counter-clockwise outline seen from the front: outward normals)
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    push([p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1]);
    push([p[0], p[1], z0], [q[0], q[1], z1], [p[0], p[1], z1]);
  }
}

const meshOf = (values: number[], mat: T.Material, name: string, surface: string, pandId: string) => {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(values, 3)); g.computeVertexNormals();
  const m = new T.Mesh(g, mat); m.name = name; m.userData = {component: 'tile-panels', surface, pandId};
  return m;
};

/** The piers of one storey: [left, right] of every wall stretch between its windows and the front ends. */
export function storeyPiers(windows: {l: number; r: number}[], frontL: number, frontR: number): [number, number][] {
  const w = [...windows].sort((a, b) => a.l - b.l), out: [number, number][] = [];
  let x = frontL;
  for (const o of w) { out.push([x, o.l]); x = Math.max(x, o.r); }
  out.push([x, frontR]);
  return out.filter(([a, b]) => b - a >= TILE_PANELS.minPierM);
}

export function addTilePanels(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): number {
  let added = 0;
  for (const front of intent.fronts) {
    const tp = front.tilePanels;
    if (!tp) continue;
    const elevation = recipe.elevations.find(e => e.id === front.id), f = fit.fronts.find(x => x.id === front.id);
    if (!elevation || !f) continue;
    const {facade, A, B} = frontEnds(group, recipe, f);
    const frontL = Math.min(A.x, B.x), frontR = Math.max(A.x, B.x);
    const tiles: number[] = [], courses: number[] = [];
    for (const s of tp.storeys) {
      const wins = elevation.openings.value.filter(o => o.kind === 'window' && new RegExp(`^(?:.*-)?s${s}-b\\d+[ab]?$`).test(o.id));
      if (!wins.length) continue;
      if (tp.place === 'sills') {
        // A row of small square tiles under the sill of each window on the listed axes (axis = the window's bay index).
        const side = TILE_PANELS.squareM, n = tp.count ?? 3;
        for (const o of wins) {
          const axis = Number(/-b(\d+)[ab]?$/.exec(o.id)?.[1]);
          if (tp.axes && !tp.axes.includes(axis)) continue;
          const yc = o.bottomM - TILE_PANELS.sillGapM, xc = o.leftM + o.widthM / 2;
          for (let k = 0; k < n; k++) {
            const x = xc + (k - (n - 1) / 2) * TILE_PANELS.squarePitchM;
            slab(tiles, [[x - side / 2, yc - side / 2], [x + side / 2, yc - side / 2], [x + side / 2, yc + side / 2], [x - side / 2, yc + side / 2]], -0.005, TILE_PANELS.proudM);
            added++;
          }
        }
        continue;
      }
      const yc = wins.reduce((t, o) => t + o.bottomM + o.heightM / 2, 0) / wins.length;
      // A timber oriel (`bayWindows.oriel`) on this storey is an opening too: no pier runs behind it.
      const oriel = f.erker?.oriel?.storeys.includes(s) ? [{l: f.erker.leftM, r: f.erker.leftM + f.erker.widthM}] : [];
      for (const [l, r] of storeyPiers([...wins.map(o => ({l: o.leftM, r: o.leftM + o.widthM})), ...oriel], frontL, frontR)) {
        const inset = 0.04, a = l + inset, b = r - inset;
        for (const dy of [-TILE_PANELS.courseOffsetM, TILE_PANELS.courseOffsetM]) slab(courses, [[a, yc + dy - TILE_PANELS.courseM / 2], [b, yc + dy - TILE_PANELS.courseM / 2], [b, yc + dy + TILE_PANELS.courseM / 2], [a, yc + dy + TILE_PANELS.courseM / 2]], -0.005, TILE_PANELS.courseProudM);
        const n = Math.max(1, Math.min(TILE_PANELS.maxPerPier, Math.floor((b - a - 0.1) / TILE_PANELS.pitchM)));
        const h = TILE_PANELS.diamondM / 2;
        for (let k = 0; k < n; k++) {
          const x = (a + b) / 2 + (k - (n - 1) / 2) * TILE_PANELS.pitchM;
          slab(tiles, [[x, yc - h], [x + h, yc], [x, yc + h], [x - h, yc]], -0.005, TILE_PANELS.proudM);
          added++;
        }
      }
    }
    if (!tiles.length) continue;
    const tileMat = new T.MeshStandardMaterial({color: tp.colour, roughness: 0.6});
    tileMat.userData = {tintSource: 'measured'};
    facade.add(meshOf(tiles, tileMat, `tile-panels/${front.id}/tiles`, 'accent', intent.pandId));
    if (tp.courses === false || !courses.length) continue;
    const courseColour = tp.courses ?? intent.palette.band ?? recipe.palette.value.wall;
    facade.add(meshOf(courses, new T.MeshStandardMaterial({color: courseColour, roughness: 1}), `tile-panels/${front.id}/courses`, 'wall', intent.pandId));
  }
  return added;
}
