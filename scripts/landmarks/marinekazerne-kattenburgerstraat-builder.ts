import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {onWall, win, door, type Kit, type V2, type Col} from './church-kit';
import {slab, poly, put, disc, archSlab, archBand, type Frame} from './nearbar-kit';
import {addShell, type Surface} from './worship-shell';
import source from './marinekazerne-kattenburgerstraat-footprints.json';

/**
 * Marinekazerne street range: 's Lands Werf on the Kattenburgerstraat (BAG pand 0363100012165822, 1657, Rijksmonument
 * 2206: "Aan de straat een langgerekte gevel (XVIIc), voor zover niet verbouwd voorzien van rijen blinde nissen a la
 * Dortsman en Stalpaert. Inrijpoort geflankeerd door twee paar pilasters en gedekt door een gesneden fries en fronton.").
 * The Marineterrein behind it has many more buildings (170237, 170240, 181341, 164934 and the De Weger buildings); they are
 * not part of this model.
 *
 * Massing is the 3DBAG LoD2.2 shell (CC BY 4.0, marinekazerne-kattenburgerstraat-prepare.ts). Every front below is read
 * from the rectified Gemeente Amsterdam panoramas (CC BY 4.0) listed in marinekazerne-kattenburgerstraat-inventory.json:
 *  - the 105 m Kattenburgerstraat front (w03-152, w04-153, 50 px/m): a grey plinth, a ground row of cream-framed windows
 *    and blind niches, an upper row of small square windows alternating with blind niches on a 2.03 m pitch, three
 *    round-headed blind niches either side of the gate, a cream cornice and a tiled roof with pedimented dormers;
 *  - the gate frontispiece in the middle (aimed views TMX7316010203-001181_pano_0000_001385, 2019, and
 *    TMX7316010203-001536_pano_0000_001597, 2020): two pairs of brick pilasters on sandstone pedestals with sandstone
 *    capitals, a carved sandstone frieze, a pediment with a relief of a crest between trophies, and a round-arched
 *    gateway with a sandstone arch ring and keystone;
 *  - the 74 m front that turns north at the corner (w01-134, 45 px/m): small windows, blind oculi and niches, and the
 *    taller brick block at its north-east end;
 *  - the terrain-side fronts (w02-314, w05-332, w06-332, w08-64, w10-334, w12-332): two storeys of cream-framed windows,
 *    doors and dormers, at the pitch read on each crop.
 *
 * Frame: native, x east, z south, y up from the pavement (3DBAG maaiveld 1.84 m NAP), metres from the BAG ring's vertex
 * average. Wall frames are built from the BAG ring edges with the outward normal; details stand on a brick face 6 cm in
 * front of the BAG line (the 3DBAG walls stand 0-0.37 m behind it).
 */
type Src = {nativeRing: number[][]; shellNative: Surface[]};
const S = source as unknown as Src;
const R = S.nativeRing.map(p => [p[0], p[1]] as V2);

const EAVES = 7.45;
/** Brick face in front of the BAG line. The 3DBAG walls stand 0-0.1 m behind the BAG line and stay in the shell; the face
 *  slab stands this far out so a niche cut through it is 0.14-0.25 m deep, with the 3DBAG wall as its back. */
const FACE = 0.15;

