import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './sea-palace-footprints.json';

/**
 * Sea Palace (Oosterdokskade 8): the floating three-storey Chinese pagoda restaurant moored in Oosterdok
 * since 1984. It is a vessel, not a BAG pand, so the model is built on the OSM houseboat outline
 * (w454006714) fitted with an oriented rectangle, in native east/south metres from its centre.
 *
 * Everything is authored in a hull frame (x = u along the long axis toward bearing 115.68, z = v toward the
 * quay-side SSW long face, y up) and turned into native axes once, by rotating each geometry about Y.
 * Measured by eye from the 2021 and 2025 municipal panoramas (ref-*.jpg):
 *  - red-trimmed pontoon deck ringed by a dark ornamental balustrade (gold octagon medallions between posts
 *    that carry white globe lamps);
 *  - three storeys of red columns and glazing, each with its own deep green glazed-tile eave: the lower two
 *    are wide hipped skirts whose rims curl up and whose four corners are swept sharply upward, the top one
 *    is the main hipped roof, concave from ridge to eave, with a red ridge, red hip ribs and upswept ridge
 *    tails;
 *  - balconies with the same balustrade on the first and second eaves;
 *  - the north-east long face has the entrance bay (glazed doors between two gold dragon pillars); the
 *    ends are brick with a door and small windows.
 * The eave profiles are real curved surfaces (per-vertex heights), not tilted boxes.
 */
const A = source.hull.halfLongMetres, B = source.hull.halfShortMetres;
const TH = (source.hull.bearingDegrees - 90) * Math.PI / 180;

type V3 = [number, number, number];
type Col = Parameters<BuildingTools['add']>[1];

/** A curved hipped eave: outer rim rectangle, inner (wall or ridge) rectangle, concave profile, lip and corner sweep. */
type Eave = {
  insOut: number; insIn: number; ridge?: number; zIn: number; zOut: number;
  lip: number; lift: number; span: number; kick: number; thIn: number; thOut: number; p?: number;
};
const ROWS = [0, 0.25, 0.5, 0.72, 0.88, 1];
const SIDES = 4;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function eaveRects(e: Eave) {
  const a0 = A - e.insOut, b0 = B - e.insOut;
  const a1 = e.ridge !== undefined ? e.ridge : Math.max(0.01, A - e.insIn);
  const b1 = e.ridge !== undefined ? 0 : Math.max(0.01, B - e.insIn);
  return {a0, b0, a1, b1};
}
const corners = (a: number, b: number): [number, number][] => [[a, b], [a, -b], [-a, -b], [-a, b]];
/** Surface point of an eave at side k, fraction f along the side, t from inner (0) to outer (1) edge. */
function surf(e: Eave, k: number, f: number, t: number): V3 & {c: number} {
  const {a0, b0, a1, b1} = eaveRects(e);
  const O = corners(a0, b0), I = corners(a1, b1), k2 = (k + 1) % SIDES;
  const po = [lerp(O[k][0], O[k2][0], f), lerp(O[k][1], O[k2][1], f)], pi = [lerp(I[k][0], I[k2][0], f), lerp(I[k][1], I[k2][1], f)];
  const L = k % 2 === 0 ? 2 * b0 : 2 * a0, d = Math.min(f, 1 - f) * L;
  const c = Math.max(0, 1 - d / e.span) ** 2;
  let u = lerp(pi[0], po[0], t), v = lerp(pi[1], po[1], t);
  const sw = e.kick * c * t * t;
  u += Math.sign(po[0] || 1) * sw; v += Math.sign(po[1] || 1) * sw;
  const z = e.zIn + (e.zOut - e.zIn) * (1 - (1 - t) ** (e.p ?? 1.6)) + e.lip * t ** 7 + e.lift * c * t ** 2.2;
  return Object.assign([u, z, v] as V3, {c});
}
const sideLen = (e: Eave, k: number, t: number) => {
  const {a0, b0, a1, b1} = eaveRects(e);
  return k % 2 === 0 ? 2 * lerp(b1, b0, t) : 2 * lerp(a1, a0, t);
};
/** Odd, so no vertex row sits exactly on the ridge/centre line. */
const nSeg = (e: Eave, k: number) => { const n = Math.max(5, Math.round(sideLen(e, k, 1) / 1.6)); return n % 2 ? n : n + 1; };

