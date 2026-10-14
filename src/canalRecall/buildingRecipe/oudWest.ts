/**
 * Post-library geometry of the 1890s-1900s Oud-West row set (Nassaukade 145-152, the block opposite berth 506), all
 * opt-in by intent field and reported by the fit (fit.ts); a house without them is untouched (`applyOudWest` returns
 * null):
 *
 *  - `addTimberBalconies` (`balconies.style: timber-bracketed`): a timber platform on carved brackets with a guard on its
 *    front and both returns, white turned balusters under a handrail or a wrought-iron grille.
 *  - `paintErkers` (`bayWindows.finish: painted`): a timber erker's panels and closures in the trim colour (the library
 *    builds them in the wall brick); its cap follows in `addErkerCaps` (amsterdamSchool.ts).
 *  - `markPaintedBrick` (`palette.wallMaterial: painted-brick`): the wall materials carry `tintSource: measured`, so the
 *    look keeps the measured paint colour on the brick texture instead of lifting it into the city brick range; a dark
 *    tympanum (`windowHead.tympanum: dark`) on such a wall is the same paint in shadow and is marked with it.
 *  - `markPaintedStone` (`palette.stoneMaterial: painted`): the stone dressings (painted bands, springers, keystones, arch
 *    rings, eared heads, console sills) carry `tintSource: measured`, so the look draws the measured white paint instead
 *    of mixing it into the city's pale sandstone.
 *
 * The painted bands, eared heads and console sills are library dressings laid out in fit.ts. Facade-frame passes work in
 * the library's elevation frame (x along the front, y up, z outward from the wall plane).
 */
import * as T from 'three';
import type {CanalHouseRecipe} from '../canalhouseRecipes.ts';
import type {FitReport} from './fit.ts';
import type {CanalHouseIntent} from './intent.ts';
import {prism} from './amsterdamSchool.ts';

type Balcony = NonNullable<FitReport['fronts'][number]['timberBalconies']>[number];
const material = (colour: string) => new T.MeshStandardMaterial({color: colour, roughness: 1});
const meshOf = (values: number[], mat: T.Material, name: string, component: string, surface: string, pandId: string) => {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(values, 3)); g.computeVertexNormals();
  const m = new T.Mesh(g, mat); m.name = name; m.userData = {component, surface, pandId};
  return m;
};

/** Baluster and guard proportions of a timber balcony (metres). */
export const BALUSTER = {shaftM: 0.045, bulbM: 0.08, bulbHM: 0.26, bulbAtK: 0.42, railHM: 0.06, railDM: 0.08, baseHM: 0.07, insetM: 0.04, ironBarM: 0.018, ironPitchM: 0.14, turnedPitchM: 0.16};
/** Carved bracket profile in (outward z, y below the platform underside), metres: a deep top arm curving down to the wall. */
export const BRACKET_PROFILE: [number, number][] = [[0, 0], [0.6, 0], [0.5, -0.16], [0.18, -0.42], [0, -0.58]];

/** Box from (x0, y0, z0) to (x1, y1, z1); `skip` leaves out hidden faces ('top', 'bottom', 'back'). */
function box(values: number[], x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, skip: string[] = []) {
  const quad = (a: number[], b: number[], c: number[], d: number[]) => values.push(...a, ...b, ...c, ...a, ...c, ...d);
  quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]); // front (+z)
  if (!skip.includes('back')) quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
  quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]); // -x
  quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]); // +x
  if (!skip.includes('top')) quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
  if (!skip.includes('bottom')) quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
}

/**
 * One timber balcony in facade coordinates: `platform` (slab + brackets, trim colour) and `guard` (balusters and rails, or
 * an iron grille). Exported for tests.
 */
