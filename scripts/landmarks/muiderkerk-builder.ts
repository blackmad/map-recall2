import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archWindow, edgeWall, oculus, wallBetween, wallPoint, type P2} from './worship-kit';
import {onWall, wallsOf, type Wall} from './worship-walls';
import source from './muiderkerk-footprints.json';

/**
 * Muiderkerk, Linnaeusstraat (Amsterdam-Oost). The church of 1892 burned in 1989; its brick tower survived and the 1997
 * complex (architect Van Hoogevest) was built against it: a five-storey buff-brick block with pink granite cladding on the
 * lower floors, teal window frames and a glazed top storey. Massing is the 3DBAG LoD2.2 shell. 3DBAG renders the tower as a
 * stepped needle, so everything of it above the shaft cornice (32.8 m) is dropped and rebuilt from municipal panoramas:
 * a 6.5 m square brick shaft with stone corner pilasters, a stone porch with pediment on the west (Linnaeusstraat) face,
 * a round-arched window above it, two rose windows and a blind-arch frieze, tall arched windows on the north and south
 * faces, a belfry with arched louvres and an octagonal lantern under a dome (top 43.7 m as in 3DBAG).
 */
const SHAFT = 30.0;
const ROOF = 22.2;
const C: P2 = [-10.8, 4.0];
const U: P2 = [0.31, 0.95]; // south
const V: P2 = [0.95, -0.31]; // east

const cxOf = (s: Surface) => s.rings[0].reduce((a, p) => a + p[0], 0) / s.rings[0].length;
const ys = (s: Surface) => s.rings[0].map(p => p[1]);
const isTower = (s: Surface) => (s as {tower?: boolean}).tower === true || Math.max(...ys(s)) > 23 && cxOf(s) < -6.3;

const NW: P2 = [C[0] - 3.25 * V[0] - 3.25 * U[0], C[1] - 3.25 * V[1] - 3.25 * U[1]];
/** Tower-frame coordinates: t along the west face (south positive), d eastwards from the west face plane. */
const loc = (x: number, z: number) => ({t: (x - NW[0]) * U[0] + (z - NW[1]) * U[1], d: (x - NW[0]) * V[0] + (z - NW[1]) * V[1]});
const pt = (t: number, d: number): P2 => [NW[0] + t * U[0] + d * V[0], NW[1] + t * U[1] + d * V[1]];
const inFlank = (s: Surface) => {
  const x = cxOf(s), z = s.rings[0].reduce((a, p) => a + p[2], 0) / s.rings[0].length, {t, d} = loc(x, z);
  return d > 3.8 && d < 8.3 && ((t < -0.4 && t > -5.4) || (t > 6.9 && t < 11.3));
};

/** 3DBAG with the tower trimmed to the block roof and the two flanking bays removed (rebuilt by hand). */
function trimmedSource() {
  const surfaces: Surface[] = [];
  for (const s of source.surfaces as Surface[]) {
    if (s.type !== 'GroundSurface' && cxOf(s) < -3 && inFlank(s)) {
      // keep the 3DBAG flank volume as a closed low box under the hand-built shoulder
      surfaces.push({type: s.type, tower: true, rings: s.rings.map(r => r.map(p => [p[0], Math.min(p[1], 13.9), p[2]]))} as Surface);
      continue;
    }
    if (isTower(s)) {
      const lo = Math.min(...ys(s)), hi = Math.max(...ys(s));
      if (lo >= 22.0) continue; // everything above the block roof is rebuilt
      if (hi > ROOF) {
        surfaces.push({type: s.type, tower: true, rings: s.rings.map(r => r.map(p => [p[0], Math.min(p[1], ROOF), p[2]]))} as Surface);
        continue;
      }
    }
    surfaces.push(s);
  }
  return {...source, surfaces};
}

type Colour = Parameters<BuildingTools['add']>[1];

/** Facade overlay box: sunk 0.25 m into the wall so BAG/3DBAG offsets never leave it floating. */
const ow = (b: BuildingTools, w: Wall, t: number, y: number, bw: number, bh: number, bd: number, colour: string, out = 0, tag?: string) =>
  onWall(b, w, t, y, bw, bh, bd + 0.25, colour, out - 0.25, tag);

