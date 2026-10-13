import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {compileLargeBuilding, type CompiledLargeBuilding, type LargeCompileHooks} from '../../src/canalRecall/buildingRecipe/largeCompile';
import {validateLargeIntent} from '../../src/canalRecall/buildingRecipe/largeIntent';
import type {PanelCtx} from '../../src/canalRecall/blockBuilding/compose';
import {fitsPanel, newell, rectPoly} from '../../src/canalRecall/blockBuilding/panels';
import {dot, norm, scale, sub} from '../../src/canalRecall/blockBuilding/mesh';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts';
import intentJson from './hoofdbureau-elandsgracht-intent.json';
import factsJson from './hoofdbureau-elandsgracht-facts.json';

/**
 * Hoofdbureau van Politie, Elandsgracht 117 (BAG 0363100012169550, 1941; city public works). A hybrid builder:
 *
 *  - massing: the 3DBAG LoD2.2 walls and roofs verbatim, through the large-tier fit and block-kit compose
 *    (`compileLargeBuilding`), one facade system per wall group of scripts/landmarks/hoofdbureau-elandsgracht-intent.json;
 *  - by hand, from the panoramas (research in hoofdbureau-elandsgracht-research.json): the projecting white stone window hoods
 *    of the 1941 wings, the entrance canopy with its post on the Marnixstraat end block, the blue POLITIE plate on its bracket.
 *
 * Local frame = the large tier's: x east, z south, y up from the 3DBAG ground, origin the BAG footprint centroid.
 */
const FACTS = factsJson as unknown as BuildingFacts;
/** 3DBAG wall surfaces (one per hooded wall group of the intent) of the 1941 south-east fronts with white stone window hoods. */
const HOOD_SURFACES = [41, 216, 53];

/** MeshBuilder slot materialSlot (recipe) -> landmark palette name. */
const PALETTE: Record<string, 'brick' | 'stone' | 'glass' | 'frame' | 'dark' | 'blue' | 'white' | 'slate'> = {
  brick: 'brick', stucco: 'white', stone: 'stone', glass: 'glass', frame: 'frame', door: 'dark', accent: 'blue', slate: 'slate', roofTile: 'slate', bitumen: 'slate',
};

export interface HoofdbureauStats {triangles: number; hoods: number; canopy: boolean; plate: boolean}

/** A closed box in the panel's frame: `PanelCtx.box` omits the back (it sits on the wall); a free-standing part needs it. */
function solid(c: PanelCtx, slot: string, u0: number, u1: number, v0: number, v1: number, d0: number, d1: number, part: number) {
  c.box(slot, u0, u1, v0, v1, d0, d1, part);
  c.mesh.quad(slot, c.P(u0, v0, d0), c.P(u1, v0, d0), c.P(u1, v1, d0), c.P(u0, v1, d0), part, scale(c.p.n, -1));
}

