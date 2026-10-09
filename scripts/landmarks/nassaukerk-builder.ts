import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {archWindow, wallBetween, wallPoint} from './worship-kit';
import {onWall, type Wall} from './worship-walls';
import source from './nassaukerk-footprints.json';

/**
 * Nassaukerk, De Wittenkade 111 (H.G. Krijgsman, 1925-26, Amsterdam School). Greek-cross plan, rotated about 45 degrees on
 * the block: massing is the 3DBAG LoD2.2 shell with steep gabled arms (ridge 18.6 m). 3DBAG renders the clock tower as a
 * needle, so those surfaces are dropped and the tower is rebuilt from the photographs: a louvred shaft rising from the
 * crossing, a square onion cap of green copper with gilt clock faces, finial and weathervane (top 27.4 m as in 3DBAG).
 * The south-west arm is the street front (the steep triangular gable, eave 9 m, apex 18.6 m): three arched windows high in the brick gable above a hipped mansard canopy
 * over the double doors.
 */
/** Small square white-framed window: stone sill, glass, white frame and one transom bar. */
function squareWindow(b: BuildingTools, w: Wall, t: number, y: number, wd: number, h: number) {
  const f = 0.07;
  onWall(b, w, t, y - 0.1, wd + 0.2, 0.1, 0.14, 'stone', 0);
  onWall(b, w, t, y, wd, h, 0.06, 'glass', 0.02, 'pane');
  onWall(b, w, t, y, wd, f, 0.1, 'white', 0.02);
  onWall(b, w, t, y + h - f, wd, f, 0.1, 'white', 0.02);
  onWall(b, w, t - wd / 2 + f / 2, y, f, h, 0.1, 'white', 0.02);
  onWall(b, w, t + wd / 2 - f / 2, y, f, h, 0.1, 'white', 0.02);
  if (wd > 0.8) onWall(b, w, t, y + h * 0.45, wd, 0.05, 0.09, 'white', 0.02);
}

/**
 * Windows read from the owner's corner photograph and the 2017 panorama (SE side). Each group is pinned to the 3DBAG wall it
 * sits on (plane normals are compass bearings: 224 = street front, 134 = SE, 44 = NE, 314 = NW):
 *  - 224 low wall right of the entrance (3DBAG walls 154/98): square window, NASSAUKERK name band, two small squares and the
 *    five-light dormer band under the bay roof in the re-entrant corner (cream fascia above);
 *  - 224 low annex walls 67/19 and 314 low wall 58: ground-storey square windows;
 *  - 134 annex wall 97: four square windows (panorama), end wall 96 (SE arm): five tall narrow round-arched windows high up
 *    plus an arched doorway at the NE end;
 *  - 44 gable (3DBAG walls 179/32/108/44, apex about t=8.0) and 314 gable (walls 147/80, apex about t=4.8): three arched windows each.
 */
function addNassaukerkWindows(b: BuildingTools, front: Wall, mid: number) {
  // street front, right of the entrance and below the bay roof
  squareWindow(b, front, mid - 3.0, 1.7, 1.1, 1.1);
  squareWindow(b, front, mid + 4.0, 1.7, 1.7, 1.2);
  onWall(b, front, mid + 9.3, 2.95, 3.6, 0.5, 0.06, 'dark', 0.01); // NASSAUKERK name band
  for (const dt of [10.7, 12.1]) squareWindow(b, front, mid + dt, 1.75, 0.5, 0.5);
  for (let k = 0; k < 5; k++) squareWindow(b, front, mid + 8.0 + k * 1.05, 4.75, 0.8, 1.05);
  onWall(b, front, mid + 10.1, 6.0, 5.6, 0.32, 0.22, 'stone', 0); // cream fascia of the bay
  // low annex, SW face (walls 67 and 19)
  const w67 = wallBetween([2.64, 21.9], [5.52, 24.66], 4, [-0.69, 0.72]);
  const w19 = wallBetween([5.52, 24.66], [8.0, 27.0], 3.9, [-0.69, 0.72]);
  for (const t of [1.2, 2.8]) squareWindow(b, w67, t, 1.9, 1.1, 1.1);
  for (const t of [1.0, 2.5]) squareWindow(b, w19, t, 1.9, 1.1, 1.1);
  // low annex, SE face (wall 97, panorama TMX7316010203-000280): four windows 2.7 m apart
  const w97 = wallBetween([8.02, 27.05], [17.49, 17.29], 3.9, [0.72, 0.70]);
  for (const t of [3.5, 6.2, 8.9, 11.5]) squareWindow(b, w97, t, 2.15, 1.2, 1.1);
  // NW low wall (58)
  const w58 = wallBetween([-12.1, -4.1], [-17.9, 2.0], 6.4, [-0.72, -0.69]);
  for (const t of [1.6, 4.2, 6.8]) squareWindow(b, w58, t, 2.2, 1.2, 1.1);
  // SE arm end wall (96): five tall narrow round-arched windows under the eaves, arched door at the NE end
  const w96 = wallBetween([17.49, 17.29], [25.3, 9.3], 13.2, [0.72, 0.70]);
  for (let k = 0; k < 5; k++) archWindow(b, w96, 2.2 + k * 1.7, 8.9, 0.85, 3.3, {trim: 'stone', mullions: 1});
  archWindow(b, w96, 9.6, 0, 1.5, 2.9, {trim: 'stone', glass: 'dark', mullions: 1});
  // NE gable
  const ne = wallBetween([2.3, -12.7], [-5.7, -20.5], 17, [0.70, -0.72]);
  for (const dt of [-1.75, 0, 1.75]) archWindow(b, ne, 8.0 + dt, 9.0, 1.4, 3.0, {trim: 'stone', mullions: 1});
  // NW gable
  const nw = wallBetween([-7.7, -8.5], [-17.9, 2.0], 18.5, [-0.74, -0.67]);
  // 3DBAG leaves a 1.6 m seam at the apex (between walls 147 and 80): close it behind the centre window.
  onWall(b, nw, 4.8, 7.8, 1.9, 8.2, 0.05, 'brick', 0);
  for (const dt of [-1.9, 0, 1.9]) archWindow(b, nw, 4.8 + dt, 8.3, 1.5, 3.0, {trim: 'stone', mullions: 1});
}

