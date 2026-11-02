import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {setSink, slab, type Frame} from './nearbar-kit';
import {addShell, type ShellSource} from './worship-shell';
import main from './zonnehuis-footprints.json';
import nw from './zonnehuis-nw-footprints.json';

type Colour = Parameters<BuildingTools['add']>[1];

/**
 * Het Zonnehuis, Zonneplein 30, Tuindorp Oostzaan (J.H. Mulder, opened 29 October 1932; Rijksmonument 508539; nl.wikipedia
 * "Zonnehuis", CC BY-SA 4.0): an Amsterdam School T-plan, a gabled hall with two low wings either side of its front.
 * BAG pand 0363100012092742 is the hall and the SE wing; the NW wing is BAG pand 0363100012132683 (also 1932), included so the
 * symmetrical front reads whole. Native frame of scripts/landmarks/zonnehuis-footprints.json (x east, z south, y up from the
 * 3DBAG ground, -2.4 m NAP); the NW pand's file is shifted into it by the RD anchor difference.
 *
 * The hall is authored (walls to 8.1 m, a 1.5 m flat strip on each side, a 37 degree tiled roof to the 14.6 m ridge between brick
 * gables); the wings are their 3DBAG LoD2.2 shells (CC BY 4.0). Measured on the head-on Commons photo "Zonnehuis 2023.jpg"
 * (Marion Golsteijn, CC BY-SA 4.0, 68.5 px/m on the front), the rectified panorama crops w02/w07/w09 (Gemeente Amsterdam, CC BY 4.0,
 * 50 px/m) and the Commons photos listed in zonnehuis-inventory.json.
 */
type Src = ShellSource & {anchorRD: number[]};
const M = main as unknown as Src, N = nw as unknown as Src;
const DX = N.anchorRD[0] - M.anchorRD[0], DZ = -(N.anchorRD[1] - M.anchorRD[1]);

// Hall corners in the native frame (BAG ring vertices).
const FNW = [-24.229, -2.978], FSE = [-8.199, 9.555], RSE = [11.736, -15.887], RNW = [-4.249, -28.465];
const W = Math.hypot(FSE[0] - FNW[0], FSE[1] - FNW[1]);   // 20.35 m front
const D = Math.hypot(RNW[0] - FNW[0], RNW[1] - FNW[1]);   // 32.39 m deep
const ax = [(FSE[0] - FNW[0]) / W, (FSE[1] - FNW[1]) / W]; // along the front, NW -> SE
const nf = [-ax[1], ax[0]];                                 // out of the front (bearing 218)
/** Hall local (x along the front from the NW corner, y, z out of the front; the rear is z = -D) to native. det +1. */
const HM = new T.Matrix4().set(ax[0], 0, nf[0], FNW[0], 0, 1, 0, 0, ax[1], 0, nf[1], FNW[1], 0, 0, 0, 1);
const frame = (o: number[], t: number[]): Frame => ({origin: [o[0], o[1]], tangent: [t[0], t[1]], n: [-t[1], t[0]]});
// the BAG ring is not quite a rectangle (4 cm); the facade frames use the hall box corners so trims sit on its faces
const hc = (x: number, z: number) => [FNW[0] + ax[0] * x + nf[0] * z, FNW[1] + ax[1] * x + nf[1] * z];
const FRONT = frame(FNW, ax), REAR = frame(hc(W, -D), [-ax[0], -ax[1]]);
const SIDE_SE = frame(hc(W, 0), [-nf[0], -nf[1]]), SIDE_NW = frame(hc(0, -D), [nf[0], nf[1]]);
const FRONT_ANGLE = Math.atan2(-ax[1], ax[0]);

const EAVE = 8.1, RIDGE = 14.6, SHOULDER = 1.5;

let b: BuildingTools;
function put(g: T.BufferGeometry, c: Colour) { g.applyMatrix4(HM); b.add(g, c); }
function HB(x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, c: Colour) {
  put(new T.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), c);
}
/** Prism of an (x, y) profile in hall coordinates, extruded over z0..z1. */
function HP(pts: [number, number][], z0: number, z1: number, c: Colour) {
  const g = new T.ExtrudeGeometry(new T.Shape(pts.map(p => new T.Vector2(p[0], p[1]))), {depth: z1 - z0, bevelEnabled: false});
  g.translate(0, 0, z0); put(g, c);
}

