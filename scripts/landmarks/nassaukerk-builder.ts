import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {archWindow, wallBetween, wallPoint} from './worship-kit';
import {onWall} from './worship-walls';
import source from './nassaukerk-footprints.json';

/**
 * Nassaukerk, De Wittenkade 111 (H.G. Krijgsman, 1925-26, Amsterdam School). Greek-cross plan, rotated about 45 degrees on
 * the block: massing is the 3DBAG LoD2.2 shell with steep gabled arms (ridge 18.6 m). 3DBAG renders the clock tower as a
 * needle, so those surfaces are dropped and the tower is rebuilt from the photographs: a louvred shaft rising from the
 * crossing, a square onion cap of green copper with gilt clock faces, finial and weathervane (top 27.4 m as in 3DBAG).
 * The south-west arm is the street front (the steep triangular gable, eave 9 m, apex 18.6 m): three arched windows high in the brick gable above a hipped mansard canopy
 * over the double doors.
 */
export function buildNassaukerk(_w: number, _d: number, b: BuildingTools) {
  const inTower = (rings: number[][][]) => {
    const r = rings[0];
    const xs = r.map(p => p[0]), zs = r.map(p => p[2]), ys = r.map(p => p[1]);
    return Math.min(...xs) > -3.2 && Math.max(...xs) < 1.4 && Math.min(...zs) > 1.6 && Math.max(...zs) < 6.1 && Math.min(...ys) > 16.2;
  };
  addShell(b, source as never, {wall: 'brick', roof: 'slate', skip: s => s.type !== 'GroundSurface' && inTower(s.rings)});

  // Street front: north-west arm end.
  const A: [number, number] = [-13.4, 6.5], B: [number, number] = [-2.6, 16.9];
  const front = wallBetween(A, B, 9, [-0.69, 0.72]);
  const mid = front.length / 2;
  for (const dt of [-2.1, 0, 2.1]) archWindow(b, front, mid + dt, 6.7, 1.7, 3.2, {trim: 'stone', mullions: 1});
  // Hipped mansard canopy over the entrance, double doors, side lights and steps.
  onWall(b, front, mid, 0, 2.6, 3.0, 0.1, 'dark', 0.03);
  onWall(b, front, mid, 0, 0.07, 3.0, 0.14, 'frame', 0.03);
  for (const dt of [-3.3, 3.3]) archWindow(b, front, mid + dt, 1.6, 0.9, 1.3, {trim: 'stone', mullions: 1});
  {
    const p = wallPoint(front, mid, 1.3);
    const canopy = new T.ConeGeometry(2.6, 1.7, 4);
    canopy.rotateY(Math.atan2(front.n[0], front.n[1]) + Math.PI / 4);
    canopy.scale(1, 1, 1);
    b.add(canopy, 'slate' as never, p[0], 3.1 + 0.85, p[1]);
    for (const dt of [-1.25, 1.25]) { const q = wallPoint(front, mid + dt, 2.4); b.box(q[0], 0, q[1], 0.16, 3.1, 0.16, 'white'); }
    for (let s = 0; s < 3; s++) { const q = wallPoint(front, mid, 0.5 + s * 0.35); b.box(q[0], 0, q[1], 3.2, 0.14 + (2 - s) * 0.16, 0.5, 'stone', Math.atan2(front.n[0], front.n[1])); }
  }

  // Clock tower on the crossing.
  const cx = -1.0, cz = 3.85, S = 3.2;
  b.box(cx, 15.5, cz, S, 6.0, S, 'white'); // louvred shaft, 15.5 .. 21.5
  for (let k = 0; k < 4; k++) for (const o of [-0.8, 0.8]) {
    const a = k * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a), off = S / 2 + 0.03;
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
    b.add(disc, 'gold' as never, cx + nx * 2.15, 21.85 + 0.95, cz + nz * 2.15);
  }
}
