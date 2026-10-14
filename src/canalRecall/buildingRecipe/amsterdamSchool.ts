/**
 * Post-library geometry of the Amsterdam School component set (1915-1935 shop streets such as Jan Evertsenstraat), all
 * opt-in by intent field and reported by the fit (fit.ts); a house without them is untouched:
 *
 *  - `addCanopies`: the rigid shop canopy (`shopfront.awning.style: rigid`): a slab with a fascia on its nose. An end that
 *    a block face's `continuity.canopy` group joins to its neighbour runs onto the party plane (through the frontage
 *    corner, along the party wall), so two neighbours' pieces meet in one plane: no gap, no overlap, one slab per group
 *    that is still cut per pand (pandRanges keep working).
 *  - `addErkerCaps`: the hipped or flat cap on a multi-bay erker (`bayWindows.bays`); the erker stack itself is the
 *    library's glazed bay module, one per storey.
 *  - `addCornerTowers`: the body and cap of a corner tower (`tower.corner`) behind the two fronts that rise over it.
 *  - `addLisenes`: brick pilasters at front ends (`lisenes`), halves of a shared one meeting on the party plane.
 *  - glass-block band over a rigid canopy (`awning.glassBlocks`), built with the canopy.
 *  - `addWindowHoods`: projecting brick hoods over the upper windows (`windowHoods`).
 *  - `steppedTowerCap`: the stepped tower cap (two receding brick tiers under a flat slab), for every tower.
 *
 * Facade-frame passes work in the library's elevation frame (x along the front, y up, z outward); the corner tower works
 * in the recipe-local plan (x east, z south), where both fronts are known.
 */
import * as T from 'three';
import type {CanalHouseRecipe, CanalhousePoint} from '../canalhouseRecipes.ts';
import {ROOF_COLOURS, type FitReport} from './fit.ts';
import type {CanalHouseIntent} from './intent.ts';
import {frontEnds} from './historicPasses.ts';

type V3 = [number, number, number];
const material = (colour: string) => new T.MeshStandardMaterial({color: colour, roughness: 1});

/** Triangle a-b-c wound so its normal points along `out`. */
function tri(values: number[], a: V3, b: V3, c: V3, out: V3) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  values.push(...(n[0] * out[0] + n[1] * out[1] + n[2] * out[2] >= 0 ? [...a, ...b, ...c] : [...a, ...c, ...b]));
}
/** Planar polygon (convex, in order) as a fan, facing `out`. */
function face(values: number[], pts: V3[], out: V3) { for (let i = 1; i + 1 < pts.length; i++) tri(values, pts[0], pts[i], pts[i + 1], out); }

/** A convex prism between y0 and y1 over a plan (x, z) polygon: sides facing away from its centre, top up, bottom down. */
export function prism(values: number[], plan: [number, number][], y0: number, y1: number, opts: {top?: boolean; bottom?: boolean} = {}) {
  const cx = plan.reduce((s, p) => s + p[0], 0) / plan.length, cz = plan.reduce((s, p) => s + p[1], 0) / plan.length;
  plan.forEach((p, k) => {
    const q = plan[(k + 1) % plan.length], out: V3 = [(p[0] + q[0]) / 2 - cx, 0, (p[1] + q[1]) / 2 - cz];
    face(values, [[p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]]], out);
  });
  if (opts.top !== false) face(values, plan.map(p => [p[0], y1, p[1]] as V3), [0, 1, 0]);
  if (opts.bottom !== false) face(values, plan.map(p => [p[0], y0, p[1]] as V3), [0, -1, 0]);
}

/** Offset a convex plan polygon outward by `d` (inward when negative), keeping its edge directions. */
export function offsetConvex(plan: [number, number][], d: number): [number, number][] {
  const n = plan.length, cx = plan.reduce((s, p) => s + p[0], 0) / n, cz = plan.reduce((s, p) => s + p[1], 0) / n;
  const lines = plan.map((p, k) => {
    const q = plan[(k + 1) % n], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    let nx = (q[1] - p[1]) / len, nz = -(q[0] - p[0]) / len;
    if (nx * ((p[0] + q[0]) / 2 - cx) + nz * ((p[1] + q[1]) / 2 - cz) < 0) { nx = -nx; nz = -nz; }
    return {p: [p[0] + nx * d, p[1] + nz * d], dir: [(q[0] - p[0]) / len, (q[1] - p[1]) / len]};
  });
  return lines.map((b, k) => {
    const a = lines[(k - 1 + n) % n], det = a.dir[0] * -b.dir[1] - a.dir[1] * -b.dir[0];
    if (Math.abs(det) < 1e-9) return b.p as [number, number];
    const t = ((b.p[0] - a.p[0]) * -b.dir[1] - (b.p[1] - a.p[1]) * -b.dir[0]) / det;
    return [a.p[0] + a.dir[0] * t, a.p[1] + a.dir[1] * t] as [number, number];
  });
}

