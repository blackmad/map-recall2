import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, poly, put, ringFrame, segBand, setSink, slab, type Frame} from './nearbar-kit';
import {glyphRuns} from './mixed-case-glyphs';
import {balustrade} from '../../src/canalRecall/landmarks/balustrade';
import {arcFrame, domeProfile} from '../../src/canalRecall/landmarks/roundTower';
import {openRotunda} from '../../src/canalRecall/landmarks/openRotunda';
import source from './lloyd-prins-hendrikkade-33-footprints.json';

/**
 * PRINS HENDRIKKADE 33 (BAG pand 0363100012170961, BAG year 1921, rijksmonument 518433), now the art'otel: a stone and
 * yellow-brick office block on the corner opposite Centraal Station, with a round open belvedere over its rounded corner.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts). Its ring carries the giant pilasters of both
 * fronts (0.22 m proud) and the entrance risalit of number 33 (1.4 m proud of the east front); the 3DBAG blocks of the
 * corner belvedere are dropped and the belvedere is drawn here (openRotunda.ts).
 *
 * Read from the rectified Gemeente Amsterdam panoramas (CC BY 4.0), 50 px/m, heights h = (1169 - y) / 50:
 *  - east front (w02-63.alt.jpg, TMX7316060226-000030_pano_0006_000132, 2016, sunlit): the storey lines below;
 *  - north front (w01-341.jpg, 2025, and .alt 2022): axes, balconies, dormers and the end gables (a tram hides the ground
 *    storey; it is drawn as on the east front, which the corner views show continuing round);
 *  - the entrance bay of 33 (w04-61.jpg, recording_2025-06-16_06-42-40_02645);
 *  - the corner and the belvedere from aimed views of b_20250109_1300_Track01_Sphere_00091 (heading 122) and
 *    TMX7316060226-000030_pano_0006_000132 (heading 273).
 * Axis positions come from the BAG ring (the shell's pilasters), not the photo: the rectified east crop reads the bay
 * pitch 3.56 m against the ring's 3.73 m, a 5 % camera-distance error.
 */
type Src = {nativeRing: number[][]; facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const R = src.nativeRing, FR = src.facadeRing;
type Col = 'brick' | 'stone' | 'sandstone' | 'slate' | 'glass' | 'frame' | 'bronze' | 'dark' | 'concrete' | 'red' | 'greyBrick';

// ---- storey lines (east front 2016 crop) ----
const H = {
  cellar: [0.8, 2.1], ground: [3.0, 5.6], string: 6.5,
  w1: [7.1, 9.7], w2: [11.1, 13.6], w3: [14.6, 16.8],
  cap: [16.8, 17.5], frieze: [17.5, 18.8], cornice: [18.8, 20.1], attic: 20.9,
} as const;

/** Frame on the line through `a` along the unit tangent of (p -> q), its normal turned outward (n = (-tz, tx)). */
function frameAlong(a: number[], p: number[], q: number[]): Frame {
  const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz), tx = dx / L, tz = dz / L;
  return {origin: [a[0], a[1]], tangent: [tx, tz], n: [-tz, tx]};
}
/** North front: from the east corner (ring 0) westward; east front: from the south end (ring 83) northward. */
const FN = frameAlong(R[0], R[10], R[26]);
const FE = frameAlong(R[83], R[95], R[115]);
const proj = (F: Frame, p: number[]) => {
  const dx = p[0] - F.origin[0], dz = p[1] - F.origin[1];
  return {t: dx * F.tangent[0] + dz * F.tangent[1], o: dx * F.n[0] + dz * F.n[1]};
};
type Seg = {t0: number; t1: number; o: number};
/** The ring's runs parallel to a front between t0 and t1 (pilaster faces, bay recesses, strips), with their offset o. */
function segs(F: Frame, t0: number, t1: number): Seg[] {
  const out: Seg[] = [];
  for (let i = 0; i < R.length; i++) {
    const a = proj(F, R[i]), c = proj(F, R[(i + 1) % R.length]);
    if (Math.abs(a.o - c.o) > 0.06 || Math.abs(c.t - a.t) < 0.2 || Math.abs(a.o) > 2) continue;
    const lo = Math.max(Math.min(a.t, c.t), t0), hi = Math.min(Math.max(a.t, c.t), t1);
    if (hi - lo > 0.15) out.push({t0: lo, t1: hi, o: (a.o + c.o) / 2});
  }
  return out.sort((x, y) => x.t0 - y.t0);
}
/** Stone cladding stands this far proud of the shell (closer reads as z-fighting with the brick behind it). */
const CL = 0.1;
/** Cladding runs reach this far past their ring run's ends (into the neighbouring run's mass). */
const EXT = 0.08;
const oAt = (ss: Seg[], t: number) => (ss.find(s => t >= s.t0 - 0.01 && t <= s.t1 + 0.01) ?? ss[0]).o;

