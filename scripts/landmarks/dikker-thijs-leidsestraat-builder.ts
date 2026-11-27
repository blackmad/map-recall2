import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, ledgeStrip, put, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {timberWindow} from './wallen-more-kit';
import {glyphRuns} from './mixed-case-glyphs';
import {cantedBayOn} from './canted-bay-kit';
import {balustrade} from '../../src/canalRecall/landmarks/balustrade';
import source from './dikker-thijs-leidsestraat-footprints.json';

/**
 * DIKKER & THIJS, Leidsestraat / Prinsengracht corner (BAG pand 0363100012169650, BAG year 1926, rijksmonument 518364;
 * the municipal register carries no description text): a six-storey brick corner block with a granite ground storey,
 * three canted two-storey oriels on each front, a loggia storey behind brick posts, a modillion cornice and a white roof
 * balustrade, and the "Dikker & Thijs" script lettering on the stone sign band.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts); walls to 19.8-20.6 m, a hipped roof behind
 * the balustrade to 25.4 m. The ring's first vertex splits the canal front in two collinear edges; `R` drops it.
 * Fronts (nearbar-kit ringFrame, t from the viewer's left):
 *  - Leidsestraat, R edge 2 (14.79 m, faces 143), t from the party wall: TMX7316060226-000022_pano_0000_000789 (2016,
 *    w02-142.jpg, 50 px/m from the party wall), with recording_2025-07-14_05-25-22_01750 (2025) for the ground storey.
 *  - Canal (Prinsengracht) front, R edge 8 (17.55 m, faces 48), t from the corner: TMX7316010203-000355_pano_0000_000172
 *    (2017, w01-48.jpg, t = (x - 62) / 50: the crop starts on the 1.23 m corner return) for positions, and
 *    TMX7316010203-001974_pano_0000_001045 (2021, w01-48.alt.jpg, 25 m out, the least parallax) for heights,
 *    h = (1125 - y) / 50 (the cornice crown lands on the 3DBAG 19.9 m wall top). The 2016 Leidsestraat crop, taken 9 m
 *    out, lifts everything that projects (the cornice reads 1 m high), so its heights are used only for flat parts.
 *  - The canted corner, R edge 5 (1.84 m, faces 95), and its two short returns R edges 4 and 6.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const R = src.facadeRing.slice(1);
const EL = ringFrame(R, 2), EK = ringFrame(R, 8), EC = ringFrame(R, 5), ES = ringFrame(R, 4), EN = ringFrame(R, 6);

/** Heights (m above the pavement), from the 2021 canal crop h = (1125 - y) / 50 and the 2025 Leidsestraat ground storey. */
export const H = {
  shop: [0.35, 4.3] as [number, number], // shop glass (2025 Leidsestraat y 1050-1250)
  mezz: [4.8, 7.0] as [number, number], // mezzanine window band (2025 y 915-1025)
  sign: [7.2, 8.6] as [number, number], // stone sign band (2021 y 700-780)
  bayFoot: 8.6,
  win1: [8.9, 11.5] as [number, number], // lower oriel lights (2021 y 550-680)
  win2: [12.6, 15.1] as [number, number], // upper oriel lights (2021 y 365-495)
  bayTop: 15.45,
  parapet: [15.45, 16.75] as [number, number], // pierced parapet (2021 y 290-350)
  loggia: [16.75, 18.45] as [number, number], // loggia lights (2021 y 205-290)
  frieze: [18.45, 19.3] as [number, number],
  corona: [19.5, 19.88] as [number, number], // stone corona (2021 y 135-150), the 3DBAG wall top 19.9
  rail: 20.75, // balustrade top (2021 y 90)
};
/** Pier spans (t0, t1) and bay centres per front. */
/** Width of a pier's post in the loggia storey. */
const POST = 0.55;
const LEIDSE = {piers: [[0.06, 1.0], [4.6, 5.6], [9.2, 10.2], [13.9, 14.79]] as [number, number][], bays: [2.8, 7.4, 12.05]};
const CANAL = {piers: [[0, 1.06], [4.36, 5.26], [8.56, 9.46], [12.76, 13.66], [16.76, 17.49]] as [number, number][], bays: [2.71, 6.91, 11.11], flat: 15.21};
const BAY = {base: 3.1, front: 1.5, out: 0.75};

