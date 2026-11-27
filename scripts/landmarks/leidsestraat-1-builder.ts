import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archSlab, getSink, patternPanel, put, ringFrame, segBand, setSink, slab, type Frame} from './nearbar-kit';
import source from './leidsestraat-1-footprints.json';

/**
 * LEIDSESTRAAT 1 / HERENGRACHT (BAG pand 0363100012177446, rijksmonument 518332): the 1904-1905 clothing store built for
 * the Levensverzekering Maatschappij "Dordrecht" (P.A. Weeldenburg, Art Nouveau; Kreymborg & Co.), on the corner of the
 * Herengracht and the Leidsestraat. The register describes white and coloured glazed brick, four storeys under a
 * pyramidal shingle roof with copper edges, an iron frame that lets the ground and the two storeys above it be almost
 * wholly glass, heavy horizontal iron beams on slender cast-iron colonnettes, and heavy stone pilasters on the corners.
 * The BAG pand also holds the plain stuccoed three-axis house east of it on the Herengracht (front t 0-5.4 m, 3DBAG wall
 * top 14.7 m), which carries the same shop fascia.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts). Fronts (nearbar-kit ringFrame, t left to right
 * seen from the street):
 *  - Herengracht: ring edge 14 (origin at the east end); the store front runs t 5.4-18.2 on that line (edges 1 and 3
 *    continue it; edge 1 stands 0.34 m back at ground level, so the glazed storeys there reach back to it).
 *  - The rounded Leidsestraat corner: ring edges 4-7 (the oriel to 11.5 m, the 3DBAG balcony roof).
 *  - Leidsestraat: ring edge 9 (origin at the corner end), 15.5 m.
 * Heights from the rectified 2020 crop TMX7316010203-001543_pano_0000_003117 (w03-45.jpg, 50.1 px/m): h = (1407 - y) / 50.1,
 * the ground fitted so the rooftop glazing ends at the 3DBAG front top (24.1 m) and the corner oriel's roof at the 3DBAG
 * 11.5 m balcony roof. Bays and the attic windows from the aimed 2020 view and the 2022/2021 Leidsestraat looks
 * (TMX7316010203-002860_pano_0000_000032, TMX7316010203-002306_pano_0002_001838).
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const EH = ringFrame(src.facadeRing, 14), EL = ringFrame(src.facadeRing, 9);
const FH = EH.f, FL = EL.f;
const CORNER = [4, 5, 6, 7].map(i => ringFrame(src.facadeRing, i));

const h = (y: number) => +((1407 - y) / 50.1).toFixed(3);
export const LV = {
  shop: [0.25, 3.62] as [number, number], // shop windows over a low stone plinth, under the iron beam that carries the mezzanine (crop y 1212-1230)
  mezz: [h(1210), h(1132)] as [number, number], // 3.93-5.49: small-pane mezzanine glazing
  fascia: [h(1130), h(1086)] as [number, number], // 5.53-6.41
  panels: [h(1085), h(1058)] as [number, number], // 6.43-6.97: the tiled panel row under the first glazed storey
  gl1: [h(1056), h(882)] as [number, number], // 7.01-10.48
  beam1: [h(880), h(830)] as [number, number], // 10.52-11.52: the iron beam and stone ledge (the oriel roof)
  gl2: [h(822), h(652)] as [number, number], // 11.68-15.07, segmental heads on the Herengracht
  beam2: [h(645), h(595)] as [number, number], // 15.21-16.21: beam and balustrade band
  attic: [h(560), h(442)] as [number, number], // 16.91-19.26
  frieze: [h(400), h(360)] as [number, number], // 20.10-20.90
  cornice: [h(350), h(283)] as [number, number], // 21.10-22.44
  roofGlass: [h(283), 24.05] as [number, number],
};
// Herengracht store front, t along ring edge 14 from the east end
const HF = {t0: 5.4, t1: 18.2, pierL: [5.4, 6.65] as [number, number], pierR: [17.0, 18.2] as [number, number], cols: [10.1, 13.55]};
const INSET = [9.81, 16.4] as [number, number];
// Leidsestraat front, t along ring edge 9 from the corner
const LF = {t0: 0, t1: 14.1, pierL: [0.05, 1.2] as [number, number], pierR: [13.0, 14.1] as [number, number], cols: [5.13, 9.07]};

type Col = 'stone' | 'ochre' | 'sandstone' | 'bronze' | 'red' | 'copper' | 'concrete' | 'frame' | 'glass' | 'slate' | 'brick' | 'greyBrick';

export function buildLeidsestraat1(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {wall: 'stone', roof: 'slate', wallFor: wallColour});
  const sink0 = getSink();
  setSink(0.04);
  storeFront(b, FH, HF, true);
  storeFront(b, FL, LF, false);
  whiteHouse(b);
  corner(b);
  setSink(sink0);
}

/** Shell walls: the stuccoed house's front white, the street fronts cream glazed brick, party and rear walls brick. */
function wallColour(s: Surface): Col {
  const r = s.rings[0];
  const c = r.reduce((a, p) => [a[0] + p[0] / r.length, a[1] + p[2] / r.length], [0, 0]);
  const tH = (c[0] - FH.origin[0]) * FH.tangent[0] + (c[1] - FH.origin[1]) * FH.tangent[1];
  const dH = (c[0] - FH.origin[0]) * FH.n[0] + (c[1] - FH.origin[1]) * FH.n[1];
  if (tH < 5.45 && Math.abs(dH) < 0.6) return 'concrete';
  if (Math.abs(dH) < 4.2 && tH > 5.3 && tH < 21.5) return 'stone';
  const tL = (c[0] - FL.origin[0]) * FL.tangent[0] + (c[1] - FL.origin[1]) * FL.tangent[1];
  const dL = (c[0] - FL.origin[0]) * FL.n[0] + (c[1] - FL.origin[1]) * FL.n[1];
  if (Math.abs(dL) < 2 && tL > -4 && tL < 16.8) return 'stone';
  return 'brick';
}