// north front: stone end bays 0-4.74 (window 0.92-3.52) and 20.95-25.81 (window 22.16-24.76), brick axes between
const N = {len: 25.81, stone: [[0, 4.74], [20.95, 25.81]] as [number, number][], stoneAxes: [2.22, 23.46], brickAxes: [5.945, 9.395, 12.85, 16.3, 19.75], balconies: [2.22, 9.395, 16.3, 23.46]};
// east front: entrance bay 0-7.5, brick axes 8.83-29.92, stone bay 29.92-34.8 (window 31.26-33.68)
const E = {len: 34.8, entrance: 7.5, stone: [[29.92, 34.8]] as [number, number][], stoneAxes: [32.47], brickAxes: [10.05, 13.78, 17.51, 21.24, 24.97, 28.7], balconies: [10.05, 17.51, 24.97, 32.47]};
const TOWER = {c: [4.3, -15.3] as [number, number], r: 2.0};

export function buildLloydPrinsHendrikkade33(_w: number, _d: number, b: BuildingTools) {
  // the 3DBAG blocks of the belvedere (all within 3 m of its axis and reaching above 25 m) give way to the drawn one
  addShell(b, src as never, {wall: 'brick', roof: 'slate', skip: s => {
    const pts = s.rings[0];
    const cx = pts.reduce((m, p) => m + p[0], 0) / pts.length, cz = pts.reduce((m, p) => m + p[2], 0) / pts.length;
    return Math.hypot(cx - TOWER.c[0], cz - TOWER.c[1]) < 3 && Math.max(...pts.map(p => p[1])) > 25;
  }});
  const sink0 = getSink();
  setSink(0.04, true);
  front(b, FN, N, true);
  front(b, FE, E, false);
  entranceBay(b);
  corner(b);
  belvedere(b);
  setSink(sink0);
}

/** A white-framed cross window with a transom at 70 % and small panes above it. */
function windowAt(b: BuildingTools, F: Frame, t: number, w: number, y0: number, y1: number, out: number, lights = 2) {
  slab(b, F, t, y0 - 0.06, w + 0.12, y1 - y0 + 0.12, 0.08, 'frame', out);
  slab(b, F, t, y0, w, y1 - y0, 0.12, 'glass', out);
  const tr = y0 + (y1 - y0) * 0.7;
  // glazing bars in the white of the frames but a trim material: the openings gate judges each loose bar as its own opening
  slab(b, F, t, tr, w, 0.07, 0.17, 'concrete', out);
  for (let k = 1; k < lights; k++) slab(b, F, t - w / 2 + (w * k) / lights, y0, 0.07, y1 - y0, 0.17, 'concrete', out);
}

/** Stone balustrade (balustrade.ts layout) standing at height y, centred at t; `knobs` puts ball finials on the posts. */
function balus(b: BuildingTools, F: Frame, t: number, y: number, w: number, h: number, out: number, bays = 1, knobs = false) {
  const L = balustrade({width: w, height: h, post: 0.24, plinth: 0.1, rail: 0.1, baluster: 0.1, pitch: 0.2, bays});
  slab(b, F, t, y, w, L.plinth.h, 0.3, 'stone', out);
  slab(b, F, t, y + L.rail.y, w + 0.06, L.rail.h, 0.32, 'stone', out);
  for (const p of L.posts) {
    slab(b, F, t + p.x, y, p.w, p.h + 0.05, 0.3, 'stone', out + 0.01);
    if (knobs) put(b, F, new T.SphereGeometry(0.16, 8, 6), t + p.x, y + p.h + 0.16, out + 0.16, 'stone');
  }
  for (const s of L.balusters) slab(b, F, t + s.x, y + s.y, s.w * 0.8, s.h, 0.12, 'stone', out + 0.08);
}

