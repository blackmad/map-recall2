import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archSlab, disc, getSink, ledgeStrip, poly, put, ringFrame, segBand, setSink, slab, type Frame} from './nearbar-kit';
import {speklagen, type BandOpening} from '../../src/canalRecall/landmarks/speklagen';
import {balustrade} from '../../src/canalRecall/landmarks/balustrade';
import {tympanumArchAt} from './tympanum-arch-kit';
import source from './nieuwe-doelenstraat-12-footprints.json';

/**
 * KANTOORGEBOUW NIEUWE DOELENSTRAAT 12 (BAG pand 0363100012180414, BAG 1890; rijksmonument 518440, register: an office
 * building between the Nieuwe Doelenstraat and the Binnen-Amstel, built 1889-1890 to a Neo-Renaissance design by
 * F.W.M. Poggenbeek for the firm Labouchere Oyens; the Nieuwe Doelenstraat front altered in 1905 by Gebr. van Gendt).
 * The register (paraphrased): basement, ground floor and two upper storeys; the street front five bays with a natural-stone
 * basement and ground floor; the Binnen-Amstel front five bays with a three-bay risalit and an open attic.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts). 3DBAG stops the water fronts at the flat roof
 * behind the attic (14.9-16.8 m); the photo's cornice tops out at 16.9 m with the balustrade over it, so the fronts are
 * carried up in brick to the cornice here (the front photo, not the 3DBAG plane).
 *
 * Fronts read from Gemeente Amsterdam panoramas (CC BY 4.0), rectified at 50 px/m, heights above the 3DBAG ground
 * (0.0 m NAP) with the canal (-0.4 m NAP) as the datum of the boat-level captures:
 *  - Binnen-Amstel risalit (ring edge 8, w02-147, 8.8 m): TMX7316010203-000354_pano_0001_001510 (2017, sunlit) and
 *    TMX7316010203-001975_pano_0000_001283 (2021);
 *  - Binnen-Amstel side bays (ring edge 6, w04-149, 5.3 m): TMX7316010203-001975_pano_0000_001284 (2021), the balcony;
 *  - Nieuwe Doelenstraat (ring edge 0, w01-329, 14.2 m): TMX7316010203-000717_pano_0000_000476 (2018) and
 *    TMX7315120208-000073_pano_0003_000693 (2016).
 * Per item in nieuwe-doelenstraat-12-inventory.json.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]; nativeRing: number[][]};
const src = source as unknown as Src;
const edge = (i: number) => ringFrame(src.facadeRing, i);

/** Water fronts: storeys (sill, head) above the 3DBAG ground. */
const BASE = 3.0;
const ST: [number, number][] = [[3.4, 6.0], [7.6, 10.2], [12.1, 14.6]];
const BANDS = [7.25, 11.75];
const CORN0 = 15.5, CORN1 = 16.9, BAL1 = 17.75;
const WIN = 1.3;

/**
 * The shell with the street front's eaves level: 3DBAG drops the mansard's foot to 11.4-14.9 m along the Nieuwe
 * Doelenstraat (ring edge 0), the photo shows the cornice level at 15.3 m across all five bays; points within 1.5 m of
 * that front and below 15.2 m are lifted to it.
 */
function liftedShell(): Src {
  const r = src.facadeRing, a = r[0], c = r[1], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz);
  const dOf = (p: number[]) => Math.abs((p[0] - a[0]) * dz - (p[2] - a[1]) * dx) / L;
  const tOf = (p: number[]) => ((p[0] - a[0]) * dx + (p[2] - a[1]) * dz) / L;
  // 3DBAG also reads the stone dormer as a roof bump rising to 17.5-20 m on the front (t 5.7-8.6); that front is set back to
  // the eaves line so the modelled dormer stands on the mansard instead of inside a sloped 3DBAG facet.
  const bump = (p: number[]) => dOf(p) < 0.6 && tOf(p) > 5.4 && tOf(p) < 8.8 && p[1] > 15.2 && p[1] < 20.2;
  const lift = (p: number[]) => ((p[1] > 1 && p[1] < 15.2 && dOf(p) < 1.5) || bump(p) ? [p[0], 15.2, p[2]] : p);
  return {...src, surfaces: src.surfaces.map(s => ({...s, rings: s.rings.map(q => q.map(lift))}))};
}

