import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archSlab, awning, disc, getSink, letters, poly, ringFrame, ringSlab, segBand, setSink, slab, type Frame} from './nearbar-kit';
import source from './sphinx-hotel-footprints.json';

/**
 * HOTEL SPHINX, WETERINGSCHANS (BAG pand 0363100012179513, BAG year 1922, "verbouwing"): two late nineteenth-century
 * houses on one pand, the hotel's front on the Weteringschans. No monument record. Read from the rectified Gemeente
 * Amsterdam panoramas recording_2025-07-14_07-34-51_00639 (2025, frontal, overcast; w03-6.alt.jpg, 50 px/m) and
 * TMX7316010203-001048_pano_0000_000480 (2019, frontal), CC BY 4.0. Photo x maps to the front from its east end
 * (t = x / 50; the photo's left is east); heights h = (1000 - y) * 0.0207 with the pavement at y 1000, fitted between the
 * 3DBAG's 17.0 m flat roof on the east house and its 21.0 m gable apex.
 *
 *  - East house (t 0-6.0): dark brown brick over a black basement, three axes of round-headed windows with white keystones
 *    and white jamb blocks on four storeys (the ground storey's east axis is the entrance: a white aedicule with an oculus
 *    over a dark door), thin stone bands at the sills, a white entablature with frieze panels at the top.
 *  - West house (t 6.0-12.3): red brick laced with white bands (speklagen), three axes of tall windows under segmental
 *    heads with white keystones and blocks, French doors with balconies on the middle axis of the second and third
 *    storeys, the HOTEL blade sign, a red awning over the hotel door in the west bay with a paired-light aedicule above,
 *    and the pointed gable with its attic window under a white coping. The 3DBAG gable is lopsided (apex at t 8.95, bases
 *    at 5.89 and 11.52, 50 and 59 deg); the photo's is symmetric (52 deg, bases 6.0 and 12.0, apex 9.0), so the coping
 *    and the gable field follow the photo and the 3DBAG's surplus on the left slope is drawn as roof behind it.
 * The east side wall (w01-96) is a party wall that stood sheeted over a building site in 2022 and 2024: drawn as the
 * shell in the east house's brick. The back (w02-186) has no panorama: shell.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const FR = ringFrame(src.facadeRing, 6);
const F0 = FR.f, L = FR.len;
const shifted = (f: Frame, k: number): Frame => ({origin: [f.origin[0] + f.n[0] * k, f.origin[1] + f.n[1] * k], tangent: f.tangent, n: f.n});
/** The 3DBAG front is not one plane: the east house stands 5 cm behind the ring line, the west house 1-4 cm proud. */
let F = F0;
const K = 0.0207;
const h = (y: number) => +((1000 - y) * K).toFixed(3);
const SPLIT = 6.0;
const EAST_AXES = [1.25, 3.0, 4.75];
const WEST_AXES = [7.14, 9.03, 10.86];
const APEX = 21.0, EAVES = 16.8, G0 = 6.0, G1 = 12.0, GC = 9.0;
const gableY = (t: number) => EAVES + (APEX - EAVES) * (1 - Math.abs(t - GC) / (GC - G0));
type Col = 'brick' | 'greyBrick' | 'white' | 'stone' | 'dark' | 'glass' | 'frame' | 'bronze' | 'slate' | 'red' | 'blue' | 'concrete';

/** Native x of a front position t, to colour the shell's walls by house. */
const xAt = (t: number) => F0.origin[0] + F0.tangent[0] * t;

export function buildSphinxHotel(_w: number, _d: number, b: BuildingTools) {
  const splitX = xAt(5.8);
  addShell(b, src as never, {
    wall: 'brick', roof: 'slate',
    // east house (x east of the split) in its dark brown brick; west house red
    wallFor: s => { const r = s.rings[0]; const cx = r.reduce((a, p) => a + p[0], 0) / r.length; return cx > splitX ? 'greyBrick' : 'brick'; },
  });
  const sink0 = getSink();
  setSink(0.04);
  F = shifted(F0, -0.05);
  eastHouse(b);
  F = shifted(F0, 0.04);
  westHouse(b);
  F = F0;
  setSink(sink0);
}