/** Square-framed office window with granite sill, teal frame and one mullion. */
function blockWindow(b: BuildingTools, w: Wall, t: number, y: number, wd: number, h: number) {
  const f = 0.07;
  ow(b, w, t, y - 0.1, wd + 0.2, 0.1, 0.12, 'stone', 0);
  ow(b, w, t, y, wd, h, 0.06, 'glass', 0.02, 'pane');
  ow(b, w, t, y, wd, f, 0.09, 'green', 0.02);
  ow(b, w, t, y + h - f, wd, f, 0.09, 'green', 0.02);
  ow(b, w, t - wd / 2 + f / 2, y, f, h, 0.09, 'green', 0.02);
  ow(b, w, t + wd / 2 - f / 2, y, f, h, 0.09, 'green', 0.02);
  if (wd > 1.1) ow(b, w, t, y, f, h, 0.09, 'green', 0.02);
}

/** The 1997 block's face: concrete plinth, pink granite floors 0-2, shopfront glazing, four window rows, red bands. */
function blockFace(b: BuildingTools, w: Wall, top = 18.4) {
  const L = w.length;
  if (L < 3) return;
  ow(b, w, L / 2, 0, L, 1.0, 0.07, 'concrete', 0);
  ow(b, w, L / 2, 1.0, L, 9.6, 0.05, 'pink', 0);
  for (const y of [10.6, 13.9, 17.3]) ow(b, w, L / 2, y, L, 0.18, 0.07, 'red', 0);
  // shopfronts
  const n = Math.max(1, Math.round((L - 1) / 5.3)), span = (L - 1) / n;
  for (let k = 0; k < n; k++) {
    const t = 0.5 + (k + 0.5) * span, wd = span - 0.8;
    ow(b, w, t, 1.0, wd, 3.1, 0.06, 'glass', 0.02, 'pane');
    ow(b, w, t, 1.0, wd, 0.07, 0.09, 'green', 0.02);
    ow(b, w, t, 4.1, wd, 0.07, 0.09, 'green', 0.02);
    ow(b, w, t - wd / 2 + 0.035, 1.0, 0.07, 3.2, 0.09, 'green', 0.02);
    ow(b, w, t + wd / 2 - 0.035, 1.0, 0.07, 3.2, 0.09, 'green', 0.02);
    ow(b, w, t, 1.0, 0.07, 3.1, 0.09, 'green', 0.02);
    ow(b, w, t, 2.45, wd, 0.06, 0.09, 'green', 0.02);
    ow(b, w, t, 4.2, wd + 0.5, 0.22, 0.4, 'green', 0);
  }
  // window rows
  const pitch = 2.65, nw = Math.floor((L - 1.6) / pitch) + 1, t0 = L / 2 - (nw - 1) * pitch / 2;
  for (const y of [5.5, 8.8, 12.1, 15.4]) {
    if (y + 1.7 > top) continue;
    for (let k = 0; k < nw; k++) blockWindow(b, w, t0 + k * pitch, y, 1.5, 1.7);
  }
}

/** Glazed fifth storey: glass band between teal mullions. */
function glazedStorey(b: BuildingTools, w: Wall) {
  const L = w.length;
  if (L < 5) return;
  ow(b, w, L / 2, 19.1, L - 0.6, 2.6, 0.06, 'glass', 0.02, 'pane');
  ow(b, w, L / 2, 19.1, L - 0.6, 0.1, 0.1, 'green', 0.02);
  ow(b, w, L / 2, 21.6, L - 0.6, 0.1, 0.1, 'green', 0.02);
  const n = Math.round(L / 2.65);
  for (let k = 0; k <= n; k++) ow(b, w, 0.3 + (L - 0.6) * k / n, 19.1, 0.09, 2.6, 0.1, 'green', 0.02);
}

/** Blind round arch recess (corbel-arch frieze). */
function blindArch(b: BuildingTools, w: Wall, t: number, y: number, wd: number, h: number) {
  const s = new T.Shape(), hw = wd / 2, r0 = h - hw;
  s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, r0); s.absarc(0, r0, hw, 0, Math.PI, false); s.lineTo(-hw, 0);
  const g = new T.ExtrudeGeometry(s, {depth: 0.06, bevelEnabled: false});
  g.rotateY(Math.atan2(w.n[0], w.n[1]));
  const p = wallPoint(w, t, 0);
  g.translate(p[0], w.base + y, p[1]);
  b.add(g, 'dark' as never);
}

