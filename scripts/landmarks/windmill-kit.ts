import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {upwardRoofPlane} from './house-geometry';
import {sailPoint, sweepClearance, type SailCross} from '../../src/canalRecall/landmarks/windmillSails';

/**
 * Windmill parts shared by the bespoke mill builders (De Bloem, De Otter, D'Admiraal; De Gooyer predates it).
 * Frame: metres, Y up, mill axis at x = z = 0, sails on +Z. `facing` turns a finished mill to the compass bearing its
 * sails face (the cap turns in reality; the builders record the representative bearing they chose).
 * Every part is texture-free flat colour; colours are palette names the spec's materialOverrides tint.
 */
export type C = Parameters<BuildingTools['add']>[1];
export type P = [number, number, number];

/** A BuildingTools whose geometry is turned by `theta` about the mill axis, then moved to (ox, oz). */
export function turned(b: BuildingTools, theta: number, ox = 0, oz = 0): BuildingTools {
  const add = (g: T.BufferGeometry, c: C, x = 0, y = 0, z = 0, angle = 0) => {
    g.rotateY(angle); g.translate(x, y, z); g.rotateY(theta); g.translate(ox, 0, oz); b.add(g, c);
  };
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, c: C, angle = 0) => add(new T.BoxGeometry(w, h, d), c, x, y + h / 2, z, angle);
  const no = () => { throw new Error('windmill-kit: use add/box on a turned frame'); };
  return {add, box, prism: no, gableRoof: no, hip: no, window: no, clock: no, sign: no};
}

/** Y rotation that turns the +Z sail face to a compass bearing (degrees clockwise from north; +Z is south). */
export const facingRotation = (bearingDeg: number) => Math.PI - (bearingDeg * Math.PI) / 180;

export function beam(b: BuildingTools, a: P, q: P, width: number, c: C, role = 'structure', depth = width): void {
  const v = new T.Vector3(...q).sub(new T.Vector3(...a)), len = v.length();
  if (len < 1e-4) return;
  const g = new T.BoxGeometry(width, len, depth);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize()));
  g.userData.role = role;
  const m = new T.Vector3(...a).add(new T.Vector3(...q)).multiplyScalar(.5);
  b.add(g, c, m.x, m.y, m.z);
}

/** Octagon outline, circumradius r, flats facing the axes (matches CylinderGeometry rotated by PI/8). */
export function octagon(r: number): T.Shape {
  const s = new T.Shape();
  for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  s.closePath(); return s;
}
export const flat = (r: number) => r * Math.cos(Math.PI / 8);

/** Open-ended eight-sided frustum (a smock body section): circumradius r0 at y, r1 at y + h. */
export function octFrustum(b: BuildingTools, y: number, h: number, r0: number, r1: number, c: C, role: string): void {
  const g = new T.CylinderGeometry(r1, r0, h, 8, 1, true); g.rotateY(Math.PI / 8); g.userData.role = role; b.add(g, c, 0, y + h / 2, 0);
}

/** A point on face `i` (0 = +Z face) of an octagonal frustum at height y, `out` metres proud of the face. */
export function octFacePoint(i: number, rAtY: number, out: number): {x: number; z: number; angle: number} {
  const a = i * Math.PI / 4, d = flat(rAtY) + out;
  return {x: Math.sin(a) * d, z: Math.cos(a) * d, angle: a};
}

/**
 * Small framed window on octagon face i: frame proud of the face, pane in front of it. `lean` is the face's inward run
 * per metre of rise (circumradius change per metre times cos 22.5 degrees), so the window lies on a tapering body.
 * `rAtY` is the circumradius at the window's centre height.
 */
export function octWindow(b: BuildingTools, i: number, y: number, rAtY: number, w: number, h: number, frame: C, pane: C, lean = 0): void {
  const tilt = -Math.atan(lean);
  for (const [out, ww, hh, dd, c] of [[.05, w, h, .14, frame], [.14, w - .16, h - .14, .06, pane]] as const) {
    const f = octFacePoint(i, rAtY, out), g = new T.BoxGeometry(ww, hh, dd); g.rotateX(tilt); g.userData.role = 'octagon-window';
    b.add(g, c, f.x, y + h / 2, f.z, f.angle);
  }
}

/** Signed area of a ground ring (x east, z south): positive when wallUnder faces walk outwards along it. */
export function ringArea(ring: [number, number][]): number {
  let a = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2;
}

/**
 * The stage (stelling): an octagonal deck annulus at `y` with edge beams, posts, two rails and, when `braces` is given,
 * the diagonal struts (schoren) down to the body.
 */
