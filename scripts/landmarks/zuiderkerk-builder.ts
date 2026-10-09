import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archWindow, facePoly, wallPoint} from './worship-kit';
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
const E1: [number, number] = [Math.cos(ANG), -Math.sin(ANG)]; // local +x in world (x,z)
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
    {
      // 3DBAG wall pieces of the tower shaft jog by up to a metre; the shaft is rebuilt as one exact box below.
      const inBox = (p: number[], m: number) => {
        const dx = p[0] - CX, dz = p[2] - CZ;
        return Math.abs(dx * E1[0] + dz * E1[1]) < HALF + m && Math.abs(dx * E2[0] + dz * E2[1]) < HALF + m;
      };
      const inTurret = (p: number[]) => {
        const dx = p[0] - CX, dz = p[2] - CZ, lx = dx * E1[0] + dz * E1[1], lz = dx * E2[0] + dz * E2[1];
        return lx > -3.9 && lx < 1.3 && lz > -8.9 && lz < -3.7;
      };
      const horiz = Math.hypot(Math.max(...s.rings[0].map(p => p[0])) - Math.min(...s.rings[0].map(p => p[0])), Math.max(...s.rings[0].map(p => p[2])) - Math.min(...s.rings[0].map(p => p[2])));
      if (s.type === 'WallSurface' && (s.rings[0].every(p => inBox(p, 0.35) || inTurret(p)) || (horiz < 1.0 && s.rings[0].every(p => inBox(p, 2.2))) || (s.rings[0].every(p => inBox(p, 1.3)) && (Math.min(...ys) >= 12 || Math.max(...ys) > 25)))) continue;
    }
    if (s.type === 'RoofSurface') {
      const r = s.rings[0], inTurretZone = r.every(p => { const dx = p[0] - CX, dz = p[2] - CZ, lx = dx * E1[0] + dz * E1[1], lz = dx * E2[0] + dz * E2[1]; return lx > -4.9 && lx < 2.3 && lz > -9.9 && lz < -3.7; });
      if (Math.min(...ys) < 29 && !(inTurretZone && Math.min(...ys) > 12)) surfaces.push(s);
      continue;
    }
    if (Math.min(...ys) >= 29.9) continue;
    if (Math.max(...ys) <= BASE_TOP + 0.05) { surfaces.push(s); continue; }
    const r = clipBelow(s.rings[0], BASE_TOP);
    if (r.length >= 3) surfaces.push({type: s.type, rings: [r, ...s.rings.slice(1).map(h => clipBelow(h, BASE_TOP)).filter(h => h.length >= 3)]});
  }
  const shell = {...(source as never as {nativeRing: number[][]}), surfaces};
  addShell(b, shell as never, {wall: 'brick', roof: 'slate'});
  (b as {mark?: (n: string) => void}).mark?.('shell');

  addNaveWindows(b, shell as never);
  buildTower(b);
}

/**
 * Tall aisle window as photographed on the east side: rectangular head, fine white lattice (about 5 lights wide, one pane
 * every ~0.5 m), thick stone surround of alternating quoin blocks. Sill sits at 40% and head at 92% of the eaves height.
 */
function zkWindow(b: BuildingTools, w: Wall, t: number, y: number, wd: number, h: number) {
  onWall(b, w, t, y - 0.25, wd + 0.8, 0.25, 0.22, 'stone', 0); // sill
  onWall(b, w, t, y + h, wd + 0.8, 0.28, 0.2, 'stone', 0); // lintel
  onWall(b, w, t, y, wd, h, 0.06, 'glass', 0.02, 'pane');
  const rows = Math.max(3, Math.round(h / 0.5));
  for (let k = 1; k < rows; k++) onWall(b, w, t, y + h * k / rows - 0.02, wd, 0.04, 0.09, 'frame', 0.02);
  const cols = Math.max(3, Math.round(wd / 0.5));
  for (let k = 0; k <= cols; k++) onWall(b, w, t - wd / 2 + 0.025 + (wd - 0.05) * k / cols, y, 0.05, h, 0.09, 'frame', 0.02);
  for (const sgn of [-1, 1]) for (let q = 0, yy = y - 0.1; yy < y + h + 0.1; q++, yy += 0.6) {
    const ex = q % 2 ? 0.22 : 0;
    onWall(b, w, t + sgn * (wd / 2 + 0.17 + ex / 2), yy, 0.34 + ex, 0.56, 0.16, 'stone', 0);
  }
}