const meshOf = (values: number[], mat: T.Material, name: string, component: string, surface: string, pandId: string) => {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(values, 3)); g.computeVertexNormals();
  const m = new T.Mesh(g, mat); m.name = name; m.userData = {component, surface, pandId};
  return m;
};

/**
 * Stepped tower cap on a plan (x, z) at the tower top `y1`: a first brick tier 4 cm proud of the walls, a second set
 * 0.3 m back, each 0.35 m high, and a 0.12 m slab overhanging the second tier by 8 cm. Adds three meshes under `parent`.
 */
export function steppedTowerCap(parent: T.Object3D, plan: [number, number][], y1: number, wall: T.Material, roof: T.Material, name: string, pandId: string): number {
  const tiers: number[] = [], slab: number[] = [];
  prism(tiers, offsetConvex(plan, 0.04), y1, y1 + 0.35, {bottom: true});
  prism(tiers, offsetConvex(plan, -0.3), y1 + 0.35, y1 + 0.7, {bottom: false});
  prism(slab, offsetConvex(plan, -0.22), y1 + 0.7, y1 + 0.82);
  parent.add(meshOf(tiers, wall, `${name}/cap-tiers`, 'tower', 'wall', pandId));
  parent.add(meshOf(slab, roof, `${name}/cap`, 'tower', 'roof', pandId));
  return 1;
}

/** Glass-block band: pale grey-green blocks, a light mortar grid. */
export const GLASS_BLOCK = {glass: '#aebbb8', mortar: '#d4d2ca', proudM: 0.015, gridProudM: 0.025, jointM: 0.03};

/**
 * Glass-block band over a rigid canopy (facade frame): one glass panel `proudM` in front of the wall (front face and its
 * four 1.5 cm reveals) and the mortar joints of a `cellM` grid as flat strips just in front of it. About 2 triangles per
 * joint: a 6 x 1 m band is ~90 triangles.
 */
export function glassBlockBand(b: {leftM: number; widthM: number; bottomM: number; topM: number; cellM: number}) {
  const glass: number[] = [], grid: number[] = [], g = GLASS_BLOCK, x0 = b.leftM, x1 = b.leftM + b.widthM, y0 = b.bottomM, y1 = b.topM;
  face(glass, [[x0, y0, g.proudM], [x1, y0, g.proudM], [x1, y1, g.proudM], [x0, y1, g.proudM]], [0, 0, 1]);
  face(glass, [[x0, y1, 0], [x1, y1, 0], [x1, y1, g.proudM], [x0, y1, g.proudM]], [0, 1, 0]);
  face(glass, [[x0, y0, 0], [x1, y0, 0], [x1, y0, g.proudM], [x0, y0, g.proudM]], [0, -1, 0]);
  face(glass, [[x0, y0, 0], [x0, y1, 0], [x0, y1, g.proudM], [x0, y0, g.proudM]], [-1, 0, 0]);
  face(glass, [[x1, y0, 0], [x1, y1, 0], [x1, y1, g.proudM], [x1, y0, g.proudM]], [1, 0, 0]);
  const z = g.gridProudM, h = g.jointM / 2;
  const nx = Math.max(1, Math.round(b.widthM / b.cellM)), ny = Math.max(1, Math.round((y1 - y0) / b.cellM));
  for (let k = 0; k <= nx; k++) { const x = x0 + (x1 - x0) * k / nx, a = Math.max(x0, x - h), c = Math.min(x1, x + h); face(grid, [[a, y0, z], [c, y0, z], [c, y1, z], [a, y1, z]], [0, 0, 1]); }
  for (let k = 0; k <= ny; k++) { const y = y0 + (y1 - y0) * k / ny, a = Math.max(y0, y - h), c = Math.min(y1, y + h); face(grid, [[x0, a, z], [x1, a, z], [x1, c, z], [x0, c, z]], [0, 0, 1]); }
  return {glass, grid};
}