/** Extruded profile placed flush on a wall (shape in wall-local x/y, extruded along the normal). */
function profileOnWall(b: BuildingTools, w: Wall, t: number, y: number, out: number, shape: T.Shape, depth: number, colour: string) {
  const g = new T.ExtrudeGeometry(shape, {depth, bevelEnabled: false});
  g.rotateY(Math.atan2(w.n[0], w.n[1]));
  const p = wallPoint(w, t, out);
  g.translate(p[0], w.base + y, p[1]);
  b.add(g, colour as never);
}

/** Brick gable-shoulder bay beside the tower: front face recessed 4.4 m behind the tower, top sloping up to the tower. */
function addFlank(b: BuildingTools, tOut: number, tTow: number) {
  const hi = 20.5, lo = 14.0;
  const profile = (grow: number) => new T.Shape([
    new T.Vector2(tOut, 0), new T.Vector2(tTow, 0), new T.Vector2(tTow, hi + grow), new T.Vector2(tOut, lo + grow)]);
  const place = (g: T.BufferGeometry, colour: string) => {
    g.rotateY(Math.atan2(-U[1], U[0]));
    const o = pt(0, 8.0);
    g.translate(o[0], 0, o[1]);
    b.add(g, colour as never);
  };
  place(new T.ExtrudeGeometry(profile(0), {depth: 3.6, bevelEnabled: false}), 'brick');
  const cap = new T.Shape([new T.Vector2(tOut, lo), new T.Vector2(tTow, hi), new T.Vector2(tTow, hi + 0.18), new T.Vector2(tOut, lo + 0.18)]);
  const capG = new T.ExtrudeGeometry(cap, {depth: 3.9, bevelEnabled: false});
  capG.rotateY(Math.atan2(-U[1], U[0]));
  const o = pt(0, 8.15);
  capG.translate(o[0], 0, o[1]);
  b.add(capG, 'stone' as never);
  const a = Math.min(tOut, tTow), c = Math.max(tOut, tTow);
  const w = wallBetween(pt(a, 4.4), pt(c, 4.4), lo, [-V[0], -V[1]]);
  const L = w.length;
  onWall(b, w, L / 2, 0, L, 0.9, 0.1, 'stone', 0);
  onWall(b, w, L / 2, 11.7, L, 0.3, 0.14, 'stone', 0);
  onWall(b, w, L / 2, 13.6, L, 0.3, 0.16, 'stone', 0);
  archWindow(b, w, L / 2, 3.3, 2.0, 7.9, {trim: 'stone', mullions: 1});
}