function inside(p: V2) {
  let c = false;
  for (let i = 0, j = R.length - 1; i < R.length; j = i++) {
    const a = R[i], b = R[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
/** Wall frame from ring vertex a to b (t runs a -> b), plane `off` in front of the BAG line, n outward. */
function edgeFrame(a: V2, b: V2, off = FACE): Frame & {len: number} {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), tg: V2 = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  let n: V2 = [-tg[1], tg[0]];
  const mid: V2 = [(a[0] + b[0]) / 2 + n[0] * 0.3, (a[1] + b[1]) / 2 + n[1] * 0.3];
  if (inside(mid)) throw Error('edgeFrame: a->b must run with the outside on its left in the kit sense');
  return {origin: [a[0] + n[0] * off, a[1] + n[1] * off], n, tangent: [n[1], -n[0]], len: L};
}
/** Same frame moved by `d` along its normal. */
const shift = (f: Frame, d: number): Frame => ({origin: [f.origin[0] + f.n[0] * d, f.origin[1] + f.n[1] * d], n: f.n, tangent: f.tangent});

/** Brick faces drawn over the BAG line; their slabs are built last, against the 3DBAG walls they replace (finishFaces). */
type FaceRec = {k: Kit; f: Frame; t0: number; t1: number; holes: Hole[]; col: Col};
const FACES: FaceRec[] = [];
/** Face slab depth. Deeper than the audit's 0.8 m host band, so a window on a diagonal wall (whose axis-aligned box
 *  straddles both faces) is hosted on the front, not on the slab's back face. */
const SLAB_D = 2.0;
/** Top of the cornice's corona (7.2 + 0.18). */
const CORONA_TOP = 7.38;

type Hole = {t: number; y0: number; w: number; h: number; round?: boolean; circle?: boolean};
/** Brick face over [t0, t1] of a frame, SLAB_D thick behind the plane, with blind niches cut through it down to the 3DBAG
 *  wall behind; the slab itself is built in finishFaces, once its top can follow the 3DBAG walls it covers. */
function face(k: Kit, f: Frame, t0: number, t1: number, _top: number, holes: Hole[], col: Col = 'brick') {
  FACES.push({k, f, t0, t1, holes, col});
}
function holePath(h: Hole) {
  const p = new T.Path(), r = h.w / 2;
  if (h.circle) p.absarc(h.t, h.y0 + r, r, 0, Math.PI * 2, false);
  else if (h.round) { p.moveTo(h.t - r, h.y0); p.lineTo(h.t - r, h.y0 + h.h - r); p.absarc(h.t, h.y0 + h.h - r, r, Math.PI, 0, true); p.lineTo(h.t + r, h.y0); p.lineTo(h.t - r, h.y0); }
  else { p.moveTo(h.t - r, h.y0); p.lineTo(h.t - r, h.y0 + h.h); p.lineTo(h.t + r, h.y0 + h.h); p.lineTo(h.t + r, h.y0); p.lineTo(h.t - r, h.y0); }
  return p;
}
/**
 * Build every face slab and return the shell. A 3DBAG wall is covered by a face when it runs parallel to it (normals within
 * 18 deg), lies within 1 m of its BAG line over the face's extent, and tops out below 9 m (eaves walls; the taller NE
 * block keeps its own). Covered walls stay in the shell (it stays closed, and they are the niches' backs), except a wall
 * wholly inside a ground notch (the gateway's own 3DBAG recess), which is dropped so the passage stays open. The face's
 * top follows the covered walls' tops.
 */
function finishFaces(src: Surface[]): Surface[] {
  const tops: {t0: number; t1: number; y: number}[][] = FACES.map(() => []);
  const keep = src.filter(s => {
    if (s.type !== 'WallSurface') return true;
    const pts = s.rings[0];
    let nx = 0, nz = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], c = pts[(i + 1) % pts.length]; nx += (a[1] - c[1]) * (a[2] + c[2]); nz += (a[0] - c[0]) * (a[1] + c[1]); }
    const nl = Math.hypot(nx, nz), ymax = Math.max(...pts.map(p => p[1]));
    if (nl < 1e-6 || ymax > 9) return true;
    // faces parallel to this wall; a long 3DBAG wall can run on over two near-collinear faces (the long front's A and B)
    const rel = (f: Frame, p: number[]) => { const dx = p[0] - f.origin[0], dz = p[2] - f.origin[1]; return [dx * f.tangent[0] + dz * f.tangent[1], dx * f.n[0] + dz * f.n[1]]; };
    const cand = [...FACES.entries()].filter(([, {f}]) => Math.abs((nx * f.n[0] + nz * f.n[1]) / nl) >= 0.95);
    const near = (fc: FaceRec, p: number[]) => { const [t, o] = rel(fc.f, p); return t > fc.t0 - 0.6 && t < fc.t1 + 0.6 && o > -1.0 - FACE && o < 1.0 - FACE; };
    if (!cand.length || !pts.every(p => cand.some(([, fc]) => near(fc, p)))) return true;
    for (const [fi, fc] of cand) {
      const ts = pts.map(p => rel(fc.f, p)[0]), a = Math.max(Math.min(...ts), fc.t0), z = Math.min(Math.max(...ts), fc.t1);
      if (z - a > 0.01 && pts.some(p => near(fc, p))) {
        tops[fi].push({t0: a, t1: z, y: ymax});
        if (process.env.MK_DEBUG) console.error('wall', fi, a.toFixed(1), z.toFixed(1), 'o', Math.min(...pts.map(p => rel(fc.f, p)[1])).toFixed(2), Math.max(...pts.map(p => rel(fc.f, p)[1])).toFixed(2));
      }
    }
    // drop only a wall standing wholly in a face's ground notch (the gateway)
    return !cand.some(([, fc]) => fc.holes.some(h => h.y0 <= 0.01 && pts.every(p => { const [t] = rel(fc.f, p); return near(fc, p) && Math.abs(t - h.t) <= h.w / 2 + 0.5; })));
  });
  FACES.forEach(({k, f, t0, t1, holes, col}, fi) => {
    if (process.env.MK_DEBUG) console.error('face', fi, t0.toFixed(1), t1.toFixed(1), JSON.stringify(tops[fi].map(s => [+s.t0.toFixed(2), +s.t1.toFixed(2), +s.y.toFixed(2)]).sort((p, q) => p[0] - q[0])));
    // a top below 7.46 (the corona's top 7.38 plus 8 cm) is set level with it: the corona stands 5 mm proud of the face, so the
    // two tops meet edge to edge instead of lying 2-3 cm apart
    const top = (t: number) => { const c = tops[fi].filter(s => s.t0 - 0.05 <= t && t <= s.t1 + 0.05), y = c.length ? Math.max(...c.map(s => s.y)) : EAVES; return y < CORONA_TOP + 0.08 ? CORONA_TOP : y; };
    const cuts = [...new Set([t0, t1, ...tops[fi].flatMap(s => [s.t0, s.t1])].filter(t => t >= t0 && t <= t1).map(t => +t.toFixed(3)))].sort((a, b) => a - b);
    const sh = new T.Shape();
    // openings that reach the ground (the gateway) are notches in the bottom edge, not holes: a hole touching the
    // outline does not triangulate
    const notches = holes.filter(h => h.y0 <= 0.01).sort((p, q) => p.t - q.t);
    sh.moveTo(t0, 0);
    for (const h of notches) {
      const r = h.w / 2;
      sh.lineTo(h.t - r, 0);
      if (h.round) { sh.lineTo(h.t - r, h.h - r); sh.absarc(h.t, h.h - r, r, Math.PI, 0, true); } else { sh.lineTo(h.t - r, h.h); sh.lineTo(h.t + r, h.h); }
      sh.lineTo(h.t + r, 0);
    }
    sh.lineTo(t1, 0);
    for (let i = cuts.length - 1; i > 0; i--) { const y = top((cuts[i] + cuts[i - 1]) / 2); sh.lineTo(cuts[i], y); sh.lineTo(cuts[i - 1], y); }
    sh.lineTo(t0, 0);
    for (const h of holes) if (h.y0 > 0.01) sh.holes.push(holePath(h));
    const geo = new T.ExtrudeGeometry(sh, {depth: SLAB_D, bevelEnabled: false, curveSegments: 8});
    // mitre the slab's ends inwards behind the front 0.3 m: a square end would lie in the plane of the next wall round the corner
    const pa = geo.getAttribute('position') as T.BufferAttribute;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), z = pa.getZ(i), back = SLAB_D - 0.3 - z;
      if (back <= 0) continue;
      if (x <= t0 + 1e-4) pa.setX(i, t0 + back * 0.7);
      else if (x >= t1 - 1e-4) pa.setX(i, t1 - back * 0.7);
    }
    put(k, f, geo, 0, 0, -SLAB_D, col);
  });
  return keep;
}