export function buildNieuweDoelenstraat12(_w: number, _d: number, b: BuildingTools) {
  addShell(b, liftedShell() as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.12, true);
  risalit(b);
  sideBays(b);
  jog(b);
  street(b);
  setSink(sink0);
}

/** Two-light window with a transom: white frame, glass, white mullion and transom strips, stone sill; base `o` out. */
function win(b: BuildingTools, f: Frame, c: number, y0: number, y1: number, w: number, o = 0, transom = 0.7) {
  const h = y1 - y0;
  slab(b, f, c, y0 - 0.04, w + 0.12, h + 0.08, 0.06, 'white', o);
  slab(b, f, c, y0, w, h, 0.15, 'glass', o);
  ledgeStrip(b, f, c, y0, 0.07, h, 0.22, 'white', o);
  ledgeStrip(b, f, c, y1 - transom, w, 0.07, 0.22, 'white', o);
  slab(b, f, c, y0 - 0.16, w + 0.3, 0.12, 0.3, 'stone', o);
}

/** Stone speklagen through the brick between `t0` and `t1`, cut at the window openings (kit speklagen). */
function bands(b: BuildingTools, f: Frame, t0: number, t1: number, cols: number[], ys: number[], from = BASE + 0.3, to = 15.3) {
  const openings: BandOpening[] = [];
  for (const c of cols) for (const [y0, y1] of ST) openings.push({t0: c - WIN / 2 - 0.08, t1: c + WIN / 2 + 0.08, y0: y0 - 0.2, y1: y1 + 1.05});
  const rows = [];
  for (let y = from; y < to; y += 0.72) if (!ys.some(v => Math.abs(v - y) < 0.3)) rows.push({y, h: 0.14});
  for (const r of speklagen({t0: t0 + 0.1, t1: t1 - 0.1, bands: rows, openings, gap: 0.02})) slab(b, f, (r.t0 + r.t1) / 2, r.y, r.t1 - r.t0, r.h, 0.04, 'stone');
}

/** A water-front bay column: three windows, rosette panel, relieving arches with stone tympana over the upper two. */
function bayColumn(b: BuildingTools, f: Frame, c: number, rosette: boolean) {
  for (const [k, [y0, y1]] of ST.entries()) {
    win(b, f, c, y0, y1, WIN);
    if (k === 0) {
      slab(b, f, c, y1 + 0.04, WIN + 0.4, 0.22, 0.2, 'stone');
      if (rosette) {
        slab(b, f, c, 6.4, WIN + 0.2, 0.66, 0.08, 'stone');
        for (const s of [-0.35, 0.35]) disc(b, f, c + s, 6.73, 0.24, 0.08, 'sandstone', 0.08);
      }
    } else {
      // round-headed relieving arch (kit tympanumArch): a brick rowlock ring on stone imposts with a stone keystone over a
      // filled brick tympanum carrying a carved boss (w02-147, 2017: span 1.7 m, rise 0.7 m over the head on the middle row;
      // the top row's arches stop under the cornice frieze)
      const top = k === ST.length - 1;
      tympanumArchAt(b, f, c, {width: WIN + 0.4, head: y1 + 0.1, shape: 'segmental', rise: top ? 0.55 : 0.66, ring: top ? 0.16 : 0.18, voussoirs: 15,
        keystone: {scale: 1.6, proud: top ? 0 : 0.1}, impost: {width: 0.08, height: 0.2}, boss: {radius: 0.13}},
      {field: 'brick', voussoirColours: 'brick', keyColour: 'stone', impostColour: 'stone', bossColour: 'sandstone', fieldD: 0.04, ringD: 0.1});
    }
  }
}

/** Water-front cornice: frieze, bed moulding, modillions, corona. */
function cornice(b: BuildingTools, f: Frame, t0: number, t1: number, top = CORN1) {
  const c = (t0 + t1) / 2, w = t1 - t0;
  slab(b, f, c, CORN0, w, 0.4, 0.06, 'stone');
  slab(b, f, c, CORN0 + 0.4, w + 0.1, 0.2, 0.18, 'stone');
  for (let t = t0 + 0.2; t < t1 - 0.1; t += 0.45) slab(b, f, t, CORN0 + 0.6, 0.14, 0.3, 0.42, 'stone');
  slab(b, f, c, CORN0 + 0.9, w + 0.4, top - CORN0 - 0.9, 0.55, 'stone');
}