/** Large pointed window with stone surround, mullions and a tracery head (transept / end-gable window). */
function pointedWindow(b: BuildingTools, w: Wall, t: number, y: number, wd: number, h: number) {
  const rise = wd * 0.8, r0 = h - rise;
  const outline = (grow: number) => {
    const s = new T.Shape(), hw = wd / 2 + grow;
    s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, r0);
    s.quadraticCurveTo(hw, r0 + rise * 0.75 + grow, 0, h + grow);
    s.quadraticCurveTo(-hw, r0 + rise * 0.75 + grow, -hw, r0); s.lineTo(-hw, 0);
    return s;
  };
  const place = (g: T.BufferGeometry, colour: string, out: number, tag?: string) => {
    g.rotateY(Math.atan2(w.n[0], w.n[1]));
    const p = wallPoint(w, t, out);
    g.translate(p[0], w.base + y, p[1]);
    if (tag) g.userData.tag = tag;
    b.add(g, colour as never);
  };
  place(new T.ExtrudeGeometry(outline(0.3), {depth: 0.12, bevelEnabled: false, curveSegments: 8}), 'stone', 0);
  place(new T.ExtrudeGeometry(outline(0), {depth: 0.1, bevelEnabled: false, curveSegments: 8}), 'glass', 0.1, 'pane');
  const cols = Math.max(4, Math.round(wd / 0.55));
  for (let k = 1; k < cols; k++) onWall(b, w, t - wd / 2 + wd * k / cols, y, 0.05, r0 + rise * 0.55, 0.1, 'frame', 0.1);
  const rows = Math.round(r0 / 0.55);
  for (let k = 1; k < rows; k++) onWall(b, w, t, y + r0 * k / rows, wd, 0.04, 0.1, 'frame', 0.1);
  onWall(b, w, t, y + r0, wd, 0.07, 0.1, 'frame', 0.1);
}