/** Triangle soup helper that fixes winding with a predicate on the face normal. */
class Soup {
  pos: number[] = [];
  tri(a: V3, b: V3, c: V3, want: (n: T.Vector3, p: V3) => boolean) {
    const A_ = new T.Vector3(...a), B_ = new T.Vector3(...b), C_ = new T.Vector3(...c);
    const n = B_.clone().sub(A_).cross(C_.clone().sub(A_));
    if (n.lengthSq() < 1e-10) return;
    const ctr: V3 = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    if (want(n, ctr)) this.pos.push(...a, ...b, ...c); else this.pos.push(...a, ...c, ...b);
  }
  geometry() {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3));
    g.computeVertexNormals();
    return g;
  }
}
const up = (n: T.Vector3) => n.y > 0, down = (n: T.Vector3) => n.y < 0;
const outwardXZ = (n: T.Vector3, p: V3) => n.x * p[0] + n.z * p[2] > 0;
const inwardXZ = (n: T.Vector3, p: V3) => n.x * p[0] + n.z * p[2] < 0;

function eaveSoup(e: Eave) {
  const s = new Soup(), under = new Soup();
  const th = (t: number) => lerp(e.thIn, e.thOut, t);
  const topP = (k: number, f: number, j: number) => surf(e, k, f, ROWS[j]);
  const botP = (k: number, f: number, j: number): V3 => { const p = surf(e, k, f, ROWS[j]); return [p[0], p[1] - th(ROWS[j]), p[2]]; };
  for (let k = 0; k < SIDES; k++) {
    const n = nSeg(e, k);
    for (let i = 0; i < n; i++) {
      const f0 = i / n, f1 = (i + 1) / n;
      for (let j = 0; j < ROWS.length - 1; j++) {
        const q = [topP(k, f0, j), topP(k, f1, j), topP(k, f1, j + 1), topP(k, f0, j + 1)] as V3[];
        s.tri(q[0], q[1], q[2], up); s.tri(q[0], q[2], q[3], up);
        const r = [botP(k, f0, j), botP(k, f1, j), botP(k, f1, j + 1), botP(k, f0, j + 1)];
        under.tri(r[0], r[1], r[2], down); under.tri(r[0], r[2], r[3], down);
      }
      const jo = ROWS.length - 1;
      const ot = [topP(k, f0, jo), topP(k, f1, jo)], ob = [botP(k, f0, jo), botP(k, f1, jo)];
      s.tri(ot[0], ot[1], ob[1], outwardXZ); s.tri(ot[0], ob[1], ob[0], outwardXZ);
      const it = [topP(k, f0, 0), topP(k, f1, 0)], ib = [botP(k, f0, 0), botP(k, f1, 0)];
      if (e.ridge === undefined) { s.tri(it[0], it[1], ib[1], inwardXZ); s.tri(it[0], ib[1], ib[0], inwardXZ); }
    }
  }
  return {top: s, under};
}

/** Closed prism swept through cross-sections (each a ring of points); loop closes the sweep, otherwise end caps. */
function sweep(sections: V3[][], loop: boolean) {
  const s = new Soup(), n = sections.length, m = sections[0].length;
  const ctr = (sec: V3[]) => sec.reduce((a, p) => [a[0] + p[0] / m, a[1] + p[1] / m, a[2] + p[2] / m] as V3, [0, 0, 0] as V3);
  const last = loop ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = sections[i], c = sections[(i + 1) % n], ca = ctr(a), cc = ctr(c), mid: V3 = [(ca[0] + cc[0]) / 2, (ca[1] + cc[1]) / 2, (ca[2] + cc[2]) / 2];
    for (let k = 0; k < m; k++) {
      const k2 = (k + 1) % m;
      const away = (_n: T.Vector3, p: V3) => { const x = p[0] - mid[0], y = p[1] - mid[1], z = p[2] - mid[2]; return _n.x * x + _n.y * y + _n.z * z > 0; };
      s.tri(a[k], a[k2], c[k2], away); s.tri(a[k], c[k2], c[k], away);
    }
  }
  if (!loop) {
    for (const [sec, other] of [[sections[0], sections[1]], [sections[n - 1], sections[n - 2]]] as [V3[], V3[]][]) {
      const co = ctr(other);
      for (let k = 1; k < m - 1; k++) s.tri(sec[0], sec[k], sec[k + 1], (_n, p) => _n.x * (p[0] - co[0]) + _n.y * (p[1] - co[1]) + _n.z * (p[2] - co[2]) > 0);
    }
  }
  return s;
}