export function stage(b: BuildingTools, o: {y: number; rOuter: number; rInner: number; deck: C; edge: C; rail: C; railH?: number; postsPerSide?: number; braces?: {toY: number; toR: number; c: C; perSide?: number}}): void {
  const deck = octagon(o.rOuter), hole = octagon(o.rInner);
  deck.holes.push(new T.Path(hole.getPoints().reverse()));
  const plane = upwardRoofPlane(deck, o.y); plane.userData.role = 'stage-deck'; b.add(plane, o.deck);
  const under = new T.ShapeGeometry(deck); under.rotateX(Math.PI / 2); under.translate(0, o.y - .22, 0); under.userData.role = 'stage-underside'; b.add(under, o.deck);
  const railH = o.railH ?? 1.05, n = o.postsPerSide ?? 3;
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + i * Math.PI / 4, q = a + Math.PI / 4, r = o.rOuter;
    const p: P = [Math.cos(a) * r, o.y - .17, Math.sin(a) * r], e: P = [Math.cos(q) * r, o.y - .17, Math.sin(q) * r];
    beam(b, p, e, .24, o.edge, 'stage-edge');
    for (const h of [railH * .5, railH]) beam(b, [p[0], o.y + h, p[2]], [e[0], o.y + h, e[2]], .09, o.rail, 'stage-rail');
    for (let j = 0; j < n; j++) { const t = j / n, x = p[0] * (1 - t) + e[0] * t, z = p[2] * (1 - t) + e[2] * t; beam(b, [x, o.y, z], [x, o.y + railH, z], .09, o.rail, 'stage-post'); }
    if (o.braces) {
      const m = o.braces.perSide ?? 1;
      for (let j = 0; j < m; j++) {
        const t = (j + .5) / m, x = p[0] * (1 - t) + e[0] * t, z = p[2] * (1 - t) + e[2] * t, k = o.braces.toR / r;
        beam(b, [x * .97, o.y - .2, z * .97], [x * k, o.braces.toY, z * k], .16, o.braces.c, 'stage-brace');
      }
    }
  }
}

/** Rounded (boat-shaped) cap: half ellipsoid on a flat floor, at y, radii rx (across) and rz (front-back), height h. */
export function boatCap(b: BuildingTools, y: number, rx: number, rz: number, h: number, c: C, floor: C): void {
  const g = new T.SphereGeometry(1, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(rx, h, rz); g.userData.role = 'cap'; b.add(g, c, 0, y, 0);
  const f = new T.CircleGeometry(1, 12); f.rotateX(Math.PI / 2); f.scale(rx, 1, rz); f.translate(0, y, 0); f.userData.role = 'cap-floor'; b.add(f, floor);
}

/** A flat board in the XY plane at z (facing +Z), `depth` thick, with an optional border of `trim` proud of it. */
export function board(b: BuildingTools, x: number, y: number, z: number, w: number, h: number, c: C, trim?: C, depth = .1): void {
  b.box(x, y, z, w, h, depth, c);
  if (trim) for (const [dx, dy, ww, hh] of [[0, h - .06, w, .06], [0, 0, w, .06], [-w / 2 + .03, 0, .06, h], [w / 2 - .03, 0, .06, h]] as const) b.box(x + dx, y + dy, z + depth / 2 + .03, ww, hh, .05, trim);
}

/**
 * The sail cross. `old-dutch`: stock with the lattice (hekwerk) on the trailing side. `fauel`: the same lattice plus a
 * streamlined leading board (fok / steekbord) on the other side of the stock, as on De Bloem and D'Admiraal.
 * Returns the sweep clearance so the builder can assert the sails pass its stage and roofs.
 */
export function sails(b: BuildingTools, o: {cross: SailCross; style: 'old-dutch' | 'fauel'; stock: C; lattice: C; leading?: C; latticeWidth?: number; barStep?: number; hubC: C; shaftFrom: P}): {lowest: number; forward: number} {
  const cr = o.cross, lw = o.latticeWidth ?? cr.radius * .115, step = o.barStep ?? .5, inner = cr.radius * .15;
  for (let k = 0; k < (cr.count ?? 4); k++) {
    const pt = (r: number, l: number) => sailPoint(cr, k, r, l);
    beam(b, pt(0, 0), pt(cr.radius, 0), .26, o.stock, 'sail-stock', .3);
    beam(b, pt(inner, lw), pt(cr.radius, lw), .08, o.lattice, 'sail-rail');
    beam(b, pt(inner, lw * .5), pt(cr.radius, lw * .5), .05, o.lattice, 'sail-rail');
    for (let r = inner; r <= cr.radius + 1e-6; r += step) beam(b, pt(r, .12), pt(r, lw), .06, o.lattice, 'sail-lattice');
    if (o.style === 'fauel' && o.leading) {
      // Leading board: a flat plank in the sail plane the full length of the lattice, on the other side of the stock.
      plate(b, [pt(inner, -.16), pt(cr.radius, -.16), pt(cr.radius, -.6), pt(inner, -.6)], o.leading, 'sail-leading-board');
    }
  }
  beam(b, o.shaftFrom, [cr.hub[0], cr.hub[1], cr.hub[2] - .1], .5, o.stock, 'windshaft');
  const hub = new T.CylinderGeometry(.42, .42, .5, 10); hub.rotateX(Math.PI / 2 - Math.atan(cr.lean)); hub.userData.role = 'sail-hub'; b.add(hub, o.hubC, ...cr.hub);
  return sweepClearance(cr);
}

/** Winding wheel (kruirad): rim and four spokes in a vertical plane facing +Z, centred at `at`. */
export function windingWheel(b: BuildingTools, at: P, r: number, c: C): void {
  const rim = new T.TorusGeometry(r, .06, 4, 16); rim.userData.role = 'winding-wheel'; b.add(rim, c, ...at);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; beam(b, [at[0] - Math.cos(a) * r, at[1] - Math.sin(a) * r, at[2]], [at[0] + Math.cos(a) * r, at[1] + Math.sin(a) * r, at[2]], .05, c, 'winding-wheel'); }
}