/** Carry a water front up from the 3DBAG top (14.9-16.8 m) to the cornice in brick, flush with the wall. */
function raise(b: BuildingTools, f: Frame, len: number, from: number, top = CORN1 - 0.06) {
  slab(b, f, len / 2, from, len - 0.2, top - from, 0.4, 'brick', -0.49);
}

/** The Binnen-Amstel risalit (edge 8): base, three bays, cornice, balustrade, pinnacles, aedicule. */
function risalit(b: BuildingTools) {
  const {f, len} = edge(8);
  raise(b, f, len, 14.6);
  const cols = [len / 2 - 2.35, len / 2, len / 2 + 2.35];
  // sandstone base storey from the water: two small grilled windows per bay
  slab(b, f, len / 2, 0, len - 0.2, BASE, 0.15, 'stone');
  slab(b, f, len / 2, BASE, len - 0.2, 0.3, 0.24, 'stone');
  for (const c of cols) for (const s of [-0.38, 0.38]) {
    slab(b, f, c + s, 0.6, 0.5, 1.3, 0.1, 'glass', 0.15);
    for (let k = 1; k < 4; k++) ledgeStrip(b, f, c + s - 0.25 + 0.125 * k, 0.6, 0.04, 1.3, 0.24, 'dark', 0.06);
  }
  // quoins and pier blocks: speklagen through the brick
  bands(b, f, 0, len, cols, [...BANDS, ST[0][1] + 0.04]);
  for (const y of BANDS) slab(b, f, len / 2, y, len - 0.2, 0.2, 0.12, 'stone');
  for (const c of cols) bayColumn(b, f, c, true);
  // corbels on the piers at the bands
  for (const t of [0.6, len / 2 - 1.175, len / 2 + 1.175, len - 0.6]) for (const y of BANDS) slab(b, f, t, y - 0.35, 0.22, 0.35, 0.24, 'sandstone');
  cornice(b, f, 0.1, len - 0.1);
  // the open attic: a stone balustrade the width of the risalit, posts over the piers
  const bl = balustrade({width: len - 0.2, height: BAL1 - CORN1, post: 0.36, plinth: 0.14, rail: 0.14, baluster: 0.13, pitch: 0.3, bays: 3});
  const at = (x: number) => len / 2 + x;
  slab(b, f, at((bl.plinth.x0 + bl.plinth.x1) / 2), CORN1 + bl.plinth.y, bl.plinth.x1 - bl.plinth.x0, bl.plinth.h, 0.36, 'stone', 0.05);
  slab(b, f, at((bl.rail.x0 + bl.rail.x1) / 2), CORN1 + bl.rail.y, bl.rail.x1 - bl.rail.x0, bl.rail.h, 0.4, 'stone', 0.03);
  for (const p of bl.posts) slab(b, f, at(p.x), CORN1 + p.y, p.w, bl.rail.y - p.y, 0.32, 'stone', 0.06);
  for (const q of bl.balusters) slab(b, f, at(q.x), CORN1 + q.y, q.w, q.h, 0.14, 'stone', 0.14);
  // obelisk pinnacles on the corners
  for (const t of [0.35, len - 0.35]) pinnacle(b, f, t, BAL1, 0.42);
  aedicule(b, f, len / 2, BAL1 - 0.1);
}

/** Tapered stone obelisk on a pedestal (sitting on the balustrade's posts). */
function pinnacle(b: BuildingTools, f: Frame, t: number, y: number, w: number) {
  slab(b, f, t, y, w, 0.3, w, 'stone', 0.1);
  const g = new T.ConeGeometry(w * 0.5, 1.2, 4).rotateY(Math.PI / 4).translate(0, 0.6, 0);
  put(b, f, g, t, y + 0.3, 0.1 + w / 2, 'stone');
  disc(b, f, t, y + 1.6, 0.09, 0.18, 'stone', 0.1 + w / 2 - 0.09);
}