function addTower(b: BuildingTools) {
  const at = (a: number, c: number): P2 => pt(3.25 + a * 3.25, 3.25 + c * 3.25);
  const W = wallBetween(at(-1, -1), at(1, -1), SHAFT, [-V[0], -V[1]]);
  const S = wallBetween(at(1, -1), at(1, 1), SHAFT, U);
  const N = wallBetween(at(-1, -1), at(-1, 1), SHAFT, [-U[0], -U[1]]);
  const rotY = Math.atan2(U[0], U[1]);
  b.box(C[0], ROOF, C[1], 6.5, SHAFT - ROOF - 0.4, 6.5, 'brick', rotY);

  // stone plinth, slim corner pilasters with capitals, string course under the cornice
  for (const w of [W, S, N]) {
    onWall(b, w, w.length / 2, 0, w.length, 1.0, 0.1, 'stone', 0);
    for (const t of [0.25, w.length - 0.25]) {
      const low = (w === S && t > 1) || (w === N && t < 1);
      onWall(b, w, t, low ? ROOF : 1.0, 0.4, SHAFT - 1.7 - (low ? ROOF : 1.0), 0.08, 'stone', 0);
      onWall(b, w, t, SHAFT - 1.7, 0.6, 0.4, 0.16, 'stone', 0);
    }
    onWall(b, w, w.length / 2, SHAFT - 1.3, w.length, 0.2, 0.12, 'stone', 0);
  }

  // ---- west face (Linnaeusstraat): porch with pediment, first-floor window, rose window, blind-arch frieze
  const L = W.length, mid = L / 2, pw = 4.8, depth = 0.7, bw = Math.atan2(W.n[0], W.n[1]);
  for (const dt of [-pw / 2 + 0.15, pw / 2 - 0.15]) onWall(b, W, mid + dt, 0, 0.3, 6.2, depth, 'stone', 0);
  onWall(b, W, mid, 6.2, pw + 0.4, 0.8, depth + 0.2, 'stone', 0); // entablature
  onWall(b, W, mid, 7.0, pw + 0.7, 0.18, depth + 0.3, 'stone', 0); // cornice
  for (const dt of [-pw / 2 + 0.55, pw / 2 - 0.55]) {
    const q = wallPoint(W, mid + dt, depth - 0.15);
    b.add(new T.CylinderGeometry(0.26, 0.3, 5.9, 10), 'stone' as never, q[0], 0.3 + 2.95, q[1]);
  }
  {
    const tri = new T.Shape([new T.Vector2(-pw / 2 - 0.35, 0), new T.Vector2(pw / 2 + 0.35, 0), new T.Vector2(0, 1.5)]);
    profileOnWall(b, W, mid, 7.18, 0, tri, depth + 0.3, 'stone');
    const tym = new T.Shape([new T.Vector2(-pw / 2 + 0.1, 0.05), new T.Vector2(pw / 2 - 0.1, 0.05), new T.Vector2(0, 1.1)]);
    profileOnWall(b, W, mid, 7.18, depth + 0.31, tym, 0.04, 'brick');
  }
  archWindow(b, W, mid, 0.3, 2.2, 5.0, {trim: 'stone', glass: 'dark', mullions: 1});
  for (let s = 0; s < 2; s++) { const q = wallPoint(W, mid, depth + 0.3 + s * 0.2); b.box(q[0], s * 0.15, q[1], pw + 0.2 - s * 0.1, 0.15 * (2 - s), 0.3, 'stone', bw); }
  // first-floor sash window with stone surround and triangular hood
  {
    const wd = 1.8, h = 2.5, y = 10.6, f = 0.07;
    onWall(b, W, mid, y - 0.18, wd + 0.7, 0.18, 0.16, 'stone', 0);
    onWall(b, W, mid, y, wd + 0.5, h + 0.2, 0.08, 'stone', 0);
    onWall(b, W, mid, y, wd, h, 0.06, 'glass', 0.04, 'pane');
    for (const t of [mid - wd / 2 + f / 2, mid, mid + wd / 2 - f / 2]) onWall(b, W, t, y, f, h, 0.1, 'white', 0.04);
    for (const yy of [y, y + h * 0.33, y + h * 0.66, y + h - f]) onWall(b, W, mid, yy, wd, f, 0.1, 'white', 0.04);
    const hood = new T.Shape([new T.Vector2(-wd / 2 - 0.5, 0), new T.Vector2(wd / 2 + 0.5, 0), new T.Vector2(0, 0.7)]);
    profileOnWall(b, W, mid, y + h + 0.2, 0, hood, 0.2, 'stone');
  }
  oculus(b, W, mid, 19.0, 0.9);
  for (let k = 0; k < 8; k++) blindArch(b, W, 0.6 + k * (L - 1.2) / 7, 22.5, 0.5, 0.9);

  // ---- south and north faces: tall arched window below the block roof, rose window, frieze
  archWindow(b, S, 2.2, 3.5, 1.6, 8.5, {trim: 'stone', mullions: 1});
  oculus(b, S, 2.2, 19.0, 0.8);
  for (let k = 0; k < 6; k++) blindArch(b, S, 0.6 + k * (S.length - 1.2) / 5, 22.5, 0.5, 0.9);
  archWindow(b, N, 4.3, 3.5, 1.6, 8.5, {trim: 'stone', mullions: 1});
  oculus(b, N, 4.3, 19.0, 0.8);
  for (let k = 0; k < 6; k++) blindArch(b, N, 0.6 + k * (N.length - 1.2) / 5, 22.5, 0.5, 0.9);

  // ---- flanking brick bays
  addFlank(b, -3.9, 0);
  addFlank(b, 10.4, 6.5);

  // ---- shaft cornice slab and belfry
  b.box(C[0], SHAFT - 0.4, C[1], 7.5, 0.5, 7.5, 'stone', rotY);
  const BASE = SHAFT + 0.1, BH = 5.6, h = 2.4;
  b.box(C[0], BASE, C[1], 2 * h, BH, 2 * h, 'brick', rotY);
  const corner = (a: number, c: number): P2 => [C[0] + a * h * U[0] + c * h * V[0], C[1] + a * h * U[1] + c * h * V[1]];
  const faces: {a: P2; c: P2; out: P2}[] = [
    {a: corner(1, -1), c: corner(1, 1), out: U},
    {a: corner(-1, 1), c: corner(1, 1), out: V},
    {a: corner(-1, -1), c: corner(-1, 1), out: [-U[0], -U[1]]},
    {a: corner(-1, -1), c: corner(1, -1), out: [-V[0], -V[1]]},
  ];
  for (const f of faces) {
    const w = wallBetween(f.a, f.c, BH, f.out);
    for (const dt of [-0.85, 0.85]) archWindow(b, w, w.length / 2 + dt, BASE + 1.2, 1.0, 3.4, {trim: 'stone', glass: 'dark', mullions: 0});
    onWall(b, w, w.length / 2, BASE + BH - 0.4, w.length, 0.18, 0.1, 'stone', 0);
  }
  b.box(C[0], BASE + BH, C[1], 5.5, 0.45, 5.5, 'stone', rotY);
  // octagonal lantern with small dark openings, ogee dome and finial
  const lanternY = BASE + BH + 0.45;
  const oct = new T.CylinderGeometry(1.9, 2.0, 2.0, 8); oct.rotateY(Math.PI / 8 + rotY);
  b.add(oct, 'stone' as never, C[0], lanternY + 1.0, C[1]);
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 + rotY, r = 1.86 * Math.cos(Math.PI / 8) + 0.06;
    b.box(C[0] + Math.sin(a) * r, lanternY + 0.5, C[1] + Math.cos(a) * r, 0.5, 1.1, 0.12, 'dark', a);
  }
  b.box(C[0], lanternY + 2.0, C[1], 4.4, 0.25, 4.4, 'stone', rotY + Math.PI / 4);
  const prof = [[2.1, 0], [2.15, 0.3], [1.75, 1.1], [1.0, 2.0], [0.5, 2.8], [0.2, 3.3], [0.1, 3.5]].map(p => new T.Vector2(p[0], p[1]));
  const dome = new T.LatheGeometry(prof, 8); dome.rotateY(Math.PI / 8 + rotY);
  b.add(dome, 'slate' as never, C[0], lanternY + 2.25, C[1]);
  b.add(new T.CylinderGeometry(0.06, 0.06, 1.5, 6), 'gold' as never, C[0], lanternY + 2.25 + 3.5 + 0.7, C[1]);
}