export function buildDikkerThijsLeidsestraat(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.04, true);
  front(b, EL.f, EL.len, LEIDSE.piers, LEIDSE.bays, null);
  front(b, EK.f, EK.len, CANAL.piers, CANAL.bays, CANAL.flat);
  // Leidsestraat lettering over the corner bay (2016 x 480-750); canal lettering over the first two bays (2017 x 125-470)
  script(b, EL.f, 'Dikker & Thijs', 12.3, 0.068);
  script(b, EK.f, 'Dikker', 2.66, 0.08);
  script(b, EK.f, '& Thijs', 6.8, 0.075);
  corner(b);
  setSink(sink0);
}

/** White script lettering on the sign band: mixed-case pixel letters, taller than wide (the script's capitals). */
function script(b: BuildingTools, F: Frame, text: string, tc: number, px: number) {
  const {runs, width} = glyphRuns(text, px);
  const sy = 0.12 / px, y0 = H.sign[0] + 0.22;
  // the script's strokes are bold: every pixel run is widened by 0.4 px (neighbouring runs overlap, which reads as one stroke)
  for (const r of runs) ledgeStrip(b, F, tc - width / 2 + (r.t0 + r.t1) / 2, y0 + r.y0 * sy, r.t1 - r.t0 + 0.4 * px, (r.y1 - r.y0) * sy, 0.06, 'concrete', 0.3);
}

/** Granite pier of alternating long and short blocks with sunk joints. */
function granitePier(b: BuildingTools, F: Frame, t0: number, t1: number, y0: number, y1: number) {
  // the sunk joints behind the blocks: near-black granite ('bronze' palette name: 'dark' is an opening material for the gates)
  slab(b, F, (t0 + t1) / 2, y0, t1 - t0, y1 - y0, 0.16, 'bronze');
  for (let y = y0 + 0.03, k = 0; y < y1 - 0.15; y += 0.56, k++) {
    const inset = k % 2 ? 0.14 : 0.06; // joints at least 6 cm so the block sides never sit within 3 cm of the backing's
    slab(b, F, (t0 + t1) / 2, y, t1 - t0 - 2 * inset, Math.min(0.5, y1 - y - 0.03), 0.08, 'greyBrick', 0.16);
  }
}

/** Brick pier strip with dotted lines of light stone blocks down both edges, from y0 to y1. */
function brickPier(b: BuildingTools, F: Frame, t0: number, t1: number, y0: number, y1: number) {
  slab(b, F, (t0 + t1) / 2, y0, t1 - t0, y1 - y0, 0.14, 'brick');
  for (const e of [t0 + 0.12, t1 - 0.12]) for (let y = y0 + 0.2; y < y1 - 0.2; y += 0.42) ledgeStrip(b, F, e, y, 0.09, 0.12, 0.03, 'stone', 0.14);
  // the slender brick shaft in the middle of the pier, a step prouder
  slab(b, F, (t0 + t1) / 2, y0, (t1 - t0) * 0.36, y1 - y0, 0.06, 'brick', 0.14);
}

/** One bay of the ground storey between two granite piers: shop window, spandrel, mezzanine window band. */
function shopBay(b: BuildingTools, F: Frame, t0: number, t1: number) {
  const w = t1 - t0, tc = (t0 + t1) / 2;
  slab(b, F, tc, 0, w, 0.35, 0.1, 'greyBrick');
  // shop window: red-brown joinery, three lights and a transom
  // (the joinery panel and the lights stand 10 cm proud: the 3DBAG wall behind is a centimetre or two off the ring line)
  slab(b, F, tc, H.shop[0], w, H.shop[1] - H.shop[0], 0.1, 'red');
  timberWindow(b, F, tc, H.shop[0] + 0.06, w - 0.16, H.shop[1] - H.shop[0] - 0.12, {cols: 3, rows: 2, rowWeights: [3, 1], frame: 'red', glass: 'glass', sill: null, fw: 0.08, bar: 0.07, out: 0.1});
  slab(b, F, tc, H.shop[1], w, H.mezz[0] - H.shop[1] - 0.04, 0.12, 'dark'); // dark fascia
  // mezzanine band: five transomed lights (2025: x 275-445 in the middle bay)
  timberWindow(b, F, tc, H.mezz[0], w - 0.1, H.mezz[1] - H.mezz[0], {cols: 5, rows: 2, rowWeights: [3, 1], frame: 'red', glass: 'glass', sill: 'stone', fw: 0.08, bar: 0.07, out: 0.1});
  slab(b, F, tc, H.mezz[1], w, H.sign[0] - H.mezz[1], 0.06, 'stone');
}