/** Hand-modelled parts, drawn in each panel's own frame so every one sits on the exact 3DBAG wall plane. */
export function hoofdbureauHooks(stats: HoofdbureauStats): LargeCompileHooks {
  return {
    budget: 40000,
    panelHook: (c, info, g) => {
      if (!g) return;
      const s = g.slots, p = c.p;
      if (g.surfaces.includes(4)) {
        // sw-sculpture-group (simplified): the stone pair on a console high on the left of the quay front (wall 247, 27 m; pano 2021): console 1.2 m wide
        // at 11.3 m, two blocky standing figures (legs, torso, head) 2.5 m tall, 1.5 m across. The Krop/Beeldbank attribution is not found, so no details.
        const part = c.part(), u = 3.9;
        c.box(s.stone, u - 0.75, u + 0.75, 11.3, 11.9, 0, 0.9, part);
        for (const du of [-0.38, 0.38]) {
          c.box(s.stone, u + du - 0.17, u + du + 0.17, 11.9, 12.7, 0.25, 0.6, part);
          c.box(s.stone, u + du - 0.22, u + du + 0.22, 12.7, 13.5, 0.28, 0.58, part);
          c.box(s.stone, u + du - 0.11, u + du + 0.11, 13.5, 13.8, 0.33, 0.53, part);
        }
      }
      if (HOOD_SURFACES.some(w => g.surfaces.includes(w))) {
        // Heavy white stone hood over every sash window, a little wider than the opening (panorama 2025, west wing).
        for (const [k, list] of c.holes) {
          // The hood sits on the member wall's own plane (3DBAG walls drift a few cm from the merged panel plane).
          const ring = p.members![k].rings[0], nm = norm(newell(ring)), den = dot(nm, p.n);
          for (const [u0, u1, v0, v1] of list) {
            // No hood where it would run past the wall's top or side edge (it would hang in the air at a corner or eaves).
            if (v1 + 0.34 > g.eavesM || !fitsPanel(p, rectPoly(u0 - 0.2, u1 + 0.2, v1 + 0.02, v1 + 0.32), 0.05)) continue;
            const at = c.P((u0 + u1) / 2, v1, 0), d = Math.abs(den) > 1e-6 ? dot(nm, sub(ring[0], at)) / den : 0;
            c.box(s.stone, u0 - 0.16, u1 + 0.16, v1 + 0.03, v1 + 0.3, d, d + 0.17, c.part());
            stats.hoods++;
          }
        }
      }
      if (g.entrance?.panel === p.index && info.levels.length > 1) {
        const e = g.entrance, cells = info.cells.filter(x => x.bay === e.bay && x.floor < e.storeys);
        if (cells.length) {
          const u0 = Math.min(...cells.map(x => x.u0)), u1 = Math.max(...cells.map(x => x.u1)), top = info.levels[1];
          // Flat canopy slab on a single round post at the street corner, as in the 2025 panorama; plate on a bracket beside it.
          const v0 = Math.min(top - 0.95, top - 0.6), part = c.part();
          c.box(s.stone, u0 - 0.4, u1 + 0.4, v0, v0 + 0.22, 0, 1.9, part);
          const post = c.part();
          solid(c, s.frame, u1 + 0.15, u1 + 0.4, p.vMin, v0, 1.5, 1.75, post);
          // The post must touch the slab (shares its underside plane) and the ground.
          stats.canopy = true;
          const plate = c.part();
          solid(c, s.frame, u0 - 1.35, u0 - 1.3, v0 + 0.1, v0 + 1.3, 0, 0.35, plate);
          solid(c, s.sign, u0 - 1.65, u0 - 1.35, v0 + 0.55, v0 + 1.25, 0.3, 0.36, plate);
          stats.plate = true;
          // POLITIE word mark on the wall over the canopy (e-politie-lettering): 3x5 block letters, 0.1 m pixels, 2.7 m wide, centred on the entrance bay.
          const FONT: Record<string, string[]> = {P: ['111', '101', '111', '100', '100'], O: ['111', '101', '101', '101', '111'], L: ['100', '100', '100', '100', '111'],
            I: ['111', '010', '010', '010', '111'], T: ['111', '010', '010', '010', '010'], E: ['111', '100', '111', '100', '111']};
          const px = 0.1, word = 'POLITIE', wordW = word.length * 3 * px + (word.length - 1) * px, lp = c.part();
          let x = (u0 + u1) / 2 - wordW / 2;
          for (const ch of word) {
            FONT[ch].forEach((row, j) => {
              for (let k = 0; k < 3;) {
                if (row[k] !== '1') { k++; continue; }
                let m = k; while (m < 3 && row[m] === '1') m++;
                c.box(s.stucco ?? s.stone, x + k * px, x + m * px, v0 + 0.45 + (4 - j) * px, v0 + 0.45 + (5 - j) * px, 0, 0.04, lp);
                k = m;
              }
            });
            x += 4 * px;
          }
        }
      }
    },
  };
}