/** Dwarshuis: a brick dormer-gable flush with the aisle wall, stone cornice, scrolled pediment, one small window, slate flanks. */
function dwarshuis(b: BuildingTools, w: Wall, t: number, eave: number) {
  const hw = 1.75, y0 = eave - 0.2, y1 = eave + 2.9, apex = y1 + 1.15, depth = 2.2;
  onWall(b, w, t, y0, 2 * hw, y1 - y0, depth, 'brick', -depth + 0.12);
  onWall(b, w, t, y0, 2 * hw + 0.6, 0.35, 0.3, 'stone', 0);
  const place = (g: T.BufferGeometry, colour: string, out: number) => {
    g.rotateY(Math.atan2(w.n[0], w.n[1]));
    const p = wallPoint(w, t, out);
    g.translate(p[0], 0, p[1]);
    b.add(g, colour as never);
  };
  const tri = new T.Shape(); tri.moveTo(-hw - 0.3, y1); tri.lineTo(hw + 0.3, y1); tri.lineTo(0, apex); tri.closePath();
  place(new T.ExtrudeGeometry(tri, {depth: 0.3, bevelEnabled: false}), 'stone', 0.12);
  const inner = new T.Shape(); inner.moveTo(-hw + 0.2, y1 + 0.1); inner.lineTo(hw - 0.2, y1 + 0.1); inner.lineTo(0, apex - 0.55); inner.closePath();
  place(new T.ExtrudeGeometry(inner, {depth: 0.1, bevelEnabled: false}), 'brick', 0.42);
  for (const sg of [-1, 1]) { // scroll ears stepping down to the eave
    onWall(b, w, t + sg * (hw + 0.55), y0 + 0.35, 0.5, y1 - y0 - 0.2, 0.3, 'stone', 0.0);
    onWall(b, w, t + sg * (hw + 0.55), y1 - 0.1, 0.62, 0.22, 0.34, 'stone', 0.0);
  }
  {
    const aw = 1.6, ah = 2.55, ar = aw / 2;
    const sh = new T.Shape(); sh.moveTo(-aw / 2, 0); sh.lineTo(aw / 2, 0); sh.lineTo(aw / 2, ah - ar); sh.absarc(0, ah - ar, ar, 0, Math.PI, false); sh.closePath();
    const sur = new T.Shape(); const gw = aw / 2 + 0.22; sur.moveTo(-gw, 0); sur.lineTo(gw, 0); sur.lineTo(gw, ah - ar); sur.absarc(0, ah - ar, gw, 0, Math.PI, false); sur.closePath();
    for (const [shape, col, out, dp, tag] of [[sur, 'stone', 0.12, 0.1, ''], [sh, 'glass', 0.2, 0.06, 'pane']] as const) {
      const g = new T.ExtrudeGeometry(shape, {depth: dp, bevelEnabled: false, curveSegments: 6});
      g.rotateY(Math.atan2(w.n[0], w.n[1]));
      const pp = wallPoint(w, t, out); g.translate(pp[0], y0 + 0.4, pp[1]);
      if (tag) g.userData.tag = tag;
      b.add(g, col as never);
    }
    for (const x of [-0.4, 0, 0.4]) onWall(b, w, t + x, y0 + 0.4, 0.05, ah - ar, 0.1, 'frame', 0.2);
    for (const yy of [0.7, 1.3, 1.9]) onWall(b, w, t, y0 + 0.4 + yy, aw, 0.04, 0.1, 'frame', 0.2);
  }
  const P = (tt: number, y: number, o: number) => [w.origin[0] + w.tangent[0] * tt + w.n[0] * o, y, w.origin[1] + w.tangent[1] * tt + w.n[1] * o];
  facePoly(b, [P(t - hw - 0.3, y1, 0.42), P(t, apex, 0.42), P(t, apex, -depth), P(t - hw - 0.3, y1, -depth)], 'slate', [-w.tangent[0] * 0.5, 1, -w.tangent[1] * 0.5], 'roof');
  facePoly(b, [P(t + hw + 0.3, y1, 0.42), P(t, apex, 0.42), P(t, apex, -depth), P(t + hw + 0.3, y1, -depth)], 'slate', [w.tangent[0] * 0.5, 1, w.tangent[1] * 0.5], 'roof');
}