/** Wrought-iron balcony: a stone slab on two consoles and a dark railing panel with a top rail. */
function ironBalcony(b: BuildingTools, F: Frame, t: number, y: number, w: number, out: number) {
  slab(b, F, t, y - 0.16, w + 0.2, 0.16, 0.6, 'stone', out);
  for (const s of [-1, 1]) slab(b, F, t + s * (w / 2 - 0.1), y - 0.5, 0.16, 0.34, 0.4, 'stone', out);
  slab(b, F, t, y + 0.05, w - 0.1, 0.5, 0.03, 'bronze', out + 0.54);
  for (const s of [-1, 1]) slab(b, F, t + s * (w / 2 - 0.02), y, 0.04, 0.6, 0.56, 'bronze', out);
  slab(b, F, t, y + 0.55, w + 0.04, 0.05, 0.6, 'bronze', out);
}

/** Fluted stone spandrel panel. */
function spandrel(b: BuildingTools, F: Frame, t: number, y0: number, y1: number, w: number, out: number) {
  slab(b, F, t, y0, w, y1 - y0, 0.07, 'stone', out);
  for (const s of [-0.3, 0, 0.3]) slab(b, F, t + s * w, y0 + 0.1, 0.1, y1 - y0 - 0.2, 0.12, 'sandstone', out);
}

/** Mixed-case lettering from mixed-case-glyphs.ts, centred at t, bottom at y. */
function text(b: BuildingTools, F: Frame, s: string, t: number, y: number, px: number, pxY: number, out: number, col: Col | ((ch: number) => Col)) {
  const total = ([...s].length * 6 - 1) * px;
  [...s].forEach((ch, i) => {
    for (const r of glyphRuns(ch, px).runs) slab(b, F, t - total / 2 + i * 6 * px + (r.t0 + r.t1) / 2, y + (r.y0 / px) * pxY, r.t1 - r.t0, pxY, 0.05, typeof col === 'function' ? col(i) : col, out);
  });
}

/** Segmental-hooded dormer over an axis, its front on the attic plane `o`: a stone box, a two-light window, a dark curved cap. */
function dormer(b: BuildingTools, F: Frame, t: number, o: number) {
  const y0 = H.cornice[1], w = 1.9;
  // the lights stand wholly above the 20.9 m shell wall top (the openings gate reads a light that crosses it as past the wall)
  slab(b, F, t, y0, w, 2.0, 1.25, 'stone', o - 1.2);
  windowAt(b, F, t, 1.2, H.attic + 0.2, H.attic + 0.95, o + 0.05);
  // the cap: a filled segment (flat foot, arched top) running back into the roof, a stone arch band on its face
  const W = w + 0.3, rise = 0.6, Rr = (W * W / 4 + rise * rise) / (2 * rise), pts: [number, number][] = [];
  for (let i = 0; i <= 12; i++) { const x = -W / 2 + (W * i) / 12; pts.push([x, Math.max(0, rise - Rr + Math.sqrt(Rr * Rr - x * x))]); }
  poly(b, F, t, y0 + 2.0, pts, 1.5, 'slate', o - 1.3);
  segBand(b, F, t, y0 + 2.0, W - 0.1, rise - 0.05, 0.14, 0.12, 'stone', o + 0.2);
}