export function buildNassaukerk(_w: number, _d: number, b: BuildingTools) {
  const inTower = (rings: number[][][]) => {
    const r = rings[0];
    const xs = r.map(p => p[0]), zs = r.map(p => p[2]), ys = r.map(p => p[1]);
    return Math.min(...xs) > -3.2 && Math.max(...xs) < 1.4 && Math.min(...zs) > 1.6 && Math.max(...zs) < 6.1 && Math.min(...ys) > 16.2;
  };
  addShell(b, source as never, {wall: 'brick', roof: 'slate', skip: s => s.type !== 'GroundSurface' && inTower(s.rings)});
  (b as {mark?: (n: string) => void}).mark?.('shell');

  // Street front: north-west arm end.
  const A: [number, number] = [-13.4, 6.5], B: [number, number] = [-2.6, 16.9];
  const front = wallBetween(A, B, 9, [-0.69, 0.72]);
  const mid = front.length / 2;
  for (const dt of [-2.1, 0, 2.1]) archWindow(b, front, mid + dt, 6.7, 1.7, 3.2, {trim: 'stone', mullions: 1});
  // Hipped mansard canopy over the entrance, double doors, side lights and steps.
  onWall(b, front, mid, 0, 2.6, 3.0, 0.1, 'dark', 0.03);
  onWall(b, front, mid, 0, 0.07, 3.0, 0.14, 'frame', 0.03);
  {
    const p = wallPoint(front, mid, 1.3);
    const canopy = new T.ConeGeometry(2.6, 1.7, 4);
    canopy.rotateY(Math.atan2(front.n[0], front.n[1]) + Math.PI / 4);
    canopy.scale(1, 1, 1);
    b.add(canopy, 'slate' as never, p[0], 3.1 + 0.85, p[1]);
    for (const dt of [-1.25, 1.25]) { const q = wallPoint(front, mid + dt, 2.4); b.box(q[0], 0, q[1], 0.16, 3.1, 0.16, 'white'); }
    for (let s = 0; s < 3; s++) { const q = wallPoint(front, mid, 0.25 + s * 0.35); b.box(q[0], 0, q[1], 3.2, 0.14 + (2 - s) * 0.16, 0.5, 'stone', Math.atan2(front.n[0], front.n[1])); }
  }

  addNassaukerkWindows(b, front, mid);

  // Clock tower on the crossing.
  const cx = -1.0, cz = 3.85, S = 3.2;
  b.box(cx, 15.5, cz, S, 6.0, S, 'white'); // louvred shaft, 15.5 .. 21.5
  for (let k = 0; k < 4; k++) for (const o of [-0.8, 0.8]) {
    const a = k * Math.PI / 2, nx = Math.round(Math.sin(a)), nz = Math.round(Math.cos(a)), off = S / 2 + 0.03;
    b.box(cx + nx * off + (nz ? o : 0), 17.0, cz + nz * off + (nx ? o : 0), nx ? 0.1 : 1.2, 3.6, nz ? 0.1 : 1.2, 'frame');
  }
  b.box(cx, 21.5, cz, S + 0.7, 0.35, S + 0.7, 'white');
  // square onion cap, green copper
  const prof = [[2.55, 0], [2.7, 0.35], [2.3, 1.2], [1.55, 2.2], [0.8, 3.05], [0.28, 3.65], [0.1, 3.9]].map(p => new T.Vector2(p[0], p[1]));
  const cap = new T.LatheGeometry(prof, 4); cap.rotateY(Math.PI / 4);
  b.add(cap, 'copper' as never, cx, 21.85, cz);
  b.add(new T.CylinderGeometry(0.07, 0.07, 1.7, 6), 'copper' as never, cx, 25.7 + 0.85 - 0.05, cz);
  b.add(new T.SphereGeometry(0.28, 8, 6), 'copper' as never, cx, 27.1, cz);
  // gilt clock faces on the four cap faces, tilted to the cap slope
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a);
    const disc = new T.CylinderGeometry(0.62, 0.62, 0.06, 16);
    disc.rotateX(Math.PI / 2 - 0.42); // face normal leans up with the cap
    disc.rotateY(a);
    b.add(disc, 'gold' as never, cx + nx * 1.72, 21.85 + 0.95, cz + nz * 1.72);
  }
}
