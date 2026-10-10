import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism} from './house-geometry';
import {facePoly} from './worship-kit';
import {poly, slab, disc, type Frame} from './nearbar-kit';

/**
 * Lloyd Hotel, Oostelijke Handelskade 34 (Evert Breman, 1918-21, for the Koninklijke Hollandsche Lloyd): five-storey brick block
 * with a slate mansard roof, four gabled end wings (stepped Dutch gables lettered LLOYD:HOTEL) and a battered entrance tower on the
 * quay side that ends in a clock stage, an octagonal lantern and a grey dome with a ship weathervane.
 *
 * The 3DBAG shell is rectilinear but its tower is cut off, so the building is rebuilt in its own axis frame (a along the long block,
 * bearing 105.8 degrees, b to the right i.e. towards the south-south-west back of the plot). BAG ring decomposed:
 *   core a -25.1..30.7, b -6.6..11.6, eave 15.2, mansard flat top 22.5 (3DBAG roof planes #245/#250/#274/#275);
 *   gabled risalits (ends of the wings) a -25.1..-14.4 and 19.8..30.6 north to b -11.6, south to b 14.4;
 *   one-storey annexes at both ends (3DBAG flat roofs at 3.7 m); tower shaft a -0.7..6.1, b -9.4..-0.5.
 * Heights read off the RCE photograph 20409072 (tower base 36 px/m): lettered plaque 6.2, shaft top 18.3, clock stage 21.3,
 * lantern 23.9, dome tip 26.7 (3DBAG max 26.0), vane about 29.
 */
const TH = 105.8 * Math.PI / 180;
const PHI = Math.PI / 2 - TH;
const nat = (a: number, bb: number): [number, number] => [a * Math.sin(TH) + bb * Math.cos(TH), -a * Math.cos(TH) + bb * Math.sin(TH)];
const dirNat = nat;
const P3 = (a: number, y: number, bb: number): number[] => { const p = nat(a, bb); return [p[0], y, p[1]]; };
const o3 = (da: number, up: number, db: number): number[] => { const d = dirNat(da, db); return [d[0], up, d[1]]; };
type Pt = [number, number];

const EAVE = 15.2, TOP = 22.5, PL = 2.2;
const BN = -6.6, BS = 11.6, BT = -1.5, BU = 6.5;          // core north/south walls and the edges of the flat top
const A0 = -25.1, A1 = 30.7;

const GLY: Record<string, string[]> = {
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
};