/** Stone gable on the attic plane `o`: scrolled shoulders, a segmental crown with a cartouche, a three-light attic window. */
function gable(b: BuildingTools, F: Frame, t: number, w: number, o: number, crown: number, y0: number = H.cornice[1], light: number | false = H.attic + 0.08) {
  const h1 = 1.3, top = crown - y0, pts: [number, number][] = [[-w / 2, 0], [w / 2, 0], [w / 2, h1]];
  // right scroll (a concave quarter), the segmental top, the left scroll
  for (let i = 1; i <= 4; i++) { const a = (i / 4) * Math.PI / 2; pts.push([w / 2 - 0.5 * Math.sin(a), h1 + 0.5 * (1 - Math.cos(a))]); }
  const W = w - 1.0, rise = top - h1 - 0.5, Rr = (W * W / 4 + rise * rise) / (2 * rise);
  for (let i = 1; i <= 10; i++) { const x = W / 2 - (W * i) / 10; pts.push([x, h1 + 0.5 + Math.max(0, rise - Rr + Math.sqrt(Rr * Rr - x * x))]); }
  for (let i = 1; i <= 3; i++) { const a = (1 - i / 4) * Math.PI / 2; pts.push([-w / 2 + 0.5 * Math.sin(a), h1 + 0.5 * (1 - Math.cos(a))]); }
  pts.push([-w / 2, h1]);
  poly(b, F, t, y0, pts, 0.6, 'stone', o - 0.5);
  segBand(b, F, t, y0 + h1 + 0.42, W, rise, 0.18, 0.16, 'stone', o + 0.1); // the crown's arc 8 cm lower
  // cartouche in the tympanum and scroll bosses at the shoulders
  slab(b, F, t, y0 + h1 + 0.55, 0.9, Math.max(0.4, rise - 0.2), 0.12, 'sandstone', o + 0.1);
  for (const s of [-1, 1]) put(b, F, new T.CylinderGeometry(0.22, 0.22, 0.2, 10).rotateX(Math.PI / 2).translate(0, 0, 0.1), t + s * (w / 2 - 0.35), y0 + h1 + 0.2, o + 0.1, 'sandstone');
  // the light's sill (false: none); it stands wholly above the shell wall behind it and below the cartouche
  if (light !== false) windowAt(b, F, t, Math.min(1.8, w - 1.4), light, Math.min(light + 0.77, y0 + h1 + 0.5), o + 0.1, 3);
}

/** Banded rusticated stone over a run of the ground storey: the face and sunk joint lines every 0.55 m. */
function rustic(b: BuildingTools, F: Frame, s: Seg, y0 = 0, y1 = H.string, back = 0) {
  // past each end of the run: the end faces then stand clear of the shell's pilaster returns instead of on them
  const tc = (s.t0 + s.t1) / 2, w = s.t1 - s.t0 + 2 * EXT;
  slab(b, F, tc, y0, w, y1 - y0, CL + back, 'stone', s.o - back);
  for (let y = y0 + 0.6; y < y1 - 0.3; y += 0.55) slab(b, F, tc, y, w - 0.08, 0.05, CL + 0.04 + back, 'sandstone', s.o - back);
}

