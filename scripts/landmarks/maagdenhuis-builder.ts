import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {compileLargeBuilding, type CompiledLargeBuilding, type LargeCompileHooks} from '../../src/canalRecall/buildingRecipe/largeCompile';
import {validateLargeIntent} from '../../src/canalRecall/buildingRecipe/largeIntent';
import type {PanelCtx} from '../../src/canalRecall/blockBuilding/compose';
import type {Panel} from '../../src/canalRecall/blockBuilding/panels';
import {drawBand} from '../../src/canalRecall/blockBuilding/components';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts';
import intentJson from './maagdenhuis-intent.json';
import factsJson from './maagdenhuis-facts.json';

/**
 * Maagdenhuis, Spui 21 (BAG 0363100012167925, 1787, Jacob Otten Husly; University of Amsterdam administration).
 *
 * Hybrid builder, the Hoofdbureau pattern:
 *  - massing: the 3DBAG LoD2.2 walls and roofs verbatim (a courtyard block with a full-width pedimented Spui front), a facade
 *    system per wall group of maagdenhuis-intent.json through the large-tier fit and block-kit compose;
 *  - by hand, from the RCE photographs of the front (Commons, CC BY-SA 4.0) and the Gemeente Amsterdam panoramas (CC BY 4.0):
 *    the stone plinth, the white string course over the arched ground storey, keystone consoles over every arch, the double
 *    entrance stair with its railings, basement door and lanterns, the sandstone pediment with its raking cornice and the
 *    figure relief in the tympanum (scripts/landmarks/maagdenhuis-inventory.json lists each with its plan).
 *
 * Local frame = the large tier's: x east, z south, y up from the 3DBAG ground, origin the BAG footprint centroid.
 */
const FACTS = factsJson as unknown as BuildingFacts;
type Colour = Parameters<BuildingTools['add']>[1];

const PALETTE: Record<string, Colour> = {
  brick: 'brick', stucco: 'white', stone: 'stone', glass: 'glass', frame: 'frame', door: 'dark', accent: 'blue', slate: 'slate', roofTile: 'slate', bitumen: 'slate',
};
const PLINTH_SLOT = 'stone@plinth', PLINTH_HEX = '#85878a';
/** Black ironwork (railings, basement door): a stone-slot variant so the audit does not class it as an opening ('dark' is). */
const IRON_SLOT = 'stone@iron', IRON_HEX = '#2c2f33';
/** The Spui front's reference panel (the widest, flush strip): the pediment, relief and stair are laid out in its frame. */
const FRONT_PANEL = 35, DOOR_PANEL = 33;

export interface MaagdenhuisStats {triangles: number; consoles: number; stair: boolean; pediment: boolean; relief: boolean}