/** Glass and white frames 7-14 cm proud of the wall; brick reveals are the 3DBAG wall (the audit's 3 cm layer rule). */
function glazing(b: BuildingTools, t: number, y0: number, y1: number, w: number, arched: boolean, transom: number | null) {
  if (arched) archSlab(b, F, t, y0, w, y1 - y0, 0.02, 'glass', 0.07, 10);
  else slab(b, F, t, y0, w, y1 - y0, 0.02, 'glass', 0.07);
  for (const s of [-1, 1]) slab(b, F, t + s * (w / 2 - 0.08), y0, 0.08, (arched ? y1 - w / 2 : y1) - y0, 0.05, 'frame', 0.09);
  slab(b, F, t, y0, 0.06, (arched ? y1 - w / 2 : y1) - y0, 0.05, 'frame', 0.09);
  if (transom) slab(b, F, t, transom, w, 0.06, 0.05, 'frame', 0.09);
  if (!arched) slab(b, F, t, y1 - 0.06, w, 0.06, 0.05, 'frame', 0.09);
  // stone sill
  slab(b, F, t, y0 - 0.1, w + 0.2, 0.1, 0.16, 'white');
}

function eastHouse(b: BuildingTools) {
  // black basement and the plinth band (2025)
  slab(b, F, 2.955, 0, 5.81, 1.9, 0.08, 'dark');
  slab(b, F, 2.94, 1.9, 5.84, 0.1, 0.14, 'white');
  // stone bands at the sills of the upper storeys
  const rows: [number, number][] = [[h(900), h(775)], [h(711), h(586)], [h(518), h(414)], [h(350), h(257)]];
  for (const [y0] of rows.slice(1)) slab(b, F, 2.94, y0 - 0.24, 5.84, 0.12, 0.1, 'white');
  rows.forEach(([y0, y1], r) => {
    for (const t of EAST_AXES) {
      if (r === 0 && t === EAST_AXES[0]) continue; // the entrance aedicule
      const w = 1.08;
      glazing(b, t, y0, y1, w, true, y1 - w / 2 - 0.05);
      // white keystone and four jamb blocks a side (alternating long/short, 2025)
      slab(b, F, t, y1 + 0.01, 0.24, 0.34, 0.12, 'white');
      for (let k = 0; k < 4; k++) {
        const y = y0 + (k + 0.3) * (y1 - w / 2 - y0) / 4.2 + (k === 3 ? 0.35 : 0);
        for (const s of [-1, 1]) slab(b, F, t + s * (w / 2 + 0.12 + (k % 2 ? 0 : 0.04)), y, k % 2 ? 0.2 : 0.28, 0.13, 0.1, 'white');
      }
      // brick relieving arch over the head
      segBand(b, F, t, y1 - w / 2 + 0.05, w + 0.5, w / 2 + 0.25, 0.18, 0.05, 'greyBrick');
    }
  });
  // basement lights under axes 2 and 3: segmental heads, bars
  for (const t of EAST_AXES.slice(1)) {
    slab(b, F, t, 0.12, 1.16, 0.95, 0.02, 'glass', 0.1);
    for (let k = 1; k < 8; k++) slab(b, F, t - 0.58 + k * 1.16 / 8, 0.12, 0.03, 0.95, 0.03, 'bronze', 0.13);
    segBand(b, F, t, 1.0, 1.3, 0.18, 0.14, 0.12, 'white');
  }
  // entrance: dark door under a white aedicule with an oculus and a semicircular pediment (2025)
  const t = EAST_AXES[0];
  slab(b, F, t, 0, 0.98, 2.95, 0.1, 'dark');
  slab(b, F, t, 1.95, 0.6, 0.85, 0.04, 'glass', 0.1);
  for (const s of [-1, 1]) slab(b, F, t + s * 0.6, 0, 0.22, 3.0, 0.14, 'white');
  slab(b, F, t, 2.95, 1.6, 0.25, 0.22, 'white');
  slab(b, F, t, 3.2, 1.35, 1.2, 0.12, 'white');
  for (const s of [-1, 1]) slab(b, F, t + s * 0.72, 3.15, 0.2, 1.3, 0.2, 'white');
  disc(b, F, t, 3.75, 0.3, 0.06, 'glass', 0.12);
  ringSlab(b, F, t, 3.75, 0.3, 0.4, 0.08, 'white', 0.12, 16);
  slab(b, F, t, 4.4, 1.7, 0.14, 0.26, 'white');
  archSlab(b, F, t, 4.54, 1.5, 0.75, 0.18, 'white', 0, 10);
  // the white entablature: architrave, frieze with sunk panels, projecting cornice (2025: y 168-214)
  slab(b, F, 2.94, h(214), 5.84, 0.14, 0.12, 'concrete');
  slab(b, F, 2.94, h(214) + 0.14, 5.84, h(178) - h(214) - 0.14, 0.08, 'concrete');
  for (let k = 0; k < 7; k++) slab(b, F, 0.45 + k * (SPLIT - 0.9) / 6, h(205), 0.22, h(185) - h(205), 0.16, 'concrete');
  slab(b, F, 2.94, h(178), 5.84, 17.12 - h(178), 0.35, 'concrete');
}