/**
 * Rigid canopies: a slab (wall to `projectM - fasciaDepthM`, `thicknessM` thick) and a fascia on its nose (`fasciaDepthM`
 * thick, `fasciaM` high, top flush with the slab). A party end follows the party plane, a free end is square.
 */
export function addCanopies(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): number {
  let added = 0;
  for (const f of fit.fronts) {
    const c = f.canopy, facade = group.getObjectByName(`elevation/${f.id}`);
    if (!c || !facade) continue;
    const {A, B, left, right} = frontEnds(group, recipe, f);
    const x0 = (z: number) => c.partyStart ? A.x + (z - A.z) * left.x : c.leftM, x1 = (z: number) => c.partyEnd ? B.x + (z - B.z) * right.x : c.leftM + c.widthM;
    const box = (values: number[], z0: number, z1: number, y0: number, y1: number) => {
      const at = (x: (z: number) => number, y: number, z: number): V3 => [x(z), y, z];
      const L = (y: number, z: number) => at(x0, y, z), R = (y: number, z: number) => at(x1, y, z);
      face(values, [L(y0, z1), R(y0, z1), R(y1, z1), L(y1, z1)], [0, 0, 1]); // front
      face(values, [L(y0, z0), R(y0, z0), R(y1, z0), L(y1, z0)], [0, 0, -1]); // back (on the wall)
      face(values, [L(y1, z0), R(y1, z0), R(y1, z1), L(y1, z1)], [0, 1, 0]); // top
      face(values, [L(y0, z0), R(y0, z0), R(y0, z1), L(y0, z1)], [0, -1, 0]); // underside
      face(values, [L(y0, z0), L(y0, z1), L(y1, z1), L(y1, z0)], [-1, 0, 0]); // ends
      face(values, [R(y0, z0), R(y0, z1), R(y1, z1), R(y1, z0)], [1, 0, 0]);
    };
    const top = c.bottomM + c.thicknessM, nose = c.projectM - c.fasciaDepthM, slab: number[] = [], fascia: number[] = [];
    box(slab, -0.005, nose, c.bottomM, top);
    box(fascia, nose, c.projectM, top - c.fasciaM, top);
    facade.add(meshOf(slab, material(c.colour), `canopy/${f.id}/slab`, 'canopy', 'awning', intent.pandId));
    facade.add(meshOf(fascia, material(c.fasciaColour), `canopy/${f.id}/fascia`, 'canopy', 'awning', intent.pandId));
    if (c.glassBlocks) {
      const {glass, grid} = glassBlockBand(c.glassBlocks);
      facade.add(meshOf(glass, material(GLASS_BLOCK.glass), `canopy/${f.id}/glass-blocks`, 'canopy', 'glass', intent.pandId));
      facade.add(meshOf(grid, material(GLASS_BLOCK.mortar), `canopy/${f.id}/glass-block-grid`, 'canopy', 'trim', intent.pandId));
    }
    added++;
  }
  return added;
}

/**
 * Brick lisenes: a 0.1 m proud brick pier per `lisenes` entry and a 0.15 m corbel cap 0.16 m proud on top, in the wall
 * material. A `party` end follows the party plane (like a joined canopy), so the two halves of a shared lisene meet in one
 * plane.
 */
export function addLisenes(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): number {
  let added = 0;
  const shell = group.getObjectByName('shell/0') as T.Mesh | undefined;
  const wall = (shell?.material as T.Material) ?? material(recipe.palette.value.wall);
  for (const f of fit.fronts) {
    const facade = group.getObjectByName(`elevation/${f.id}`);
    if (!f.lisenes?.length || !facade) continue;
    const {A, B, left, right} = frontEnds(group, recipe, f), values: number[] = [];
    for (const l of f.lisenes) {
      const x0 = (z: number) => l.party === 'start' ? A.x + (z - A.z) * left.x : l.leftM, x1 = (z: number) => l.party === 'end' ? B.x + (z - B.z) * right.x : l.leftM + l.widthM;
      const box = (z1: number, y0: number, y1: number) => {
        const L = (y: number, z: number): V3 => [x0(z), y, z], R = (y: number, z: number): V3 => [x1(z), y, z], z0 = -0.005;
        face(values, [L(y0, z1), R(y0, z1), R(y1, z1), L(y1, z1)], [0, 0, 1]);
        face(values, [L(y1, z0), R(y1, z0), R(y1, z1), L(y1, z1)], [0, 1, 0]);
        face(values, [L(y0, z0), R(y0, z0), R(y0, z1), L(y0, z1)], [0, -1, 0]);
        if (l.party !== 'start') face(values, [L(y0, z0), L(y0, z1), L(y1, z1), L(y1, z0)], [-1, 0, 0]);
        if (l.party !== 'end') face(values, [R(y0, z0), R(y0, z1), R(y1, z1), R(y1, z0)], [1, 0, 0]);
      };
      box(0.1, l.bottomM, l.topM - 0.15);
      box(0.16, l.topM - 0.15, l.topM);
      added++;
    }
    facade.add(meshOf(values, wall, `lisenes/${f.id}`, 'lisene', 'wall', intent.pandId));
  }
  return added;
}