/** A glazed-brick pier: cream with ochre courses, a yellow brick base storey and a stone cap at each beam. */
function pier(b: BuildingTools, F: Frame, t0: number, t1: number, top: number, out = 0) {
  const tc = (t0 + t1) / 2, w = t1 - t0;
  slab(b, F, tc, 0, w, 0.3, 0.22, 'sandstone', out);
  slab(b, F, tc, 0.3, w, LV.panels[1] - 0.3, 0.14, 'ochre', out);
  for (let y = 0.7; y < LV.panels[1] - 0.2; y += 0.55) slab(b, F, tc, y, w + 0.01, 0.07, 0.19, 'stone', out);
  slab(b, F, tc, LV.panels[1], w, top - LV.panels[1], 0.14, 'stone', out);
  for (let y = LV.panels[1] + 0.45; y < top - 0.3; y += 0.62) slab(b, F, tc, y, w + 0.01, 0.1, 0.19, 'ochre', out);
  for (const y of [LV.beam1[0] + 0.3, LV.beam2[0] + 0.3]) slab(b, F, tc, y, w + 0.1, 0.36, 0.26, 'sandstone', out);
}

/** One storey of iron glazing between iron posts: bays [t0, t1], `lights` per bay, an optional transom and segmental head. */
function ironGlazing(b: BuildingTools, F: Frame, bays: [number, number][], y0: number, y1: number, o: {lights: number; transom?: number; head?: number; back: (t: number) => number}) {
  for (const [a, c] of bays) {
    const tc = (a + c) / 2, w = c - a, back = Math.max(o.back(a + 0.05), o.back(c - 0.05));
    const rise = o.head ?? 0;
    slab(b, F, tc, y0, w, y1 - y0 - rise, 0.06 + back, 'glass', -back);
    if (rise > 0) {
      // segmental head: a glass arch cap and the iron arch over it
      const s = new T.Shape([new T.Vector2(-w / 2, 0), new T.Vector2(w / 2, 0)]);
      s.absarc(0, -(w * w / 4 - rise * rise) / (2 * rise), (w * w / 4 + rise * rise) / (2 * rise), Math.atan2((w * w / 4 - rise * rise) / (2 * rise), w / 2), Math.PI - Math.atan2((w * w / 4 - rise * rise) / (2 * rise), w / 2), false);
      put(b, F, new T.ExtrudeGeometry(s, {depth: 0.06 + back, bevelEnabled: false, curveSegments: 6}), tc, y1 - rise, -back, 'glass');
      segBand(b, F, tc, y1 - rise, w, rise, 0.12, 0.12, 'bronze');
    }
    for (let k = 1; k < o.lights; k++) slab(b, F, a + (w * k) / o.lights, y0, 0.07, y1 - y0 - rise * 0.6, 0.12, 'bronze');
    if (o.transom) slab(b, F, tc, y0 + o.transom, w, 0.07, 0.16, 'bronze');
    slab(b, F, tc, y0 - 0.06, w, 0.08, 0.14, 'bronze');
  }
}