export function compileHoofdbureau(): {built: CompiledLargeBuilding; stats: HoofdbureauStats} {
  const intent = validateLargeIntent(intentJson);
  const stats: HoofdbureauStats = {triangles: 0, hoods: 0, canopy: false, plate: false};
  const built = compileLargeBuilding(intent, FACTS, hoofdbureauHooks(stats));
  return {built, stats};
}

/**
 * The north end wall of the Marnixstraat wing (3DBAG wall 190, faces 337 deg; panorama 2025-07-03 recording_2025-07-03_10-58-37_00361
 * and a user photo, 2026-10-13): the white steel ribbons of the long front wrap round the corner for ~5 m; the rest carries the
 * big stone relief of the Amsterdam arms (crowned shield with the three saltires on a pale, two rampant lions, a long banner sweeping
 * left), three standing figures on brackets under it, a row of six round windows, and an open ground storey behind white columns.
 * Drawn in the wall's own frame: s along the wall from the north-east corner, y up from the landmark ground, o out of the wall.
 */
const END_WALL = {a: [10.56, -97.98] as const, b: [-2.07, -92.65] as const, top: 16.96, storey: 16.96 / 5};

export function addEndWallRelief(b: BuildingTools) {
  const [ax, az] = END_WALL.a, len = Math.hypot(END_WALL.b[0] - ax, END_WALL.b[1] - az);
  const t = [(END_WALL.b[0] - ax) / len, (END_WALL.b[1] - az) / len], n = [-t[1], t[0]];   // n points out (north-north-west); local +x then runs along +s
  const yaw = Math.atan2(n[0], n[1]);
  /** Place a geometry built in a local frame (x along the wall, y up, z out of the wall) at (s, y, o). */
  const put = (g: T.BufferGeometry, s: number, y: number, o: number, colour: Parameters<BuildingTools['add']>[1]) => {
    g.rotateY(yaw);
    g.translate(ax + t[0] * s + n[0] * o, y, az + t[1] * s + n[1] * o);
    b.add(g, colour);
  };
  const box = (s: number, y: number, o: number, w: number, h: number, d: number, colour: Parameters<BuildingTools['add']>[1]) =>
    put(new T.BoxGeometry(w, h, d), s, y + h / 2, o + d / 2, colour);
  const extrude = (shape: T.Shape, depth: number) => new T.ExtrudeGeometry(shape, {depth, bevelEnabled: false, curveSegments: 10});

  // Registration from the rectified 2022 pano (wall 337, 13.9 m; 42 px/m, ground at the column bases): the open ground storey is 5.0 m tall
  // on four columns, the six round windows sit at 7.2 m on a 2.26 m pitch across the whole width, the figures stand on 1.2 m consoles
  // (heads at 10.3 m), the arms centre on s 6.6 with the banner band at 12.7 m, and the left of the wall is plain brick (the ribbons
  // of the long front stop at the corner; an earlier pass wrapped four of them round the left 5 m).
  const H0 = 4.75;
  box(len / 2, 0, 0, len - 0.3, H0, 0.04, 'dark');
  box(len / 2, H0, 0, len, 0.32, 0.9, 'stone');
  for (const s of [1.4, 4.1, 8.8, 13.4]) put(new T.CylinderGeometry(0.24, 0.24, H0, 16), s, H0 / 2, 0.6, 'concrete');   // structural columns: concrete, not opening trim

  // Two 5 cm glass anchors inside the brick (invisible) keep the glass primitive's position range what it was when the left ribbons stood here:
  // the GLB quantises positions per primitive, and with a narrower range the kit windows' 1.5 cm bar-to-glass gaps round to under the audit's
  // 1 cm coplanar tolerance (3.4 m2 of z-fight on 36 windows elsewhere in the building). Root cause is the 1.5 cm bar offset in blockBuilding/compose.ts.
  box(0.4, 4.3, -0.03, 0.05, 0.05, 0.05, 'glass'); box(5.3, 14, -0.03, 0.05, 0.05, 0.05, 'glass');
  // Six round windows in a row over the colonnade.
  for (let k = 0; k < 6; k++) {
    const s = 0.9 + k * 2.26, y = 7.2;
    put(new T.TorusGeometry(0.28, 0.07, 6, 18), s, y, 0.04, 'white');
    put(new T.CircleGeometry(0.26, 18), s, y, 0.03, 'dark');
  }

  // Three standing figures on tall stone consoles (Hildo Krop).
  for (const s of [4.8, 6.6, 8.3]) {
    const y = 8.2;
    box(s, y - 1.2, 0, 0.9, 1.2, 0.75, 'stone');
    put(new T.CylinderGeometry(0.24, 0.3, 1.2, 10), s, y + 0.6, 0.38, 'white');              // robe
    put(new T.CylinderGeometry(0.3, 0.24, 0.5, 10), s, y + 1.45, 0.38, 'white');             // chest and shoulders
    for (const side of [-1, 1]) put(new T.BoxGeometry(0.12, 0.8, 0.14), s + side * 0.33, y + 1.2, 0.42, 'white');   // arms
    put(new T.SphereGeometry(0.15, 10, 8), s, y + 1.86, 0.38, 'white');                       // head
  }

  // The arms group is authored in its original frame (shield centre s 9.75, banner band y 9.65) and mapped onto the photo: centre
  // s 6.6, banner band 11.8 m, scale 0.85 (lion tops 14.8 m; checked against the camera-matched overlay).
  const K = 0.85, mapS = (s: number) => 6.6 + (s - 9.75) * K, mapY = (y: number) => 11.8 + (y - 9.65) * K;
  const putA = (g: T.BufferGeometry, s: number, y: number, o: number, colour: Parameters<BuildingTools['add']>[1]) => { g.scale(K, K, K); put(g, mapS(s), mapY(y), o * K, colour); };
  const boxA = (s: number, y: number, o: number, w: number, h: number, d: number, colour: Parameters<BuildingTools['add']>[1]) =>
    putA(new T.BoxGeometry(w, h, d), s, y + h / 2, o + d / 2, colour);
  const SC = 9.75, SY = 11.6;
  const shield = new T.Shape();
  shield.moveTo(-0.85, 1.05); shield.lineTo(0.85, 1.05); shield.lineTo(0.85, -0.2);
  shield.quadraticCurveTo(0.85, -0.95, 0, -1.25); shield.quadraticCurveTo(-0.85, -0.95, -0.85, -0.2); shield.lineTo(-0.85, 1.05);
  putA(extrude(shield, 0.22), SC, SY, 0, 'white');
  boxA(SC, SY - 1.15, 0.22, 0.5, 2.15, 0.06, 'stone');
  for (const dy of [0.62, 0, -0.62]) for (const r of [Math.PI / 4, -Math.PI / 4])
    putA(new T.BoxGeometry(0.46, 0.09, 0.05).rotateZ(r), SC, SY + dy, 0.3, 'white');
  putA(new T.CylinderGeometry(0.62, 0.62, 0.22, 16), SC, SY + 1.3, 0.3, 'white');                // crown band
  putA(new T.SphereGeometry(0.58, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), SC, SY + 1.4, 0.3, 'white');
  boxA(SC, SY + 1.95, 0.25, 0.09, 0.45, 0.09, 'white'); boxA(SC, SY + 2.15, 0.25, 0.3, 0.09, 0.09, 'white');

  // Two rampant lions holding the shield, mirrored: an extruded silhouette (rear paws on the banner, fore paws on the shield).
  const lion = new T.Shape();
  [[0, 0], [0.55, 0], [0.7, 0.55], [0.95, 0.95], [0.95, 1.6], [1.25, 2.0], [1.2, 2.45], [1.45, 2.6], [1.5, 2.95], [1.15, 3.15],
    [0.8, 3.0], [0.6, 2.55], [0.25, 2.3], [0.15, 1.6], [-0.35, 1.9], [-0.55, 2.45], [-0.4, 1.6], [0.05, 1.05], [-0.15, 0.45], [0, 0]]
    .forEach(([x, y], i) => i ? lion.lineTo(x, y) : lion.moveTo(x, y));
  for (const side of [-1, 1]) {
    const g = extrude(lion, 0.3);
    if (side > 0) {
      // Mirror, then swap two corners of every triangle so the faces still point outwards.
      g.scale(-1, 1, 1);
      const a = g.getAttribute('position') as T.BufferAttribute;
      for (let i = 0; i < a.count; i += 3) for (let k = 0; k < 3; k++) { const v = a.getComponent(i + 1, k); a.setComponent(i + 1, k, a.getComponent(i + 2, k)); a.setComponent(i + 2, k, v); }
      g.computeVertexNormals();
    }
    putA(g, SC + side * 2.55, SY - 1.55, 0, 'white');
  }

  // The banner (absolute wall coordinates, rectified pano): a ribbon 0.8 m wide, flat across the middle at 11.9 m from s 3.3 to 9.9, then
  // sweeping down on both sides into a curl: left tail ends at s 0.4-2 (10.1-11.6 m), right tail at s 11.2-12.8 (10.2-11.1 m).
  const curve = new T.CatmullRomCurve3([[1.5, 9.6], [0.6, 9.3], [0.4, 10.0], [1.2, 10.7], [2.3, 11.2], [3.4, 11.7], [4.8, 11.85], [6.6, 11.9], [8.4, 11.85], [9.8, 11.6], [10.8, 10.9], [11.6, 10.1], [12.4, 9.7], [12.8, 9.3], [12.3, 9.1], [11.9, 9.5]]
    .map(([s, y]) => new T.Vector3(s, y, 0)));
  const pts = curve.getPoints(60);
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy);
    put(new T.BoxGeometry(l + 0.03, 0.95, 0.12).rotateZ(-Math.atan2(dy, dx)), (p.x + q.x) / 2, (p.y + q.y) / 2, 0.06 + 0.015 * (i % 5), 'white');   // the curls overlap themselves: stagger the depth 2 cm so no two faces share a plane
  }
}