/** Window: yellow frame, glass standing 9 cm proud of it, white glazing bars (cols x rows panes). */
function win(f: Frame, t: number, y0: number, w: number, h: number, cols: number, rows: number, out = 0) {
  slab(b, f, t, y0 - 0.08, w + 0.16, h + 0.16, 0.05, 'frame', out);
  slab(b, f, t, y0, w, h, 0.14, 'glass', out);
  for (let k = 1; k < cols; k++) slab(b, f, t - w / 2 + k * w / cols, y0, 0.05, h, 0.2, 'white', out);
  for (let k = 1; k < rows; k++) slab(b, f, t, y0 + k * h / rows - 0.025, w, 0.05, 0.2, 'white', out);
}

function hallMass() {
  HB(0, W, -D, 0, 0, EAVE, 'brick');
  // flat lead strips beside the pitched roof and the stone coping on the wall heads
  HB(0.3, W - 0.3, -D + 0.3, -0.3, EAVE - 0.04, EAVE + 0.12, 'slate');
  for (const [x0, x1] of [[-0.05, 0.4], [W - 0.4, W + 0.05]]) HB(x0, x1, -D - 0.05, 0.05, EAVE - 0.05, EAVE + 0.22, 'stone');
  for (const [z0, z1] of [[-0.4, 0.05], [-D - 0.05, -D + 0.4]]) for (const [x0, x1] of [[0.4, SHOULDER + 0.2], [W - SHOULDER - 0.2, W - 0.4]]) HB(x0, x1, z0, z1, EAVE - 0.05, EAVE + 0.22, 'stone');
  // brick gables, 0.3 m thick, with stone coping on the rakes
  const apex = W / 2, tri: [number, number][] = [[SHOULDER, EAVE], [W - SHOULDER, EAVE], [apex, RIDGE]];
  HP(tri, -0.3, 0, 'brick'); HP(tri, -D, -D + 0.3, 'brick');
  const slope = Math.atan2(RIDGE - EAVE, apex - SHOULDER), L = Math.hypot(RIDGE - EAVE, apex - SHOULDER);
  for (const z of [-0.15, -D + 0.15]) for (const s of [-1, 1]) {
    const g = new T.BoxGeometry(L + 0.2, 0.22, 0.48);
    g.translate(0, 0.11, 0); g.rotateZ(s < 0 ? slope : -slope);
    const mx = s < 0 ? (SHOULDER + apex) / 2 : (apex + W - SHOULDER) / 2;
    g.translate(mx, (EAVE + RIDGE) / 2 - 0.02, z); put(g, 'stone');
  }
  // tiled roof between the gables (2 cm clear of them, under the rake coping)
  HP([[SHOULDER - 0.1, EAVE + 0.02], [W - SHOULDER + 0.1, EAVE + 0.02], [apex, RIDGE + 0.06]], -D + 0.32, -0.32, 'slate');
  // ventilator caps on both apexes, chimneys and roof vents on both slopes (Commons "Zonnehuis Zonneplein Amsterdam.jpg", w02)
  for (const z of [-0.15, -D + 0.15]) HB(apex - 0.35, apex + 0.35, z - 0.35, z + 0.35, RIDGE - 0.1, RIDGE + 0.7, 'stone');
  HB(apex - 0.5, apex + 0.5, -2.8, -1.8, RIDGE - 0.6, RIDGE + 0.9, 'brick');
  HB(apex - 0.6, apex + 0.6, -2.9, -1.7, RIDGE + 0.9, RIDGE + 1.05, 'stone');
  const tan = (RIDGE - EAVE) / (apex - SHOULDER);
  for (const side of [-1, 1]) {
    for (const z of [-9, -17]) {
      const x = apex + side * 2.6, yr = RIDGE - 2.6 * tan;
      HB(x - 0.45, x + 0.45, z - 0.45, z + 0.45, yr - 0.6, yr + 1.6, 'brick');
      HB(x - 0.55, x + 0.55, z - 0.55, z + 0.55, yr + 1.6, yr + 1.75, 'stone');
    }
    for (const z of [-5.5, -13, -21]) {
      const x = apex + side * 5.4, yr = RIDGE - 5.4 * tan;
      // small hipped vent dormer: a box with a pyramid cap
      HB(x - 0.4, x + 0.4, z - 0.45, z + 0.45, yr - 0.5, yr + 0.55, 'slate');
      const cap = new T.ConeGeometry(0.62, 0.4, 4, 1); cap.rotateY(Math.PI / 4); cap.translate(x, yr + 0.75, z); put(cap, 'slate');
    }
  }
}