/** A cast-iron colonnette with a capital block, standing proud of the glazing. */
function colonnette(b: BuildingTools, F: Frame, t: number, y0: number, y1: number) {
  slab(b, F, t, y0, 0.2, y1 - y0, 0.26, 'bronze');
  slab(b, F, t, y1 - 0.42, 0.36, 0.42, 0.3, 'bronze');
  slab(b, F, t, y0, 0.32, 0.3, 0.3, 'bronze');
}

/** The store front on one street: piers, shop, mezzanine, fascia, two iron-glazed storeys, the attic, frieze and cornice. */
function storeFront(b: BuildingTools, F: Frame, S: {t0: number; t1: number; pierL: [number, number]; pierR: [number, number]; cols: number[]}, herengracht: boolean) {
  // the ground-level recess of ring edge 1 is filled flush to the front line, so every storey hangs on one plane
  if (herengracht) slab(b, F, (INSET[0] + INSET[1]) / 2, 0, INSET[1] - INSET[0], 24.0, 0.38, 'stone', -0.38);
  const back = (_t: number) => 0;
  const g0 = S.pierL[1], g1 = S.pierR[0], gc = (g0 + g1) / 2, gw = g1 - g0;
  const bays: [number, number][] = [[g0, S.cols[0]], [S.cols[0], S.cols[1]], [S.cols[1], g1]].map(([a, c]) => [a + 0.06, c - 0.06]);
  pier(b, F, S.pierL[0], S.pierL[1], LV.cornice[0]);
  pier(b, F, S.pierR[0], S.pierR[1], LV.cornice[0]);
  // ground storey: dark iron shopfront with recessed display windows, a low stone plinth
  const shopBack = 0;
  slab(b, F, gc, 0, gw, 0.19, 0.14, 'sandstone', -shopBack);
  ironGlazing(b, F, bays.map(([a, c]) => [a, c] as [number, number]), LV.shop[0], LV.shop[1], {lights: 2, transom: 2.7, back: () => shopBack});
  for (const t of [g0 + 0.06, ...S.cols, g1 - 0.06]) slab(b, F, t, 0, 0.3, LV.shop[1], 0.2, 'bronze', -0.1);
  // mezzanine: a grid of small panes in four runs
  slab(b, F, gc, LV.shop[1], gw, LV.mezz[1] - LV.shop[1] + 0.05, 0.05 + back(gc), 'bronze', -back(gc));
  slab(b, F, gc, LV.shop[1], gw, LV.mezz[0] + 0.12 - LV.shop[1], 0.22, 'bronze');
  const mz = 4, mw = gw / mz;
  for (let k = 0; k < mz; k++) {
    const a = g0 + k * mw + 0.08, c = g0 + (k + 1) * mw - 0.08;
    slab(b, F, (a + c) / 2, LV.mezz[0] + 0.12, c - a, LV.mezz[1] - LV.mezz[0] - 0.18, 0.11, 'glass', 0.0);
    for (let j = 1; j < 6; j++) slab(b, F, a + ((c - a) * j) / 6, LV.mezz[0] + 0.12, 0.04, LV.mezz[1] - LV.mezz[0] - 0.18, 0.17, 'bronze');
    slab(b, F, (a + c) / 2, (LV.mezz[0] + LV.mezz[1]) / 2, c - a, 0.04, 0.21, 'bronze');
  }
  // the fascia beam (the shop's lettering is a tenant sign and is left off)
  slab(b, F, gc, LV.fascia[0], gw + 0.1, LV.fascia[1] - LV.fascia[0], 0.32, 'red');
  // tiled panel row under the first glazed storey, between iron posts
  slab(b, F, gc, LV.panels[0], gw, LV.panels[1] - LV.panels[0], 0.12 + back(gc), 'bronze', -back(gc));
  const np = herengracht ? 9 : 11;
  for (let k = 0; k < np; k++) slab(b, F, g0 + (gw * (k + 0.5)) / np, LV.panels[0] + 0.1, gw / np - 0.18, LV.panels[1] - LV.panels[0] - 0.2, 0.18, 'greyBrick');
  // first glazed storey: two lights per bay with a transom
  ironGlazing(b, F, bays, LV.gl1[0], LV.gl1[1], {lights: 2, transom: LV.gl1[1] - LV.gl1[0] - 0.75, back});
  for (const t of S.cols) colonnette(b, F, t, LV.gl1[0], LV.gl1[1]);
  // heavy iron beam with the stone ledge over it
  slab(b, F, gc, LV.beam1[0], gw, 0.5, 0.2 + back(gc), 'bronze', -back(gc));
  slab(b, F, gc, LV.beam1[0] + 0.5, gw + 0.2, 0.18, 0.42, 'sandstone');
  slab(b, F, gc, LV.beam1[0] + 0.68, gw, LV.beam1[1] - LV.beam1[0] - 0.68, 0.16 + back(gc), 'stone', -back(gc));
  // second glazed storey: segmental heads on the Herengracht, square on the Leidsestraat
  ironGlazing(b, F, bays, LV.gl2[0], LV.gl2[1], {lights: herengracht ? 2 : 3, transom: 2.3, head: herengracht ? 0.42 : 0, back});
  for (const t of S.cols) colonnette(b, F, t, LV.gl2[0], LV.gl2[1]);
  // beam and the balustrade band of stone
  slab(b, F, gc, LV.beam2[0], gw, 0.35, 0.2 + back(gc), 'bronze', -back(gc));
  slab(b, F, gc, LV.beam2[0] + 0.35, gw + 0.25, 0.14, 0.4, 'sandstone');
  slab(b, F, gc, LV.beam2[0] + 0.49, gw, LV.beam2[1] - LV.beam2[0] - 0.49, 0.26, 'sandstone');
  // attic storey in cream glazed brick with ochre courses and white-framed windows
  slab(b, F, gc, LV.beam2[1], gw, LV.frieze[0] - LV.beam2[1], 0.02 + back(gc), 'stone', -back(gc));
  const n = herengracht ? 6 : 8, sp = gw / n, ww = herengracht ? 1.05 : 0.95;
  const axes = Array.from({length: n}, (_, k) => g0 + sp * (k + 0.5));
  for (const y of [LV.attic[0] - 0.42, LV.attic[0] + 0.55, LV.attic[1] + 0.25]) {
    let at = g0;
    for (const t of [...axes.map(a => [a - ww / 2 - 0.1, a + ww / 2 + 0.1]), [g1, g1]]) { if (t[0] - at > 0.1) slab(b, F, (at + t[0]) / 2, y, t[0] - at, 0.12, 0.11, 'ochre'); at = t[1]; }
  }
  for (const t of axes) {
    slab(b, F, t, LV.attic[0] - 0.12, ww + 0.2, 0.12, 0.2, 'sandstone');
    slab(b, F, t, LV.attic[0], ww, LV.attic[1] - LV.attic[0], 0.08, 'frame');
    for (const s of [-1, 1]) {
      slab(b, F, t + s * ww / 4, LV.attic[0] + 0.08, ww / 2 - 0.1, 1.35, 0.13, 'glass');
      slab(b, F, t + s * ww / 4, LV.attic[0] + 1.53, ww / 2 - 0.1, LV.attic[1] - LV.attic[0] - 1.61, 0.13, 'glass');
    }
  }
  // tiled frieze: a band of patterned tiles between stone strings
  slab(b, F, (S.pierL[0] + S.pierR[1]) / 2, LV.frieze[0] - 0.12, S.pierR[1] - S.pierL[0] + 0.08, 0.12, 0.2, 'sandstone', 0);
  patternPanel(b, F, gc, LV.frieze[0], gw, LV.frieze[1] - LV.frieze[0], ['10100101', '01011010', '10100101'], 'greyBrick', 'ochre', 0.04, 0.05, 0.02);
  // overhanging cornice clad in copper: soffit, fascia and lip
  const L = S.pierR[1] - S.pierL[0], lc = (S.pierL[0] + S.pierR[1]) / 2;
  slab(b, F, lc, LV.frieze[1], L, LV.cornice[0] - LV.frieze[1], 0.18, 'sandstone');
  slab(b, F, lc, LV.cornice[0], L + 0.3, 0.32, 0.95, 'copper');
  slab(b, F, lc, LV.cornice[0] + 0.32, L + 0.4, LV.cornice[1] - LV.cornice[0] - 0.32, 1.1, 'copper');
  for (let x = S.pierL[0] + 0.5; x < S.pierR[1] - 0.3; x += 1.05) slab(b, F, x, LV.cornice[0] - 0.35, 0.14, 0.35, 0.55, 'copper');
  // the modern glazed roof pavilion standing on the cornice (seen over the Herengracht front only)
  if (herengracht) slab(b, F, 12.1, LV.roofGlass[0] + 0.05, 9.3, 23.8 - LV.roofGlass[0] - 0.05, 0.06, 'glass');
  if (herengracht) {
    for (let x = 7.45; x <= 16.8; x += 1.55) slab(b, F, x, LV.roofGlass[0], 0.12, 23.8 - LV.roofGlass[0], 0.1, 'sandstone');
    slab(b, F, 12.1, 23.8, 9.5, 0.15, 0.12, 'sandstone');
  }
  // the right-hand pier on the Herengracht rises over the cornice in a stepped stone-capped crest
  if (herengracht) {
    const [a, c] = S.pierR, tc = (a + c) / 2;
    slab(b, F, tc, LV.cornice[1], c - a, 1.3, 0.3, 'stone', -0.1);
    for (let y = LV.cornice[1] + 0.35; y < LV.cornice[1] + 1.2; y += 0.5) slab(b, F, tc, y, c - a + 0.01, 0.1, 0.36, 'ochre', -0.1);
    slab(b, F, tc, LV.cornice[1] + 1.3, c - a + 0.15, 0.16, 0.4, 'sandstone', -0.15);
    slab(b, F, tc, LV.cornice[1] + 1.46, (c - a) * 0.6, 0.5, 0.3, 'stone', -0.1);
    slab(b, F, tc, LV.cornice[1] + 1.96, (c - a) * 0.6 + 0.12, 0.14, 0.36, 'sandstone', -0.12);
  }
}