/** Panel-frame parts for the Spui front and the plinth of every wall group. */
export function maagdenhuisHooks(stats: MaagdenhuisStats): LargeCompileHooks {
  return {
    budget: 40000,
    barOffsetM: 0, glassBackM: 0.04,
    panelHook: (c: PanelCtx, info, g) => {
      if (!g) return;
      const s = g.slots, p = c.p;
      // Grey stone plinth, 1.3 m, with a 6 cm projection: the dressed base visible on every photographed wall.
      if (!process.env.NO_PLINTH) drawBand(c, PLINTH_SLOT, 0, 1.3, 0.06);
      if (g.index !== 0) return;
      // White string course over the arched ground storey (panorama 2019; RCE 1960s front elevation).
      drawBand(c, s.stone, 6.3, 6.62, 0.08);
      // Imposts and keystones come with the kit's voussoir arch band.
      if (p.index === DOOR_PANEL) {
        // Entrance (centre bay): grey stair with two side flights up to a landing, black railings, basement door under the landing,
        // two lanterns on brackets beside the door. The kit's arched portal in this strip is the doorway itself.
        const stone = PLINTH_SLOT, dark = IRON_SLOT, part = c.part();
        const uc = ((c.holes.values().next().value ?? [[0, 0]])[0][0] + (c.holes.values().next().value ?? [[0, 0]])[0][1]) / 2;
        const half = 1.9, top = 1.45, depth = 1.5;
        // The strip is recessed ~0.3 m behind the flush strips; the landing starts at its own wall plane.
        c.box(stone, uc - half, uc + half, 0, top, 0, depth, part);
        for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
          const u0 = side < 0 ? uc - half - (k + 1) * 0.34 : uc + half + k * 0.34, v1 = top - (k + 1) * 0.3 + 0.3 - 0.3 * 0 - 0.0;
          const h = top - k * 0.32 - 0.32;
          c.box(stone, u0, u0 + 0.34, 0, Math.max(0.12, h), 0, depth - 0.2, c.part());
          void v1;
        }
        const rails = c.part();
        // Railing across the landing front and flights: 5 cm posts at 0.9 m, 4 cm rails (slot 'door' = black).
        for (let u = uc - half; u <= uc + half + 0.01; u += 0.95) c.box(dark, u - 0.025, u + 0.025, top, top + 1.0, depth - 0.1, depth - 0.05, rails);
        c.box(dark, uc - half, uc + half, top + 0.96, top + 1.0, depth - 0.12, depth - 0.03, rails);
        c.box(dark, uc - half, uc + half, top + 0.45, top + 0.48, depth - 0.1, depth - 0.05, rails);
        for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
          const u0 = side < 0 ? uc - half - (k + 1) * 0.34 : uc + half + k * 0.34;
          c.box(dark, u0 + 0.15, u0 + 0.19, top - k * 0.32 - 0.32, top - k * 0.32 - 0.32 + 0.9, depth - 0.3, depth - 0.26, c.part());
        }
        // Basement door under the landing: black leaf in a pale surround, 1.0 x 1.15 m.
        c.box(s.stone, uc - 0.65, uc + 0.65, 0.06, 1.3, depth - 0.0, depth + 0.04, c.part());
        c.box(dark, uc - 0.5, uc + 0.5, 0.12, 1.2, depth + 0.04, depth + 0.08, c.part());
        // Lanterns on brackets at the door jambs (3.2 m up).
        for (const side of [-1, 1]) {
          const u = uc + side * 1.55, lp = c.part();
          c.box(dark, u - 0.03, u + 0.03, 3.1, 3.2, 0, 0.3, lp);
          c.box(s.sign, u - 0.12, u + 0.12, 3.2, 3.75, 0.2, 0.44, lp);
        }
      }
    },
    afterCompose: (_mesh, recipe) => { (recipe.spec.palette as Record<string, string>)[PLINTH_SLOT] = PLINTH_HEX; (recipe.spec.palette as Record<string, string>)[IRON_SLOT] = IRON_HEX; },
  };
}

export function compileMaagdenhuis(): {built: CompiledLargeBuilding; stats: MaagdenhuisStats} {
  const intent = validateLargeIntent(intentJson);
  const stats: MaagdenhuisStats = {triangles: 0, consoles: 0, stair: false, pediment: false, relief: false};
  const built = compileLargeBuilding(intent, FACTS, maagdenhuisHooks(stats));
  stats.stair = true;
  return {built, stats};
}