/** 5x7 pixel glyphs for the names painted on mill beards and boards; unknown characters are spaces. */
const GLYPHS: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'], M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'], "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'], '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'], '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
};

/** Pixel lettering centred on (x, y) in the XY plane at z, facing +Z; runs of pixels in a row merge into one box. */
export function pixelText(b: BuildingTools, text: string, x: number, y: number, z: number, height: number, c: C, depth = .05): number {
  const px = height / 7, width = (text.length * 6 - 1) * px; let u = x - width / 2;
  for (const ch of text.toUpperCase()) {
    const rows = GLYPHS[ch];
    if (rows) for (let j = 0; j < 7; j++) {
      let k = 0;
      while (k < 5) {
        if (rows[j][k] !== '1') { k++; continue; }
        let e = k; while (e < 5 && rows[j][e] === '1') e++;
        b.box(u + (k + e) / 2 * px, y - height / 2 + (6 - j) * px, z + depth / 2, (e - k) * px * .95, px * .9, depth, c);
        k = e;
      }
    }
    u += 6 * px;
  }
  return width;
}

/**
 * Vertical quad strip along a ground polygon edge, whose top follows `top(x, z)` sampled at the given fractions. Walk a
 * ring with positive `ringArea` (see below) and every face points out of it.
 */
export function wallUnder(b: BuildingTools, a: [number, number], q: [number, number], bottom: number, top: (x: number, z: number) => number, c: C, samples: number[] = [0, 1], role = 'wall'): void {
  const pos: number[] = [];
  const at = (t: number) => [a[0] + (q[0] - a[0]) * t, a[1] + (q[1] - a[1]) * t] as const;
  for (let i = 0; i + 1 < samples.length; i++) {
    const [x0, z0] = at(samples[i]), [x1, z1] = at(samples[i + 1]), h0 = top(x0, z0), h1 = top(x1, z1);
    pos.push(x0, bottom, z0, x1, h1, z1, x1, bottom, z1, x0, bottom, z0, x0, h0, z0, x1, h1, z1);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); g.userData.role = role; b.add(g, c);
}

/** Planar quad (two triangles) through four points, wound so its normal faces up when listed anticlockwise from above. */
export function quad(b: BuildingTools, p: P[], c: C, role: string): void {
  const [a, q, r, s] = p, pos = [...a, ...r, ...q, ...a, ...s, ...r];
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  if (g.getAttribute('normal').getY(0) < 0) { const flip = [...a, ...q, ...r, ...a, ...r, ...s]; g.setAttribute('position', new T.Float32BufferAttribute(flip, 3)); g.computeVertexNormals(); }
  g.userData.role = role; b.add(g, c);
}

/** Flat plate through four coplanar points (both faces drawn by the double-sided export materials). */
export function plate(b: BuildingTools, p: P[], c: C, role: string): void {
  const [a, q, r, s] = p, g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute([...a, ...q, ...r, ...a, ...r, ...s], 3)); g.computeVertexNormals(); g.userData.role = role; b.add(g, c);
}

/**
 * Door or window in a flat wall whose outside faces `normal` (unit [x, z]); `at` is the opening's foot on the wall line.
 * The leaf (or pane) is set 2 cm into the wall and the frame strips stand on it, so the frame never hides behind the
 * leaf and nothing floats off the wall.
 */
export function framedOpening(b: BuildingTools, at: [number, number], normal: [number, number], y: number, w: number, h: number, leaf: C, frame: C, strip = .1): void {
  const angle = Math.atan2(normal[0], normal[1]), place = (out: number, u: number, v: number, ww: number, hh: number, dd: number, c: C) => {
    const g = new T.BoxGeometry(ww, hh, dd); g.userData.role = 'framed-opening';
    b.add(g, c, at[0] + normal[0] * out + normal[1] * u, y + v, at[1] + normal[1] * out - normal[0] * u, angle);
  };
  place(.02, 0, h / 2, w - strip, h - strip / 2, .08, leaf);
  place(.09, 0, h - strip / 2, w, strip, .06, frame);
  for (const s of [-1, 1]) place(.09, s * (w - strip) / 2, h / 2, strip, h, .06, frame);
}
