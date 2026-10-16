/**
 * Bellamybuurt 1915 roofline and oriels (Hasebroekstraat 53-67 and 56-70, the 2024-12-11 strip at 40 px/m), after the
 * library has built the facade. Each pass is opt-in; a front without `bayWindows.oriel` or `dormerCap` is untouched.
 *
 *  - `paintOriels`: the modules of a timber oriel's `paintedStoreys` take the trim colour on their panels and closures
 *    (the white timber top storey of the oriel); the other storeys keep the wall brick of the stallrisers.
 *  - `addOrielConsoles`: `oriel.console`: a white slab under the oriel's foot, `ORIEL.consoleM` thick, `consoleOverM`
 *    past its plan on the front and sides (the bracketed shelf over the ground-floor window).
 *  - `addHoistCaps`: `dormerCap`: the flared hood over a dormer that shelters the hoist beam: a trapezoid as wide as the
 *    dormer at its foot (3 cm over the dormer top) and `flare` wider on each side at the top, `rise` high, `DORMER_CAP.depthM`
 *    deep back from 3 cm before the dormer front, in the cap colour (a measured tint).
 * Facade frame: x along the front, y up, z outward from the wall plane.
 */
import * as T from 'three';
import type {CanalHouseRecipe} from '../canalhouseRecipes.ts';
import type {FitReport} from './fit.ts';
import {DORMER_CAP, ORIEL, type CanalHouseIntent} from './intent.ts';
import {offsetConvex, prism} from './amsterdamSchool.ts';

const material = (colour: string) => new T.MeshStandardMaterial({color: colour, roughness: 1});
const meshOf = (values: number[], mat: T.Material, name: string, component: string, surface: string, pandId: string) => {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(values, 3)); g.computeVertexNormals();
  const m = new T.Mesh(g, mat); m.name = name; m.userData = {component, surface, pandId};
  return m;
};
const trimOf = (recipe: CanalHouseRecipe, id: string) => recipe.elevations.find(e => e.id === id)?.palette?.value.trim ?? recipe.palette.value.trim;

/** Panels and closures of the painted oriel storeys in the trim colour. */
export function paintOriels(group: T.Group, recipe: CanalHouseRecipe, fit: FitReport): number {
  let painted = 0;
  for (const f of fit.fronts) {
    const o = f.erker?.oriel, facade = group.getObjectByName(`elevation/${f.id}`);
    if (!o?.paintedStoreys.length || !facade) continue;
    const trim = material(trimOf(recipe, f.id)), lowers: T.Mesh[] = [];
    facade.traverse(m => {
      const s = /(?:^|[-/])erker-s(\d+)\/(?:.*\/)?wall\/(\w+)/.exec(m.name);
      if (!(m instanceof T.Mesh) || !s || !o.paintedStoreys.includes(Number(s[1]))) return;
      // `paintFrom`: the stallriser keeps its brick; a trim facing 1 cm proud covers it from that height up.
      if (o.paintFrom !== undefined && s[2] === 'lower') { lowers.push(m); return; }
      m.material = trim; m.userData.surface = 'trim'; painted++;
    });
    for (const m of lowers) {
      m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox!, top = b.max.y + m.position.y, from = Math.min(top - 0.05, o.paintFrom!);
      const w = b.max.x - b.min.x, depth = b.max.z - b.min.z, facing = new T.Mesh(new T.BoxGeometry(w, top - from, 0.01), trim);
      facing.name = m.name.replace(/\/wall\/lower$/, '/trim/paint'); facing.userData = {...m.userData, role: 'frame', surface: 'trim'};
      facing.position.set(m.position.x, from + (top - from) / 2, m.position.z + depth / 2 + 0.01);
      m.parent!.add(facing); painted++;
    }
  }
  return painted;
}