/** The aedicule dormer over the middle bay: two arched lights between pilasters, pediment, pinnacles and finial. */
function aedicule(b: BuildingTools, f: Frame, c: number, y: number) {
  const W = 2.3, H = 2.3, back = -1.6;
  slab(b, f, c, y, W, H, 1.6, 'stone', back);
  for (const s of [-0.42, 0.42]) {
    archSlab(b, f, c + s, y + 0.45, 0.62, 1.45, 0.08, 'white', 0, 6);
    archSlab(b, f, c + s, y + 0.5, 0.5, 1.35, 0.14, 'glass', 0, 6);
  }
  for (const s of [-1, 1]) slab(b, f, c + s * (W / 2 - 0.16), y, 0.2, H, 0.18, 'sandstone');
  slab(b, f, c, y + H, W + 0.3, 0.22, 0.24, 'stone', -0.04);
  poly(b, f, c, y + H + 0.22, [[-W / 2 - 0.1, 0], [W / 2 + 0.1, 0], [0, 0.85]], 1.8, 'stone', -1.6);
  for (const s of [-1, 1]) pinnacle(b, f, c + s * (W / 2 - 0.05), y + H + 0.22, 0.26);
  const g = new T.ConeGeometry(0.14, 0.7, 6).translate(0, 0.35, 0);
  put(b, f, g, c, y + H + 1.0, 0.0, 'stone');
}

/** The two recessed bays beside the risalit (edge 6): arcaded base with terrace balustrade, iron balcony, dormer. */
function sideBays(b: BuildingTools) {
  const {f, len} = edge(6);
  raise(b, f, len, 15.4);
  const cols = [1.55, 3.85];
  // arcaded stone ground storey, the terrace on columns 1.0 m out, its balustrade
  slab(b, f, len / 2, 0, len - 0.2, BASE, 0.15, 'stone');
  for (const c of cols) archSlab(b, f, c, 0.4, 1.5, 2.2, 0.08, 'glass', 0.15, 8);
  slab(b, f, len / 2, BASE - 0.15, len, 0.2, 1.2, 'stone');
  for (const t of [0.25, len / 2, len - 0.25]) slab(b, f, t, 0, 0.26, BASE - 0.15, 0.26, 'stone', 0.9);
  const bl = balustrade({width: len - 0.2, height: 0.8, post: 0.26, plinth: 0.12, rail: 0.12, baluster: 0.11, pitch: 0.26, bays: 2});
  const at = (x: number) => len / 2 + x, Y = BASE + 0.05;
  slab(b, f, at(0), Y + bl.plinth.y, bl.plinth.x1 - bl.plinth.x0, bl.plinth.h, 0.3, 'stone', 0.9);
  slab(b, f, at(0), Y + bl.rail.y, bl.rail.x1 - bl.rail.x0, bl.rail.h, 0.34, 'stone', 0.88);
  for (const p of bl.posts) slab(b, f, at(p.x), Y + p.y, p.w, bl.rail.y - p.y, 0.26, 'stone', 0.92);
  for (const q of bl.balusters) slab(b, f, at(q.x), Y + q.y, q.w, q.h, 0.11, 'stone', 1.0);
  bands(b, f, 0, len, cols, [...BANDS, ST[0][1] + 0.04]);
  for (const y of BANDS) slab(b, f, len / 2, y, len - 0.2, 0.2, 0.12, 'stone');
  for (const c of cols) bayColumn(b, f, c, false);
  // the cast-iron balcony across both bays at the second storey: plate, struts, railing
  const yB = ST[1][0] - 0.2, out = 1.0;
  slab(b, f, len / 2, yB - 0.12, len - 0.1, 0.12, out, 'bronze');
  for (const t of [0.3, len / 2, len - 0.3]) strut(b, f, t, yB - 0.12, out);
  slab(b, f, len / 2, yB + 0.92, len - 0.1, 0.06, 0.06, 'bronze', out - 0.06);
  for (let t = 0.2; t < len - 0.1; t += 0.14) slab(b, f, t, yB, 0.025, 0.92, 0.025, 'bronze', out - 0.05);
  for (const s of [0.1, len - 0.1]) slab(b, f, s, yB, 0.05, 0.98, out - 0.05, 'bronze');
  cornice(b, f, 0.1, len - 0.1);
  // pointed stone-framed dormer in the mansard
  const c = len / 2;
  slab(b, f, c, CORN1, 1.3, 1.4, 1.4, 'stone', -1.6);
  poly(b, f, c, CORN1 + 1.4, [[-0.72, 0], [0.72, 0], [0, 0.75]], 1.5, 'stone', -1.6);
  slab(b, f, c, CORN1 + 0.25, 0.9, 1.05, 0.08, 'glass', -0.2);
  ledgeStrip(b, f, c, CORN1 + 0.25, 0.06, 1.05, 0.16, 'white', -0.2);
}