function frontFacade() {
  const f = FRONT, c = W / 2;
  // plinth band and basement vents
  slab(b, f, c, 0, W, 1.45, 0.1, 'red');
  for (const x of [1.9, 3.1, W - 3.1, W - 1.9]) slab(b, f, x, 0.45, 0.75, 0.45, 0.16, 'white');
  // centre bay: four piers with stepped caps, windows between them in two rows, patterned panels, canopy, three double doors
  const piers = [-3.25, -1.1, 1.1, 3.25].map(d => c + d);
  for (const p of piers) {
    slab(b, f, p, 0, 0.6, 10.0, 0.45, 'brick');
    slab(b, f, p, 10.0, 0.7, 0.25, 0.5, 'brick'); slab(b, f, p, 10.25, 0.5, 0.25, 0.4, 'brick');
  }
  for (let k = 0; k < 3; k++) {
    const x = (piers[k] + piers[k + 1]) / 2;
    win(f, x, 9.0, 1.4, 1.1, 2, 2);
    win(f, x, 5.8, 1.45, 2.0, 2, 3);
    slab(b, f, x, 4.8, 1.55, 0.95, 0.1, 'pink');
    slab(b, f, x, 7.9, 1.55, 1.0, 0.1, 'pink');
    slab(b, f, x, 1.6, 1.4, 2.5, 0.08, 'dark');
    slab(b, f, x - 0.35, 2.6, 0.3, 1.2, 0.12, 'glass'); slab(b, f, x + 0.35, 2.6, 0.3, 1.2, 0.12, 'glass');
  }
  slab(b, f, c, 4.45, 7.75, 0.3, 1.6, 'dark');
  // granite steps: seven risers of 0.22 m up to the 1.54 m landing, narrowing from 14.2 m to 9.6 m (front photo)
  for (let k = 0; k < 7; k++) {
    const w = 14.2 - k * (14.2 - 9.6) / 6, depth = 1.0 + (7 - k) * 0.35;
    slab(b, f, c, 0.005 * k, w, (k + 1) * 0.22 - 0.005 * k, depth + 0.1, 'stone', -0.1);
  }
  // side bays: tall twin strip windows next to the centre bay, a large window over a ground-floor window
  for (const s of [-1, 1]) {
    const pierEdge = c + s * 3.55, stripC = pierEdge + s * (0.2 + 0.6);
    for (const dx of [-0.32, 0.32]) win(f, stripC + dx, 2.4, 0.45, 4.6, 1, 8);
    const wc = pierEdge + s * (2.85 + 1.0);
    win(f, wc, 5.6, 2.0, 1.6, 2, 3);
    win(f, wc, 2.45, 2.0, 2.05, 2, 4);
  }
  // 't ZONNEHUIS in gilt letters at 10.7-11.2 m, the small square window above it
  const p = new T.Vector3(c + 0.15, 10.72, 0.1).applyMatrix4(HM);
  b.sign('ZONNEHUIS', p.x, p.y, p.z, 0.068, 'gold', 3.6, FRONT_ANGLE);
  const q = new T.Vector3(c - 2.05, 11.0, 0.1).applyMatrix4(HM);
  b.sign('T', q.x, q.y, q.z, 0.035, 'gold', undefined, FRONT_ANGLE);
  win(f, c, 11.6, 0.45, 0.45, 1, 1);
}

function rearFacade() {
  const f = REAR, c = W / 2;
  slab(b, f, c, 0, W, 1.2, 0.1, 'red');
  for (const s of [-1, 1]) { const x = c + s * 7.5; win(f, x, 1.6, 1.9, 2.0, 2, 4); win(f, x, 4.6, 1.9, 1.6, 2, 3); }
  // four statue piers (father, mother, two children by Willem IJzerdraat and Marinus Vreugde), pilasters above, recessed panels
  const xs = [-3.55, -1.2, 1.2, 3.55].map(d => c + d);
  for (let k = 0; k < xs.length - 1; k++) slab(b, f, (xs[k] + xs[k + 1]) / 2, 3.0, xs[k + 1] - xs[k] - 0.5, 4.2, 0.1, 'pink');
  for (const x of xs) {
    slab(b, f, x, 0, 0.55, 2.3, 0.45, 'brick');
    slab(b, f, x, 2.3, 0.75, 0.15, 0.55, 'concrete');
    slab(b, f, x, 2.45, 0.7, 2.0, 0.18, 'concrete');
    figure(f, x, 2.45);
    slab(b, f, x, 4.5, 0.45, 4.6, 0.14, 'brick');
  }
  // low planter wall in front of the statues
  slab(b, f, c, 0, 9.6, 0.8, 1.2, 'brick');
}