/**
 * Window hoods (`windowHoods`): a 0.12 m high ledge 0.22 m proud, 2 cm over the head of every upper-storey window (a
 * ladder pair `…a`/`…b` gets one hood over both), 0.1 m wider each side, in the wall material. Facade frame.
 */
export function addWindowHoods(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe): number {
  let added = 0;
  const shell = group.getObjectByName('shell/0') as T.Mesh | undefined;
  const wall = (shell?.material as T.Material) ?? material(recipe.palette.value.wall);
  for (const front of intent.fronts) {
    if (!front.windowHoods) continue;
    const elevation = recipe.elevations.find(e => e.id === front.id), facade = group.getObjectByName(`elevation/${front.id}`);
    if (!elevation || !facade) continue;
    const spans = new Map<string, {l: number; r: number; head: number}>();
    for (const o of elevation.openings.value) {
      const m = /^(?:.*-)?s([1-9]\d*)-b(\d+)[ab]?$/.exec(o.id);
      if (!m || o.kind !== 'window') continue;
      const key = o.id.replace(/[ab]$/, ''), s = spans.get(key), head = o.bottomM + o.heightM;
      spans.set(key, s ? {l: Math.min(s.l, o.leftM), r: Math.max(s.r, o.leftM + o.widthM), head: Math.max(s.head, head)} : {l: o.leftM, r: o.leftM + o.widthM, head});
    }
    const values: number[] = [];
    for (const {l, r, head} of spans.values()) { prism(values, [[l - 0.1, -0.005], [r + 0.1, -0.005], [r + 0.1, 0.22], [l - 0.1, 0.22]], head + 0.02, head + 0.14, {bottom: true}); added++; }
    if (values.length) facade.add(meshOf(values, wall, `window-hoods/${front.id}`, 'hood', 'wall', intent.pandId));
  }
  return added;
}

/** Erker caps: `hip` = a lean-to hipped roof rising 0.45 m to the wall over the erker plan (6 cm eaves overhang); `flat` = a 0.12 m slab overhanging 6 cm. */
export function addErkerCaps(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): number {
  let added = 0;
  for (const f of fit.fronts) {
    const e = f.erker, facade = group.getObjectByName(`elevation/${f.id}`);
    if (!e || e.cap === 'none' || !facade) continue;
    const out = 0.015, inset = (e.widthM - e.frontWidthM) / 2, o = 0.06, l = e.leftM, r = e.leftM + e.widthM, d = out + e.depthM;
    // Plan of the erker (x, z) from the wall, grown by the overhang on the front and sides.
    const plan = offsetConvex([[l, out], [l + inset, d], [r - inset, d], [r, out]], o).map(([x, z]) => [x, Math.max(0, z)] as [number, number]);
    plan[0][1] = 0; plan[3][1] = 0;
    const values: number[] = [];
    if (e.cap === 'flat') {
      prism(values, plan, e.topM, e.topM + 0.12);
      facade.add(meshOf(values, material((f.id && recipe.elevations.find(x => x.id === f.id)?.palette?.value.trim) ?? recipe.palette.value.trim), `erker-cap/${f.id}`, 'erker', 'trim', intent.pandId));
    } else {
      const rise = 0.45, y = e.topM, Y = e.topM + rise, [bl, fl, fr, br] = plan;
      const BL: V3 = [bl[0], y, bl[1]], FL: V3 = [fl[0], y, fl[1]], FR: V3 = [fr[0], y, fr[1]], BR: V3 = [br[0], y, br[1]];
      const RL: V3 = [l + inset, Y, 0], RR: V3 = [r - inset, Y, 0];
      face(values, [FL, FR, RR, RL], [0, rise, e.depthM]); // front slope
      tri(values, BL, FL, RL, [-1, 0.5, 0]); // hips
      tri(values, FR, BR, RR, [1, 0.5, 0]);
      face(values, [BL, FL, FR, BR], [0, -1, 0]); // soffit
      face(values, [BL, RL, RR, BR], [0, 0, -1]); // against the wall
      // A painted (timber) erker (`bayWindows.finish`) has its hipped cap in the trim colour too (oudWest.ts paints the panels).
      const painted = e.finish === 'painted', trim = recipe.elevations.find(x => x.id === f.id)?.palette?.value.trim ?? recipe.palette.value.trim;
      facade.add(meshOf(values, material(painted ? trim : ROOF_COLOURS[intent.roof.material].steep), `erker-cap/${f.id}`, 'erker', painted ? 'trim' : 'roof', intent.pandId));
    }
    added++;
  }
  return added;
}