export function timberBalconyGeometry(b: Balcony): {platform: number[]; guard: number[]; balusters: number} {
  const platform: number[] = [], guard: number[] = [], B = BALUSTER, x0 = b.leftM, x1 = b.leftM + b.widthM, y = b.floorM, z1 = b.projectM;
  box(platform, x0, x1, y - b.slabM, y, -0.005, z1);
  // Carved brackets: one per ~1.1 m (at least two), inset from the ends, 8 cm thick.
  const n = Math.max(2, Math.round(b.widthM / 1.1) + 1), under = y - b.slabM;
  for (let k = 0; k < n; k++) {
    const cx = x0 + 0.12 + (b.widthM - 0.24) * k / (n - 1), plan = BRACKET_PROFILE.map(([z, dy]) => [z * z1 / 0.75, under + dy] as [number, number]);
    // A bracket is a prism across x of its (z, y) profile.
    const pts = plan, xa = cx - 0.04, xb = cx + 0.04;
    const cz = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      if (i === pts.length - 1) continue; // the wall side (z = 0) is hidden
      if (p[1] === q[1] && p[1] === under) continue; // the top lies under the platform
      const nz = q[1] - p[1], ny = -(q[0] - p[0]), out = nz * ((p[0] + q[0]) / 2 - cz) + ny * ((p[1] + q[1]) / 2 - cy) >= 0;
      const quad = out ? [[xa, p[1], p[0]], [xa, q[1], q[0]], [xb, q[1], q[0]], [xb, p[1], p[0]]] : [[xb, p[1], p[0]], [xb, q[1], q[0]], [xa, q[1], q[0]], [xa, p[1], p[0]]];
      platform.push(...quad[0], ...quad[1], ...quad[2], ...quad[0], ...quad[2], ...quad[3]);
    }
    for (const [x, sgn] of [[xa, -1], [xb, 1]] as const) for (let i = 1; i + 1 < pts.length; i++) {
      const a = [x, pts[0][1], pts[0][0]], c = [x, pts[i][1], pts[i][0]], d = [x, pts[i + 1][1], pts[i + 1][0]];
      platform.push(...(sgn > 0 ? [...a, ...c, ...d] : [...a, ...d, ...c]));
    }
  }
  // Guard on the front (just inside the platform edge) and both returns back to the wall.
  const zf = z1 - B.insetM, top = y + b.guardM, runs: {along: 'x' | 'z'; a: number; c: number; at: number}[] = [
    {along: 'x', a: x0 + B.insetM, c: x1 - B.insetM, at: zf},
    {along: 'z', a: 0.02, c: zf, at: x0 + B.insetM},
    {along: 'z', a: 0.02, c: zf, at: x1 - B.insetM},
  ];
  let balusters = 0;
  for (const r of runs) {
    const rail = (ya: number, yb: number, w: number) => r.along === 'x' ? box(guard, r.a - w / 2, r.c + w / 2, ya, yb, r.at - w / 2, r.at + w / 2, ['back']) : box(guard, r.at - w / 2, r.at + w / 2, ya, yb, r.a, r.c, ['back']);
    rail(top - B.railHM, top, B.railDM);
    rail(y, y + B.baseHM, B.railDM * 0.8);
    const pitch = b.rail === 'iron' ? B.ironPitchM : B.turnedPitchM, count = Math.max(1, Math.floor((r.c - r.a) / pitch));
    for (let k = 1; k < count; k++) {
      const t = r.a + (r.c - r.a) * k / count;
      const post = (w: number, ya: number, yb: number, skip: string[]) => r.along === 'x' ? box(guard, t - w / 2, t + w / 2, ya, yb, r.at - w / 2, r.at + w / 2, skip) : box(guard, r.at - w / 2, r.at + w / 2, ya, yb, t - w / 2, t + w / 2, skip);
      // Faces against the rails, and the inner (back) faces nobody sees from the street, are left out: 6 triangles a bar.
      if (b.rail === 'iron') post(B.ironBarM, y + B.baseHM, top - B.railHM, ['top', 'bottom', 'back']);
      else {
        // Turned baluster: a slim shaft and a bulb, both square in plan (12 triangles).
        const span = b.guardM - B.railHM - B.baseHM, mid = y + B.baseHM + span * B.bulbAtK;
        post(B.shaftM, y + B.baseHM, top - B.railHM, ['top', 'bottom', 'back']);
        post(B.bulbM, mid - B.bulbHM / 2, mid + B.bulbHM / 2, ['top', 'bottom', 'back']);
      }
      balusters++;
    }
  }
  return {platform, guard, balusters};
}