/** A standing figure in relief on its backing slab: legs, tapered body, shoulders, head (simplified, 1.9 m). */
function figure(f: Frame, t: number, y: number) {
  const px = f.origin[0] + f.tangent[0] * t, pz = f.origin[1] + f.tangent[1] * t, n = f.n;
  const at = (out: number, yy: number) => [px + n[0] * out, yy, pz + n[1] * out];
  const body = new T.CylinderGeometry(0.17, 0.2, 0.75, 6); const bp = at(0.3, y + 1.15); body.translate(bp[0], bp[1], bp[2]); b.add(body, 'concrete');
  const legs = new T.CylinderGeometry(0.19, 0.14, 0.8, 6); const lp = at(0.28, y + 0.4); legs.translate(lp[0], lp[1], lp[2]); b.add(legs, 'concrete');
  const sh = new T.CylinderGeometry(0.23, 0.18, 0.18, 6); const sp = at(0.3, y + 1.6); sh.translate(sp[0], sp[1], sp[2]); b.add(sh, 'concrete');
  const head = new T.SphereGeometry(0.13, 8, 6); const hp = at(0.3, y + 1.82); head.translate(hp[0], hp[1], hp[2]); b.add(head, 'concrete');
}

/** Long hall walls: the 2 m strip in front of the wing, then buttress piers with tall windows and a side door in the rear 20 m. */
function sideWalls() {
  for (const side of [SIDE_SE, SIDE_NW]) {
    const fromFront = (z: number) => (side === SIDE_SE ? z : D - z); // t of a point z m behind the front
    slab(b, side, D / 2, 0, D, 1.2, 0.1, 'red');
    win(side, fromFront(1.0), 2.45, 1.0, 2.05, 1, 4);
    win(side, fromFront(1.0), 5.6, 1.0, 1.6, 1, 3);
    const piers = [14.5, 17.5, 20.5, 23.5, 26.5, 29.5];
    for (const z of piers) {
      slab(b, side, fromFront(z), 0, 0.8, 6.0, 0.5, 'brick');
      slab(b, side, fromFront(z), 6.0, 0.8, 0.3, 0.32, 'brick'); slab(b, side, fromFront(z), 6.3, 0.8, 0.25, 0.16, 'brick');
    }
    for (let k = 0; k < piers.length - 1; k++) {
      const z0 = piers[k] + 0.4, z1 = piers[k + 1] - 0.4, mid = (z0 + z1) / 2;
      if (k === piers.length - 2) {
        // rear bay: white double door with a transom, a narrow window, brick steps (Commons "Zijgevel ...")
        win(side, fromFront(mid - 0.45), 3.85, 1.2, 1.8, 2, 3);
        slab(b, side, fromFront(mid - 0.45), 0.7, 1.2, 3.05, 0.16, 'white');
        slab(b, side, fromFront(mid - 0.45), 0, 1.6, 0.7, 1.2, 'brick');
        win(side, fromFront(mid + 0.75), 1.6, 0.45, 4.0, 1, 7);
      } else for (const dz of [-0.55, 0.55]) win(side, fromFront(mid + dz), 1.6, 0.7, 4.0, 2, 7);
    }
  }
}

