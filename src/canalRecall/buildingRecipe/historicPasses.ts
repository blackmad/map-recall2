/**
 * Post-compile passes for historic canal-house fronts (all opt-in by intent field; a house without them is untouched):
 *
 *  - `dressHistoric`: cornice paint (`palette.cornice`) and roller-shutter paint (`groundFront.shutterColour`);
 *  - `addMansards`: a steep mansard roof face behind the cornice (`roofFront: 'mansard'`);
 *  - `addTowers`: the 3D body and cap behind a tower's front wall (`tower`);
 *  - `clipAtPartyWalls`: street-side details clipped at oblique party walls (`partyClip`);
 *  - `leanFronts`: a forward lean of the front (`leanDegrees`), sheared along the party walls so party lines stay closed.
 *
 * Geometry is edited in each elevation's facade frame (x along the front, y up, z outward), the library's own frame.
 */
import * as T from 'three';
import type {CanalHouseRecipe, CanalhousePoint} from '../canalhouseRecipes.ts';
import {ROOF_COLOURS, type FitReport} from './fit.ts';
import {swatch, type CanalHouseIntent, type FrontIntent} from './intent.ts';

const facadeOf = (group: T.Group, id: string) => group.getObjectByName(`elevation/${id}`) as T.Group | undefined;
const material = (colour: string) => new T.MeshStandardMaterial({color: colour, roughness: 1});
const meshesUnder = (root: T.Object3D) => { const out: T.Mesh[] = []; root.traverse(o => { if (o instanceof T.Mesh) out.push(o); }); return out; };

/** Cornice and roller-shutter paint. Returns the number of repainted meshes. */
export function dressHistoric(group: T.Group, intent: CanalHouseIntent, fit: FitReport): number {
  let painted = 0;
  for (const f of fit.fronts) {
    const front = intent.fronts.find(x => x.id === f.id), facade = facadeOf(group, f.id);
    if (!front || !facade) continue;
    const cornice = front.palette?.cornice ?? intent.palette.cornice;
    const paint = (test: (name: string) => boolean, colour: string) => { const m = material(swatch(colour)); for (const mesh of meshesUnder(facade)) if (test(mesh.name)) { mesh.material = m; painted++; } };
    if (cornice) paint(n => n.startsWith('cornice/'), cornice);
    const shutter = front.groundFront?.shutterColour;
    if (shutter) paint(n => /^opening\/(\S*-)?gf-b\d+-shutter(-m\d+)?\/(pane|bar)$/.test(n), shutter);
  }
  return painted;
}

/** Facade-frame copy of the recipe ring around one front: the corners of the frontage and the party-wall neighbours. */
function frontEnds(group: T.Group, recipe: CanalHouseRecipe, f: FitReport['fronts'][number]) {
  const facade = facadeOf(group, f.id)!;
  group.updateMatrixWorld(true);
  const inv = facade.matrixWorld.clone().invert(), ring = recipe.footprint.value[f.polygonIndex].outer, n = ring.length;
  const local = (p: CanalhousePoint) => new T.Vector3(p[0], 0, p[1]).applyMatrix4(inv);
  const [i0, i1] = f.edge;
  const A = local(ring[i0]), B = local(ring[i1]), P = local(ring[(i0 - 1 + n) % n]), Q = local(ring[(i1 + 1) % n]);
  // Party direction (towards the street) normalised to dz = 1; a ring edge running along the front is not a party wall.
  const dir = (from: T.Vector3, to: T.Vector3) => { const d = to.clone().sub(from); d.y = 0; return d.z > 0.2 * d.length() ? new T.Vector3(d.x / d.z, 0, 1) : new T.Vector3(0, 0, 1); };
  return {facade, A, B, left: dir(P, A), right: dir(Q, B)};
}

/**
 * Clip street-side details at the party planes: a vertex of a facade detail lying past the party line (beyond the
 * neighbour's side of the plane through the frontage corner and its party-wall neighbour vertex) moves onto the line.
 * Boxes keep their triangles; their ends become slanted along the party wall. Only within 0.8 m of each end.
 */
export function clipAtPartyWalls(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): number {
  let moved = 0;
  for (const f of fit.fronts) {
    const front = intent.fronts.find(x => x.id === f.id);
    if (!front?.partyClip) continue;
    const {facade, A, B, left, right} = frontEnds(group, recipe, f);
    const xL = (z: number) => A.x + (z - A.z) * left.x, xR = (z: number) => B.x + (z - B.z) * right.x;
    const facadeInv = facade.matrixWorld.clone().invert();
    for (const mesh of meshesUnder(facade)) {
      const toFacade = facadeInv.clone().multiply(mesh.matrixWorld), back = toFacade.clone().invert();
      const pos = mesh.geometry.getAttribute('position') as T.BufferAttribute, v = new T.Vector3();
      let changed = false;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(toFacade);
        if (v.z < Math.min(A.z, B.z) - 0.3) continue;
        let x = v.x;
        if (x < A.x + 0.8 && x < xL(v.z)) x = xL(v.z);
        if (x > B.x - 0.8 && x > xR(v.z)) x = xR(v.z);
        if (Math.abs(x - v.x) < 1e-5) continue;
        v.x = x; v.applyMatrix4(back); pos.setXYZ(i, v.x, v.y, v.z); changed = true; moved++;
      }
      if (changed) { pos.needsUpdate = true; if (mesh.geometry.getAttribute('normal')) mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingBox(); }
    }
  }
  return moved;
}