function westHouse(b: BuildingTools) {
  const W0 = SPLIT, W1 = L, wc = (W0 + W1) / 2, ww = W1 - W0;
  // stone plinth
  slab(b, F, wc, 0, ww, 1.25, 0.06, 'stone');
  // speklagen: white bands every 0.72 m up the front and into the gable (2025), broken by the openings
  const openings: [number, number, number, number][] = []; // t0, t1, y0, y1
  const win = (t: number, y0: number, y1: number, w: number) => openings.push([t - w / 2 - 0.08, t + w / 2 + 0.08, y0 - 0.12, y1 + 0.35]);
  const rows: [number, number][] = [[h(904), h(793)], [h(736), h(614)], [h(568), h(450)], [h(400), h(279)]];
  rows.forEach(([y0, y1], r) => WEST_AXES.forEach((t, i) => { if (!(r === 0 && i === 2)) win(t, r > 0 && r < 3 && i === 1 ? y0 - 0.55 : y0, y1, 1.12); }));
  win(GC, h(239), h(146), 1.0);
  openings.push([10.05, W1, 0, 4.7]); // the hotel door, awning and aedicule bay
  for (let y = 1.5; y < APEX - 0.6; y += 0.72) {
    const top = (t: number) => (t < G0 || t > G1 ? EAVES : gableY(t));
    // run between the openings and inside the gable outline
    const lo = y > EAVES ? G0 + (y - EAVES) / (APEX - EAVES) * (GC - G0) + 0.15 : W0 + 0.02;
    const hi = y > EAVES ? G1 - (y - EAVES) / (APEX - EAVES) * (G1 - GC) - 0.15 : W1 - 0.02;
    // and under the 3DBAG's right slope (apex t 8.95 at 21.0 m to t 11.52 at 16.77 m), which is lower than the photo's
    const hiBag = y > 16.77 ? 8.95 + (21.0 - y - 0.12) / (21.0 - 16.77) * (11.52 - 8.95) - 0.1 : hi;
    const hiB = Math.min(hi, hiBag);
    if (hiB - lo < 0.3 || y + 0.12 > top((lo + hi) / 2)) continue;
    const cuts = openings.filter(o => y + 0.12 > o[2] && y < o[3]).map(o => [o[0], o[1]] as [number, number]).sort((p, q) => p[0] - q[0]);
    let p0 = lo;
    for (const [c0, c1] of [...cuts, [hiB, hiB] as [number, number]]) {
      const e = Math.min(c0, hiB);
      if (e - p0 > 0.12) slab(b, F, (p0 + e) / 2, y, e - p0, 0.12, 0.06, 'white');
      p0 = Math.max(p0, c1);
    }
  }
  // windows: tall sashes with transoms under segmental heads, white keystone and three white blocks (2025)
  rows.forEach(([y0, y1], r) => WEST_AXES.forEach((t, i) => {
    if (r === 0 && i === 2) return;
    const french = r > 0 && r < 3 && i === 1;
    const yb = french ? y0 - 0.55 : y0;
    glazing(b, t, yb, y1, 1.12, false, y1 - 0.75);
    head(b, t, y1, 1.12);
    if (french) balcony(b, t, yb);
  }));
  // gable attic window with its small lintel ornament
  glazing(b, GC, h(239), h(146), 1.0, false, null);
  slab(b, F, GC, h(146), 1.2, 0.18, 0.12, 'white');
  slab(b, F, GC, h(146) + 0.18, 0.9, 0.16, 0.08, 'stone');
  // basement lights under axes 1 and 2
  for (const t of WEST_AXES.slice(0, 2)) {
    slab(b, F, t, 0.12, 1.1, 1.0, 0.02, 'glass', 0.09);
    for (let k = 1; k < 7; k++) slab(b, F, t - 0.55 + k * 1.1 / 7, 0.12, 0.03, 1.0, 0.03, 'bronze', 0.11);
    head(b, t, 1.12, 1.1);
  }
  // the hotel door bay: door, red awning, paired round-headed lights in a white aedicule (2025)
  const td = 11.05;
  slab(b, F, td, 0, 1.0, 2.15, 0.1, 'white');
  slab(b, F, td, 0.05, 0.84, 1.1, 0.05, 'frame', 0.1);
  slab(b, F, td, 1.15, 0.84, 0.9, 0.05, 'glass', 0.1);
  for (const s of [-1, 1]) slab(b, F, td + s * 0.75, 0, 0.3, 2.2, 0.18, 'white');
  awning(b, F, (10.1 + W1) / 2, 2.15, W1 - 10.1, 0.62, 0.95, 'red');
  slab(b, F, td, 2.95, 1.45, 0.14, 0.2, 'white');
  for (const s of [-1, 1]) {
    archSlab(b, F, td + s * 0.27, 3.1, 0.36, 1.15, 0.02, 'glass', 0.07, 8);
    slab(b, F, td + s * 0.62, 3.1, 0.16, 1.3, 0.16, 'white');
  }
  slab(b, F, td, 3.1, 0.14, 1.15, 0.12, 'white');
  slab(b, F, td, 4.4, 1.5, 0.16, 0.22, 'white');
  disc(b, F, td, 4.75, 0.17, 0.12, 'white', 0.05);
  // the HOTEL blade sign on the middle axis (2025: blue letters on white, h 4.7-9.5)
  blade(b);
  // the gable's white coping (symmetric, after the photo) with the 3DBAG roof's surplus on the left drawn as roof
  coping(b);
  // white band at the eaves line, across the house
  slab(b, F, wc, h(225), ww, 0.14, 0.12, 'concrete');
}