/** Wing details on the 3DBAG shells: yellow eaves fascia, windows and door on the plaza (SW) sides, end windows, ridge chimneys. */
function wings() {
  const L = 23.4;
  // SE wing SW face (w02-218, t from the hall end) and the NW wing mirrored about the hall axis
  const seFace = frame([-6.948, 7.954], [(11.441 + 6.948) / L, (22.387 - 7.954) / L]);
  const nwA = [-41.39, -18.98], nwB = [-22.98, -4.58], nwL = Math.hypot(nwB[0] - nwA[0], nwB[1] - nwA[1]);
  const nwFace = frame(nwA, [(nwB[0] - nwA[0]) / nwL, (nwB[1] - nwA[1]) / nwL]);
  const windows = [0.7, 1.84, 2.96, 4.1, 10.2, 11.34, 12.46, 13.56, 14.86, 16.0, 17.12, 18.35, 19.6, 20.8, 21.94, 22.35];
  for (const [f, mirror] of [[seFace, false], [nwFace, true]] as [Frame, boolean][]) {
    const tt = (t: number) => (mirror ? nwL - t : t);
    slab(b, f, L / 2 + (mirror ? nwL - L : 0), 3.1, L + 0.1, 0.65, 0.14, 'ochre');
    slab(b, f, L / 2 + (mirror ? nwL - L : 0), 3.02, L + 0.1, 0.08, 0.22, 'ochre');
    for (const t of windows) win(f, tt(t), 1.1, 0.75, 1.55, 2, 3);
    win(f, tt(8.8), 1.3, 0.38, 1.3, 1, 3);
    slab(b, f, tt(7.15), 0.05, 1.7, 2.55, 0.1, 'dark');
    // ridge chimneys at 7.0 / 10.3 / 13.7 / 17.0 m, on the wing's centre line 5.15 m behind the face
    for (const t of [7.0, 10.3, 13.7, 17.0]) {
      slab(b, f, tt(t), 7.2, 0.9, 1.75, 0.9, 'brick', -5.6);
      slab(b, f, tt(t), 8.95, 1.15, 0.14, 1.15, 'stone', -5.72);
    }
  }
  // SE end gable of the SE wing (w06-130): five windows, apex chimney; the NW wing's NW end mirrored
  const seEnd = frame([15.781, 25.088], [(21.492 - 15.781) / 9.05, (18.068 - 25.088) / 9.05]);
  const nwEndA = [-39.38, -29.64], nwEndB = [-44.91, -22.58], nwEndL = Math.hypot(nwEndB[0] - nwEndA[0], nwEndB[1] - nwEndA[1]);
  const nwEnd = frame(nwEndA, [(nwEndB[0] - nwEndA[0]) / nwEndL, (nwEndB[1] - nwEndA[1]) / nwEndL]);
  for (const [f, len] of [[seEnd, 9.05], [nwEnd, nwEndL]] as [Frame, number][]) {
    // five windows with brick between them (w06-130: outer frame 0.79 of the 0.98 m pitch, 1.78 tall to wide)
    for (let k = -2; k <= 2; k++) win(f, len / 2 + k * 0.98, 1.4, 0.62, 1.25, 2, 3);
    // the wing's yellow eaves fascia only returns 1.2 m onto the gable at each corner
    for (const t of [0.6, len - 0.6]) slab(b, f, t, 3.1, 1.2, 0.14, 0.14, 'ochre');
    // apex chimney on the end gable (w06-130)
    slab(b, f, len / 2, 7.0, 0.95, 1.6, 0.7, 'brick', -0.75);
    slab(b, f, len / 2, 8.6, 1.15, 0.14, 0.9, 'stone', -0.85);
  }
}

export function buildZonnehuis(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  // wing shells: every 3DBAG surface of the two pands except the hall's own (authored above) and wing walls on the hall's side planes
  const toHall = (p: number[]) => { const dx = p[0] - FNW[0], dz = p[2] - FNW[1]; return [dx * ax[0] + dz * ax[1], -(dx * nf[0] + dz * nf[1])]; };
  // the 3DBAG front steps 0.5 m out of the BAG line at the gable piers; those walls belong to the authored front
  const inHall = (p: number[]) => { const [x, z] = toHall(p); return x > -0.3 && x < W + 0.3 && z > -0.8 && z < D + 0.3; };
  // wing roofs and walls that run under the hall eaves (3DBAG's hall is 1 m narrower than the BAG ring) end on the hall side walls
  const toSide = (p: number[]) => {
    const [x, z] = toHall(p);
    if (x <= 0 || x >= W || z <= 0 || z >= D) return p;
    const nx = x < W / 2 ? 0 : W;
    return [FNW[0] + ax[0] * nx - nf[0] * z, p[1], FNW[1] + ax[1] * nx - nf[1] * z];
  };
  const shift = (s: {type: string; rings: number[][][]}) => ({...s, rings: s.rings.map(r => r.map(p => [p[0] + DX, p[1], p[2] + DZ]))});
  const clamp = (s: {type: string; rings: number[][][]}) => ({...s, rings: s.rings.map(r => r.map(toSide))});
  const surfaces = [...M.surfaces, ...N.surfaces.map(shift)].filter(s => s.type !== 'GroundSurface' && !s.rings[0].every(inHall)).map(clamp);
  setSink(0);
  addShell(b, {surfaces, nativeRing: M.nativeRing}, {wall: 'brick', roof: 'slate'});
  setSink(0.12);
  hallMass();
  frontFacade();
  rearFacade();
  sideWalls();
  wings();
  setSink(0);
}