const SASH = {head: 'flat' as const, bars: 1, rowM: 0.7, surround: 'white' as Col, bar: 'white' as Col, glass: 'glass' as Col, sill: 'stone' as Col};
/** A pedimented dormer standing on the cornice, its front 0.15 m behind the wall plane: the roof (about 57 deg) rises
 *  0.23 m in that depth, so the whole sash clears the roof plane; slate cheeks and roof run 1.6 m back into it. */
function dormer(k: Kit, f: Frame, t: number, w = 1.1) {
  const FD = shift(f, -0.05), Y0 = EAVES - 0.07, TOP = Y0 + 1.82; // on the corona (top 7.38)
  slab(k, FD, t, Y0, w + 0.3, TOP - Y0, 0.1, 'stone', -0.1);
  for (const s2 of [-1, 1]) slab(k, f, t + s2 * (w / 2 + 0.02), Y0, 0.06, TOP - Y0, 1.65, 'slate', -1.75); // inside the panel's edge, behind the sash surround
  slab(k, f, t, TOP, w + 0.4, 0.1, 1.8, 'slate', -1.8);
  poly(k, FD, t, TOP, [[-(w + 0.34) / 2, 0], [(w + 0.34) / 2, 0], [0, 0.42]], 0.14, 'stone', 0);
  win(k, FD, t, {...SASH, w: w - 0.25, y0: Y0 + 0.62, y1: TOP - 0.18, surround: 'stone', bar: 'stone', sill: 'stone'});
}
/** Plinth and cornice along a front, split around the gate opening. */
function bands(k: Kit, f: Frame, t0: number, t1: number, skip: [number, number] | null = null) {
  const runs: [number, number][] = skip ? [[t0, skip[0]], [skip[1], t1]] : [[t0, t1]];
  for (const [a, z] of runs) if (z - a > 0.05) {
    onWall(k, f, (a + z) / 2, 0, z - a, 1.25, 0.08, 'concrete');
    onWall(k, f, (a + z) / 2, 1.25, z - a, 0.14, 0.13, 'stone');
  }
  onWall(k, f, (t0 + t1) / 2, 6.95, t1 - t0, 0.25, 0.12, 'stone');
  slab(k, f, (t0 + t1) / 2, 7.2, t1 - t0, 0.18, 0.32, 'stone', 0.005);
}
const pipe = (k: Kit, f: Frame, t: number, top = 7.0) => onWall(k, f, t, 0, 0.11, top, 0.16, 'concrete');