/** Shear depth: the lean fades out over this many metres behind the front (side walls bend, the rear stays). */
export const LEAN_FADE_M = 4;
/** No point of a front moves forward by more than this (a 3 degree lean on a 15 m front is 0.79 m). */
export const MAX_LEAN_SHIFT_M = 0.6;

/**
 * Lean fronts forward by `leanDegrees`: every vertex between a front's two party lines and within `LEAN_FADE_M` behind
 * it moves outward by height x tan(lean) x fade, along a direction interpolated between the two party walls (so a vertex
 * on a party wall stays in that wall's plane and the neighbour's party line still closes). Ground vertices do not move.
 */
export function leanFronts(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): number {
  const fronts = fit.fronts.map(f => ({f, front: intent.fronts.find(x => x.id === f.id)})).filter(x => (x.front?.leanDegrees ?? 0) > 0);
  if (!fronts.length) return 0;
  group.updateMatrixWorld(true);
  const zones = fronts.map(({f, front}) => {
    const e = frontEnds(group, recipe, f), toWorld = new T.Matrix3().setFromMatrix4(e.facade.matrixWorld), inv = e.facade.matrixWorld.clone().invert();
    return {...e, tan: Math.tan(front!.leanDegrees! * Math.PI / 180), toWorld, inv};
  });
  let moved = 0;
  const v = new T.Vector3(), w = new T.Vector3();
  for (const mesh of meshesUnder(group)) {
    const pos = mesh.geometry.getAttribute('position') as T.BufferAttribute, back = mesh.matrixWorld.clone().invert();
    let changed = false;
    for (let i = 0; i < pos.count; i++) {
      w.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (w.y <= 1e-4) continue;
      for (const z of zones) {
        v.copy(w).applyMatrix4(z.inv);
        const depth = Math.min(z.A.z, z.B.z) - v.z, fade = depth <= 0 ? 1 : Math.max(0, 1 - depth / LEAN_FADE_M);
        if (fade <= 0) continue;
        const sL = v.x - (z.A.x + (v.z - z.A.z) * z.left.x), sR = z.B.x + (v.z - z.B.z) * z.right.x - v.x;
        if (sL < -1e-4 || sR < -1e-4) continue;
        const s = sL + sR > 1e-9 ? Math.max(0, Math.min(1, sL / (sL + sR))) : 0;
        const amount = Math.min(MAX_LEAN_SHIFT_M, w.y * z.tan) * fade;
        const shift = new T.Vector3(z.left.x * (1 - s) + z.right.x * s, 0, 1).multiplyScalar(amount).applyMatrix3(z.toWorld);
        w.add(shift).applyMatrix4(back); pos.setXYZ(i, w.x, w.y, w.z); changed = true; moved++;
        break;
      }
    }
    if (changed) { pos.needsUpdate = true; if (mesh.geometry.getAttribute('normal')) mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingBox(); }
  }
  return moved;
}

/** Triangles of a planar quad a-b-c-d, wound so the face normal points along `out`. */
function orientedQuad(values: number[], a: number[], b: number[], c: number[], d: number[], out: T.Vector3) {
  const n = new T.Vector3(...b).sub(new T.Vector3(...a)).cross(new T.Vector3(...c).sub(new T.Vector3(...a)));
  const [p, q, r, s] = n.dot(out) >= 0 ? [a, b, c, d] : [a, d, c, b];
  values.push(...p, ...q, ...r, ...p, ...r, ...s);
}

/**
 * Mansard roof faces: a wedge from the cornice top rising `heightM` while leaning back `setbackM`, then a short flat top.
 * Its ends follow the party walls (trapezoidal plots), so it never reaches into a neighbour's plot.
 */