/** Diagonal bracket under a balcony: from the wall 0.7 m lower out to the plate's front. */
function strut(b: BuildingTools, f: Frame, t: number, y: number, out: number) {
  const L = Math.hypot(out, 0.7);
  const g = new T.BoxGeometry(0.05, 0.05, L).rotateX(Math.atan2(0.7, out)).translate(0, -0.35, out / 2);
  put(b, f, g, t, y, 0, 'bronze');
}

/** The risalit's side return (edge 7, 3 m): brick with speklagen and the cornice carried round. */
function jog(b: BuildingTools) {
  const {f, len} = edge(7);
  raise(b, f, len, 15.4, CORN1 - 0.2);
  bands(b, f, 0, len, [], BANDS, 0.4, 15.3);
  for (const y of BANDS) slab(b, f, len / 2, y, len - 0.2, 0.2, 0.12, 'stone');
  cornice(b, f, 0.1, len - 0.1, CORN1 - 0.05);
}

/** Nieuwe Doelenstraat (edge 0, 1905 front): rusticated stone ground storey, two brick storeys with stone surrounds, frieze, cornice, dormers. */
function street(b: BuildingTools) {
  const {f, len} = edge(0);
  const cols = [2.3, 4.7, 7.1, 9.5, 11.9];
  const G = 6.3, S1: [number, number] = [7.0, 9.6], S2: [number, number] = [11.0, 13.6], FR0 = 13.8, FR1 = 14.75, CR = 15.3;
  // rusticated sandstone ground storey with its band; grooves as darker courses every 0.5 m
  slab(b, f, len / 2, 0, len - 0.2, G, 0.15, 'stone');
  for (let y = 0.6; y < G - 0.4; y += 0.5) ledgeStrip(b, f, len / 2, y, len - 0.2, 0.04, 0.06, 'sandstone', 0.15);
  slab(b, f, len / 2, G - 0.3, len + 0.1, 0.35, 0.32, 'stone');
  for (const [k, c] of cols.entries()) {
    if (k === 0) {
      // the entrance: dark door in a stone surround with a hood (hidden by trees in the captures)
      slab(b, f, c, 0.3, 1.5, 3.6, 0.1, 'sandstone', 0.15);
      slab(b, f, c, 0.3, 1.1, 3.2, 0.08, 'dark', 0.25);
      slab(b, f, c, 3.9, 1.9, 0.32, 0.4, 'stone', 0.15);
      continue;
    }
    win(b, f, c, 2.7, 5.2, WIN, 0.25, 0.6);
    slab(b, f, c, 5.3, WIN + 0.4, 0.25, 0.2, 'sandstone', 0.15);
  }
  // brick storeys: stone surrounds and hoods on the first floor, plain stone frames on the second
  const openings: BandOpening[] = cols.flatMap(c => [S1, S2].map(([y0, y1]) => ({t0: c - WIN / 2 - 0.25, t1: c + WIN / 2 + 0.25, y0: y0 - 0.3, y1: y1 + 1.0})));
  const rows = [];
  for (let y = G + 0.5; y < FR0 - 0.2; y += 0.7) rows.push({y, h: 0.14});
  for (const r of speklagen({t0: 0.1, t1: len - 0.1, bands: rows, openings, gap: 0.02})) slab(b, f, (r.t0 + r.t1) / 2, r.y, r.t1 - r.t0, r.h, 0.04, 'stone');
  for (const c of cols) {
    for (const s of [-1, 1]) slab(b, f, c + s * (WIN / 2 + 0.12), S1[0] - 0.1, 0.2, S1[1] - S1[0] + 0.2, 0.14, 'stone');
    win(b, f, c, S1[0], S1[1], WIN, 0, 0.7);
    slab(b, f, c, S1[1] + 0.1, WIN + 0.5, 0.3, 0.12, 'stone');
    slab(b, f, c, S1[1] + 0.4, WIN + 0.7, 0.16, 0.3, 'stone');
    disc(b, f, c, S1[1] + 0.75, 0.16, 0.08, 'sandstone', 0.04);
    for (const s of [-1, 1]) slab(b, f, c + s * (WIN / 2 + 0.06), S2[0] - 0.08, 0.12, S2[1] - S2[0] + 0.16, 0.12, 'stone');
    slab(b, f, c, S2[1] + 0.08, WIN + 0.24, 0.16, 0.12, 'stone');
    win(b, f, c, S2[0], S2[1], WIN, 0, 0.7);
  }
  // frieze with the festoons (shallow swags between rosettes), cornice
  slab(b, f, len / 2, FR0, len - 0.2, FR1 - FR0, 0.1, 'stone');
  for (let t = 0.6; t < len - 0.3; t += 1.2) {
    disc(b, f, t, FR0 + 0.62, 0.1, 0.06, 'sandstone', 0.1);
    if (t + 1.2 < len) segBand(b, f, t + 0.6, FR0 + 0.62, 1.0, -0.28, 0.07, 0.05, 'sandstone', 0.1);
  }
  slab(b, f, len / 2, FR1, len + 0.1, 0.2, 0.25, 'stone');
  slab(b, f, len / 2, FR1 + 0.2, len + 0.3, CR - FR1 - 0.2, 0.5, 'stone');
  streetDormer(b, f, 7.1, CR);
  for (const c of [2.3, 11.9]) {
    slab(b, f, c, CR + 0.1, 1.3, 1.6, 1.2, 'greyBrick', -1.5);
    slab(b, f, c, CR + 0.5, 0.7, 0.9, 0.08, 'glass', -0.3);
    ledgeStrip(b, f, c, CR + 0.5, 0.05, 0.9, 0.16, 'white', -0.3);
  }
}

