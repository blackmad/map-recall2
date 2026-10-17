/**
 * Flat roof with a deep eaves overhang (`eavesOverhang`, Plan Zuid rows of 1930-1936: Rivierenbuurt, Boterdiepstraat
 * 4-70 and Eemsstraat on the 2022-03-24 and 2023-01-03 strips at 40 px/m). The flat roof runs out over the front as a
 * thin slab: a painted fascia board on its nose and a boarded soffit under it, one continuous line along the row.
 *
 * Geometry, facade frame (x along the front, y up, z outward from the wall plane), after the library has built the
 * facade: one prism from `eaves - fascia` to the front's eaves, from 5 mm inside the wall to `projection` metres out.
 * Its two ends follow the party planes (through the frontage corners along the party walls, as a joined canopy or a
 * shared lisene), so the slabs of neighbours meet in one plane with no gap or overlap; the row reads as one overhang.
 * The fascia and top take `colour` (default the front's trim), the soffit `soffit` (default the same colour); both are
 * measured tints.
 *
 * Measured on Boterdiepstraat 26-34 (090853, 115959, 065564, 124733, 112680; panoramas 6.4-6.7 m from the front, camera
 * 2.4 m up): the wall stops at 12.1-12.25 m under a thin white trim; the soffit's nose rectifies to 13.6 m and the fascia
 * top to 14.1 m, which at 6.4 m puts the nose 0.75 m out and the fascia 12.3-12.75 m (0.45 m). Absent = untouched
 * (no mesh, byte-identical GLB).
 */
import * as T from 'three';
import type {CanalHouseRecipe} from '../canalhouseRecipes.ts';
import type {FitReport} from './fit.ts';
import type {CanalHouseIntent} from './intent.ts';
import {EAVES_OVERHANG} from './eavesOverhangIntent.ts';
import {frontEnds} from './historicPasses.ts';

const meshOf = (values: number[], colour: string, name: string, surface: string, pandId: string) => {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(values, 3)); g.computeVertexNormals();
  const mat = new T.MeshStandardMaterial({color: colour, roughness: 0.9});
  mat.userData = {tintSource: 'measured'};
  const m = new T.Mesh(g, mat); m.name = name; m.userData = {component: 'eaves-overhang', surface, pandId};
  return m;
};

type V3 = [number, number, number];
/** Quad a-b-c-d (in order) wound so its normal points along `out`. */
function quad(values: number[], a: V3, b: V3, c: V3, d: V3, out: V3) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const flip = n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0;
  values.push(...(flip ? [...a, ...c, ...b, ...a, ...d, ...c] : [...a, ...b, ...c, ...a, ...c, ...d]));
}

/** The overhang slab of every front with `eavesOverhang`; returns the number of slabs added. */
export function addEavesOverhangs(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): number {
  let added = 0;
  for (const front of intent.fronts) {
    const o = front.eavesOverhang, f = fit.fronts.find(x => x.id === front.id);
    if (!o || !f) continue;
    const {facade, A, B, left, right} = frontEnds(group, recipe, f);
    const elevation = recipe.elevations.find(e => e.id === front.id);
    const top = elevation?.bodyEavesM?.value ?? f.eavesM, bottom = top - o.fascia;
    // Party planes through the frontage corners (facade x of each end at depth z).
    const lo = A.x <= B.x ? {p: A, d: left} : {p: B, d: right}, hi = A.x <= B.x ? {p: B, d: right} : {p: A, d: left};
    const xL = (z: number) => lo.p.x + (z - lo.p.z) * lo.d.x, xR = (z: number) => hi.p.x + (z - hi.p.z) * hi.d.x;
    const z0 = -EAVES_OVERHANG.insetM, z1 = o.projection;
    const P = (x: (z: number) => number, y: number, z: number): V3 => [x(z), y, z];
    const slab: number[] = [], soffit: number[] = [];
    quad(slab, P(xL, bottom, z1), P(xR, bottom, z1), P(xR, top, z1), P(xL, top, z1), [0, 0, 1]); // fascia
    quad(slab, P(xL, top, z0), P(xR, top, z0), P(xR, top, z1), P(xL, top, z1), [0, 1, 0]); // top
    quad(slab, P(xL, bottom, z0), P(xL, bottom, z1), P(xL, top, z1), P(xL, top, z0), [-1, 0, 0]); // ends on the party planes
    quad(slab, P(xR, bottom, z0), P(xR, bottom, z1), P(xR, top, z1), P(xR, top, z0), [1, 0, 0]);
    quad(soffit, P(xL, bottom, z0), P(xR, bottom, z0), P(xR, bottom, z1), P(xL, bottom, z1), [0, -1, 0]);
    const trim = o.colour ?? elevation?.palette?.value.trim ?? recipe.palette.value.trim;
    facade.add(meshOf(slab, trim, `eaves-overhang/${front.id}/fascia`, 'trim', intent.pandId));
    facade.add(meshOf(soffit, o.soffit ?? trim, `eaves-overhang/${front.id}/soffit`, 'trim', intent.pandId));
    added++;
  }
  return added;
}