/** The canted two-storey oriel on its stone base, with a decorated spandrel and plaque between the storeys. */
function oriel(b: BuildingTools, F: Frame, t: number) {
  const plan = {t, ...BAY};
  cantedBayOn(b, F, {
    plan, body: [H.bayFoot + 0.3, H.bayTop],
    windows: [{y0: H.win1[0], y1: H.win1[1], cols: 3, rows: 4, margin: 0.03, sideCols: 2, fw: 0.05}, {y0: H.win2[0], y1: H.win2[1], cols: 3, rows: 4, margin: 0.03, sideCols: 2, fw: 0.05}],
    bands: [
      {y: H.bayFoot, h: 0.3, d: 0.06}, // stone base
      {y: H.win1[1], h: 0.16, d: 0.04}, // lintel band
      {y: H.win2[0] - 0.18, h: 0.14, d: 0.05}, // sill band
      {y: H.win2[1], h: H.bayTop - H.win2[1] + 0.05, d: 0.06}, // cap (its top 5 cm over the body's)
    ],
    colonnettes: [{y0: H.win1[0], y1: H.win1[1], r: 0.06, capital: 0.14}, {y0: H.win2[0], y1: H.win2[1], r: 0.06, capital: 0.14}],
    colours: {wall: 'brick', trim: 'stone', glass: 'glass', frame: 'frame'},
  });
  // spandrel plaque on the front facet and the small vent over the base
  slab(b, F, t, H.win1[1] + 0.42, 0.55, 0.38, 0.06, 'stone', BAY.out);
  slab(b, F, t, H.bayFoot + 0.05, 0.5, 0.18, 0.04, 'dark', BAY.out + 0.06);
}

/** The flat north-west bay of the canal front: paired windows in a stone surround on each oriel storey. */
function flatBay(b: BuildingTools, F: Frame, t: number) {
  for (const [y0, y1] of [H.win1, H.win2]) {
    slab(b, F, t, y0 - 0.2, 2.9, y1 - y0 + 0.4, 0.08, 'stone');
    for (const s of [-1, 1]) timberWindow(b, F, t + s * 0.64, y0, 1.18, y1 - y0, {cols: 2, rows: 4, frame: 'frame', glass: 'glass', sill: null, out: 0.08});
    slab(b, F, t, y0 - 0.05, 0.14, y1 - y0 + 0.1, 0.16, 'stone'); // the stone mullion between the pair
  }
}

/** The top storey loggia across a bay: glazing on the wall, brick posts with stone capitals, a dark soffit over it. */
function loggia(b: BuildingTools, F: Frame, t0: number, t1: number, out: number) {
  const w = t1 - t0, n = 3, step = w / n;
  slab(b, F, (t0 + t1) / 2, H.loggia[0], w, H.frieze[0] - H.loggia[0], 0.1, 'dark');
  for (let k = 0; k < n; k++) timberWindow(b, F, t0 + step * (k + 0.5), H.loggia[0] + 0.1, step - 0.32, H.loggia[1] - H.loggia[0] - 0.15, {cols: 3, rows: 2, frame: 'frame', glass: 'glass', sill: null, out: 0.1});
  for (let k = 1; k < n; k++) {
    const tp = t0 + step * k;
    slab(b, F, tp, H.loggia[0], 0.3, H.frieze[0] - H.loggia[0], out, 'brick');
    slab(b, F, tp, H.loggia[1] - 0.05, 0.42, 0.3, out + 0.08, 'stone'); // corbel capital
  }
  slab(b, F, (t0 + t1) / 2, H.frieze[0] - 0.08, w, 0.08, out, 'dark'); // soffit edge
}

