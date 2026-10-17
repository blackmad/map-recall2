/**
 * Slab canopies ("luifels") over the ground-storey openings (`groundCanopy`, Plan Zuid portiek rows of 1932-1936:
 * Rivierenbuurt, Boterdiepstraat 36-66 on the 2020-01-07 strip at 40 px/m). A thin painted slab sticks out of the wall
 * over the portiek doorway and over the wide ground window; its nose reads as one light line under the first-storey
 * sills. Boterdiepstraat 36/38 (ruler at 120 px/m): window head 2.12 m, slab 2.20-2.32 m, 0.05-0.13 m past the window
 * frame each side; the portiek slab 0.25 m past its 1.6 m doorway.
 *
 * Geometry, facade frame (x along the front, y up, z outward from the wall plane), after the library has built the
 * openings: per covered opening one box from `gap` over its head (trim included) to `thickness` above, `overhang` past
 * each side of its trim (clamped 5 cm inside the front's ends), from 5 mm inside the wall to `projection` out. Slabs that meet
 * or overlap at one height merge into one. The slab takes `colour` (default the front's trim) as a measured tint.
 * Absent = untouched (no mesh, byte-identical GLB).
 */
import * as T from 'three';
import type {CanalHouseRecipe} from '../canalhouseRecipes.ts';
import type {FitReport} from './fit.ts';
import type {CanalHouseIntent} from './intent.ts';
import {GROUND_CANOPY} from './groundCanopyIntent.ts';
import {frontEnds} from './historicPasses.ts';

type V3 = [number, number, number];
function quad(values: number[], a: V3, b: V3, c: V3, d: V3, out: V3) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const flip = n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0;
  values.push(...(flip ? [...a, ...c, ...b, ...a, ...d, ...c] : [...a, ...b, ...c, ...a, ...c, ...d]));
}

/** Slab spans of one front: [left, right, bottom] in facade metres, merged where they meet at one height. */
export interface CanopySpan { l: number; r: number; y: number }
export function mergeSpans(spans: CanopySpan[]): CanopySpan[] {
  const out: CanopySpan[] = [];
  for (const s of [...spans].sort((a, b) => a.l - b.l)) {
    const last = out.at(-1);
    if (last && s.l <= last.r + 1e-3 && Math.abs(s.y - last.y) < 0.05) { last.r = Math.max(last.r, s.r); last.y = Math.max(last.y, s.y); }
    else out.push({...s});
  }
  return out;
}

/** The canopy slabs of every front with `groundCanopy`; returns the number of slabs added. */
export function addGroundCanopies(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): number {
  let added = 0;
  for (const front of intent.fronts) {
    const c = front.groundCanopy, f = fit.fronts.find(x => x.id === front.id), elevation = recipe.elevations.find(e => e.id === front.id);
    if (!c || !f || !elevation) continue;
    const {facade, A, B} = frontEnds(group, recipe, f);
    const frontL = Math.min(A.x, B.x) + 0.05, frontR = Math.max(A.x, B.x) - 0.05, over = c.over ?? ['door', 'windows'];
    const firstStorey = (f.storeyHeightsM?.[0] ?? 3) - 0.05;
    const spans: CanopySpan[] = [], openings = elevation.openings.value;
    const head = (o: typeof openings[number]) => o.bottomM + o.heightM + (o.trimWidthM ?? 0);
    // The slab stays under the first-storey sills (5 cm clear).
    const ceiling = Math.min(firstStorey + 1.2, ...openings.filter(o => o.bottomM >= firstStorey).map(o => o.bottomM - 0.05));
    const doors = openings.filter(o => o.kind === 'door' && o.bottomM < 0.5);
    // A light over a door (its transom) belongs to the doorway: the slab goes over both.
    // A staircase light (`stairLight`, its ids `stair-light-*`) rising from over the door is not its transom: the slab goes under it.
  const overDoor = (o: typeof openings[number]) => o.id.startsWith('stair-light') ? undefined : doors.find(d => o !== d && o.leftM >= d.leftM - 0.05 && o.leftM + o.widthM <= d.leftM + d.widthM + 0.05 && o.bottomM >= head(d) - 0.3);
    for (const o of openings) {
      const isDoor = doors.includes(o), isWindow = o.kind === 'window' && head(o) < firstStorey && !overDoor(o);
      if (!(isDoor && over.includes('door')) && !(isWindow && over.includes('windows'))) continue;
      const trim = o.trimWidthM ?? 0, ov = isDoor ? c.doorOverhang ?? c.overhang : c.overhang;
      const top = Math.max(head(o), ...openings.filter(x => overDoor(x) === o).map(head));
      const l = Math.max(frontL, o.leftM - trim - ov), r = Math.min(frontR, o.leftM + o.widthM + trim + ov);
      if (r - l > 0.2 && top + c.gap + c.thickness < ceiling) spans.push({l, r, y: top + c.gap});
    }
    const values: number[] = [], z0 = -GROUND_CANOPY.insetM, z1 = c.projection;
    for (const s of mergeSpans(spans)) {
      const y0 = s.y, y1 = s.y + c.thickness;
      quad(values, [s.l, y0, z1], [s.r, y0, z1], [s.r, y1, z1], [s.l, y1, z1], [0, 0, 1]); // nose
      quad(values, [s.l, y1, z0], [s.r, y1, z0], [s.r, y1, z1], [s.l, y1, z1], [0, 1, 0]); // top
      quad(values, [s.l, y0, z0], [s.r, y0, z0], [s.r, y0, z1], [s.l, y0, z1], [0, -1, 0]); // underside
      quad(values, [s.l, y0, z0], [s.l, y0, z1], [s.l, y1, z1], [s.l, y1, z0], [-1, 0, 0]);
      quad(values, [s.r, y0, z0], [s.r, y0, z1], [s.r, y1, z1], [s.r, y1, z0], [1, 0, 0]);
      added++;
    }
    if (!values.length) continue;
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(values, 3)); g.computeVertexNormals();
    const mat = new T.MeshStandardMaterial({color: c.colour ?? elevation.palette?.value.trim ?? recipe.palette.value.trim, roughness: 0.9});
    mat.userData = {tintSource: 'measured'};
    const m = new T.Mesh(g, mat); m.name = `ground-canopy/${front.id}`; m.userData = {component: 'ground-canopy', surface: 'trim', pandId: intent.pandId};
    facade.add(m);
  }
  return added;
}