export function buildSeaPalace(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const ad = (g: T.BufferGeometry, c: Col) => { g.rotateY(-TH); b.add(g, c); };
  const soup = (s: Soup, c: Col) => ad(s.geometry(), c);
  /** Axis-aligned box in the hull frame, centred on (u,v), bottom at y0. */
  const bx = (u: number, y0: number, v: number, w: number, h: number, d: number, c: Col) => ad(new T.BoxGeometry(w, h, d).translate(u, y0 + h / 2, v), c);
  /** Oriented bar between two points (box w x h cross-section, rolled so +Y stays up). */
  const bar = (p: V3, q: V3, w: number, h: number, c: Col) => {
    const d = new T.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]), len = d.length();
    const g = new T.BoxGeometry(len, h, w);
    const qn = new T.Quaternion().setFromUnitVectors(new T.Vector3(1, 0, 0), d.clone().normalize());
    g.applyQuaternion(qn); g.translate((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2);
    ad(g, c);
  };

  // ---- Pontoon hull and deck ----
  const DECK = 0.95;
  bx(0, 0, 0, 2 * A - 0.12, 0.5, 2 * B - 0.12, 'concrete');
  bx(0, 0.5, 0, 2 * A, DECK - 0.5, 2 * B, 'red');

  // ---- Storey walls (brick) ----
  type Storey = {ins: number; y0: number; y1: number};
  const S1: Storey = {ins: 2.7, y0: DECK - 0.05, y1: 4.15}, S2: Storey = {ins: 3.7, y0: 4.15, y1: 7.45}, S3: Storey = {ins: 4.4, y0: 7.35, y1: 10.5};
  for (const s of [S1, S2, S3]) bx(0, s.y0, 0, 2 * (A - s.ins), s.y1 - s.y0, 2 * (B - s.ins), 'brick');

  // ---- Eaves (real curved surfaces) ----
  const E1: Eave = {insOut: 0.35, insIn: 4.3, zIn: 4.75, zOut: 3.2, lip: 0.38, lift: 0.95, span: 6.5, kick: 0.35, thIn: 0.3, thOut: 0.16};
  const E2: Eave = {insOut: 0.9, insIn: 5.3, zIn: 8.05, zOut: 6.6, lip: 0.36, lift: 1.0, span: 6.0, kick: 0.35, thIn: 0.3, thOut: 0.16};
  const roofRidge = (A - 1.9) - (B - 1.9) * 0.92;
  const E3: Eave = {insOut: 1.9, insIn: 0, ridge: roofRidge, zIn: 13.2, zOut: 10.1, lip: 0.45, lift: 1.2, span: 7.5, kick: 0.4, thIn: 0.12, thOut: 0.2, p: 1.9};
  for (const e of [E1, E2, E3]) { const parts = eaveSoup(e); soup(parts.top, 'green'); soup(parts.under, 'brick'); }
  b.mark?.('shell');

  // Tile ribs, hip ribs and red rim fascia for every eave.
  const rim = (e: Eave) => {
    const sections: V3[][] = [];
    for (let k = 0; k < SIDES; k++) {
      const n = nSeg(e, k);
      for (let i = 0; i < n; i++) {
        const p = surf(e, k, i / n, 1), th = e.thOut;
        // outward direction is the side normal blended at corners
        const {a0, b0} = eaveRects(e);
        const sx = Math.abs(p[0]) > a0 - 1e-3 ? Math.sign(p[0]) : 0, sz = Math.abs(p[2]) > b0 - 1e-3 ? Math.sign(p[2]) : 0;
        const l = Math.hypot(sx, sz) || 1, ox = sx / l, oz = sz / l;
        const at = (out: number, y: number): V3 => [p[0] + ox * out, y, p[2] + oz * out];
        sections.push([at(-0.1, p[1] - th - 0.05), at(0.07, p[1] - th - 0.06), at(0.07, p[1] + 0.07), at(-0.1, p[1] + 0.07)]);
      }
    }
    soup(sweep(sections, true), 'red');
  };
  const ribs = (e: Eave, pitch: number, w: number, hgt: number, col: Col, hipsOnly = false) => {
    for (let k = 0; k < SIDES; k++) {
      const n = hipsOnly ? 1 : nSeg(e, k) / Math.max(1, Math.round(pitch));
      const fs = hipsOnly ? [0] : Array.from({length: Math.round(n)}, (_, i) => (i + 0.5) / Math.round(n));
      for (const f of fs) {
        const sections: V3[][] = [];
        for (let j = 0; j < ROWS.length; j++) {
          const p = surf(e, k, f, ROWS[j]), q = surf(e, k, Math.min(1, f + 0.001), ROWS[j]);
          const tx = q[0] - p[0], tz = q[2] - p[2], l = Math.hypot(tx, tz) || 1, nx = tx / l, nz = tz / l;
          sections.push([[p[0] - nx * w / 2, p[1] - 0.04, p[2] - nz * w / 2], [p[0] + nx * w / 2, p[1] - 0.04, p[2] + nz * w / 2], [p[0] + nx * w / 2, p[1] + hgt, p[2] + nz * w / 2], [p[0] - nx * w / 2, p[1] + hgt, p[2] - nz * w / 2]]);
        }
        soup(sweep(sections, false), col);
      }
    }
  };
  for (const e of [E1, E2, E3]) { rim(e); ribs(e, e === E3 ? 1 : 2, 0.16, 0.07, 'bronze'); ribs(e, 1, 0.34, 0.12, 'red', true); }

  // ---- Balustrades with medallions and globe lamps ----
  const balustrade = (e: Eave, t: number) => {
    for (let k = 0; k < SIDES; k++) {
      const n = Math.max(2, Math.round(sideLen(e, k, t) / 2.4));
      const pts: V3[] = [];
      for (let i = 0; i <= n; i++) pts.push(surf(e, k, i / n, t) as V3);
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[i + 1];
        const du = q[0] - p[0], dv = q[2] - p[2], l = Math.hypot(du, dv);
        const nu = dv / l, nv = -du / l; // horizontal normal, flipped to point outward below
        const mu = (p[0] + q[0]) / 2, mv = (p[2] + q[2]) / 2, sgn = nu * mu + nv * mv >= 0 ? 1 : -1;
        const pb: V3 = [p[0], p[1] + 0.12, p[2]], qb: V3 = [q[0], q[1] + 0.12, q[2]];
        // dark panel and top rail follow the slope
        bar([pb[0], pb[1] + 0.4, pb[2]], [qb[0], qb[1] + 0.4, qb[2]], 0.12, 0.8, 'frame');
        bar([p[0], p[1] + 1.0, p[2]], [q[0], q[1] + 1.0, q[2]], 0.2, 0.1, 'frame');
        const mx = mu, my = (p[1] + q[1]) / 2 + 0.52, mz = mv;
        // cylinder axis is Y after construction; stand it so the axis points along the outward normal
        const g = new T.CylinderGeometry(0.28, 0.28, 0.05, 8);
        g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(sgn * nu, 0, sgn * nv)));
        g.translate(mx + sgn * nu * 0.08, my, mz + sgn * nv * 0.08);
        ad(g, 'gold');
      }
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        bx(p[0], p[1] - 0.08, p[2], 0.17, 1.2, 0.17, 'frame');
        ad(new T.OctahedronGeometry(0.15, 0).translate(p[0], p[1] + 1.27, p[2]), 'white');
      }
    }
  };
  const deck: Eave = {insOut: 0.38, insIn: 0.38, zIn: DECK, zOut: DECK, lip: 0, lift: 0, span: 1, kick: 0, thIn: 0, thOut: 0};
  balustrade(deck, 1);
  // First and second balconies stand on the eave surfaces; the rail ring is inset from the curled rim.
  const tAt = (e: Eave, inset: number) => (e.insIn - inset) / (e.insIn - e.insOut);
  balustrade(E1, tAt(E1, 2.35));
  balustrade(E2, tAt(E2, 3.0));

  // ---- Columns, glazing and the entrance on each storey ----
  const COLX = [-14.5, -8.7, -2.9, 2.9, 8.7, 14.5];
  type Face = {nu: number; nv: number};
  const faces: Face[] = [{nu: 0, nv: -1}, {nu: 0, nv: 1}, {nu: 1, nv: 0}, {nu: -1, nv: 0}];
  /** Box on a storey face: t along the face (viewer's left to right), out from the wall plane. */
  const fb = (s: Storey, f: Face, t: number, y0: number, w: number, h: number, depth: number, out: number, c: Col) => {
    const a = A - s.ins, bb = B - s.ins;
    const horizontal = f.nu === 0; // long face
    const tu = -f.nv, tv = f.nu; // tangent along +u (long faces) or +v (end faces)
    const dx = horizontal ? w : depth, dz = horizontal ? depth : w;
    const centreU = horizontal ? tu * t : f.nu * (a + out + depth / 2), centreV = horizontal ? f.nv * (bb + out + depth / 2) : tv * t;
    bx(centreU, y0, centreV, dx, h, dz, c);
  };
  const lens = (s: Storey, f: Face) => (f.nu === 0 ? 2 * (A - s.ins) : 2 * (B - s.ins));
  const window = (s: Storey, f: Face, t: number, y0: number, w: number, h: number) => {
    fb(s, f, t, y0 - 0.1, w + 0.22, h + 0.2, 0.09, -0.04, 'frame');
    fb(s, f, t, y0, w, h, 0.1, 0.0, 'glass');
  };
  const storeyDetail = (s: Storey, level: 1 | 2 | 3) => {
    for (const f of faces) {
      const L = lens(s, f), half = L / 2;
      const ts = f.nu === 0 ? [-half, ...COLX.filter(x => Math.abs(x) < half - 0.4), half] : [-half, -half / 2, 0, half / 2, half];
      // columns (red) in front of the wall, plus a red beam under the eave
      for (const t of ts) fb(s, f, t, s.y0 + (level === 1 ? 0 : 0.0), 0.36, s.y1 - s.y0 - 0.05, 0.36, 0.06, 'red');
      fb(s, f, 0, s.y1 - 0.42, L + 0.3, 0.38, 0.3, 0.1, 'red');
      fb(s, f, 0, s.y0 + 0.05, L, 0.14, 0.2, 0.0, 'frame');
      for (let i = 0; i < ts.length - 1; i++) {
        const t0 = ts[i], t1 = ts[i + 1], tc = (t0 + t1) / 2, w = t1 - t0 - 0.55;
        if (w < 0.8) continue;
        const isEntrance = level === 1 && f.nu === 0 && f.nv === -1 && Math.abs(tc) < 0.1;
        const isEndDoor = level === 1 && f.nu === -1 && i === ts.length - 2;
        if (isEntrance) {
          // glazed double doors between gold dragon pillars
          window(s, f, tc, s.y0 + 0.2, 2.6, 2.5);
          fb(s, f, tc, s.y0 + 0.2, 0.08, 2.5, 0.14, 0.04, 'frame');
          for (const sg of [-1, 1]) {
            const d = new T.CylinderGeometry(0.3, 0.34, 3.3, 8);
            ad(d.translate(sg * 1.75, s.y0 + 1.65, -(B - s.ins + 0.45)), 'gold');
            ad(new T.CylinderGeometry(0.4, 0.4, 0.22, 8).translate(sg * 1.75, s.y0 + 3.4, -(B - s.ins + 0.45)), 'gold');
          }
        } else if (isEndDoor) {
          window(s, f, tc, s.y0 + 0.2, 1.7, 2.5);
        } else if (level === 1) {
          if (f.nu === 0) window(s, f, tc, s.y0 + 1.0, w, 2.3);
          else window(s, f, tc, s.y0 + 1.1, Math.min(w, 2.2), 1.6);
        } else if (f.nu === 0) {
          const pw = (w - 0.4) / 2;
          for (const sg of [-1, 1]) window(s, f, tc + sg * (pw / 2 + 0.2), s.y0 + 0.65, pw, 1.6);
        } else window(s, f, tc, s.y0 + 0.7, Math.min(w, 2.0), 1.5);
      }
    }
  };
  storeyDetail(S1, 1); storeyDetail(S2, 2); storeyDetail(S3, 3);

  // ---- Eave corner dragons (upswept gold tips) and ridge ----
  for (const e of [E1, E2, E3]) {
    for (let k = 0; k < SIDES; k++) {
      const p = surf(e, k, 0, 1), q = surf(e, k, 0, 0.93);
      const dir = new T.Vector3(p[0] - q[0], p[1] - q[1] + 0.35, p[2] - q[2]).normalize();
      const g = new T.ConeGeometry(0.16, 0.7, 6);
      g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir));
      g.translate(p[0] + dir.x * 0.25, p[1] + dir.y * 0.25 - 0.05, p[2] + dir.z * 0.25);
      ad(g, 'gold');
    }
  }
  // Ridge beam with upswept tails.
  {
    const ry = E3.zIn;
    bar([-roofRidge, ry + 0.12, 0], [roofRidge, ry + 0.12, 0], 0.4, 0.34, 'red');
    for (const sg of [-1, 1]) {
      const s = new T.Shape();
      s.moveTo(0, 0); s.lineTo(0, 0.34); s.quadraticCurveTo(0.8, 0.45, 1.15, 1.25); s.quadraticCurveTo(1.0, 0.7, 0.5, 0.0); s.lineTo(0, 0);
      const g = new T.ExtrudeGeometry(s, {depth: 0.3, bevelEnabled: false, curveSegments: 6});
      g.translate(0, 0, -0.15);
      const gg = g;
      if (sg < 0) { gg.scale(-1, 1, 1); const idx = gg.getIndex(); if (idx) for (let i = 0; i < idx.count; i += 3) { const t0 = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, t0); } }
      gg.translate(sg * roofRidge, ry - 0.05, 0);
      ad(gg, 'gold');
    }
  }
}