function addNaveWindows(b: BuildingTools, shell: {surfaces: Surface[]; nativeRing: number[][]}) {
  const sides = new Map<number, {w: Wall; t: number; eave: number}[]>();
  for (const w of wallsOf(shell)) {
    const mx = w.origin[0] + w.tangent[0] * w.length / 2, mz = w.origin[1] + w.tangent[1] * w.length / 2;
    if (Math.hypot(mx - CX, mz - CZ) < 7.5) continue; // tower shaft has its own windows
    const top = Math.max(...w.poly.map(p => p[1]));
    if (w.base > 0.5 || w.length < 2.6 || top < 7) continue;
    const eave = Math.min(top, 10.4), wy = 0.4 * eave, h = 0.52 * eave;
    const n = w.length >= 8 ? 2 : 1, wd = Math.min(2.6, w.length / n - 1.7);
    if (wd < 1.0) continue;
    for (let i = 0; i < n; i++) {
      const t = w.length * (i + 0.5) / n;
      if (wallTop(w, t - wd / 2 - 0.6) < wy + h + 0.4 || wallTop(w, t + wd / 2 + 0.6) < wy + h + 0.4) continue;
      zkWindow(b, w, t, wy, wd, h);
    }
    const bearing = Math.round((Math.atan2(w.n[0], -w.n[1]) * 180 / Math.PI + 360) % 360);
    if ((bearing === 119 && w.length >= 4.4 && eave >= 9.5) || (bearing === 299 && w.length >= 3 && eave >= 8.5)) { // west is inferred (mirror of the photographed east rhythm)
      const list = sides.get(bearing) ?? [];
      list.push({w, t: w.length / 2, eave});
      sides.set(bearing, list);
    }
  }
  // Low porches/annexes on the east side get an arched double door.
  for (const w of wallsOf(shell)) {
    const top = Math.max(...w.poly.map(p => p[1])), bearing = Math.round((Math.atan2(w.n[0], -w.n[1]) * 180 / Math.PI + 360) % 360);
    if (w.base < 0.5 && bearing === 119 && top < 5 && w.length >= 4) archWindow(b, w, w.length / 2, 0, 1.5, Math.min(2.1, top - 0.35), {trim: 'stone', glass: 'dark', mullions: 1});
  }
  // Pointed traceried end-gable windows (inferred from the photographed transept window): north end wall and the nave's south gable.
  for (const w of wallsOf(shell)) {
    const top = Math.max(...w.poly.map(p => p[1])), bearing = Math.round((Math.atan2(w.n[0], -w.n[1]) * 180 / Math.PI + 360) % 360);
    if (w.base > 0.5) continue;
    if (bearing === 29 && w.length > 7 && top > 12) pointedWindow(b, w, w.length / 2, 3.2, 3.0, Math.min(8.2, top - 3.2 - 1.2));
    if (bearing === 209 && w.length > 3.5 && w.length < 4.5 && top > 23) pointedWindow(b, w, w.length / 2, 14.5, 2.4, 7.5);
  }
  // dwarshuizen over every second bay of each long side, counted along the church axis
  for (const list of sides.values()) {
    list.sort((a, c) => (a.w.origin[0] + a.w.tangent[0] * a.t) - (c.w.origin[0] + c.w.tangent[0] * c.t));
    list.forEach((e, i) => { if (i % 2 === 1) dwarshuis(b, e.w, e.t, e.eave); });
  }
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
  const K = 1 / Math.cos(Math.PI / 8);
  /** Octagonal prism (flats face the four cardinal local directions); r is the apothem. */
  const oct = (r: number, h: number, y: number, c: string, rTop = r) => {
    const g = new T.CylinderGeometry(rTop * K, r * K, h, 8, 1); g.rotateY(Math.PI / 8); g.translate(0, h / 2, 0); part(g, c, 0, y, 0);
  };
  const lathe = (pts: number[][], seg: number, y: number, c: string, rot = 0) => {
    const g = new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], p[1])), seg); g.rotateY(rot); part(g, c, 0, y, 0);
  };
  const cyl = (r: number, h: number, lx: number, y: number, lz: number, c: string, seg = 10) => {
    const g = new T.CylinderGeometry(r, r, h, seg); g.translate(0, h / 2, 0); part(g, c, lx, y, lz);
  };
  const vase = (lx: number, y: number, lz: number, s: number) => {
    box(lx, y, lz, 0.55 * s, 0.25 * s, 0.55 * s, 'white');
    const body = new T.SphereGeometry(0.34 * s, 8, 6); body.scale(1, 1.25, 1); body.translate(0, 0.42 * s, 0); part(body, 'slate', lx, y + 0.25 * s, lz);
    const fin = new T.ConeGeometry(0.13 * s, 0.4 * s, 6); fin.translate(0, 0.2 * s, 0); part(fin, 'gold', lx, y + 0.25 * s + 0.82 * s, lz);
  };
  /** Square balustrade ring: rail resting on short posts and a plinth. */
  const ringBalustrade = (half: number, y: number, h: number, colour: string, pitch = 0.75) => {
    box(0, y + h - 0.14, 0, 2 * half + 0.3, 0.14, 2 * half + 0.3, colour);
    const n = Math.floor(2 * half / pitch);
    for (const s of [-1, 1]) for (let i = 0; i <= n; i++) {
      const t = -half + (2 * half) * i / n;
      box(t, y, s * half, 0.16, h - 0.14, 0.16, colour);
      box(s * half, y, t, 0.16, h - 0.14, 0.16, colour);
    }
  };
  /** Arched niche / window group extruded on face k (outward local normal at angle k*90 degrees). */
  const archOn = (k: number, x: number, y: number, w: number, h: number, face: number, depth: number, c: string) => {
    const s = new T.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); s.closePath();
    const g = new T.ExtrudeGeometry(s, {depth, bevelEnabled: false, curveSegments: 6});
    g.translate(x, y, face); g.rotateY(k * Math.PI / 2); part(g, c, 0, 0, 0);
  };

  // ---- brick shaft details (measured from the frontal c.1900 print and the 2005/2024 photographs):
  // stone string courses, corner quoins, and per face a pair of arched lights over a tall arched niche between two roundels.
  box(0, 0, 0, 2 * HALF, 30.2, 2 * HALF, 'brick');
  box(5.45, 0, 3.72, 1.7, 24.0, 2.05, 'brick'); // fills the 1.5 m gap between the nave's south gable and the shaft
  box(-1.3, 0, -6.35, 3.2, 30.2, 3.3, 'brick'); // stair turret on the north face, as 3DBAG's walls show
  box(0, 30.2, 0, 2 * HALF + 0.9, 0.6, 2 * HALF + 0.9, 'stone');
  box(-1.3, 30.0, -6.35, 3.6, 0.3, 3.7, 'stone'); // turret cap
  for (const y of [9.6, 17.4, 28.9]) box(0, y, 0, 2 * HALF + 0.14, 0.3, 2 * HALF + 0.14, 'stone');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let y = 0.4; y < 29; y += 1.2) {
    const q = Math.round(y / 1.2) % 2;
    const qw = 0.55 + q * 0.4, qd = 0.55 + (1 - q) * 0.4;
    box(sx * (HALF - qw / 2 + 0.07), y, sz * (HALF - qd / 2 + 0.07), qw, 0.6, qd, 'stone');
  }
  for (let k = 0; k < 4; k++) {
    const face = HALF + 0.02;
    // tall arched niche, flanking roundels, two arched lights above
    archOn(k, 0, 19.9, 2.5, 4.9, face, 0.14, 'stone');
    archOn(k, 0, 20.0, 1.9, 4.3, face + 0.13, 0.05, 'dark');
    for (const sx of [-1, 1]) {
      const g = new T.CylinderGeometry(0.55, 0.55, 0.14, 14); g.rotateX(Math.PI / 2); g.translate(sx * 2.7, 27.5, face + 0.07); g.rotateY(k * Math.PI / 2); part(g, 'stone', 0, 0, 0);
    }
    for (const sx of [-0.62, 0.62]) { archOn(k, sx, 25.2, 1.0, 2.5, face, 0.14, 'stone'); archOn(k, sx, 25.3, 0.7, 2.2, face + 0.13, 0.05, 'dark'); }
    // upper brick-faced zone: three-light window group (west/south free faces carry it in the photos)
    for (const sx of [-1.25, 0, 1.25]) { archOn(k, sx, 12.0, 1.0, 3.6, face, 0.1, 'stone'); archOn(k, sx, 12.1, 0.72, 3.3, face + 0.09, 0.05, 'glass'); }
  }

  // ---- stage 1 (30.8 .. 38.5): cream stone, free corner columns, blind arched niches, balustrade at its foot
  const S1 = 30.8;
  box(0, S1, 0, 7.3, 7.7, 7.3, 'white');
  ringBalustrade(HALF - 0.1, S1, 1.05, 'white', 0.8);
  for (let k = 0; k < 4; k++) archOn(k, 0, S1 + 1.7, 2.5, 4.9, 3.65, 0.18, 'stone');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lx = sx * 3.85, lz = sz * 3.85;
    box(lx, S1 + 1.0, lz, 1.2, 0.4, 1.2, 'stone');
    cyl(0.5, 5.2, lx, S1 + 1.4, lz, 'white', 12);
    box(lx, S1 + 6.6, lz, 1.25, 0.45, 1.25, 'stone');
    box(lx, S1 + 7.05, lz, 1.5, 0.3, 1.5, 'stone');
  }
  box(0, 37.35, 0, 8.7, 0.6, 8.7, 'stone');
  box(0, 37.95, 0, 9.4, 0.55, 9.4, 'stone');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) vase(sx * 3.95, 38.5, sz * 3.95, 1.1);
  { // lead slope stepping in to the clock stage
    const g = new T.CylinderGeometry(3.3 * K * 0.92, 4.5 * Math.SQRT2 * 0.95, 0.9, 4, 1); g.rotateY(Math.PI / 4); g.translate(0, 0.45, 0); part(g, 'slate', 0, 38.5, 0);
  }

  // ---- clock stage (39.4 .. 43.4): octagon, four red dials with gilt rings, pediments
  oct(3.2, 4.0, 39.4, 'white');
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a), r = 3.2, yc = 41.2;
    const dial = new T.CylinderGeometry(1.1, 1.1, 0.14, 24); dial.rotateX(Math.PI / 2); dial.translate(0, yc, r + 0.1); dial.rotateY(a); part(dial, 'red', 0, 0, 0);
    const ring = new T.CylinderGeometry(1.28, 1.28, 0.12, 24); ring.rotateX(Math.PI / 2); ring.translate(0, yc, r + 0.05); ring.rotateY(a); part(ring, 'gold', 0, 0, 0);
    for (let i = 0; i < 12; i++) {
      const th = i * Math.PI / 6, u = 0.9 * Math.sin(th), v = 0.9 * Math.cos(th);
      const tick = new T.BoxGeometry(0.14, 0.22, 0.08); tick.translate(u, yc + v, 0); tick.rotateY(a); tick.translate(nx * (r + 0.2), 0, nz * (r + 0.2)); part(tick, 'gold', 0, 0, 0);
    }
    const hand = new T.BoxGeometry(0.1, 0.8, 0.08); hand.translate(0, 0.35, 0); hand.rotateZ(-0.5); hand.translate(0, yc, 0); hand.rotateY(a); hand.translate(nx * (r + 0.22), 0, nz * (r + 0.22)); part(hand, 'gold', 0, 0, 0);
    const hand2 = new T.BoxGeometry(0.1, 0.6, 0.08); hand2.translate(0, 0.25, 0); hand2.rotateZ(1.7); hand2.translate(0, yc, 0); hand2.rotateY(a); hand2.translate(nx * (r + 0.22), 0, nz * (r + 0.22)); part(hand2, 'gold', 0, 0, 0);
    const ped = new T.Shape(); ped.moveTo(-1.7, 0); ped.lineTo(1.7, 0); ped.lineTo(0, 1.0); ped.closePath();
    const pg = new T.ExtrudeGeometry(ped, {depth: 0.5, bevelEnabled: false}); pg.translate(0, 42.45, r - 0.05); pg.rotateY(a); part(pg, 'stone', 0, 0, 0);
    const entab = new T.BoxGeometry(3.9, 0.3, 0.7); entab.translate(0, 42.2, r + 0.2); entab.rotateY(a); part(entab, 'stone', 0, 0, 0);
  }
  oct(3.55, 0.5, 43.3, 'stone');

  // ---- lead octagon (43.8 .. 47.1), panelled
  oct(2.8, 3.3, 43.8, 'slate');
  oct(3.2, 0.5, 47.1, 'stone');
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2, nx = Math.sin(a), nz = Math.cos(a);
    const g = new T.BoxGeometry(1.8, 2.2, 0.12); g.translate(0, 44.2 + 1.1, 0); g.rotateY(a); g.translate(nx * 2.84, 0, nz * 2.84); part(g, 'stone', 0, 0, 0);
    const g2 = new T.BoxGeometry(1.5, 1.9, 0.1); g2.translate(0, 44.35 + 0.95, 0); g2.rotateY(a); g2.translate(nx * 2.9, 0, nz * 2.9); part(g2, 'slate', 0, 0, 0);
  }
  // ---- octagonal balustrade (47.6 .. 48.5), then the open belfry (48.5 .. 55.0)
  {
    const rr = 3.0 * K;
    const g = new T.CylinderGeometry(rr, rr, 0.16, 8); g.rotateY(Math.PI / 8); g.translate(0, 47.6 + 0.84, 0); part(g, 'stone', 0, 0, 0);
    for (let i = 0; i < 24; i++) {
      const th = Math.PI / 8 + i * Math.PI / 12;
      box(2.85 * K * Math.sin(th) * 0.97, 47.6, 2.85 * K * Math.cos(th) * 0.97, 0.17, 0.84, 0.17, 'white');
    }
  }
  oct(2.4, 6.5, 48.5, 'slate');
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, w = 1.1, h = 3.7;
    const s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); s.closePath();
    const fr = new T.ExtrudeGeometry(s, {depth: 0.14, bevelEnabled: false, curveSegments: 6}); fr.scale(1.28, 1, 1); fr.translate(0, 49.7, 2.4); fr.rotateY(a); part(fr, 'stone', 0, 0, 0);
    const op = new T.ExtrudeGeometry(s, {depth: 0.12, bevelEnabled: false, curveSegments: 6}); op.translate(0, 49.7, 2.4 + 0.1); op.rotateY(a); part(op, 'dark', 0, 0, 0);
    const bell = new T.ConeGeometry(0.3, 0.65, 8); bell.translate(0, 51.0, 2.25); bell.rotateY(a); part(bell, 'bronze', 0, 0, 0);
  }
  for (let k = 0; k < 8; k++) {
    const th = Math.PI / 8 + k * Math.PI / 4;
    vase(2.55 * K * Math.sin(th) * 0.95, 48.5, 2.55 * K * Math.cos(th) * 0.95, 0.85);
  }
  oct(2.8, 0.5, 55.0, 'slate');
  oct(2.45, 0.35, 55.5, 'stone');
  // ---- onion dome, neck, small bulb, crown, needle and vane (top about 67.5 m)
  lathe([[0.001, 0], [1.75, 0], [1.9, 0.3], [1.65, 0.95], [1.05, 1.55], [0.55, 1.9], [0.001, 1.95]], 8, 55.85, 'slate', Math.PI / 8);
  cyl(0.32, 1.7, 0, 57.75, 0, 'slate', 8);
  lathe([[0.001, 0], [0.4, 0.05], [0.75, 0.5], [0.7, 0.9], [0.35, 1.3], [0.12, 1.6], [0.001, 1.65]], 10, 59.0, 'slate');
  {
    const c1 = new T.TorusGeometry(0.42, 0.06, 5, 12); c1.rotateX(Math.PI / 2); c1.translate(0, 60.9, 0); part(c1, 'gold', 0, 0, 0);
    const c2 = new T.TorusGeometry(0.42, 0.06, 5, 12); c2.rotateY(Math.PI / 2); c2.translate(0, 60.9, 0); part(c2, 'gold', 0, 0, 0);
  }
  cyl(0.07, 5.6, 0, 60.4, 0, 'dark', 6);
  { const ball = new T.SphereGeometry(0.24, 8, 6); ball.translate(0, 63.3, 0); part(ball, 'gold', 0, 0, 0); }
  box(0, 64.3, 0, 0.1, 0.1, 0.9, 'gold'); box(0, 64.8, 0, 0.1, 0.1, 0.1, 'gold');
  box(0, 65.1, 0, 0.6, 0.07, 0.07, 'gold');
  { const f = new T.ConeGeometry(0.15, 0.9, 5); f.translate(0, 0.45 + 65.4, 0); part(f, 'gold', 0, 0, 0); }
}