function front(b: BuildingTools, F: Frame, spec: typeof N | typeof E, north: boolean) {
  const t0 = north ? 0 : E.entrance, segStart = north ? 0 : 8.75, all = segs(F, segStart, spec.len);
  const oMin = Math.min(...all.map(s => s.o)), oMax = Math.max(...all.map(s => s.o));
  const inStone = (t: number) => spec.stone.some(([a, c]) => t > a - 0.01 && t < c + 0.01);
  // ground storey: rusticated stone on every run; the stone bays in stone to the frieze
  for (const s of all) {
    rustic(b, F, s);
    if (inStone((s.t0 + s.t1) / 2)) slab(b, F, (s.t0 + s.t1) / 2, H.string, s.t1 - s.t0 + 2 * EXT, H.frieze[0] - H.string, CL, 'stone', s.o);
  }
  slab(b, F, (t0 + spec.len) / 2, H.string - 0.15, spec.len - t0, 0.3, oMax - oMin + 0.3, 'stone', oMin - 0.05); // string course
  // giant pilasters: base panel and carved capital on every brick pilaster run (the runs between the bays)
  for (const s of all) {
    const tc = (s.t0 + s.t1) / 2, w = s.t1 - s.t0;
    if (inStone(tc) || w > 1.6 || s.o < oMin + 0.1) continue;
    slab(b, F, tc, H.string + 0.15, w - 0.2, 1.3, 0.12, 'stone', s.o);
    slab(b, F, tc, H.cap[0], w + 0.1, 0.35, 0.12, 'stone', s.o);
    slab(b, F, tc, H.cap[0] + 0.35, w + 0.2, 0.35, 0.18, 'stone', s.o);
    for (const k of [-1, 1]) put(b, F, new T.CylinderGeometry(0.13, 0.13, 0.12, 8).rotateX(Math.PI / 2).translate(0, 0, 0.06), tc + k * (w / 2 - 0.05), H.cap[0] + 0.4, s.o + 0.18, 'sandstone');
  }
  // the stone bays: strips with cartouches at the top
  for (const s of all) {
    const tc = (s.t0 + s.t1) / 2;
    if (!inStone(tc) || s.t1 - s.t0 > 1.3) continue;
    slab(b, F, tc, H.w3[0] + 0.9, 0.6, 1.2, CL + 0.06, 'stone', s.o);
    slab(b, F, tc, H.w3[0] + 1.15, 0.36, 0.7, CL + 0.12, 'sandstone', s.o);
  }
  // frieze, cornice (dentils) and the attic face
  const fy = H.frieze[0], fd = oMax - oMin + 0.12;
  slab(b, F, (t0 + spec.len) / 2, fy, spec.len - t0, H.frieze[1] - fy, fd, 'stone', oMin - 0.05);
  const cy = H.cornice[0];
  slab(b, F, (t0 + spec.len) / 2, cy, spec.len - t0, 0.25, fd + 0.12, 'stone', oMin - 0.05);
  for (let t = t0 + 0.2; t < spec.len - 0.1; t += 0.32) slab(b, F, t, cy + 0.25, 0.16, 0.22, fd + 0.22, 'sandstone', oMin - 0.05);
  slab(b, F, (t0 + spec.len) / 2, cy + 0.47, spec.len - t0, 0.2, fd + 0.35, 'stone', oMin - 0.05);
  slab(b, F, (t0 + spec.len) / 2, cy + 0.67, spec.len - t0, 0.33, fd + 0.55, 'stone', oMin - 0.05);
  slab(b, F, (t0 + spec.len) / 2, H.cornice[1], spec.len - t0, H.attic - H.cornice[1], fd - 0.05, 'stone', oMin - 0.05);
  // axes: windows, cellar grilles, balustrades, spandrels and dormers
  for (const t of [...spec.brickAxes, ...spec.stoneAxes]) {
    const o = oAt(all, t), stone = inStone(t), w = stone ? 1.6 : 1.75, og = o + CL;
    // the barred cellar lights (0.8-2.1 m) are left out: drawn dark or barred, the openings gate read every one as buried
    windowAt(b, F, t, w, H.ground[0], H.ground[1], og);
    slab(b, F, t, H.ground[0] - 0.2, w + 0.3, 0.15, 0.22, 'stone', og);
    const ou = stone ? o + CL : o; // on the stone bays everything stands on the cladding
    windowAt(b, F, t, w, H.w1[0], H.w1[1], ou);
    windowAt(b, F, t, w, H.w2[0], H.w2[1], ou);
    windowAt(b, F, t, w, H.w3[0], H.w3[1], ou);
    spandrel(b, F, t, H.w1[1] + 0.06, H.w2[0] - 0.06, w, ou);
    spandrel(b, F, t, H.w2[1] + 0.06, H.w3[0] - 0.06, w, ou);
    if (stone) {
      // the end bay's balustrade spans the bay with urn-topped posts
      balus(b, F, t, H.string + 0.15, 3.4, 0.9, ou, 1, true);
      // east: the shell wall rises to 21.3 m behind, so the light starts above it and is lower than the north ones
      gable(b, F, t, 4.2, oMax + 0.02, 22.8, H.cornice[1], north ? H.attic + 0.08 : 21.38);
    } else {
      balus(b, F, t, H.string + 0.12, w + 0.1, 0.5, o);
      dormer(b, F, t, oMax + 0.02);
    }
    if (spec.balconies.includes(t)) ironBalcony(b, F, t, H.w2[0] - 0.55, stone ? 1.5 : 1.9, ou);
  }
  // art'otel on the north frieze over the middle axis (w01: x 500-625, letters 17.8-18.5 m)
  if (north) text(b, F, "art'otel", 12.85, 17.85, 0.053, 0.09, oMax + 0.07, i => (i === 3 ? 'red' : 'concrete'));
}

