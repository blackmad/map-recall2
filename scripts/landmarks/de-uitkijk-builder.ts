import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {letters, poly, setSink, slab} from './nearbar-kit';
import {frameAt, makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import {border} from './cut-face';
import {clipRingByLine, clipRingByY, cutFrontWalls, segDist, TriSink, type XZ} from './venue-kit';
import source from './de-uitkijk-footprints.json' with {type: 'json'};

/**
 * Filmtheater De Uitkijk, Prinsengracht 452 (BAG pand 0363100012169642, bouwjaar 1902): a canal house turned cinema
 * in 1913, the oldest cinema in Amsterdam still running. The 5.6 m canal front is drawn from rectified Gemeente
 * Amsterdam panoramas (CC BY 4.0, venue-face-crops.ts at 50 px/m): TMX7316010203-003011_pano_0001_000174 (2023-03-27),
 * b_20250120_0926_Track24_Sphere_00008 (2025-01-20), TMX7316010203-001974_pano_0000_001049 (2021) and the close
 * TMX7316010203-001900_pano_0004_000886 (2020). Painted grey stucco:
 *  - ground floor: red double doors under a round fanlight in a cream frame, poster cases either side;
 *  - the white letter-board canopy (2.25-3.05 m) reading FILMTHEATER DE UITKIJK over rows of film titles;
 *  - the poster storey: a 2.8 m framed film poster between two small round-headed windows;
 *  - first floor: three tall windows with round heads and small-paned upper lights, a cornice at 10 m;
 *  - the pointed gable (shoulders 11.05 m, apex 14.3 m) with a two-light window, two anchor plates and a pinnacle.
 * 3DBAG LoD2.2 (CC BY 4.0) keeps the auditorium behind; its flat 14.9 m roof over the front house is the gable's own
 * points (the photos show sky over the rakes), so the front house gets a pitched roof behind the drawn gable.
 *
 * Native frame of de-uitkijk-footprints.json (x east, z south, y up from the pavement); chord ring vertex 0 to 1.
 */
type Shell = {nativeRing: XZ[]; surfaces: Surface[]};
const SRC = source as unknown as Shell;
const R = SRC.nativeRing;
const ST: Chord = {a: R[0], b: R[1]};
const L = Math.hypot(R[1][0] - R[0][0], R[1][1] - R[0][1]);
const stF = frameAt(ST, 0, 0);
const MID = L / 2;
const FOOT = 10.05, SHOULDER = 11.05, APEX = 14.3, HOUSE_D = 10.15, RIDGE = 14.0;

type Ctx = {K: FrontKit; b: BuildingTools; M: TriSink};
const P3 = (s: number, y: number, o: number) => [stF.origin[0] + stF.tangent[0] * s + stF.n[0] * o, y, stF.origin[1] + stF.tangent[1] * s + stF.n[1] * o];
const at = (s: number, o = 0): XZ => [stF.origin[0] + stF.tangent[0] * s + stF.n[0] * o, stF.origin[1] + stF.tangent[1] * s + stF.n[1] * o];
const oOf = (p: number[]) => (p[0] - stF.origin[0]) * stF.n[0] + (p[2] - stF.origin[1]) * stF.n[1];
// the party walls splay a little: the house is 5.58 m at the front and 5.91 m at its back (ring vertices 6 and 2)
const sideS = (o: number): [number, number] => [-0.23 * -o / HOUSE_D, L + 0.1 * -o / HOUSE_D];
const pitchY = (s: number) => { const [l, r] = sideS(-HOUSE_D), m = (l + r) / 2; return RIDGE - Math.abs(s - m) * (RIDGE - SHOULDER) / ((r - l) / 2); };
const sOf = (p: number[]) => (p[0] - stF.origin[0]) * stF.tangent[0] + (p[2] - stF.origin[1]) * stF.tangent[1];

// ---- shell: the 3DBAG front wall goes, the front house's roof and party-wall tops come down under a pitched roof ----------
function shell(c: Ctx) {
  let cut = cutFrontWalls(SRC.surfaces, [R[0], R[1]], ST, [[-1, L + 1, 15.5]]);
  const back = (side: 1 | -1) => (side === 1 ? 1 : -1) as 1 | -1;
  // keep: the side of the line o = -HOUSE_D away from the canal (behind the front house)
  const a = at(0, -HOUSE_D), bb = at(1, -HOUSE_D), probe = at(0.5, -HOUSE_D - 1);
  const sideOf = (p: XZ) => Math.sign((bb[0] - a[0]) * (p[1] - a[1]) - (bb[1] - a[1]) * (p[0] - a[0])) as 1 | -1;
  const behind = back(sideOf(probe)), front = (-behind) as 1 | -1;
  const party = [[R[6], R[0]], [R[1], R[2]]] as const;
  const onParty = (s: Surface) => s.type === 'WallSurface' && s.rings[0].every(p => party.some(([q, r]) => segDist([p[0], p[2]], q, r).d <= 0.5));
  const out: Surface[] = [];
  for (const s of cut) {
    const r0 = s.rings[0];
    if (s.type === 'RoofSurface' && Math.max(...r0.map(oOf)) > -HOUSE_D + 0.3) {
      // the front house's roofs: only what lies behind the house depth stays
      const r = clipRingByLine(r0, a, bb, behind);
      if (r.length && Math.max(...r.map(p => p[1])) > 0 && Math.min(...r.map(oOf)) < -HOUSE_D - 0.05) {
        out.push({...s, rings: [r]});
        // close the cut: a wall on the house-depth line from the front house's roof up to the kept roof's edge
        const on = r.filter(p => Math.abs(oOf(p) + HOUSE_D) < 1e-3).sort((p, q) => sOf(p) - sOf(q));
        for (let i = 0; i + 1 < on.length; i++) {
          const [p, q] = [on[i], on[i + 1]];
          if (sOf(q) - sOf(p) < 0.02) continue;
          const [bl, br] = sideS(-HOUSE_D), lo = (u: number) => pitchY(Math.max(bl, Math.min(br, u)));
          c.M.quad('stone', [p[0], lo(sOf(p)), p[2]], [q[0], lo(sOf(q)), q[2]], [q[0], q[1], q[2]], [p[0], p[1], p[2]], [stF.n[0], 0, stF.n[1]]);
        }
      }
      continue;
    }
    if (onParty(s) && Math.max(...r0.map(oOf)) > -HOUSE_D) {
      const rb = clipRingByLine(r0, a, bb, behind);
      if (rb.length) out.push({...s, rings: [rb]});
      let rf = clipRingByLine(r0, a, bb, front);
      if (rf.length) rf = clipRingByY(rf, SHOULDER, -1);
      if (rf.length) out.push({...s, rings: [rf]});
      continue;
    }
    out.push(s);
  }
  cut = out;
  addShell(c.b, {surfaces: cut, nativeRing: R}, {wall: 'stone', roof: 'slate'});
  // pitched roof over the front house: eaves on the party walls at the shoulder height, ridge on the gable axis
  const o0 = -0.35, o1 = -HOUSE_D;
  const up = (sx: number) => [stF.tangent[0] * sx * 0.7, 1, stF.tangent[1] * sx * 0.7];
  const [fl, fr] = sideS(o0), [bl, br] = sideS(o1), fm = (fl + fr) / 2, bm = (bl + br) / 2;
  c.M.quad('slate', P3(fl, SHOULDER, o0), P3(fm, RIDGE, o0), P3(bm, RIDGE, o1), P3(bl, SHOULDER, o1), up(-1));
  c.M.quad('slate', P3(fr, SHOULDER, o0), P3(fm, RIDGE, o0), P3(bm, RIDGE, o1), P3(br, SHOULDER, o1), up(1));
  // rear gable of the front house against the auditorium
  c.M.tri('stone', P3(bl, SHOULDER, o1), P3(br, SHOULDER, o1), P3(bm, RIDGE, o1), [-stF.n[0], 0, -stF.n[1]]);
}

// ---- the canal front ---------------------------------------------------------------------------------------------------------
function front(c: Ctx) {
  const {K, b} = c;
  const S: Sec = K.sec(ST, 0, L, -0.3, FOOT, 'stone', 0);
  const f = K.faceFrame(S, 0);
  // ground floor: red doors under a round fanlight, poster cases
  K.opening(S, MID, 0, 1.7, 2.25, {frame: 'white', back: 'red', depth: 0.22, edge: 0.1, bars: [1.72], rise: 0.53, cols: 2});
  // the fanlight over the doors: a segment under the head, in front of the door back
  const W = 1.5, rise = 0.43, rad = (W * W / 4 + rise * rise) / (2 * rise);
  const seg: [number, number][] = [];
  for (let k = 0; k <= 12; k++) { const x = -W / 2 + W * k / 12; seg.push([x, Math.sqrt(rad * rad - x * x) - (rad - rise)]); }
  poly(b, f, MID, 1.76, seg, 0.03, 'glass', -0.17);
  for (const s of [0.72, L - 0.72]) {
    slab(b, f, s, 0.35, 0.9, 1.15, 0.08, 'slate');
    slab(b, f, s, 0.42, 0.78, 1.01, 0.06, 'blue', 0.08);
  }
  // the letter-board canopy
  slab(b, f, MID, 2.25, L - 0.3, 0.8, 0.55, 'sandstone');
  slab(b, f, MID, 3.05, L - 0.2, 0.06, 0.6, 'slate');
  letters(b, f, 'FILMTHEATER DE UITKIJK', MID, 2.8, 0.55, 0.034, 0.03, 'slate');
  // rows of film titles (they change weekly): word-length runs
  const words = [[0.9, 0.5, 1.1, 0.7, 0.6], [0.6, 1.2, 0.8, 0.5, 1.0]];
  words.forEach((row, j) => {
    let s = MID - (row.reduce((a, w) => a + w + 0.18, 0) - 0.18) / 2;
    for (const w of row) { slab(b, f, s + w / 2, 2.62 - j * 0.2, w, 0.1, 0.03, 'slate', 0.55); s += w + 0.18; }
  });
  // poster storey: the framed film poster, two small round-headed windows
  slab(b, f, MID, 3.3, 2.8, 2.75, 0.1, 'slate');
  slab(b, f, MID, 3.4, 2.6, 2.55, 0.06, 'blue', 0.1);
  for (const s of [0.72, L - 0.72]) K.opening(S, s, 3.6, 0.44, 1.25, {frame: 'white', back: 'glass', depth: 0.16, edge: 0.06, rise: 0.22, bars: [0.85]});
  slab(b, f, MID, 6.15, L, 0.18, 0.14, 'stone');
  // first floor: three round-headed windows with small-paned upper lights
  for (const s of [1.05, MID, L - 1.05]) {
    K.opening(S, s, 6.95, 1.12, 2.4, {frame: 'white', back: 'glass', depth: 0.18, edge: 0.07, cols: 2, rows: 1, bars: [1.55], rise: 0.3});
    slab(b, f, s, 6.83, 1.3, 0.1, 0.12, 'stone');
  }
  // entablature and cornice at the gable foot
  slab(b, f, MID, FOOT - 0.42, L, 0.3, 0.1, 'stone');
  slab(b, f, MID, FOOT - 0.12, L, 0.2, 0.28, 'stone');
}

// ---- the gable -------------------------------------------------------------------------------------------------------------
function gable(c: Ctx) {
  const {b} = c;
  const gf = frameAt(ST, 0, 0);
  const step = 0.22;
  const pts: [number, number][] = [[0, FOOT], [L, FOOT], [L, SHOULDER], [L - step, SHOULDER], [MID, APEX], [step, SHOULDER], [0, SHOULDER]];
  poly(b, gf, 0, 0, pts, 0.35, 'stone', -0.35);
  // rake copings and the shoulder caps
  const slope = (APEX - SHOULDER) / (MID - step);
  const dy = 0.16 * Math.hypot(1, slope);
  const rake = (t0: number, t1: number, y0: number, y1: number) => poly(b, gf, 0, 0, [[t0, y0 - 0.02], [t1, y1 - 0.02], [t1, y1 + dy], [t0, y0 + dy]], 0.5, 'stone', -0.4);
  rake(step - 0.06, MID, SHOULDER, APEX);
  rake(MID, L - step + 0.06, APEX, SHOULDER);
  slab(b, gf, step / 2, SHOULDER, step + 0.1, 0.14, 0.5, 'stone', -0.4);
  slab(b, gf, L - step / 2, SHOULDER, step + 0.1, 0.14, 0.5, 'stone', -0.4);
  // pinnacle on the apex
  slab(b, gf, MID, APEX - 0.1, 0.4, 0.75, 0.45, 'stone', -0.38);
  slab(b, gf, MID, APEX + 0.65, 0.5, 0.1, 0.52, 'stone', -0.41);
  // the two-light gable window and its frame
  slab(b, gf, MID, 11.55, 0.85, 1.0, 0.06, 'glass', 0);
  border(b, gf, MID, 11.55, 0.85, 1.0, 0.08, 0.1, 'white');
  slab(b, gf, MID, 11.55, 0.07, 1.0, 0.09, 'white', 0);
  slab(b, gf, MID, 11.47, 1.05, 0.08, 0.14, 'stone', 0);
  // anchor plates either side
  for (const s of [1.0, L - 1.0]) slab(b, gf, s, 10.8, 0.45, 0.14, 0.05, 'sandstone', 0);
}

export function buildDeUitkijk(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    const K = makeFrontKit(b, 0), M = new TriSink();
    const c: Ctx = {K, b, M};
    shell(c);
    front(c);
    gable(c);
    K.flush();
    M.flush(b);
  } finally {
    setSink(0);
  }
}