/** The white console slab under an oriel's foot. */
export function addOrielConsoles(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): number {
  let added = 0;
  for (const f of fit.fronts) {
    const e = f.erker, facade = group.getObjectByName(`elevation/${f.id}`);
    if (!e?.oriel?.console || !facade) continue;
    const out = 0.015, inset = (e.widthM - e.frontWidthM) / 2, l = e.leftM, r = e.leftM + e.widthM, d = out + e.depthM;
    const plan = offsetConvex([[l, out], [l + inset, d], [r - inset, d], [r, out]], ORIEL.consoleOverM).map(([x, z]) => [x, Math.max(0, z)] as [number, number]);
    plan[0][1] = -0.005; plan[3][1] = -0.005;
    const values: number[] = [];
    prism(values, plan, e.oriel.footM - ORIEL.consoleM, e.oriel.footM - 0.002, {bottom: true});
    facade.add(meshOf(values, material(trimOf(recipe, f.id)), `oriel-console/${f.id}`, 'erker', 'trim', intent.pandId));
    added++;
  }
  return added;
}

/** Hoist caps on the listed dormers of every front with `dormerCap`. */
export function addHoistCaps(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe): number {
  let added = 0;
  for (const front of intent.fronts) {
    const c = front.dormerCap, k = front.dormers ?? 0;
    if (!c || !k) continue;
    const elevation = recipe.elevations.find(e => e.id === front.id), facade = group.getObjectByName(`elevation/${front.id}`);
    if (!elevation?.dormers || !facade) continue;
    const rise = c.rise ?? DORMER_CAP.rise, flare = c.flare ?? DORMER_CAP.flare, values: number[] = [];
    for (const d of elevation.dormers.value) {
      const j = Number(/^dormer-(\d+)$/.exec(d.id)?.[1]);
      if (!Number.isInteger(j) || !c.dormers.includes(j % k)) continue;
      // 3 cm over the dormer top: no face coplanar with the dormer's frame and wall tops (the geometry audit's 2 cm band).
      const top = d.bottomM + d.heightM + 0.03, x0 = d.leftM, x1 = d.leftM + d.widthM, zf = -(d.setbackM ?? 0) + 0.03, zb = zf - DORMER_CAP.depthM;
      // The trapezoid in the facade plane (x, y), extruded from the back (zb) to the front (zf): prism() takes a plan in
      // (x, z) and heights in y, so build the faces directly.
      const P = [[x0, top], [x1, top], [x1 + flare, top + rise], [x0 - flare, top + rise]] as [number, number][];
      const push = (a: number[], b: number[], cc: number[]) => values.push(...a, ...b, ...cc);
      // front and back
      push([...P[0], zf], [...P[1], zf], [...P[2], zf]); push([...P[0], zf], [...P[2], zf], [...P[3], zf]);
      push([...P[0], zb], [...P[2], zb], [...P[1], zb]); push([...P[0], zb], [...P[3], zb], [...P[2], zb]);
      // sides, top and the soffit
      for (let i = 0; i < 4; i++) {
        const p = P[i], q = P[(i + 1) % 4];
        push([...p, zb], [...q, zf], [...p, zf]); push([...p, zb], [...q, zb], [...q, zf]);
      }
      added++;
    }
    if (!values.length) continue;
    const mat = new T.MeshStandardMaterial({color: c.colour ?? DORMER_CAP.colour, roughness: 0.9});
    mat.userData = {tintSource: 'measured'};
    facade.add(meshOf(values, mat, `hoist-caps/${front.id}`, 'dormer', 'roof', intent.pandId));
  }
  return added;
}

/** Every pass of this set, or null when no front uses it (nothing is touched). */
export function applyOrielHoist(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport) {
  if (!intent.fronts.some(f => f.bayWindows?.oriel || f.dormerCap)) return null;
  return {paintedOriels: paintOriels(group, recipe, fit), consoles: addOrielConsoles(group, intent, recipe, fit), hoistCaps: addHoistCaps(group, intent, recipe)};
}