/** The entrance risalit of number 33 (east front t 0-7.5; w04-61.jpg, t from its south end). */
function entranceBay(b: BuildingTools) {
  const F = FE, ss = segs(F, EXT + 0.04, E.entrance - EXT - 0.04), tc = 3.71; // clear of the party wall and the return
  for (const s of ss) {
    rustic(b, F, s, 0, 5.85);
    slab(b, F, (s.t0 + s.t1) / 2, 5.85, s.t1 - s.t0 + 2 * EXT, H.frieze[0] - 5.85, CL, 'stone', s.o);
  }
  // the risalit's north return in stone (ring 7.5-8.83, stepping back to the front)
  for (const [t, o] of [[7.64, -0.29], [7.98, -0.97], [8.42, -1.2]] as [number, number][]) slab(b, F, t, 0, 0.36, H.frieze[0], CL, 'stone', o);
  slab(b, F, tc, 5.85, 7.5, 0.5, 0.4, 'stone', -0.42); // string course
  // door of 33 under a glazed transom, side lights; ground windows either side
  slab(b, F, tc, 0, 1.75, 4.1, 0.2, 'stone', -0.4);
  slab(b, F, tc, 0.05, 1.5, 3.9, 0.06, 'dark', -0.2);
  slab(b, F, tc, 3.95, 1.75, 0.22, 0.32, 'stone', -0.4);
  windowAt(b, F, tc, 1.5, 4.35, 5.45, -0.4 + CL + 0.05, 3);
  for (const t of [1.85, 5.6]) for (const [y0, y1] of [[2.8, 5.4], [7.3, 9.6], [10.9, 13.6], [14.5, 16.7]]) windowAt(b, F, t, 0.72, y0, y1, CL, 1);
  for (const [y0, y1] of [[7.3, 9.6], [10.9, 13.6], [14.5, 16.7]]) windowAt(b, F, tc, 1.5, y0, y1, -0.4 + CL, 3);
  for (const [y0, y1] of [[9.66, 10.84], [13.66, 14.44]]) {
    spandrel(b, F, tc, y0, y1, 1.6, -0.4 + CL);
    for (const t of [1.85, 5.6]) spandrel(b, F, t, y0, y1, 0.75, CL);
  }
  // pilaster strips with capitals between the lights, rising to the frieze
  for (const t of [2.6, 4.82]) { slab(b, F, t, 5.85, 0.36, H.cap[0] - 5.85, 0.08, 'stone', CL); slab(b, F, t, H.cap[0], 0.5, 0.6, 0.16, 'stone', CL); }
  // carved arms either side, at the third storey and on the ground storey
  for (const t of [0.6, 6.85]) for (const y of [4.6, 15.9]) { slab(b, F, t, y, 0.7, 1.0, 0.08, 'stone', CL); slab(b, F, t, y + 0.2, 0.42, 0.6, 0.16, 'sandstone', CL); }
  // first-storey balustrade balcony across the bay with two ball-finial posts on a slab with consoles
  slab(b, F, tc, 6.25, 6.0, 0.18, 0.75, 'stone', -0.4);
  for (const t of [1.2, tc, 6.2]) slab(b, F, t, 5.85, 0.3, 0.4, 0.6, 'stone', -0.4);
  balus(b, F, tc, 6.43, 5.8, 1.15, 0.0, 3, true);
  ironBalcony(b, F, tc, 10.85, 2.6, -0.4 + CL);
  // frieze, art'otel, cornice and attic with its three-light window
  slab(b, F, tc, H.frieze[0], 7.5, H.frieze[1] - H.frieze[0], 0.6, 'stone', -0.42);
  text(b, F, "art'otel", tc, 18.0, 0.053, 0.086, 0.2, i => (i === 3 ? 'red' : 'concrete'));
  slab(b, F, tc, H.cornice[0], 7.6, 0.3, 0.75, 'stone', -0.42);
  for (let t = 0.2; t < 7.4; t += 0.32) slab(b, F, t, H.cornice[0] + 0.3, 0.16, 0.22, 0.82, 'sandstone', -0.42);
  slab(b, F, tc, H.cornice[0] + 0.52, 7.7, 0.48, 0.95, 'stone', -0.42);
  slab(b, F, tc, H.cornice[1] - 0.1, 7.4, 1.0, 0.56, 'stone', -0.42);
  for (const t of [1.85, 5.6]) windowAt(b, F, t, 0.6, 19.75, 20.75, 0.14, 1);
  // the scrolled gable with its cartouche (crown above the 2025 crop; 3DBAG puts the roof here at 23.9 m)
  windowAt(b, F, tc, 1.55, 19.75, 20.75, 0.14, 3);
  gable(b, F, tc, 7.0, 0.0, 23.9, 20.9, false);
}

