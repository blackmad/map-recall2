import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {wallBetween} from './worship-kit';
import {onWall, wallsOf, wallTop, type Wall} from './worship-walls';
import source from './zuiderkerk-footprints.json';

/**
 * Zuiderkerk, Zuiderkerkhof (Hendrick de Keyser, 1603-1611). One BAG pand holds church and tower.
 * Massing is the 3DBAG LoD2.2 shell (nave ridge 24.6 m, aisles eave about 10.4 m). 3DBAG sees the tower only as a
 * stepped brick needle, so everything of it above the brick base (y 30.2 m, flat) is dropped and rebuilt:
 *   brick base 9.6 m square (to 30.2) -> stone cornice and balustrade -> cream stone stage with free corner columns
 *   and blind arched niches (to 43) -> octagonal clock stage with four pedimented clock faces (to 52) ->
 *   lead-grey panelled octagon, balustrade, open belfry with arches (to 66.5) -> onion dome, lantern, crown,
 *   needle and weathervane (about 80 m).
 * The tower stands at the south-west corner of the church, flush with the west aisle wall.
 */
type Colour = Parameters<BuildingTools['add']>[1];

// Tower frame: centre and axes fitted to the four 3DBAG base corners (9.6 m square, rotated 26.3 degrees).
const CX = -19.67, CZ = 6.48, ANG = -26.3 * Math.PI / 180;
const E1: [number, number] = [Math.cos(-ANG), -Math.sin(-ANG) * -1]; // local +x in world (x,z)
const E2: [number, number] = [Math.sin(ANG), Math.cos(ANG)]; // local +z in world (x,z)
const HALF = 4.75, BASE_TOP = 30.2;
const wx = (lx: number, lz: number) => CX + lx * E1[0] + lz * E2[0];
const wz = (lx: number, lz: number) => CZ + lx * E1[1] + lz * E2[1];