export function buildHoofdbureauElandsgracht(_w: number, _d: number, b: BuildingTools) {
  addEndWallRelief(b);
  const {built} = compileHoofdbureau();
  built.group.traverse(o => {
    if (!(o instanceof T.Mesh)) return;
    const name = PALETTE[o.userData.materialSlot as string];
    if (!name) throw Error(`hoofdbureau: no palette colour for materialSlot ${o.userData.materialSlot}`);
    // Per-group palette variants (slot names with an @) keep their own colour through the spare palette names red (wall) and gold (frame).
    const variant = o.name.includes('@');
    const colour = variant && name === 'brick' ? 'red' : variant && name === 'frame' ? 'gold' : name;
    const src = o.geometry as T.BufferGeometry, g = src.index ? src.toNonIndexed() : src.clone(), a = g.getAttribute('position');
    // The 3DBAG shell has a sunken ramp below the street (lowest -4.4 m): the landmark ground is y = 0, so drop what lies fully below it and clamp the rest.
    const keep: number[] = [];
    for (let i = 0; i < a.count; i += 3) if (Math.max(a.getY(i), a.getY(i + 1), a.getY(i + 2)) > 0.01) for (let k = 0; k < 3; k++) keep.push(a.getX(i + k), Math.max(0, a.getY(i + k)), a.getZ(i + k));
    if (!keep.length) return;
    const out = new T.BufferGeometry(); out.setAttribute('position', new T.Float32BufferAttribute(keep, 3)); out.computeVertexNormals();
    b.add(out, colour);
  });
}