/** The plain stuccoed house in the same pand (Herengracht front t 0-5.4): three axes over the shared shop fascia. */
function whiteHouse(b: BuildingTools) {
  const F = FH, t0 = 0.02, t1 = 5.4, tc = (t0 + t1) / 2, w = t1 - t0;
  const hw = (y: number) => +((1225 - y) / 50).toFixed(3); // w02-43.alt.jpg (2017), ground fitted to the 3DBAG 14.7 m wall top
  ironGlazing(b, F, [[t0 + 0.2, t1 - 0.2]], 0.25, hw(1010) - 0.1, {lights: 4, transom: 2.6, back: () => 0});
  slab(b, F, tc, hw(1005), w, hw(975) - hw(1005), 0.28, 'red');
  const axes = [1.05, 2.7, 4.35];
  for (const [y0, y1] of [[hw(950), hw(825)], [hw(790), hw(705)], [hw(670), hw(600)]]) {
    for (const t of axes) {
      slab(b, F, t, y0 - 0.1, 1.3, 0.1, 0.12, 'concrete');
      slab(b, F, t, y0, 1.2, y1 - y0, 0.04, 'frame');
      slab(b, F, t, y0 + 0.06, 1.08, y1 - y0 - 0.12, 0.09, 'glass');
      slab(b, F, t, y0, 0.06, y1 - y0, 0.14, 'frame');
      slab(b, F, t, y0 + (y1 - y0) * 0.62, 1.08, 0.06, 0.18, 'frame');
      slab(b, F, t, y1 + 0.05, 1.3, 0.12, 0.12, 'concrete');
    }
  }
  slab(b, F, tc, hw(510), w, 0.22, 0.25, 'concrete');
  slab(b, F, tc, hw(500), w + 0.04, hw(490) - hw(500) + 0.05, 0.36, 'concrete');
}