/** Timber balconies of every front that has them (fit report `timberBalconies`). */
export function addTimberBalconies(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): number {
  let added = 0;
  for (const f of fit.fronts) {
    const facade = group.getObjectByName(`elevation/${f.id}`);
    if (!f.timberBalconies?.length || !facade) continue;
    const palette = recipe.elevations.find(e => e.id === f.id)?.palette?.value ?? recipe.palette.value;
    const trim = material(palette.trim), iron = material(palette.door);
    for (const b of f.timberBalconies) {
      const g = timberBalconyGeometry(b);
      facade.add(meshOf(g.platform, trim, `timber-balcony/${b.id}/platform`, 'balcony', 'trim', intent.pandId));
      facade.add(meshOf(g.guard, b.rail === 'iron' ? iron : trim, `timber-balcony/${b.id}/guard`, 'balcony', b.rail === 'iron' ? 'door' : 'trim', intent.pandId));
      added++;
    }
  }
  return added;
}

/** A painted (timber) erker: the library's wall-brick panels and closures of its glazed modules take the trim colour. */
export function paintErkers(group: T.Group, recipe: CanalHouseRecipe, fit: FitReport): number {
  let painted = 0;
  for (const f of fit.fronts) {
    const facade = group.getObjectByName(`elevation/${f.id}`);
    if (f.erker?.finish !== 'painted' || !facade) continue;
    const trim = material((recipe.elevations.find(e => e.id === f.id)?.palette?.value ?? recipe.palette.value).trim);
    facade.traverse(o => {
      if (o instanceof T.Mesh && /(?:^|[-/])erker-s\d+\/(?:.*\/)?wall\//.test(o.name)) { o.material = trim; o.userData.surface = 'trim'; painted++; }
    });
  }
  return painted;
}

/** Every mesh `pick` selects exports its material colour as a measured tint (materials are cloned, never edited in place). */
function markMeasured(group: T.Group, pick: (o: T.Mesh) => boolean): number {
  let marked = 0;
  const clones = new Map<T.Material, T.Material>();
  group.traverse(o => {
    if (!(o instanceof T.Mesh) || !pick(o) || Array.isArray(o.material) || o.material.userData.tintSource) return;
    let m = clones.get(o.material);
    if (!m) { const c = o.material.clone(); c.userData = {...o.material.userData, tintSource: 'measured'}; clones.set(o.material, c); m = c; }
    o.material = m; marked++;
  });
  return marked;
}

/** Painted brick: every wall-surface material of the house exports its colour as a measured tint. */
export function markPaintedBrick(group: T.Group): number {
  return markMeasured(group, o => o.userData.surface === 'wall');
}

/** Dark tympana (`windowHead.tympanum: dark`) on a painted-brick house: the same paint in shadow, a measured tint too. */
export function markDarkTympana(group: T.Group): number {
  return markMeasured(group, o => o.userData.surface === 'accent' && /(?:^|\/)ornament\/[^/]*tympanum-/.test(o.name));
}

/** Painted stone: every stone-surface material (the white stucco dressings) exports its colour as a measured tint. */
export function markPaintedStone(group: T.Group): number {
  return markMeasured(group, o => o.userData.surface === 'stone');
}

/** Every Oud-West pass, or null when the house uses none of the set (nothing is touched). */
export function applyOudWest(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport) {
  const painted = intent.palette.wallMaterial === 'painted-brick', paintedStone = intent.palette.stoneMaterial === 'painted';
  if (!painted && !paintedStone && !fit.fronts.some(f => f.timberBalconies?.length || f.erker?.finish)) return null;
  const dark = painted && intent.fronts.some(f => f.windowHead?.tympanum === 'dark');
  return {timberBalconies: addTimberBalconies(group, intent, recipe, fit), erkers: paintErkers(group, recipe, fit), paintedWalls: painted ? markPaintedBrick(group) : 0,
    ...(dark ? {darkTympana: markDarkTympana(group)} : {}), ...(paintedStone ? {paintedStone: markPaintedStone(group)} : {})};
}