/** The 1905 stone dormer: two round-arched lights between volutes, an upper stage on brackets, a pediment with a finial. */
function streetDormer(b: BuildingTools, f: Frame, c: number, y: number) {
  slab(b, f, c, y, 2.6, 1.95, 1.8, 'stone', -1.6);
  for (const s of [-0.34, 0.34]) {
    archSlab(b, f, c + s, y + 0.4, 0.6, 1.45, 0.08, 'white', 0.2, 6);
    archSlab(b, f, c + s, y + 0.45, 0.46, 1.35, 0.14, 'glass', 0.2, 6);
  }
  // scroll blocks either side
  for (const s of [-1, 1]) {
    poly(b, f, c + s * 1.75, y, s < 0 ? [[-0.5, 0], [0.45, 0], [0.45, 1.6], [0.1, 1.6]] : [[-0.45, 0], [0.5, 0], [-0.1, 1.6], [-0.45, 1.6]], 0.3, 'stone', 0.15);
    disc(b, f, c + s * 1.45, y + 1.3, 0.22, 0.12, 'sandstone', 0.45);
  }
  slab(b, f, c, y + 1.95, 2.9, 0.22, 0.3, 'stone', 0.12);
  // upper stage
  slab(b, f, c, y + 2.17, 1.8, 1.4, 1.6, 'stone', -1.4);
  for (const s of [-0.45, 0, 0.45]) slab(b, f, c + s, y + 2.4, 0.14, 0.9, 0.1, 'sandstone', 0.2);
  slab(b, f, c, y + 3.57, 2.1, 0.2, 0.2, 'stone', 0.1);
  poly(b, f, c, y + 3.77, [[-1.05, 0], [1.05, 0], [0, 0.95]], 1.7, 'stone', -1.4);
  const g = new T.ConeGeometry(0.16, 0.8, 6).translate(0, 0.4, 0);
  put(b, f, g, c, y + 4.6, -0.1, 'stone');
}