/** Pierced brick parapet over an oriel bay: a band with a row of small square holes and a stone coping. */
function parapet(b: BuildingTools, F: Frame, t0: number, t1: number, out: number) {
  const w = t1 - t0, tc = (t0 + t1) / 2, [y0, y1] = H.parapet;
  slab(b, F, tc, y0, w, y1 - y0 - 0.12, out, 'brick');
  slab(b, F, tc, y0 - 0.12, w - 0.1, 0.12, out - 0.08, 'stone'); // corbel table
  const n = Math.max(4, Math.round(w / 0.34));
  // the pierced holes read as shadow; drawn in the granite's dark grey (they are not windows, so not the 'dark' opening slot)
  for (let k = 0; k < n; k++) slab(b, F, t0 + (w / n) * (k + 0.5), y1 - 0.42, 0.14, 0.16, 0.02, 'greyBrick', out);
  slab(b, F, tc, y1 - 0.12, w + 0.04, 0.12, out + 0.05, 'stone');
}

/** Cornice: brick frieze, square stone modillions, the corona, then the white balustrade between brick piers. */
function cornice(b: BuildingTools, F: Frame, t0: number, t1: number, out: number, posts: [number, number][]) {
  const w = t1 - t0, tc = (t0 + t1) / 2;
  slab(b, F, tc, H.frieze[0], w, H.corona[0] - H.frieze[0], out, 'brick');
  for (let x = t0 + 0.25; x < t1 - 0.1; x += 0.66) slab(b, F, x, H.frieze[1], 0.22, H.corona[0] - H.frieze[1], out + 0.22, 'stone');
  slab(b, F, tc, H.corona[0], w + 0.1, H.corona[1] - H.corona[0], out + 0.32, 'stone');
  // balustrade spans between the piers; the piers rise as brick blocks with stone caps
  const bo = out - 0.1;
  for (const [a, c] of posts) {
    slab(b, F, (a + c) / 2, H.corona[1], c - a, H.rail + 0.25 - H.corona[1], bo + 0.2, 'brick');
    slab(b, F, (a + c) / 2, H.rail + 0.25, c - a + 0.08, 0.12, bo + 0.24, 'stone');
  }
  for (let i = 0; i + 1 < posts.length; i++) {
    const a = posts[i][1], c = posts[i + 1][0], L = balustrade({width: c - a, height: H.rail - H.corona[1], post: 0.12, plinth: 0.12, rail: 0.1, baluster: 0.06, pitch: 0.2});
    const mid = (a + c) / 2;
    slab(b, F, mid, H.corona[1] + L.plinth.y, L.plinth.x1 - L.plinth.x0, L.plinth.h, 0.2, 'sandstone', bo);
    slab(b, F, mid, H.corona[1] + L.rail.y, L.rail.x1 - L.rail.x0, L.rail.h, 0.2, 'sandstone', bo);
    for (const p of L.balusters) slab(b, F, mid + p.x, H.corona[1] + p.y, p.w, p.h, 0.06, 'sandstone', bo + 0.07);
  }
}

function front(b: BuildingTools, F: Frame, L: number, piers: [number, number][], bays: number[], flat: number | null) {
  // ground storey: granite piers and the shop bays between them; the stone sign band over everything
  for (const [a, c] of piers) granitePier(b, F, a, c, 0, H.sign[0]);
  for (let i = 0; i + 1 < piers.length; i++) shopBay(b, F, piers[i][1], piers[i + 1][0]);
  // the sign band is a deep stone entablature: fascia, a moulded bed and a cornice 0.55 m out (2016 crop: its soffit
  // casts the shadow over the lettering)
  // It runs from the first to the last pier: at the party wall the pier stops 6 cm short of the neighbour's wall plane
  // (no coplanar end faces), at the corner the mouldings run 5-10 cm past the front to meet the corner's.
  const s0 = piers[0][0], s1 = piers[piers.length - 1][1], e0 = s0 > 0 ? 0 : 1, e1 = s1 < L ? 0 : 1;
  const band = (y: number, h: number, d: number, over: number) => slab(b, F, (s0 - over * e0 + s1 + over * e1) / 2, y, s1 - s0 + over * (e0 + e1), h, d, 'stone');
  band(H.sign[0], H.sign[1] - H.sign[0], 0.22, 0);
  band(H.sign[1] - 0.3, 0.16, 0.38, 0.05);
  band(H.sign[1] - 0.14, 0.16, 0.55, 0.1);
  band(H.sign[0], 0.12, 0.3, 0);
  // upper storeys: brick piers to the cornice, oriels, parapets and the loggia between them
  for (const [a, c] of piers) {
    // the pier runs full width to the loggia floor; in the loggia storey it narrows to a 0.55 m post on its axis (2016 crop
    // x 235-265 over the 1 m pier), so the loggia lights keep their spacing across it
    brickPier(b, F, a, c, H.sign[1], H.loggia[0]);
    brickPier(b, F, (a + c) / 2 - POST / 2, (a + c) / 2 + POST / 2, H.loggia[0], H.frieze[0]);
    // carved console under the pier head (the lamps on the 2021 crop)
    slab(b, F, (a + c) / 2, H.sign[1], 0.36, 0.5, 0.3, 'stone');
  }
  for (const t of bays) oriel(b, F, t);
  if (flat !== null) flatBay(b, F, flat);
  for (let i = 0; i + 1 < piers.length; i++) {
    const a = piers[i][1], c = piers[i + 1][0];
    // spandrel band under the oriel foot and over the sign band, the brick between oriels
    parapet(b, F, a, c, 0.62);
    loggia(b, F, (piers[i][0] + a) / 2 + POST / 2, (c + piers[i + 1][1]) / 2 - POST / 2, 0.5);
  }
  cornice(b, F, 0, L, 0.5, piers);
}