/** Segmental head over a window: brick arch band, white keystone and two white blocks a side. */
function head(b: BuildingTools, t: number, y1: number, w: number) {
  segBand(b, F, t, y1 + 0.05, w + 0.3, 0.22, 0.2, 0.1, 'brick');
  slab(b, F, t, y1 + 0.08, 0.2, 0.34, 0.12, 'white');
  for (const s of [-1, 1]) for (const k of [0.32, 0.6]) slab(b, F, t + s * k, y1 + 0.1 - (k > 0.5 ? 0.06 : 0), 0.18, 0.16, 0.1, 'white');
}

function balcony(b: BuildingTools, t: number, y: number) {
  slab(b, F, t, y - 0.14, 1.7, 0.14, 0.45, 'white');
  const out = 0.4;
  slab(b, F, t, y + 0.95, 1.6, 0.05, 0.05, 'bronze', out);
  slab(b, F, t, y + 0.05, 1.6, 0.04, 0.05, 'bronze', out);
  for (let k = 0; k <= 12; k++) slab(b, F, t - 0.8 + k * 1.6 / 12, y, 0.025, 1.0, 0.025, 'bronze', out + 0.01);
  for (const s of [-1, 1]) slab(b, F, t + s * 0.8, y, 0.03, 1.0, out, 'bronze');
}

function blade(b: BuildingTools) {
  const t = 8.3, y0 = 4.75, y1 = 9.45, out = 0.75;
  for (const y of [y0 + 0.3, y1 - 0.3]) slab(b, F, t, y, 0.06, 0.06, out - 0.3, 'bronze');
  const o: [number, number] = [F.origin[0] + F.tangent[0] * t, F.origin[1] + F.tangent[1] * t];
  // the blade's faces look along the street, east (s = 1) and west (s = -1); its width runs out from the wall
  for (const s of [-1, 1]) {
    const B: Frame = {origin: o, tangent: [s * F.n[0], s * F.n[1]], n: [-s * F.tangent[0], -s * F.tangent[1]]};
    if (s > 0) slab(b, B, out, y0, 0.6, y1 - y0, 0.12, 'white', -0.06);
    for (const v of [-0.27, 0.27]) slab(b, B, out + v, y0, 0.05, y1 - y0, 0.04, 'blue', 0.1);
    ['H', 'O', 'T', 'E', 'L'].forEach((ch, i) => letters(b, B, ch, out, y1 - 0.2 - (i + 1) * 0.85, 0.06, 0.09, 0.04, 'blue', 0.1));
  }
}

function coping(b: BuildingTools) {
  // gable field: brick up to the photo's outline where the 3DBAG's is lower (the right slope), flush with the shell
  poly(b, F, 0, 0, [[9.0, APEX], [11.52, gableY(11.52)], [11.52, 16.77], [9.05, 21.0]], 0.3, 'brick', -0.3);
  // roof in front of the 3DBAG's higher left slope, so the coping reads symmetric
  poly(b, F, 0, 0, [[5.89, gableY(5.89) - 0.08], [8.95, gableY(8.95) - 0.08], [8.95, 21.0], [5.89, 17.3]], 0.05, 'slate');
  // the coping: a white board on each slope, 0.4 m deep on the face, from the eaves to the apex (2025)
  const th = 0.4;
  for (const sd of [-1, 1]) {
    const x0 = sd < 0 ? G0 - 0.3 : G1 + 0.3, y0 = gableY(sd < 0 ? G0 : G1) - 0.3 * (APEX - EAVES) / (GC - G0) - 0.05;
    const pts: [number, number][] = [[x0, y0], [GC, APEX + 0.02], [GC, APEX + 0.02 + th], [x0, y0 + th]];
    poly(b, F, 0, 0, sd < 0 ? pts : pts.slice().reverse(), 0.28, 'concrete', 0.05);
  }
  slab(b, F, GC, APEX + 0.3, 0.12, 0.9, 0.12, 'bronze', 0.1);
}