function clipBelow(ring: number[][], ymax: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const ina = a[1] <= ymax, inb = b[1] <= ymax;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (ymax - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, ymax, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return out;
}

export function buildZuiderkerk(_w: number, _d: number, b: BuildingTools) {
  // ---- shell: drop / clip the 3DBAG tower needle
  const surfaces: Surface[] = [];
  for (const s of (source as {surfaces: Surface[]}).surfaces) {
    const ys = s.rings[0].map(p => p[1]);
    if (s.type === 'GroundSurface') { surfaces.push(s); continue; }
    if (s.type === 'RoofSurface') { if (Math.max(...ys) <= 30.6) surfaces.push(s); continue; }
    if (Math.min(...ys) >= 29.9) continue;
    if (Math.max(...ys) <= BASE_TOP + 0.05) { surfaces.push(s); continue; }
    const r = clipBelow(s.rings[0], BASE_TOP);
    if (r.length >= 3) surfaces.push({type: s.type, rings: [r, ...s.rings.slice(1).map(h => clipBelow(h, BASE_TOP)).filter(h => h.length >= 3)]});
  }
  const shell = {...(source as never as {nativeRing: number[][]}), surfaces};
  addShell(b, shell as never, {wall: 'brick', roof: 'slate'});
  (b as {mark?: (n: string) => void}).mark?.('shell');

  buildTower(b);
}

function buildTower(b: BuildingTools) {
  const part = (g: T.BufferGeometry, c: Colour | string, lx: number, y: number, lz: number, a = 0) => {
    // author in tower-local axes; a = extra local rotation
    g.rotateY(a + ANG);
    b.add(g, c as never, wx(lx, lz), y, wz(lx, lz));
  };
  const box = (lx: number, y: number, lz: number, w: number, h: number, d: number, c: string, a = 0) => {
    const g = new T.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); part(g, c, lx, y, lz, a);
  };
  const oct = (r: number, h: number, y: number, c: string, rTop = r) => {
    // octagon whose flats face the four cardinal local directions; r is the flat-to-centre distance (apothem)
    const k = 1 / Math.cos(Math.PI / 8);
    const g = new T.CylinderGeometry(rTop * k, r * k, h, 8, 1); g.rotateY(Math.PI / 8); g.translate(0, h / 2, 0); part(g, c, 0, y, 0);
  };
  const lathe = (pts: number[][], seg: number, y: number, c: string, rot = 0) => {
    const g = new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], p[1])), seg); g.rotateY(rot); part(g, c, 0, y, 0);
  };
  const cyl = (r: number, h: number, lx: number, y: number, lz: number, c: string, seg = 10) => {
    const g = new T.CylinderGeometry(r, r, h, seg); g.translate(0, h / 2, 0); part(g, c, lx, y, lz);
  };
  const urn = (lx: number, y: number, lz: number, s = 1) => {
    lathe([[0.001, 0], [0.32 * s, 0], [0.18 * s, 0.25 * s], [0.34 * s, 0.7 * s], [0.2 * s, 1.0 * s], [0.001, 1.05 * s]].map(p => [p[0], p[1]]), 8, y, 'slate');
    // lathe is centred on the tower axis, so urns are built as boxes + spheres instead
  };
  void urn;
  const vase = (lx: number, y: number, lz: number, s: number) => {
    box(lx, y, lz, 0.55 * s, 0.25 * s, 0.55 * s, 'white');
    const body = new T.SphereGeometry(0.34 * s, 8, 6); body.scale(1, 1.25, 1); body.translate(0, 0.42 * s, 0); part(body, 'slate', lx, y + 0.25 * s, lz);
    const fin = new T.ConeGeometry(0.13 * s, 0.4 * s, 6); fin.translate(0, 0.2 * s, 0); part(fin, 'gold', lx, y + 0.25 * s + 0.82 * s, lz);
  };
  const ringBalustrade = (half: number, y: number, h: number, colour: string, pitch = 0.75) => {
    box(0, y + h - 0.14, 0, 2 * half + 0.3, 0.14, 2 * half + 0.3, colour); // rail overhangs, posts below only on the edge ring
    const rail = (2 * half + 0.3);
    void rail;
    for (const s of [-1, 1]) {
      const n = Math.floor(2 * half / pitch);
      for (let i = 0; i <= n; i++) {
        const t = -half + (2 * half) * i / n;
        box(t, y, s * half, 0.16, h - 0.14, 0.16, colour);
        box(s * half, y, t, 0.16, h - 0.14, 0.16, colour);
      }
    }
  };

  // ---- base: stone cornice course over the brick, string courses, windows
  box(0, 30.05, 0, 2 * HALF + 0.9, 0.75, 2 * HALF + 0.9, 'stone');
  for (const y of [9.6, 17.2, 28.9]) box(0, y, 0, 2 * HALF + 0.2, 0.3, 2 * HALF + 0.2, 'stone');
  // corner quoin blocks on the brick shaft
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let y = 0.4; y < 29; y += 1.2) {
    box(sx * (HALF - 0.12), y, sz * (HALF - 0.12), 0.68 + (Math.round(y / 1.2) % 2) * 0.35, 0.6, 0.68 + ((Math.round(y / 1.2) + 1) % 2) * 0.35, 'stone');
  }

  // ---- stage 1: cream stone with free corner columns and niches, balustrade at its foot
  const S1 = 30.8;
  box(0, S1, 0, 7.3, 12.2, 7.3, 'white');
  ringBalustrade(HALF - 0.1, S1, 1.05, 'white', 0.8);
  // blind arched niches on the four faces
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2;
    const s = new T.Shape(); const w = 2.5, h = 6.6;
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); s.closePath();
    const g = new T.ExtrudeGeometry(s, {depth: 0.18, bevelEnabled: false, curveSegments: 6});
    g.translate(0, 0, 3.65); g.translate(0, 33.1, 0); // wall face at 3.65, niche proud by 0.18
    g.rotateY(a); part(g, 'stone', 0, 0, 0);
  }
  // corner columns (free-standing, projecting at the corners), base blocks, capitals
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = sx * 3.85, lz = sz * 3.85;
    box(lx, S1 + 1.0, lz, 1.2, 0.45, 1.2, 'stone');
    cyl(0.5, 7.4, lx, S1 + 1.45, lz, 'white', 12);
    box(lx, S1 + 8.85, lz, 1.25, 0.5, 1.25, 'stone');
    box(lx, S1 + 9.35, lz, 1.5, 0.35, 1.5, 'stone');
  }
  // entablature and cornice of stage 1
  box(0, 40.5, 0, 8.7, 0.9, 8.7, 'stone');
  box(0, 41.4, 0, 9.3, 0.55, 9.3, 'stone');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) vase(sx * 3.95, 41.95, sz * 3.95, 1.25);
  // lead roof stepping in from the cornice to the clock stage
  {
    const g = new T.CylinderGeometry(3.7 * 1.0824, 4.7 * Math.SQRT2, 1.2, 4, 1); g.rotateY(Math.PI / 4); g.translate(0, 0.6, 0); part(g, 'slate', 0, 41.95, 0);
  }

  // ---- stage 2: clock stage, octagon with four pedimented clock faces
  oct(3.05, 8.3, 43.1, 'white');
  oct(3.45, 0.55, 43.0, 'stone');
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a), r = 3.05;
    const ox = nx * (r + 0.1), oz = nz * (r + 0.1);
    // red dial with gilt ring, numerals and hands on the facing plane
    const dial = new T.CylinderGeometry(1.35, 1.35, 0.14, 24); dial.rotateX(Math.PI / 2); dial.translate(ox, 47.2, oz); dial.rotateY(0); part(dial, 'red', 0, 0, 0, a * 0);
    const ring = new T.CylinderGeometry(1.55, 1.55, 0.12, 24); ring.rotateX(Math.PI / 2); ring.translate(nx * (r + 0.05), 47.2, nz * (r + 0.05)); part(ring, 'gold', 0, 0, 0);
    for (let i = 0; i < 12; i++) {
      const th = i * Math.PI / 6, u = 1.1 * Math.sin(th), v = 1.1 * Math.cos(th);
      const tick = new T.BoxGeometry(0.16, 0.26, 0.08); tick.translate(u, 47.2 + v, 0); tick.rotateY(a); tick.translate(nx * (r + 0.22), 0, nz * (r + 0.22)); part(tick, 'gold', 0, 0, 0);
    }
    const hand = new T.BoxGeometry(0.1, 0.95, 0.08); hand.translate(0, 0.4, 0); hand.rotateZ(-0.5); hand.translate(0, 47.2, 0); hand.rotateY(a); hand.translate(nx * (r + 0.24), 0, nz * (r + 0.24)); part(hand, 'gold', 0, 0, 0);
    const hand2 = new T.BoxGeometry(0.1, 0.7, 0.08); hand2.translate(0, 0.3, 0); hand2.rotateZ(1.7); hand2.translate(0, 47.2, 0); hand2.rotateY(a); hand2.translate(nx * (r + 0.24), 0, nz * (r + 0.24)); part(hand2, 'gold', 0, 0, 0);
    // pediment over the dial
    const ped = new T.Shape(); ped.moveTo(-1.9, 0); ped.lineTo(1.9, 0); ped.lineTo(0, 1.2); ped.closePath();
    const pg = new T.ExtrudeGeometry(ped, {depth: 0.5, bevelEnabled: false}); pg.translate(0, 49.45, r - 0.05); pg.rotateY(a); part(pg, 'stone', 0, 0, 0);
    const entab = new T.BoxGeometry(4.3, 0.35, 0.7); entab.translate(0, 49.3, r + 0.2); entab.rotateY(a); part(entab, 'stone', 0, 0, 0);
  }
  // cornice of the clock stage
  oct(3.6, 0.5, 51.4, 'stone');
  // ---- stage 3: lead octagon, panelled
  oct(2.75, 6.1, 51.9, 'slate');
  oct(3.25, 0.5, 57.9, 'stone');
  // panel mouldings on four cardinal faces
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a);
    const g = new T.BoxGeometry(1.7, 3.2, 0.12); g.translate(0, 53.5 + 1.6, 0); g.rotateY(a); g.translate(nx * 2.8, 0, nz * 2.8); part(g, 'stone', 0, 0, 0);
    const g2 = new T.BoxGeometry(1.4, 2.9, 0.1); g2.translate(0, 53.65 + 1.45, 0); g2.rotateY(a); g2.translate(nx * 2.86, 0, nz * 2.86); part(g2, 'slate', 0, 0, 0);
  }
  // ---- balustrade ring (octagonal), then the open belfry
  {
    const k = 1 / Math.cos(Math.PI / 8), rr = 3.0 * k;
    const g = new T.CylinderGeometry(rr, rr, 0.16, 8); g.rotateY(Math.PI / 8); g.translate(0, 58.4 + 0.92, 0); part(g, 'stone', 0, 0, 0);
    for (let i = 0; i < 24; i++) {
      const th = Math.PI / 8 + i * Math.PI / 12;
      const px = 2.85 * k * Math.sin(th) * 0.97, pz = 2.85 * k * Math.cos(th) * 0.97;
      box(px, 58.4, pz, 0.17, 0.84, 0.17, 'white');
    }
  }
  box(0, 58.4, 0, 0.1, 0.1, 0.1, 'stone');
  oct(2.2, 7.4, 59.3, 'slate');
  // eight arched belfry openings, bells inside
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, nx = Math.sin(a), nz = Math.cos(a);
    const w = 1.2, h = 3.9;
    const s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); s.closePath();
    const fr = new T.ExtrudeGeometry(s, {depth: 0.14, bevelEnabled: false, curveSegments: 6}); fr.scale(1.28, 1, 1); fr.translate(0, 60.0, 2.2); fr.rotateY(a); part(fr, 'stone', 0, 0, 0);
    const op = new T.ExtrudeGeometry(s, {depth: 0.12, bevelEnabled: false, curveSegments: 6}); op.translate(0, 60.0, 2.2 + 0.1); op.rotateY(a); part(op, 'dark', 0, 0, 0);
    const bell = new T.ConeGeometry(0.34, 0.7, 8); bell.translate(0, 61.5, 2.05); bell.rotateY(a); part(bell, 'bronze', 0, 0, 0);
    void nx; void nz;
  }
  // gilt-topped vases at the belfry corners
  for (let k = 0; k < 8; k++) {
    const th = Math.PI / 8 + k * Math.PI / 4, kk = 1 / Math.cos(Math.PI / 8);
    vase(2.75 * kk * Math.sin(th) * 0.95, 59.3, 2.75 * kk * Math.cos(th) * 0.95, 0.9);
  }
  oct(2.75, 0.5, 66.7, 'slate');
  oct(2.4, 0.4, 67.2, 'stone');
  // ---- onion dome, lantern, crown, needle
  lathe([[0.001, 0], [2.45, 0], [2.65, 0.35], [2.35, 1.25], [1.55, 2.2], [0.85, 2.85], [0.5, 3.25], [0.001, 3.3]], 8, 67.6, 'slate', Math.PI / 8);
  cyl(0.42, 1.0, 0, 70.85, 0, 'slate', 8);
  lathe([[0.001, 0], [0.5, 0.05], [0.95, 0.55], [0.9, 1.0], [0.45, 1.55], [0.15, 1.95], [0.001, 2.0]], 10, 71.8, 'slate');
  {
    const crown = new T.TorusGeometry(0.5, 0.07, 5, 12); crown.rotateX(Math.PI / 2); crown.translate(0, 74.1, 0); part(crown, 'gold', 0, 0, 0);
    const crown2 = new T.TorusGeometry(0.5, 0.07, 5, 12); crown2.rotateY(Math.PI / 2); crown2.translate(0, 74.1, 0); part(crown2, 'gold', 0, 0, 0);
  }
  cyl(0.08, 4.6, 0, 73.8, 0, 'dark', 6);
  { const ball = new T.SphereGeometry(0.26, 8, 6); ball.translate(0, 76.4, 0); part(ball, 'gold', 0, 0, 0); }
  box(0, 77.4, 0, 0.1, 0.1, 1.0, 'gold'); box(0, 77.9, 0, 0.1, 0.1, 0.1, 'gold');
  box(0, 78.2, 0, 0.7, 0.07, 0.07, 'gold');
  // weathervane flame
  { const f = new T.ConeGeometry(0.16, 1.0, 5); f.translate(0, 0.5 + 78.5, 0); part(f, 'gold', 0, 0, 0); }
}