/** The canted corner and its two short returns: granite, the sign band, one light per storey, cornice and balustrade. */
function corner(b: BuildingTools) {
  for (const E of [ES, EN]) {
    const F = E.f, L = E.len;
    // the granite runs 0.16 m past both ends, round the front's corner pier: its end faces then stand clear of the
    // neighbouring wall planes instead of lying in them
    granitePier(b, F, -0.16, L + 0.16, 0, H.sign[0]);
    slab(b, F, L / 2, H.sign[0], L, H.sign[1] - H.sign[0], 0.22, 'stone');
    brickPier(b, F, 0, L, H.sign[1], H.frieze[0]);
    cornice(b, F, -0.1, L + 0.1, 0.5, [[-0.1, L + 0.1]]);
  }
  const F = EC.f, L = EC.len, tc = L / 2;
  granitePier(b, F, 0, L, 0, H.sign[0]);
  slab(b, F, tc, H.sign[0], L, H.sign[1] - H.sign[0], 0.22, 'stone');
  slab(b, F, tc, H.sign[1] - 0.12, L + 0.05, 0.14, 0.34, 'stone');
  // the corner oriel: a canted bay on the chamfer from the sign band to the frieze, lit on three storeys (2017 aimed view
  // x 140-210 and 2016 aimed view x 880-925, colonnettes). Its two side facets each face one street and carry the lights;
  // the 0.5 m nose between them is stone-banded brick (the facets are 1.04 m, wide enough to host a window)
  const loggiaRow = {y0: H.loggia[0] + 0.1, y1: H.loggia[1] - 0.05, cols: 2, rows: 3, margin: 0.1, sideCols: 2};
  cantedBayOn(b, F, {
    plan: {t: tc, base: L, front: 0.5, out: 0.8}, body: [H.bayFoot + 0.3, H.frieze[0]],
    windows: [{y0: H.win1[0], y1: H.win1[1], cols: 2, rows: 4, margin: 0.1, sideCols: 2}, {y0: H.win2[0], y1: H.win2[1], cols: 2, rows: 4, margin: 0.1, sideCols: 2}, loggiaRow],
    bands: [{y: H.bayFoot, h: 0.3, d: 0.06}, {y: H.win1[1], h: 0.16, d: 0.04}, {y: H.win2[1], h: 0.3, d: 0.05}, {y: H.parapet[1] - 0.14, h: 0.14, d: 0.05}],
    colonnettes: [{y0: H.win1[0], y1: H.win1[1], r: 0.07, capital: 0.12}, {y0: H.win2[0], y1: H.win2[1], r: 0.07, capital: 0.12}],
    colours: {wall: 'brick', trim: 'stone', glass: 'glass', frame: 'frame'},
  });
  cornice(b, F, -0.05, L + 0.05, 0.5, [[-0.05, 0.3], [L - 0.3, L + 0.05]]);
  // the corner rises over the balustrade as a brick block with a stone cap (both aimed views)
  slab(b, F, tc, H.corona[1], L + 0.2, 1.45, 0.75, 'brick');
  slab(b, F, tc, H.corona[1] + 1.45, L + 0.35, 0.16, 0.85, 'stone');
  put(b, F, new T.BoxGeometry(L - 0.4, 0.35, 0.5).translate(0, 0.175, 0.25), tc, H.corona[1] + 1.61, 0.1, 'brick');
}