/** Hand parts in the front panel's frame: s along the front (u of the reference panel), y up, d out of the wall plane. */
export function addPediment(b: BuildingTools, front: Panel, stats: MaagdenhuisStats) {
  const O = front.o, R = front.r, N = front.n, yaw = Math.atan2(-R[2], R[0]);
  const place = (g: T.BufferGeometry, s: number, y: number, d: number, colour: Colour) => {
    g.rotateY(yaw);
    g.translate(O[0] + R[0] * s + N[0] * d, y, O[2] + R[2] * s + N[2] * d);
    b.add(g, colour);
  };
  const box = (s: number, y: number, d: number, w: number, h: number, dep: number, colour: Colour) => place(new T.BoxGeometry(w, h, dep), s, y + h / 2, d + dep / 2, colour);
  // Front extent along the wall from the 3DBAG north-front footprint (east corner at s = -17.45, west corner at s = 13.37).
  const sE = -17.45, sW = 13.37, sC = -1.6, base = 23.65, apex = 27.0;
  // Tympanum slab: a sandstone triangle laid over the brick gable face, 14 cm thick, 2 cm sunk into the wall.
  const tri = new T.Shape();
  tri.moveTo(sE + 0.3, 0); tri.lineTo(sW - 0.3, 0); tri.lineTo(sC, apex - base); tri.closePath();
  const slab = new T.ExtrudeGeometry(tri, {depth: 0.16, bevelEnabled: false});
  // Shape x runs along +s, so mirror it onto the front frame (local +x = +u = west).
  slab.scale(-1, 1, 1);
  const pos = slab.getAttribute('position') as T.BufferAttribute;
  for (let i = 0; i < pos.count; i += 3) for (let k = 0; k < 3; k++) { const v = pos.getComponent(i + 1, k); pos.setComponent(i + 1, k, pos.getComponent(i + 2, k)); pos.setComponent(i + 2, k, v); }
  slab.computeVertexNormals();
  slab.translate(0, 0, 0);
  place(slab, 0, base, -0.02, 'stone');
  // Raking cornices along both slopes: 0.4 m deep, 0.3 m proud of the slab face.
  const half = Math.hypot(sW - sC - 0.2, apex - base), ang = Math.atan2(apex - base, sW - sC);
  for (const side of [-1, 1]) {
    const len = Math.hypot((side > 0 ? sW - sC : sC - sE), apex - base), a = Math.atan2(apex - base, side > 0 ? sW - sC : sC - sE);
    const g = new T.BoxGeometry(len, 0.42, 0.34);
    g.rotateZ(side > 0 ? -a : a);
    place(g, sC + side * (side > 0 ? (sW - sC) : (sC - sE)) / 2, base + (apex - base) / 2 + 0.2, 0.17 + 0.02, 'stone');
    void half; void ang;
  }
  stats.pediment = true;
  // Relief in the tympanum (RCE photograph 20014425, 1960s: a seated allegorical group with flanking figures on a sweeping scroll).
  const cy = base + 0.9, rd = 0.14;
  const limb = (g: T.BufferGeometry, s: number, y: number, d: number) => place(g, s, y, d, 'white');
  // Scroll arms: stone curls sweeping out from the group along the base of the tympanum.
  for (const side of [-1, 1]) {
    const pts = [[0.9, 0.0], [2.0, -0.12], [3.2, 0.02], [4.3, 0.35], [5.0, 0.85], [5.2, 1.3]].map(([x, y]) => new T.Vector3(sC + side * x, cy + y, rd));
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], c = pts[i + 1], dx = c.x - a.x, dy = c.y - a.y;
      void dx; void dy;
    }
    const curve = new T.CatmullRomCurve3([[0.9, 0.0], [2.0, -0.12], [3.2, 0.02], [4.3, 0.35], [5.0, 0.85], [5.2, 1.3]].map(([x, y]) => new T.Vector3(side * x, y, 0)));
    const ps = curve.getPoints(10);
    for (let i = 0; i + 1 < ps.length; i++) {
      const p = ps[i], q = ps[i + 1], l = Math.hypot(q.x - p.x, q.y - p.y);
      limb(new T.BoxGeometry(l + 0.04, 0.26, 0.14).rotateZ(Math.atan2(q.y - p.y, q.x - p.x)), sC + (p.x + q.x) / 2, cy + (p.y + q.y) / 2, rd + 0.01 * (i % 3));
    }
    // leaf cluster at the scroll end
    limb(new T.SphereGeometry(0.28, 8, 6), sC + side * 5.2, cy + 1.45, rd + 0.1);
  }
  // Central group: a seated central figure on a plinth with raised arm, two seated figures either side, a reclining figure at each end.
  box(sC, cy - 0.15, 0.04, 2.4, 0.5, 0.3, 'stone');
  const seated = (s: number, scale: number) => {
    limb(new T.BoxGeometry(0.62 * scale, 0.7 * scale, 0.4 * scale), s, cy + 0.65 * scale, 0.28);
    limb(new T.CylinderGeometry(0.26 * scale, 0.34 * scale, 0.75 * scale, 8), s, cy + 1.3 * scale, 0.3);
    limb(new T.SphereGeometry(0.2 * scale, 8, 6), s, cy + 1.88 * scale, 0.3);
    limb(new T.BoxGeometry(0.12 * scale, 0.7 * scale, 0.12 * scale).rotateZ(-0.5), s + 0.34 * scale, cy + 1.75 * scale, 0.32);
  };
  seated(sC, 1.25);
  for (const side of [-1, 1]) {
    seated(sC + side * 1.55, 0.95);
    // reclining figure at the scroll end: lying body, head and raised knee
    limb(new T.BoxGeometry(1.25, 0.42, 0.34), sC + side * 3.3, cy + 0.42, 0.26);
    limb(new T.SphereGeometry(0.2, 8, 6), sC + side * 2.55, cy + 0.72, 0.27);
    limb(new T.BoxGeometry(0.5, 0.3, 0.3).rotateZ(side * 0.7), sC + side * 3.8, cy + 0.72, 0.27);
  }
  stats.relief = true;
  // Red cast-iron street lamp with a crown finial in front of the stair, right of the door (panorama 2019).
  const lampS = -0.15, lampD = 2.3;
  place(new T.CylinderGeometry(0.1, 0.14, 0.5, 8), lampS, 0.25, lampD, 'red');
  place(new T.CylinderGeometry(0.05, 0.08, 3.1, 8), lampS, 0.5 + 1.55, lampD, 'red');
  place(new T.CylinderGeometry(0.3, 0.2, 0.55, 6), lampS, 3.9, lampD, 'gold');
  place(new T.ConeGeometry(0.34, 0.25, 6), lampS, 4.3, lampD, 'red');
  place(new T.SphereGeometry(0.08, 6, 4), lampS, 4.5, lampD, 'gold');
}