/** The rounded Leidsestraat corner: shop glazing under a dark canopy, the curved glazed oriel to the balcony at 11.5 m. */
function corner(b: BuildingTools) {
  for (const {f: F, len} of CORNER) {
    const tc = len / 2;
    // the corner's own wall skin to the balcony roof: the 3DBAG rounds it in facets too narrow to host the glazing
    slab(b, F, tc, 0, len + 0.02, LV.beam1[1] - 0.2, 0.03, 'stone');
    slab(b, F, tc, 0, len + 0.02, 0.25, 0.14, 'sandstone');
    slab(b, F, tc, 0.25, len - 0.3, LV.mezz[1] - 0.25, 0.08, 'red', 0.04); // the corner shop entrance, in shadow under the oriel
    slab(b, F, tc, 0.25, 0.08, LV.mezz[1] - 0.25, 0.12, 'bronze', 0.1);
    slab(b, F, tc, LV.shop[1], len - 0.2, 0.08, 0.16, 'bronze', 0.1);
    // dark curved canopy under the oriel
    slab(b, F, tc, LV.mezz[1] - 0.05, len + 0.06, LV.fascia[1] - LV.mezz[1] + 0.05, 0.55, 'red');
    // oriel: stone sill band, iron-framed lights with transoms, a panel band and the stone balcony slab
    slab(b, F, tc, LV.fascia[1], len + 0.04, LV.gl1[0] + 0.3 - LV.fascia[1], 0.4, 'sandstone');
    // cream glazed-brick oriel wall with white-framed lights, a transom light row over each
    slab(b, F, tc, LV.gl1[0] + 0.3, len + 0.07, LV.gl1[1] - LV.gl1[0] - 0.3, 0.3, 'stone');
    const nl = len > 1.2 ? 2 : 1, lw = (len - 0.36) / nl - 0.14;
    for (let k = 0; k < nl; k++) {
      const t = 0.18 + (len - 0.36) * (k + 0.5) / nl;
      slab(b, F, t, LV.gl1[0] + 0.55, lw + 0.12, LV.gl1[1] - LV.gl1[0] - 0.85, 0.35, 'frame');
      slab(b, F, t, LV.gl1[0] + 0.61, lw, 2.05, 0.39, 'glass');
      slab(b, F, t, LV.gl1[0] + 2.74, lw, LV.gl1[1] - LV.gl1[0] - 3.1, 0.39, 'glass');
    }
    slab(b, F, tc, LV.gl1[1], len + 0.1, LV.beam1[1] - LV.gl1[1] - 0.15, 0.38, 'stone');
    slab(b, F, tc, LV.beam1[1] - 0.15, len + 0.12, 0.17, 0.5, 'sandstone');
    // balcony railing on the oriel roof: posts and a top rail with a curved iron panel
    slab(b, F, tc, LV.beam1[1] + 0.02, len, 0.05, 0.06, 'copper', 0.36);
    slab(b, F, tc, LV.beam1[1] + 1.0, len + 0.04, 0.06, 0.08, 'copper', 0.34);
    for (let x = 0.1; x < len; x += 0.42) slab(b, F, x, LV.beam1[1] + 0.02, 0.035, 1.0, 0.08, 'copper', 0.38);
  }
  // the set-back corner wall above the balcony: second-storey and attic windows (the 3DBAG wall at about 2 m behind)
  const A = [FH.origin[0] + FH.tangent[0] * 17.45 + FH.n[0] * -2.0, FH.origin[1] + FH.tangent[1] * 17.45 + FH.n[1] * -2.0];
  const B = [FL.origin[0] + FL.tangent[0] * -2.4 + FL.n[0] * -1.43, FL.origin[1] + FL.tangent[1] * -2.4 + FL.n[1] * -1.43];
  const len = Math.hypot(B[0] - A[0], B[1] - A[1]), tg: [number, number] = [(B[0] - A[0]) / len, (B[1] - A[1]) / len];
  const F: Frame = {origin: [A[0], A[1]], tangent: tg, n: [-tg[1], tg[0]]};
  // outward: away from the ring's vertex average
  const ring = src.facadeRing, cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  if (F.n[0] * (A[0] - cx) + F.n[1] * (A[1] - cz) < 0) { F.n = [tg[1], -tg[0]]; F.origin = [B[0], B[1]]; F.tangent = [-tg[0], -tg[1]]; }
  for (let y = LV.beam1[1] + 0.5; y < LV.cornice[0]; y += 0.62) slab(b, F, len / 2, y, len, 0.1, 0.04, 'ochre');
  slab(b, F, len / 2, LV.cornice[0], len + 0.3, LV.cornice[1] - LV.cornice[0], 0.9, 'copper');
  void archSlab;
}