export function buildMuiderkerk(_w: number, _d: number, b: BuildingTools) {
  const src = trimmedSource();
  addShell(b, src as never, {wall: 'ochre', roof: 'slate', skip: s => isTower(s)});
  addShell(b, src as never, {wall: 'brick', roof: 'slate', skip: s => !isTower(s)});
  (b as {mark?: (n: string) => void}).mark?.('shell');

  addTower(b);

  // the 1997 block: faces from the BAG ring (indices into nativeRing)
  const ring = source.nativeRing;
  // faces follow the 3DBAG walls themselves (the BAG ring differs from them by up to 0.3 m)
  const wallList = wallsOf(source as never);
  for (const w of wallList) {
    const topY = Math.max(...w.poly.map(p => p[1]));
    if (w.base > 0.5 || w.length < 3.4 || topY < 18) continue;
    const mx0 = w.origin[0] + w.tangent[0] * w.length / 2, mz0 = w.origin[1] + w.tangent[1] * w.length / 2;
    const {t, d} = loc(mx0, mz0);
    if (mx0 < -6.3 && t > -5.4 && t < 11.3 && d < 8.5) continue; // tower, flanks and their return walls
    blockFace(b, w);
  }
  // glazed fifth storey: setback walls, normals re-aimed away from the block centre (wallsOf only checks the BAG ring)
  const mx = ring.reduce((a, p) => a + p[0], 0) / ring.length, mz = ring.reduce((a, p) => a + p[1], 0) / ring.length;
  for (const w0 of wallsOf(source as never)) {
    if (!(w0.length > 5 && w0.base > 18 && w0.base < 19.2 && Math.max(...w0.poly.map(p => p[1])) > 21.5)) continue;
    const p0: P2 = [w0.origin[0], w0.origin[1]], q0: P2 = [w0.origin[0] + w0.tangent[0] * w0.length, w0.origin[1] + w0.tangent[1] * w0.length];
    const away = ((p0[0] + q0[0]) / 2 - mx) * w0.n[0] + ((p0[1] + q0[1]) / 2 - mz) * w0.n[1] >= 0 ? w0.n : [-w0.n[0], -w0.n[1]] as P2;
    glazedStorey(b, wallBetween(p0, q0, 3.5, away, w0.base));
  }
}