export function buildLloydHotel(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const lput = (g: T.BufferGeometry, colour: string, a: number, y: number, bb: number, rot = 0) => {
    g.rotateY(PHI + rot);
    const p = nat(a, bb);
    g.translate(p[0], y, p[1]);
    b.add(g, colour as never);
  };
  const lbox = (a: number, y0: number, bb: number, la: number, h: number, lb: number, colour: string, rot = 0) =>
    lput(new T.BoxGeometry(la, h, lb).translate(0, h / 2, 0), colour, a, y0, bb, rot);
  const shapeOf = (pts: Pt[]) => new T.Shape(pts.map(p => { const q = nat(p[0], p[1]); return new T.Vector2(q[0], q[1]); }));
  /** Closed brick solid over a rectangle: dark plinth, brick above, flat slate cap. */
  const block = (a0: number, a1: number, b0: number, b1: number, y1: number) => {
    const r: Pt[] = [[a0, b0], [a1, b0], [a1, b1], [a0, b1]];
    b.add(openTopPrism(shapeOf(r), 0, PL), 'greyBrick' as never);
    b.add(openTopPrism(shapeOf(r), PL, y1), 'brick' as never);
    capFlat(r, y1);
  };
  const capFlat = (r: Pt[], y: number) => {
    facePoly(b, r.map(p => P3(p[0], y, p[1])), 'slate', [0, 1, 0], 'roof');
  };
  const frame = (p: Pt, q: Pt, o: Pt): Frame => {
    const P = nat(p[0], p[1]), Q = nat(q[0], q[1]), od = dirNat(o[0], o[1]);
    let tx = Q[0] - P[0], tz = Q[1] - P[1];
    const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    let n: Pt = [-tz, tx], origin: Pt = P;
    if (n[0] * od[0] + n[1] * od[1] < 0) { tx = -tx; tz = -tz; n = [-tz, tx]; origin = Q; }
    return {origin, tangent: [tx, tz], n};
  };
  const fN = (bb: number) => frame([-30, bb], [40, bb], [0, -1]);
  const fS = (bb: number) => frame([-30, bb], [40, bb], [0, 1]);
  const fW = (a: number) => frame([a, -14], [a, 16], [-1, 0]);
  const fE = (a: number) => frame([a, -14], [a, 16], [1, 0]);
  const at = (f: Frame, a: number, bb: number) => { const p = nat(a, bb); return (p[0] - f.origin[0]) * f.tangent[0] + (p[1] - f.origin[1]) * f.tangent[1]; };

  // ---------------------------------------------------------------- massing
  block(A0, A1, BN, BS, EAVE);
  block(-27.8, A0, BN, 9.3, 3.7);
  block(A1, 33.0, -6.9, 9.3, 3.7);
  const RIS: {a0: number; a1: number; b0: number; north: boolean}[] = [
    {a0: A0, a1: -14.4, b0: -11.6, north: true}, {a0: 19.8, a1: 30.7, b0: -11.6, north: true},
    {a0: A0, a1: -14.4, b0: 14.4, north: false}, {a0: 19.8, a1: 30.7, b0: 14.3, north: false},
  ];
  for (const r of RIS) block(r.a0, r.a1, r.north ? r.b0 : BS, r.north ? BN : r.b0, EAVE);
  // projecting south bays
  block(-14.5, -4.3, BS, 13.6, 15.4);
  block(14.9, 19.9, BS, 13.6, 15.4);

  // mansard between the gables: two 55 degree slopes and a flat top, closed by the end walls
  const mq = (pts: number[][], out: number[], colour: string, role?: 'roof') => facePoly(b, pts, colour, out, role);
  // slope pieces stop at the valley lines of the risalit roofs so the valleys are real shared edges
  const slope = (bw: number, bt: number, out: number, ris: typeof RIS) => {
    const R = [...ris].sort((p, q) => p.a0 - q.a0);
    const ac = (r: typeof RIS[number]) => (r.a0 + r.a1) / 2;
    const [W, E] = R;
    const q = (pts: [number, number][]) => mq(pts.map(([a, bb]) => P3(a, bb === bw ? EAVE : TOP, bb)), o3(0, 0.7, out), 'slate', 'roof');
    q([[A0, bw], [ac(W), bt], [A0, bt]]);
    q([[W.a1, bw], [E.a0, bw], [ac(E), bt], [ac(W), bt]]);
    q([[E.a1, bw], [A1, bw], [A1, bt], [ac(E), bt]]);
  };
  slope(BN, BT, -1, RIS.filter(r => r.north));
  slope(BS, BU, 1, RIS.filter(r => !r.north));
  {
    const xs = [A0, -19.75, 25.25, A1];
    for (let i = 0; i < 3; i++) mq([P3(xs[i], TOP, BT), P3(xs[i + 1], TOP, BT), P3(xs[i + 1], TOP, BU), P3(xs[i], TOP, BU)], [0, 1, 0], 'slate', 'roof');
  }
  for (const [a, s] of [[A0, -1], [A1, 1]] as [number, number][])
    mq([P3(a, EAVE, BN), P3(a, EAVE, BS), P3(a, TOP, BU), P3(a, TOP, BT)], o3(s, 0, 0), 'brick');

  // gabled roofs of the four risalits, running back to the mansard valley; each is capped by a lettered stepped-gable plate
  for (const r of RIS) {
    const ac = (r.a0 + r.a1) / 2, bp = r.north ? r.b0 + 0.5 : r.b0 - 0.5;
    const bv = r.north ? BN : BS, bt = r.north ? BT : BU;
    for (const e of [r.a0, r.a1]) mq([P3(e, EAVE, bp), P3(e, EAVE, bv), P3(ac, TOP, bt), P3(ac, TOP, bp)], o3(e === r.a0 ? -1 : 1, 0.8, 0), 'slate', 'roof');
  }

  // entrance tower: battered shaft, clock stage, octagonal lantern, grey dome
  const TC: Pt = [2.7, -4.9];
  block(-0.7, 6.1, -9.4, -0.5, 18.3);
  lbox(TC[0], 18.3, TC[1], 4.6, 3.0, 6.6, 'brick');
  const oct = (r0: number, r1: number, y0: number, h: number, colour: string) =>
    lput(new T.CylinderGeometry(r1, r0, h, 8).translate(0, h / 2, 0), colour, TC[0], y0, TC[1]);
  oct(2.55, 2.55, 21.3, 2.6, 'dark');
  oct(2.7, 2.7, 23.9, 0.18, 'stone');
  {
    const prof = [[2.7, 0], [2.78, 0.2], [2.45, 0.7], [1.95, 1.6], [1.15, 2.3], [0.4, 2.7], [0, 2.82]].map(p => new T.Vector2(p[0], p[1]));
    lput(new T.LatheGeometry(prof, 8), 'copper', TC[0], 24.08, TC[1]);
  }
  b.mark?.('shell');   // massing above; everything below is facade or tower detail that must stay attached

  // ---------------------------------------------------------------- helpers for facade detail
  const win = (f: Frame, t: number, y: number, w: number, h: number, panel = true, mullion = true) => {
    slab(b, f, t, y, w, h, 0.12, 'white', 0);
    slab(b, f, t, y + 0.12, w - 0.24, h - 0.24, 0.05, 'glass', 0.12);
    if (mullion) slab(b, f, t, y + 0.12, 0.07, h - 0.24, 0.06, 'white', 0.12);
    slab(b, f, t, y + h * 0.62, w - 0.24, 0.07, 0.06, 'white', 0.12);
    if (panel) slab(b, f, t, y - 0.95, w + 0.2, 0.85, 0.06, 'greyBrick', 0);
  };
  const word = (f: Frame, text: string, t: number, y: number, px: number, out: number, colour: string) => {
    const total = ([...text].length * 6 - 1) * px; let u = t - total / 2;
    for (const ch of text) {
      const rows = GLY[ch];
      if (rows) for (let j = 0; j < 7; j++) {
        const row = rows[j]; let k = 0;
        while (k < 5) {
          if (row[k] !== '1') { k++; continue; }
          let e = k; while (e < 5 && row[e] === '1') e++;
          slab(b, f, u + (k + e) / 2 * px, y + (6 - j) * px, (e - k) * px, px, 0.05, colour, out);
          k = e;
        }
      }
      u += 6 * px;
    }
  };
  const ROWS = [2.6, 5.4, 8.2, 11.0, 13.3];     // sills of the five storeys
  const RH = [2.0, 2.0, 2.0, 2.0, 1.6];
  const basement = (f: Frame, ts: number[]) => { for (const t of ts) { slab(b, f, t, 0.35, 1.0, 1.1, 0.08, 'white', 0); slab(b, f, t, 0.5, 0.78, 0.8, 0.04, 'dark', 0.08); } };
  const band = (f: Frame, t0: number, t1: number, y: number, h = 0.2, d = 0.22) => slab(b, f, (t0 + t1) / 2, y, t1 - t0, h, d, 'stone', 0);

  // ---------------------------------------------------------------- north front (Oostelijke Handelskade)
  const fn = fN(BN);
  const tn = (a: number) => at(fn, a, BN);
  // Register 523289: either side of the tower each storey has two coupled pairs and one triple window with brick mullions
  const GROUPS: [number, number][] = [[9.95, 2], [13.45, 2], [17.55, 3]];
  for (const side of [1, -1]) {
    const xs: number[] = [];
    for (const [c, n] of GROUPS) for (let k = 0; k < n; k++) xs.push(TC[0] + side * (c - TC[0]) + (k - (n - 1) / 2) * 1.2);
    ROWS.forEach((y, i) => xs.forEach(a => win(fn, tn(a), y, 1.1, RH[i], i > 0, false)));
    basement(fn, xs.map(tn));
    const e0 = side > 0 ? 8.2 : -14.4, e1 = side > 0 ? 19.8 : -2.7;
    band(fn, tn(e1), tn(e0), PL, 0.16, 0.16);
    band(fn, tn(e1), tn(e0), EAVE - 0.3, 0.3, 0.3);
  }
  // narrow piers beside the tower
  for (const [a0, a1] of [[-2.7, -0.7], [6.1, 8.2]] as [number, number][])
    ROWS.slice(0, 4).forEach((y, i) => win(fn, tn((a0 + a1) / 2), y + 0.2, 0.7, 1.6, false, false));

  // tower front
  const ft = fN(-9.4);
  const tt = (a: number) => at(ft, a, -9.4);
  const tcA = TC[0];
  [-2.4, -1.2, 0, 1.2, 2.4].forEach(dx => {
    [7.6, 9.9, 12.2, 14.5, 16.4].forEach((y, i) => {
      slab(b, ft, tt(tcA + dx), y, 0.46, i === 4 ? 1.0 : 1.35, 0.1, 'white', 0);
      slab(b, ft, tt(tcA + dx), y + 0.08, 0.3, (i === 4 ? 1.0 : 1.35) - 0.16, 0.04, 'glass', 0.1);
      if (i < 4) slab(b, ft, tt(tcA + dx), y + 1.5, 0.62, 0.55, 0.08, 'greyBrick', 0);
    });
  });
  // corbelled top of the shaft
  for (let k = -3; k <= 3; k++) slab(b, ft, tt(tcA + k * 0.95), 17.4, 0.6, 0.9, 0.35, 'stone', 0);
  slab(b, ft, tt(tcA), 18.0, 6.8, 0.3, 0.45, 'stone', 0);
  // plaque and lettering above the entrance
  slab(b, ft, tt(tcA), 5.7, 5.6, 1.05, 0.14, 'stone', 0);
  word(ft, 'LLOYD:HOTEL', tt(tcA), 5.95, 0.075, 0.14, 'dark');
  // canopy, door and steps
  slab(b, ft, tt(tcA), 3.55, 6.4, 0.45, 2.0, 'white', 0);
  for (let k = -6; k <= 6; k++) slab(b, ft, tt(tcA + k * 0.5), 4.0, 0.34, 0.2, 2.0, 'dark', 0);
  slab(b, ft, tt(tcA), 0, 1.8, 3.2, 0.2, 'dark', 0);
  slab(b, ft, tt(tcA), 0.0, 1.5, 2.9, 0.08, 'bronze', 0.2);
  for (let k = 0; k < 3; k++) slab(b, ft, tt(tcA), k * 0.17, 5.6, 0.17, 0.6 + k * 0.0, 'stone', 0);
  for (const s of [-1, 1]) slab(b, ft, tt(tcA + s * 2.5), 0.2, 0.45, 3.0, 0.3, 'stone', 0);
  // clock stage: clocks on the three free faces, rim and dark lantern louvres
  for (const [f, tp, dist] of [[fN(-8.2), (a: number) => at(fN(-8.2), a, -8.2), 0], [fW(0.4), (_a: number) => at(fW(0.4), 0.4, TC[1]), 0], [fE(5.0), (_a: number) => at(fE(5.0), 5.0, TC[1]), 0]] as [Frame, (a: number) => number, number][]) {
    void dist;
    disc(b, f, tp(tcA), 19.9, 0.95, 0.12, 'white', 0);
    disc(b, f, tp(tcA), 19.9, 1.02, 0.08, 'stone', 0);
    slab(b, f, tp(tcA), 19.9 - 0.02, 0.06, 0.8, 0.05, 'dark', 0.12);
    slab(b, f, tp(tcA), 19.9, 0.55, 0.06, 0.05, 'dark', 0.12);
  }
  slab(b, fN(-8.2), at(fN(-8.2), tcA, -8.2), 21.2, 5.2, 0.2, 0.4, 'stone', 0);
  for (let k = 0; k < 8; k++) {
    const ang = (k + 0.5) * Math.PI / 4, ap = 2.55 * Math.cos(Math.PI / 8) + 0.01, p = nat(TC[0], TC[1]);
    const g = new T.BoxGeometry(1.05, 1.5, 0.1).translate(0, 0.75, 0).rotateY(ang);
    g.translate(p[0] + ap * Math.sin(ang), 22.0, p[1] + ap * Math.cos(ang));
    b.add(g, 'glass' as never);
  }
  // corner pinnacles on the shaft
  for (const [da, db] of [[-0.35, -0.35], [5.75, -0.35], [-0.35, -9.05], [5.75, -9.05]] as Pt[]) {
    lbox(da, 18.3, db, 0.9, 1.6, 0.9, 'brick');
    lput(new T.ConeGeometry(0.75, 1.6, 4).rotateY(Math.PI / 4).translate(0, 0.8, 0), 'slate', da, 19.9, db);
  }
  // finial, ship vane
  lput(new T.SphereGeometry(0.28, 8, 6).translate(0, 0.28, 0), 'gold', TC[0], 26.8, TC[1]);
  lbox(TC[0], 27.0, TC[1], 0.07, 1.8, 0.07, 'gold');
  lbox(TC[0], 28.2, TC[1], 0.8, 0.45, 0.07, 'gold');

  // ---------------------------------------------------------------- gables: stepped Dutch outline, windows, lettering, arms
  const gprof = (hw: number, s: number): Pt[] => {
    const h: Pt[] = [[1, 0], [1, 1.2], [0.82, 2.0], [0.82, 2.8], [0.64, 3.8], [0.64, 4.6], [0.43, 5.7], [0.43, 6.4], [0.22, 7.4], [0, 8.4]].map(p => [p[0] * hw, p[1]] as Pt);
    void s;
    return [...h.map(p => [p[0], p[1]] as Pt), ...h.slice(0, -1).reverse().map(p => [-p[0], p[1]] as Pt)].reverse();
  };
  for (const r of RIS) {
    const ac = (r.a0 + r.a1) / 2, hw = (r.a1 - r.a0) / 2;
    const f = r.north ? fN(r.b0) : fS(r.b0);
    const t = (a: number) => at(f, a, r.b0);
    // stepped gable plate, inset 0.5 behind the wall plane
    poly(b, f, t(ac), EAVE, gprof(hw, 1), 0.5, 'brick', -0.5);
    // stone coping steps on the outline
    for (const [y0, y1] of [[1.2, 2.0], [2.8, 3.8], [4.6, 5.7], [6.4, 7.4]]) for (const k of [-1, 1]) slab(b, f, t(ac + k * hw * ((y0 === 1.2 ? 0.91 : y0 === 2.8 ? 0.73 : y0 === 4.6 ? 0.535 : 0.325))), EAVE + y0, hw * 0.2, 0.14, 0.2, 'stone', 0);
    slab(b, f, t(ac), EAVE + 8.2, 0.9, 0.35, 0.25, 'stone', 0);
    // windows: three per storey, a pair above, one slit under the lettering
    const pitch = hw * 0.62;
    ROWS.forEach((y, i) => { for (const k of [-1, 0, 1]) win(f, t(ac + k * pitch), y, 1.7, RH[i], i > 0); });
    for (const k of [-0.5, 0.5]) win(f, t(ac + k * pitch), EAVE + 1.15, 1.2, 1.5, false, false);
    win(f, t(ac), EAVE + 3.1, 0.7, 1.3, false, false);
    word(f, 'LLOYD:HOTEL', t(ac), EAVE + 4.9, 0.062, 0, 'stone');
    disc(b, f, t(ac), EAVE + 6.6, 0.62, 0.14, 'stone', 0);
    disc(b, f, t(ac), EAVE + 6.6, 0.4, 0.1, 'gold', 0.14);
    basement(f, [-1, 0, 1].map(k => t(ac + k * pitch)));
    band(f, t(ac - hw), t(ac + hw), PL, 0.16, 0.16);
    band(f, t(ac - hw), t(ac + hw), EAVE - 0.3, 0.3, 0.28);
  }

  // ---------------------------------------------------------------- risalit side walls (two windows per storey)
  for (const r of RIS) {
    const bi = r.north ? BN : BS;
    const len = Math.abs(r.b0 - bi), step = len / 2;
    for (const [a, fs] of [[r.a0, fW], [r.a1, fE]] as [number, (a: number) => Frame][]) {
      const f = fs(a);
      const tb = (bb: number) => at(f, a, bb);
      ROWS.forEach((y, i) => { for (let k = 0; k < 2; k++) win(f, tb(r.north ? r.b0 + step * (k + 0.5) : bi + step * (k + 0.5)), y, 1.2, RH[i], i > 0); });
    }
  }

  // ---------------------------------------------------------------- south face (garden side): seven bays, wall dormers, hat dormers
  const fs = fS(BS);
  const ts = (a: number) => at(fs, a, BS);
  const bay = (k: number) => -14.4 + 4.9 * (k + 0.5);
  const SROWS = [2.3, 6.7, 11.1], SH = [3.4, 3.4, 3.0];
  for (let k = 0; k < 7; k++) {
    const a = bay(k);
    const grp = k === 0 || k === 6;
    const fp = (k === 0 || k === 1) ? fS(13.6) : k === 6 ? fS(13.6) : fs;
    const tp = (aa: number) => at(fp, aa, fp === fs ? BS : 13.6);
    SROWS.forEach((y, i) => {
      if (grp) for (const dx of [-1.1, 0, 1.1]) win(fp, tp(a + dx), y + 0.3, 0.75, SH[i] - 0.6, i > 0, false);
      else win(fp, tp(a), y, 2.3, SH[i], i > 0);
    });
    // wall-dormer gable above each bay, face in the wall plane, running back into the mansard
    poly(b, fs, ts(a), EAVE, [[-1.4, 0], [1.4, 0], [1.4, 1.9], [0.8, 2.3], [0, 2.7], [-0.8, 2.3], [-1.4, 1.9]], 1.6, 'brick', -1.6);
    win(fs, ts(a), EAVE + 0.55, 1.2, 1.3, false, false);
  }
  band(fs, ts(-14.4), ts(19.8), EAVE - 0.3, 0.3, 0.3);
  band(fs, ts(-14.4), ts(19.8), PL, 0.16, 0.16);

  // hat dormers on the mansard slopes
  const hat = (a: number, bb: number, yTop: number, yBase: number, face: number) => {
    lbox(a, yBase, bb, 1.5, yTop - yBase, 1.0, 'white');
    lbox(a, yTop, bb + face * 0.0, 1.9, 0.14, 1.3, 'slate');
    const f = face < 0 ? fN(bb - 0.5) : fS(bb + 0.5);
    slab(b, f, at(f, a, bb), yBase + (yTop - yBase) * 0.2, 1.1, (yTop - yBase) * 0.62, 0.05, 'dark', 0);
  };
  for (const a of [-12.0, -8.0, -4.0, 9.5, 13.5, 17.5]) {
    const yb = EAVE + 2.6, bb = BN + (yb - EAVE) / 1.431;
    hat(a, bb + 0.5, yb + 1.45, yb - 0.1, -1);
  }
  for (const a of [-12.0, -7.5, -3.0, 3.0, 8.0, 12.5, 17.0]) {
    const yb = EAVE + 3.6, bb = BS - (yb - EAVE) / 1.431;
    hat(a, bb - 0.5, yb + 1.45, yb - 0.1, 1);
  }

  // ---------------------------------------------------------------- end walls of the core and the annexes
  for (const [a, fe, s] of [[A0, fW, -1], [A1, fE, 1]] as [number, (a: number) => Frame, number][]) {
    const f = fe(a);
    void s;
    for (const bb of [-3.2, 0.4, 4.0, 7.6]) ROWS.slice(2).forEach((y, i) => win(f, at(f, a, bb), y, 1.2, RH[i + 2], true));
  }
  for (const [a, fe] of [[-27.8, fW], [33.0, fE]] as [number, (a: number) => Frame][]) {
    const f = fe(a);
    for (const bb of [-3.0, 0.0, 3.0, 6.0]) { slab(b, f, at(f, a, bb), 1.0, 1.2, 1.5, 0.1, 'white', 0); slab(b, f, at(f, a, bb), 1.12, 0.96, 1.26, 0.04, 'glass', 0.1); }
  }
}