export function buildMaagdenhuis(_w: number, _d: number, b: BuildingTools) {
  const {built, stats} = compileMaagdenhuis();
  built.group.traverse(o => {
    if (!(o instanceof T.Mesh)) return;
    const colour: Colour | undefined = o.name.endsWith(PLINTH_SLOT) ? 'concrete' : o.name.endsWith(IRON_SLOT) ? 'slate' : PALETTE[o.userData.materialSlot as string];
    if (!colour) throw Error(`maagdenhuis: no palette colour for materialSlot ${o.userData.materialSlot} (${o.name})`);
    const src = o.geometry as T.BufferGeometry, g = src.index ? src.toNonIndexed() : src.clone(), a = g.getAttribute('position');
    // The shell stands on the 3DBAG ground: nothing below y = 0 is wanted.
    const keep: number[] = [];
    for (let i = 0; i < a.count; i += 3) if (Math.max(a.getY(i), a.getY(i + 1), a.getY(i + 2)) > 0.01) for (let k = 0; k < 3; k++) keep.push(a.getX(i + k), Math.max(0, a.getY(i + k)), a.getZ(i + k));
    if (!keep.length) return;
    const out = new T.BufferGeometry(); out.setAttribute('position', new T.Float32BufferAttribute(keep, 3)); out.computeVertexNormals();
    b.add(out, colour);
  });
  const front = built.panels.find(p => p.index === FRONT_PANEL);
  if (!front) throw Error('maagdenhuis: front panel missing');
  addPediment(b, front, stats);
}