/**
 * Corner tower body: the two inner walls of the tower plan (the outer walls are the two fronts, which rise over it) from
 * the lower front's eaves to the top, and the cap (pyramid, flat or stepped) over the plan grown by 8 cm. Recipe-local.
 */
export function addCornerTowers(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): number {
  let added = 0;
  const shell = group.getObjectByName('shell/0') as T.Mesh | undefined;
  for (const f of fit.fronts) for (const t of f.towers ?? []) {
    if (t.corner?.role !== 'owner' || !t.corner.plan) continue;
    const plan = t.corner.plan.map(p => [p[0], p[1]] as [number, number]), y0 = t.bottomM, y1 = t.topM, values: number[] = [];
    const cx = plan.reduce((s, p) => s + p[0], 0) / plan.length, cz = plan.reduce((s, p) => s + p[1], 0) / plan.length;
    for (const k of t.corner.walls ?? []) {
      const a = plan[k], b = plan[(k + 1) % plan.length];
      face(values, [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], [(a[0] + b[0]) / 2 - cx, 0, (a[1] + b[1]) / 2 - cz]);
    }
    const wallMaterial = (shell?.material as T.Material) ?? material(recipe.palette.value.wall), roofMaterial = material(ROOF_COLOURS[intent.roof.material].steep);
    group.add(meshOf(values, wallMaterial, `tower/${f.id}-corner/body`, 'tower', 'wall', intent.pandId));
    if (t.cap === 'stepped') steppedTowerCap(group, plan, y1, wallMaterial, roofMaterial, `tower/${f.id}-corner`, intent.pandId);
    else {
      const cap: number[] = [], grown = offsetConvex(plan, 0.08);
      if (t.cap === 'pyramid') {
        const side = Math.max(...plan.map(p => Math.hypot(p[0] - cx, p[1] - cz))) * Math.SQRT2, apex: V3 = [cx, y1 + 0.75 * side, cz];
        grown.forEach((p, k) => { const q = grown[(k + 1) % grown.length]; tri(cap, [p[0], y1, p[1]], [q[0], y1, q[1]], apex, [(p[0] + q[0]) / 2 - cx, 0.6, (p[1] + q[1]) / 2 - cz]); });
        face(cap, grown.map(p => [p[0], y1, p[1]] as V3), [0, -1, 0]);
      } else prism(cap, grown, y1, y1 + 0.12);
      group.add(meshOf(cap, roofMaterial, `tower/${f.id}-corner/cap`, 'tower', 'roof', intent.pandId));
    }
    added++;
  }
  return added;
}

/** Every Amsterdam School pass, or null when the house uses none of the set (nothing is touched). */
export function applyAmsterdamSchool(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport) {
  if (!fit.fronts.some(f => f.canopy || f.erker || f.lisenes || f.towers?.some(t => t.corner)) && !intent.fronts.some(f => f.windowHoods)) return null;
  return {windowHoods: addWindowHoods(group, intent, recipe), lisenes: addLisenes(group, intent, recipe, fit), canopies: addCanopies(group, intent, recipe, fit), erkerCaps: addErkerCaps(group, intent, recipe, fit), cornerTowers: addCornerTowers(group, intent, recipe, fit)};
}