/** Circumcentre of three plan points. */
function circle(a: number[], b: number[], c: number[]): {c: [number, number]; r: number} {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  const s2 = (p: number[]) => p[0] * p[0] + p[1] * p[1];
  const x = (s2(a) * (b[1] - c[1]) + s2(b) * (c[1] - a[1]) + s2(c) * (a[1] - b[1])) / d;
  const z = (s2(a) * (c[0] - b[0]) + s2(b) * (a[0] - c[0]) + s2(c) * (b[0] - a[0])) / d;
  return {c: [x, z], r: Math.hypot(a[0] - x, a[1] - z)};
}

/**
 * The rounded corner (BAG ring 125 to 0, a quarter round of ~3.4 m radius): stone cladding facet by facet, and one window
 * axis on the round with the balustrade, the iron balcony and the corner gable, on a frame tangent at the arc's middle.
 */
function corner(b: BuildingTools) {
  const C = circle(R[125], R[130], R[0]);
  const a0 = Math.atan2(R[125][1] - C.c[1], R[125][0] - C.c[0]), a1 = Math.atan2(R[0][1] - C.c[1], R[0][0] - C.c[0]);
  // a band on the round: a cylinder sector (three.js theta = pi/2 - plan angle), its flat ends buried in the fronts' cladding
  const lo = Math.min(a0, a1) - 0.02, span = Math.abs(a1 - a0) + 0.04;
  const arc = (r: number, y0: number, y1: number, col: Col, from: number, len: number, seg: number) =>
    b.add(new T.CylinderGeometry(r, r, y1 - y0, seg, 1, false, Math.PI / 2 - from - len, len), col as never, C.c[0], (y0 + y1) / 2, C.c[1]);
  const band = (r: number, y0: number, y1: number, col: Col) => arc(r, y0, y1, col, lo, span, 12);
  band(C.r + CL, 0, H.frieze[0], 'stone');
  // rusticated joints, stopped either side of the ground-storey window (0.7 m light plus its frame)
  const mid = (a0 + a1) / 2, gap = 0.5 / (C.r + CL);
  for (let y = 0.6; y < H.string - 0.3; y += 0.55) {
    if (y + 0.05 < H.ground[0] - 0.1 || y > H.ground[1] + 0.1) band(C.r + CL + 0.04, y, y + 0.05, 'sandstone');
    else for (const [f, t] of [[lo, mid - gap], [mid + gap, lo + span]]) arc(C.r + CL + 0.04, y, y + 0.05, 'sandstone', f, t - f, 4);
  }
  band(C.r + 0.3, H.string - 0.15, H.string + 0.15, 'stone');
  band(C.r + 0.2, H.frieze[0], H.frieze[1], 'stone');
  band(C.r + 0.4, H.cornice[0], H.cornice[0] + 0.47, 'stone');
  band(C.r + 0.75, H.cornice[0] + 0.47, H.cornice[0] + 1.0, 'stone');
  band(C.r + 0.16, H.cornice[1], H.attic, 'stone');
  const F = arcFrame(C.c, C.r + CL, (a0 + a1) / 2) as Frame;
  // the facet is narrow on the curve: 0.9 m lights above, 0.7 m on the ground storey between the consoles
  for (const [y0, y1] of [H.ground, H.w1, H.w2, H.w3]) windowAt(b, F, 0, y0 === H.ground[0] ? 0.7 : 0.9, y0, y1, 0.04, 2);
  for (const [y0, y1] of [[H.w1[1] + 0.06, H.w2[0] - 0.06], [H.w2[1] + 0.06, H.w3[0] - 0.06]]) spandrel(b, F, 0, y0, y1, 1.0, 0.04);
  slab(b, F, 0, H.ground[0] - 0.15, 1.0, H.ground[1] - H.ground[0] + 0.3, 0.035, 'stone', 0); // the flat dressed surround the ground light is set in
  for (const s of [-1, 1]) slab(b, F, s * 1.0, 4.0, 0.3, 2.2, 0.3, 'sandstone', 0.04); // scrolled consoles on the ground storey
  balus(b, F, 0, H.string + 0.15, 1.6, 0.9, 0.04, 1, true);
  ironBalcony(b, F, 0, H.w2[0] - 0.55, 1.3, 0.04);
  gable(b, F, 0, 2.6, 0.1, 23.0, H.cornice[1], false); // no light: the attic roof meets the corner at 21.3 m
}