/** Two storeys of cream-framed windows on a terrain-side front (pitch and rows read on its crop). */
function grid(k: Kit, f: Frame & {len: number}, o: {ts: number[]; rows: [number, number][]; w: number; doors?: number[]; dormers?: number[]; top?: number}) {
  face(k, f, 0, f.len, o.top ?? EAVES, []);
  onWall(k, f, f.len / 2, 0, f.len, 0.45, 0.08, 'concrete');
  onWall(k, f, f.len / 2, 6.95, f.len, 0.25, 0.12, 'stone');
  slab(k, f, f.len / 2, 7.2, f.len, 0.18, 0.32, 'stone', 0.005);
  for (const t of o.ts) {
    const isDoor = o.doors?.some(d => Math.abs(d - t) < 0.3);
    for (const [ri, [y0, y1]] of o.rows.entries()) {
      if (isDoor && ri === 0) { door(k, f, t, {w: 1.0, y0: 0.45, y1: y1, leaf: 'dark', surround: 'stone'}); continue; }
      win(k, f, t, {...SASH, bars: 1, w: o.w, y0, y1});
    }
  }
  for (const t of o.dormers ?? []) dormer(k, f, t);
}

export function buildMarinekazerne(_w: number, _d: number, b: BuildingTools) {
  const k: Kit = b;


  // ---------------- the Kattenburgerstraat front (edges 30 and 0-3), t from the SW corner (vertex 30) ----------------
  const A = edgeFrame(R[30], R[0]), B = edgeFrame(R[0], R[4]);
  const T_B = A.len; // B starts at global t 48.83
  /** global front t (w03: t from vertex 30; w04: 54.24 + its t) to [frame, local t] */
  const at = (t: number): [Frame, number] => (t < T_B ? [A, t] : [B, t - T_B]);
  const pitch = (k0: number, n: number) => Array.from({length: n}, (_, i) => +(k0 + 2.035 * i).toFixed(2));
  const K = pitch(8.84, 13); // w03 rhythm 8.84 ... 33.26
  const LOW = {y0: 2.45, h: 1.85, w: 0.95}, UP = {y0: 5.0, h: 0.75, w: 0.85};
  const lowerWin = [K[0], K[1], K[2], K[3], K[4], K[6], K[8], K[10], K[12], 71.5, 73.5, 79.7, 83.7, 85.7, 89.7];
  const lowerNiche = [0.7, 2.75, 4.8, 75.6, 77.6, 93.8, 95.8, 97.9, 99.9, 102.0, 104.0];
  const upperWin = [K[0], K[2], K[4], K[6], K[8], K[10], K[12], 71.5, 73.5, 77.6, 79.7, 83.7, 85.7, 89.7, 93.8, 97.9, 102.0];
  const upperNiche = [0.7, 4.8, K[1], K[3], K[5], K[7], K[9], K[11], 75.6, 81.7, 87.7, 91.7, 95.8, 99.9, 104.0];
  const arches = [37.4, 41.4, 45.4, 59.2, 63.2, 67.2];
  const GATE = 52.3, GW = 3.0, GH = 5.4; // gateway opening: 3.0 m wide, crown 5.4 m
  const holesA: Hole[] = [], holesB: Hole[] = [];
  const hole = (t: number, h: Omit<Hole, 't'>) => { const [f, lt] = at(t); (f === A ? holesA : holesB).push({t: lt, ...h}); };
  for (const t of lowerNiche) hole(t, {y0: LOW.y0, h: LOW.h, w: LOW.w});
  for (const t of upperNiche) hole(t, {y0: UP.y0, h: UP.h, w: UP.w});
  for (const t of arches) hole(t, {y0: 1.45, h: 3.45, w: 1.3, round: true});
  holesB.push({t: GATE - T_B, y0: 0, h: GH, w: GW, round: true});
  face(k, A, 0, A.len, EAVES, holesA);
  face(k, B, 0, B.len, EAVES, holesB);
  for (const t of lowerWin) { const [f, lt] = at(t); win(k, f, lt, {...SASH, bars: 1, w: LOW.w, y0: LOW.y0, y1: LOW.y0 + LOW.h}); }
  for (const t of upperWin) { const [f, lt] = at(t); win(k, f, lt, {...SASH, bars: 0, w: UP.w, y0: UP.y0, y1: UP.y0 + UP.h}); }
  bands(k, A, 0, A.len);
  bands(k, B, 0, B.len, [GATE - T_B - GW / 2 - 0.05, GATE - T_B + GW / 2 + 0.05]);
  for (const t of [5.5, 21.9, 34.7, 82.7, 99.1]) { const [f, lt] = at(t); pipe(k, f, lt); }
  for (const t of [6.8, 10.9, 14.97, 19.04, 23.1, 27.2, 31.25, 41.3, 45.4, 59.2, 63.3, 73.6, 77.6, 81.8, 85.9, 89.9, 94.0, 98.2, 102.4]) {
    const [f, lt] = at(t); dormer(k, f, lt);
  }

  // ---------------- the gate frontispiece (on B, centre 52.3) ----------------
  {
    const g = GATE - T_B, f = B;
    // the gateway: dark doors set back in the opening, sandstone arch ring, keystone and imposts
    // six vertical boards under the arch (separate leaves, 3 cm apart), so each reads as a door on the passage's back
    {
      const r = GW / 2 + 0.01, yS = GH - r;
      for (let i = 0; i < 6; i++) {
        const a = -r + i * (2 * r / 6) + 0.015, z = a + 2 * r / 6 - 0.03;
        const arc = Array.from({length: 5}, (_, j) => { const x = z + (a - z) * j / 4; return [x, yS + Math.sqrt(Math.max(0, r * r - x * x))] as [number, number]; });
        poly(k, f, g, 0, [[a, 0], [z, 0], ...arc], 0.12, 'dark', -0.42);
      }
    }
    slab(k, f, g, 0, GW + 0.3, GH + 0.1, 0.12, 'greyBrick', -0.6); // the passage's back, behind the leaves
    archBand(k, f, g, 0, GW + 0.5, GH + 0.25, 0.25, 0.14, 'stone', -0.04);
    onWall(k, f, g, GH - 0.05, 0.42, 0.62, 0.22, 'stone'); // keystone
    for (const s2 of [-1, 1]) onWall(k, f, g + s2 * (GW / 2 + 0.12), GH - GW / 2 - 0.22, 0.42, 0.22, 0.2, 'stone'); // imposts
    // two pairs of brick pilasters on sandstone pedestals, sandstone capitals
    for (const s2 of [-1, 1]) for (const d of [1.95, 3.1]) {
      const t = g + s2 * d;
      onWall(k, f, t, 0, 0.66, 1.45, 0.24, 'stone');
      onWall(k, f, t, 1.45, 0.5, 4.3, 0.14, 'brick');
      onWall(k, f, t, 5.75, 0.66, 0.35, 0.22, 'stone');
    }
    // carved frieze over the frontispiece: a sandstone band with triglyph blocks
    onWall(k, f, g, 6.1, 7.0, 0.85, 0.16, 'stone');
    for (let x = -3.25; x <= 3.26; x += 0.65) onWall(k, f, g + x, 6.2, 0.2, 0.62, 0.22, 'stone');
    // pediment: cornice, tympanum with the crest relief, raking cornices; it stands into the roof behind
    slab(k, f, g, 6.95, 7.6, 0.3, 0.48, 'stone', -0.04);
    poly(k, f, g, 7.25, [[-3.7, 0], [3.7, 0], [0, 1.85]], 1.1, 'stone', -1.0);
    const rise = 1.85, half = 3.7, ang = Math.atan2(rise, half), len = Math.hypot(rise, half) + 0.3;
    for (const s2 of [-1, 1]) {
      const geo = new T.BoxGeometry(len, 0.24, 0.5).translate(0, 0.12, 0.25).rotateZ(-s2 * ang);
      put(k, f, geo, g + s2 * (half / 2), 7.25 + rise / 2 - 0.05, -0.2, 'stone');
    }
    // relief: an oval crest in the middle, trophies (rolled banners) either side
    put(k, f, new T.CylinderGeometry(0.42, 0.42, 0.14, 14).rotateX(Math.PI / 2).scale(1, 1.3, 1).translate(0, 0, 0.17), g, 7.95, -0.05, 'stone');
    for (const s2 of [-1, 1]) {
      poly(k, f, g + s2 * 1.35, 7.4, [[-0.75, 0], [0.75, 0], [s2 > 0 ? -0.75 : 0.75, 0.55]].map(p => [p[0], p[1]] as [number, number]), 0.14, 'stone', 0.06);
      put(k, f, new T.SphereGeometry(0.16, 8, 6).scale(1, 1, 0.6), g + s2 * 0.75, 7.55, 0.15, 'stone');
    }
  }

  // ---------------- the corner front (edge 4), t from vertex 4 ----------------
  {
    const C = edgeFrame(R[4], R[5]), Cm = 62.5; // the low range to 61.7 m, then the taller NE block
    const cHoles: Hole[] = [
      {t: 34.6, y0: 4.65, w: 0.9, h: 0.9, circle: true}, {t: 37.9, y0: 4.65, w: 0.9, h: 0.9, circle: true}, // blind oculi
      {t: 44.0, y0: 3.9, w: 0.9, h: 2.2}, {t: 46.4, y0: 3.9, w: 0.9, h: 2.2}, // tall upper niches
    ];
    face(k, C, 0, Cm, EAVES, cHoles);
    bands(k, C, 0, Cm);
    for (const t of [22.6, 25.1, 31.2, 33.6, 39.8, 48.5, 50.9, 56.9]) win(k, C, t, {...SASH, bars: 0, w: 0.85, y0: 4.85, y1: 5.5});
    for (const t of [13.5, 25.1, 27.5, 33.7, 39.8, 44.0, 46.0, 56.2]) win(k, C, t, {...SASH, bars: 0, w: 0.9, y0: 1.75, y1: 2.35});
    // the two tall windows: the left pavilion and under the third dormer (photo x 400 and 818 at 45 px/m)
    for (const t of [8.9, 18.2]) win(k, C, t, {...SASH, bars: 1, w: 0.9, y0: 3.2, y1: 4.9});
    for (const t of [2.4, 8.2, 18.2, 36.6, 56.9]) dormer(k, C, t);
    for (const t of [11.2, 26.3, 40.9]) pipe(k, C, t);
    // the taller block at the north-east end: two large dark-framed windows one above the other
    const CB = shift(C, -FACE);
    for (const [y0, y1] of [[2.7, 5.7], [7.3, 8.9]] as [number, number][]) win(k, CB, 71.15, {head: 'flat', bars: 1, rowM: 1.5, w: 1.25, y0, y1, surround: 'dark', bar: 'frame', glass: 'glass', sill: 'concrete'});
  }

  // ---------------- terrain-side fronts ----------------
  const inner = (i: number, j: number) => edgeFrame(R[i], R[j]);
  // w02-314 (edge 11): 31 bays on a 1.84 m pitch, ground and first floor, four doors, dormers (28.9 px/m crop)
  {
    const f = inner(11, 12), n = Math.floor((f.len - 1.2) / 1.84) + 1, ts = Array.from({length: n}, (_, i) => +(0.9 + i * 1.84).toFixed(2));
    grid(k, f, {ts, rows: [[0.6, 2.75], [4.3, 6.5]], w: 0.95, doors: [4.6, 21.2, 32.3, 45.2].map(d => ts.reduce((p, c) => (Math.abs(c - d) < Math.abs(p - d) ? c : p))), dormers: [6.6, 10.4, 19.7, 23.5, 31.0, 34.6, 43.9, 47.8, 55.2].filter(t => t < f.len - 1)});
  }
  // w05-332 (edge 23): 16 bays, lower and upper windows; a door near the middle (39.8 px/m crop)
  {
    const f = inner(23, 24), ts = Array.from({length: 16}, (_, i) => +(1.6 + i * 2.75).toFixed(2)).filter(t => t < f.len - 0.8);
    grid(k, f, {ts, rows: [[0.7, 2.6], [3.3, 5.0]], w: 1.0, doors: [ts[7]], dormers: [10.8, 18.6, 31.5].filter(t => t < f.len - 1)});
  }
  // w06-332 (edge 19): 12 bays on 2.0 m, cross windows, the door with its sandstone frame at 16.3 m (72 px/m crop)
  {
    const f = inner(19, 20), ts = [2.5, 4.5, 6.4, 8.3, 10.25, 12.25, 14.3, 16.3, 18.3, 20.3, 22.3, 24.2].filter(t => t < f.len - 0.6);
    grid(k, f, {ts, rows: [[1.0, 3.1], [4.8, 6.7]], w: 1.15, doors: [16.3], dormers: [6.2, 14.9, 22.6]});
    onWall(k, f, 16.3, 4.3, 2.0, 0.3, 0.22, 'stone'); // cornice over the door frame
  }
  // w08-64 (edge 24, the SW pavilion's side): six bays, two storeys, dormers
  {
    const f = inner(24, 25), ts = Array.from({length: 6}, (_, i) => +(2.0 + i * (f.len - 4.0) / 5).toFixed(2));
    grid(k, f, {ts, rows: [[0.8, 2.7], [3.9, 5.9]], w: 0.95, doors: [ts[2]], dormers: [ts[0], ts[2], ts[3], ts[5]]});
  }
  // w10-334 (edge 13): six bays and a door
  {
    const f = inner(13, 14), ts = Array.from({length: 6}, (_, i) => +(1.3 + i * (f.len - 2.6) / 5).toFixed(2));
    grid(k, f, {ts, rows: [[0.8, 2.7], [3.9, 5.9]], w: 0.95, doors: [ts[2]], dormers: [ts[0], ts[4]]});
  }
  // w12-332 (edge 16): two bays and a door
  {
    const f = inner(16, 17);
    grid(k, f, {ts: [1.6, f.len / 2, f.len - 1.6], rows: [[0.9, 2.8], [4.0, 6.0]], w: 1.0, doors: [f.len / 2]});
  }

  // ---------------- massing: 3DBAG LoD2.2 shell, brick under a tiled roof ----------------
  addShell(b, {surfaces: finishFaces(S.shellNative), nativeRing: []}, {wall: 'brick', roof: 'slate'});
}