export function addMansards(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): number {
  let added = 0;
  for (const f of fit.fronts) {
    const facade = facadeOf(group, f.id);
    if (!f.mansard || !facade) continue;
    const {bottomM: b, heightM: h, setbackM: s} = f.mansard, top = 1.2, {A, B, left, right} = frontEnds(group, recipe, f);
    const xL = (z: number) => A.x + (z - A.z) * left.x, xR = (z: number) => B.x + (z - B.z) * right.x;
    // Section (z behind the facade plane, y), front to back.
    const section: [number, number][] = [[-0.02, b], [-s, b + h], [-s - top, b + h], [-s - top, b]];
    const L = (k: number) => [xL(section[k][0]), section[k][1], section[k][0]], R = (k: number) => [xR(section[k][0]), section[k][1], section[k][0]];
    const values: number[] = [];
    orientedQuad(values, L(0), R(0), R(1), L(1), new T.Vector3(0, s, h)); // steep face, out and up
    orientedQuad(values, L(1), R(1), R(2), L(2), new T.Vector3(0, 1, 0)); // flat top
    orientedQuad(values, L(2), R(2), R(3), L(3), new T.Vector3(0, 0, -1)); // back
    orientedQuad(values, L(0), L(1), L(2), L(3), new T.Vector3(-1, 0, 0)); // party ends
    orientedQuad(values, R(0), R(1), R(2), R(3), new T.Vector3(1, 0, 0));
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(values, 3)); g.computeVertexNormals();
    const m = new T.Mesh(g, material(ROOF_COLOURS[intent.roof.material].steep));
    m.name = `mansard/${f.id}`; m.userData = {component: 'mansard', surface: 'roof', pandId: intent.pandId};
    facade.add(m); added++;
  }
  return added;
}

/** Tower bodies behind their front walls: three brick walls back to the tower's width, and a pyramid or flat cap. */
export function addTowers(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport): number {
  let added = 0;
  const shell = group.getObjectByName('shell/0') as T.Mesh | undefined;
  for (const f of fit.fronts) {
    const facade = facadeOf(group, f.id);
    if (!f.towers?.length || !facade) continue;
    for (const [i, t] of f.towers.entries()) {
      const depth = Math.min(t.widthM, 4), x0 = t.leftM, x1 = t.leftM + t.widthM, y0 = t.bottomM, y1 = t.topM, z0 = -0.16, z1 = -depth;
      const values: number[] = [], quad = (a: number[], b: number[], c: number[], d: number[]) => values.push(...a, ...b, ...c, ...a, ...c, ...d);
      quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1]); // left, facing -x
      quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]); // right, facing +x
      quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]); // back, facing -z
      const body = new T.BufferGeometry(); body.setAttribute('position', new T.Float32BufferAttribute(values, 3)); body.computeVertexNormals();
      const wall = new T.Mesh(body, (shell?.material as T.Material) ?? material(recipe.palette.value.wall));
      wall.name = `tower/${f.id}-${i}/body`; wall.userData = {component: 'tower', surface: 'wall', pandId: intent.pandId};
      facade.add(wall);
      // Cap: overhangs the walls by 8 cm (front and sides), pyramid apex over the centre.
      const o = 0.08, cx = (x0 + x1) / 2, cz = (0.02 + o + z1 - o) / 2, apex = t.cap === 'pyramid' ? y1 + 0.75 * t.widthM : y1 + 0.12;
      const c = [[x0 - o, y1, 0.02 + o], [x1 + o, y1, 0.02 + o], [x1 + o, y1, z1 - o], [x0 - o, y1, z1 - o]];
      const roof: number[] = [];
      if (t.cap === 'pyramid') for (let k = 0; k < 4; k++) roof.push(...c[k], ...c[(k + 1) % 4], cx, apex, cz);
      else { const up = c.map(p => [p[0], apex, p[2]]); roof.push(...up[0], ...up[1], ...up[2], ...up[0], ...up[2], ...up[3]); for (let k = 0; k < 4; k++) roof.push(...c[k], ...c[(k + 1) % 4], ...up[(k + 1) % 4], ...c[k], ...up[(k + 1) % 4], ...up[k]); }
      const cap = new T.BufferGeometry(); cap.setAttribute('position', new T.Float32BufferAttribute(roof, 3)); cap.computeVertexNormals();
      const capMesh = new T.Mesh(cap, material(ROOF_COLOURS[intent.roof.material].steep));
      capMesh.name = `tower/${f.id}-${i}/cap`; capMesh.userData = {component: 'tower', surface: 'roof', pandId: intent.pandId};
      facade.add(capMesh); added++;
    }
  }
  return added;
}

/** Every historic pass in order (paint, mansards, towers, party clip, lean last so it shears everything). */
export function applyHistoricPasses(group: T.Group, intent: CanalHouseIntent, recipe: CanalHouseRecipe, fit: FitReport) {
  const uses = (k: keyof FrontIntent) => intent.fronts.some(f => f[k] !== undefined);
  if (!(uses('groundFront') || uses('roofFront') || uses('tower') || uses('partyClip') || uses('leanDegrees') || intent.palette.cornice || intent.fronts.some(f => f.palette?.cornice))) return null;
  return {painted: dressHistoric(group, intent, fit), mansards: addMansards(group, intent, recipe, fit), towers: addTowers(group, intent, recipe, fit), clipped: clipAtPartyWalls(group, intent, recipe, fit), leaned: leanFronts(group, intent, recipe, fit)};
}