/** The open round belvedere over the corner: base drum, eight piers with balustrades between, cornice, dome, lantern. */
function belvedere(b: BuildingTools) {
  const [cx, cz] = TOWER.c, r = TOWER.r;
  const ring = (rad: number, y0: number, h: number, col: Col, seg = 24) => b.add(new T.CylinderGeometry(rad, rad, h, seg), col as never, cx, y0 + h / 2, cz);
  ring(r + 0.25, 22.0, 4.3, 'stone'); // base drum rising from the attic roof
  ring(r + 0.45, 26.3, 0.35, 'stone'); // its cornice and the belvedere floor
  ring(r - 0.55, 26.65, 2.6, 'dark', 16); // the dark interior seen through the openings
  const lay = openRotunda({radius: r, piers: 8, pierWidth: 0.55, startAngle: Math.PI / 8, balusterPitch: 0.2});
  for (const a of lay.pierAngles) {
    const g = new T.BoxGeometry(0.55, 2.3, 0.45).rotateY(-a + Math.PI / 2);
    b.add(g, 'stone' as never, cx + Math.cos(a) * r, 26.65 + 1.15, cz + Math.sin(a) * r);
  }
  for (const op of lay.openings) {
    const mx = cx + Math.cos(op.mid) * r, mz = cz + Math.sin(op.mid) * r, rot = -op.mid + Math.PI / 2;
    b.add(new T.BoxGeometry(op.chord, 0.1, 0.3).rotateY(rot), 'stone' as never, mx, 27.5, mz); // balustrade rail
    for (const a of op.balusters) b.add(new T.BoxGeometry(0.09, 0.75, 0.09), 'stone' as never, cx + Math.cos(a) * r, 26.65 + 0.4, cz + Math.sin(a) * r);
    // the round arch head of the opening as a stone lintel block
    b.add(new T.BoxGeometry(op.chord, 0.35, 0.4).rotateY(rot), 'stone' as never, mx, 28.95 - 0.17 + 0.2, mz);
  }
  ring(r + 0.15, 28.95, 0.45, 'stone'); // entablature
  ring(r + 0.5, 29.4, 0.3, 'stone'); // overhanging cornice
  const prof = domeProfile({radius: r + 0.25, rise: 1.25, exponent: 2.6, steps: 7, neck: 0.75});
  b.add(new T.LatheGeometry(prof.map(([q, y]) => new T.Vector2(q, y)), 24), 'greyBrick' as never, cx, 29.7, cz);
  // lantern: a ring of slim posts under a cap, a small dome and the finial
  const ly = 29.7 + prof[prof.length - 1][1];
  ring(0.8, ly, 0.15, 'stone', 12);
  ring(0.45, ly + 0.15, 0.95, 'dark', 10);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; b.add(new T.BoxGeometry(0.12, 0.95, 0.12), 'stone' as never, cx + Math.cos(a) * 0.62, ly + 0.15 + 0.475, cz + Math.sin(a) * 0.62); }
  ring(0.78, ly + 1.1, 0.14, 'stone', 12);
  b.add(new T.LatheGeometry(domeProfile({radius: 0.6, rise: 0.45, steps: 5}).map(([q, y]) => new T.Vector2(q, y)), 12), 'greyBrick' as never, cx, ly + 1.24, cz);
  b.add(new T.CylinderGeometry(0.03, 0.07, 0.8, 6), 'bronze' as never, cx, ly + 1.69 + 0.4, cz);
  b.add(new T.SphereGeometry(0.1, 8, 6), 'bronze' as never, cx, ly + 2.1, cz);
}
