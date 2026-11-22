import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {disc, getSink, ledgeStrip, letters, poly, ringSlab, segBand, setSink, slab, ringFrame, type Frame} from './nearbar-kit';
import {scrollDormer} from '../../src/canalRecall/landmarks/scrollDormer';
import source from './hotel-v-frederiksplein-footprints.json';

/**
 * HOTEL V FREDERIKSPLEIN, Weteringschans 136 / Huidekoperstraat 19 (BAG pand 0363100012253826, BAG 1870; gemeentelijk
 * monument 205051, wikidata Q111410225). Register: three houses on the Weteringschans and the house Huidekoperstraat 19,
 * built as one project on a square plot of Sarphati's plan, the Weteringschans houses joining a low annexe of
 * Westeinde 2. Today one hotel (Hotel V): the ground storey of the three houses is a stone-clad shopfront with the
 * HOTEL V sign on its fascia, on both the Weteringschans and the Huidekoperstraat.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts) as scanned: the three 14.7 m houses with
 * their roofs to 18.6 m and the three dormer bumps flush with the front to 17.3 m, the 8.5 m brick bay at the east end
 * (the pand's 2 m on the Weteringschans next to Westeinde 2's curved shop wing), the courtyard and Huidekoperstraat 19
 * (10 m, its dormer to 12.3 m). 3DBAG reads the gateway between the corner house and no. 19 as a 1.7 m courtyard roof;
 * the photo shows a 4.8 m brick screen wall with the gate, added here.
 *
 * Fronts read from Gemeente Amsterdam panoramas (CC BY 4.0), positions in metres along the facade-ring edges from the
 * viewer's left (ringFrame), heights above the 3DBAG ground:
 *  - Weteringschans (ring edge 5, w01-346): TMX7316010203-002545_pano_0000_000625 (2022) and
 *    TMX7316010203-001048_pano_0000_000788 (2018, leaf-off), rectified at 50 px/m; positions fitted to the three 3DBAG
 *    dormer bumps (house axes 4.37, 11.12, 18.11 m from the east end of the houses, t = x * 0.02036 - 0.31);
 *  - Huidekoperstraat (ring edge 0, w02-255): b_20241204_1003_Track09_Sphere_00104 (2024, rectified with big-rectify.ts,
 *    the clearest), TMX7316010203-002364_pano_0004_000329 (2021) and TMX7316060226-000020_pano_0000_000428 (2016,
 *    sunlit: the measured colours), and the aimed views in artifacts/landmark-briefs/hotel-v-frederiksplein/aim.
 * Storey lines from the Weteringschans crop with its pavement at y 860 and the cornice top at the 3DBAG eaves (14.7 m,
 * 44.6 px/m; the Huidekoperstraat rectification reads 0.3-0.7 m lower and its scale is less sure): fascia 3.4-4.6 m,
 * storey two 6.0-8.55 m, storey three 10.1-12.3 m, frieze 13.2-13.9 m, cornice to 14.7 m. Per item in
 * hotel-v-frederiksplein-inventory.json.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const edge = (i: number) => ringFrame(src.facadeRing, i);

/** Weteringschans: ring edge 5 runs from the east end of the brick bay; the houses start 2.07 m along it. */
const FRONT = 5, T0 = 2.07, FRONT_W = 21.71;
/** House axes (dormers, centre bays) and the side-bay offset, metres from the east end of the houses. */
const AXES = [4.37, 11.12, 18.11], SIDE = 2.2;
/** Stone pilasters: corners and between the houses (centre, width). */
const PILASTERS: [number, number][] = [[0.42, 0.55], [7.75, 0.72], [14.6, 0.72], [21.43, 0.55]];
const WEST = 0;
/** Storey lines. */
const GF = {plinth: 0.35, glassTop: 3.4, fascia: [3.4, 4.6] as [number, number], cornice: [4.6, 5.0] as [number, number]};
const S2: [number, number] = [6.0, 8.55];
const S3: [number, number] = [10.1, 12.3];
const FRIEZE: [number, number] = [13.2, 13.9];
/** Pilaster roundels (w01-346 2018: y 450 px). */
const ROUNDEL = 9.2;
const EAVES = 14.68;
const WIN = 1.24;

export function buildHotelVFrederiksplein(_w: number, _d: number, b: BuildingTools) {
  // Huidekoperstraat 19 and the courtyard walls south of the corner house are the redder brick of no. 19 (w02-255 2016);
  // shell walls standing wholly above the cornice line (the dormer bumps' cheeks and the steps in the roof behind them) are
  // roof cladding, not brick: the photos show no brick above the cornice
  addShell(b, src as never, {wall: 'brick', roof: 'slate', wallFor: s => (minY(s) > EAVES + 0.05 ? 'slate' : centroidZ(s) > 4.6 ? 'greyBrick' : 'brick')});
  const sink0 = getSink();
  setSink(0.12, true);
  weteringschans(b);
  huidekoperstraat(b);
  eastBay(b);
  setSink(sink0);
}

/**
 * A wall frame on the straight line a -> c (native x, z), outward normal on the west side, t = 0 at `zero` projected onto
 * the line. The Huidekoperstraat front is two 3DBAG walls 0.3 deg apart (the corner house, -14.49,-6.26 -> -11.80,4.10,
 * and no. 19 behind the BAG ring's 6 cm jog), which the merged facade-ring edge misses by up to 5 cm: thin trim drawn on
 * the merged edge sank into the shell or stood 1-2 cm off it (coplanar overlap 4.9 m2 at the first export).
 */
function westFrame(a: [number, number], c: [number, number], zero: [number, number]): Frame {
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]), tan: [number, number] = [(c[0] - a[0]) / L, (c[1] - a[1]) / L];
  const n: [number, number] = [-tan[1], tan[0]];
  if (n[0] > 0) throw new Error('westFrame: normal must face west');
  const k = (zero[0] - a[0]) * tan[0] + (zero[1] - a[1]) * tan[1];
  return {origin: [a[0] + tan[0] * k, a[1] + tan[1] * k], tangent: tan, n};
}
const WEST_A = westFrame([-14.491, -6.258], [-11.796, 4.095], [-14.492, -6.269]);
const WEST_B = westFrame([-11.617, 4.516], [-9.085, 14.107], [-14.492, -6.269]);

const minY = (s: Surface) => Math.min(...s.rings[0].map(p => p[1]));
const centroidZ = (s: Surface) => { const r = s.rings[0]; return r.reduce((a, p) => a + p[2], 0) / r.length; };

/** Segmental-headed outline of width w and height h (crown), rise at the head; bottom-centre origin. */
function segOutline(w: number, h: number, rise: number, n = 8): [number, number][] {
  const R = (w * w / 4 + rise * rise) / (2 * rise), pts: [number, number][] = [[-w / 2, 0], [w / 2, 0]];
  for (let i = 0; i <= n; i++) { const x = w / 2 - w * i / n; pts.push([x, h - rise + (Math.sqrt(R * R - x * x) - (R - rise))]); }
  return pts;
}

/**
 * Cream timber window with a segmental head: frame, glass, the transom under the fanlight and the mullion of the two
 * casements below it (w01-346 2018 at 2x: the fanlight is about a quarter of the height), a stone sill.
 */
function segWin(b: BuildingTools, f: Frame, c: number, [y0, y1]: [number, number], w: number, o: {out?: number; rise?: number; sill?: boolean; mullion?: boolean; transom?: number} = {}) {
  const out = o.out ?? 0, rise = o.rise ?? 0.16, h = y1 - y0;
  poly(b, f, c, y0 - 0.06, segOutline(w + 0.16, h + 0.12, rise + 0.02), 0.08, 'white', out);
  poly(b, f, c, y0, segOutline(w, h, rise), 0.13, 'glass', out);
  const tr = o.transom ?? 0.27;
  if (tr > 0) slab(b, f, c, y1 - rise - h * tr, w, 0.07, 0.05, 'white', out + 0.13);
  if (o.mullion !== false) slab(b, f, c, y0, 0.07, h * (1 - tr) - rise, 0.05, 'white', out + 0.13);
  if (o.sill !== false) slab(b, f, c, y0 - 0.16, w + 0.3, 0.12, 0.2, 'stone', out);
}

/** Black iron balcony: stone floor slab on two consoles, top and bottom rail, bars (w01-346: about 1.0 m tall, 2.0 m wide, 0.55 m deep). */
function balcony(b: BuildingTools, f: Frame, c: number, y: number, w = 2.0, dep = 0.55) {
  slab(b, f, c, y - 0.15, w, 0.15, dep, 'stone');
  for (const s of [-1, 1]) slab(b, f, c + s * (w / 2 - 0.2), y - 0.45, 0.2, 0.3, dep - 0.15, 'stone');
  const front = dep - 0.04, sink = getSink();
  setSink(0);
  slab(b, f, c, y + 0.92, w, 0.05, 0.05, 'bronze', front - 0.01);
  slab(b, f, c, y + 0.08, w, 0.04, 0.04, 'bronze', front);
  for (const s of [-1, 1]) slab(b, f, c + s * (w / 2 - 0.02), y + 0.92, 0.04, 0.05, front - 0.02, 'bronze', 0.02);
  const n = Math.round(w / 0.14);
  for (let k = 0; k <= n; k++) slab(b, f, c - w / 2 + 0.02 + (w - 0.04) * k / n, y, 0.025, 0.95, 0.025, 'bronze', front);
  setSink(sink, true);
}

/** Stone pilaster with a sunk panel and a roundel (w01-346: panelled, the roundel at 9.2 m). */
function pilaster(b: BuildingTools, f: Frame, t: number, w: number, y0: number, y1: number, d = 0.12) {
  slab(b, f, t, y0, w, y1 - y0, d, 'stone');
  if (w > 0.6) {
    for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 - 0.06), y0 + 0.1, 0.12, y1 - y0 - 0.2, 0.06, 'stone', d);
    slab(b, f, t, y0 + 0.1, w, 0.12, 0.06, 'stone', d);
    slab(b, f, t, y1 - 0.22, w, 0.12, 0.06, 'stone', d);
  }
  disc(b, f, t, ROUNDEL, Math.min(0.24, w / 2 - 0.08), 0.08, 'stone', d);
}

/** Rusticated stone pier of the ground storey: back slab and blocks with 4 cm joints (w02-255 2024 crop). */
function rusticPier(b: BuildingTools, f: Frame, t0: number, t1: number, y0: number, y1: number) {
  const c = (t0 + t1) / 2, w = t1 - t0;
  slab(b, f, c, y0, w, y1 - y0, 0.1, 'sandstone');
  for (let y = y0 + 0.02; y < y1 - 0.2; y += 0.46) slab(b, f, c, y, w - 0.02, Math.min(0.42, y1 - y - 0.02), 0.06, 'sandstone', 0.1);
}

/** Shopfront glazing between piers: dark plinth, glass recessed behind the stone, slim light frames and mullions. */
function shop(b: BuildingTools, f: Frame, t0: number, t1: number, mullions: number[], top = GF.glassTop) {
  const c = (t0 + t1) / 2, w = t1 - t0;
  slab(b, f, c, 0, w, GF.plinth, 0.12, 'dark');
  slab(b, f, c, GF.plinth, w, top - GF.plinth, 0.06, 'glass');
  for (const t of [t0 + 0.04, t1 - 0.04, ...mullions]) slab(b, f, t, GF.plinth, 0.08, top - GF.plinth, 0.12, 'white');
  slab(b, f, c, GF.plinth, w, 0.08, 0.12, 'white');
  slab(b, f, c, top - 0.08, w, 0.08, 0.12, 'white');
}

/**
 * Stone fascia and moulded ground-storey cornice from t0 to t1. `ext1` (0 or 1) carries each layer past t1 by its own
 * depth, so it fills the outside corner square and meets the other face's layer edge to edge (no coplanar overlap).
 */
function fascia(b: BuildingTools, f: Frame, t0: number, t1: number, ext1 = 0) {
  const layers: [number, number, number][] = [[GF.fascia[0], GF.fascia[1] - GF.fascia[0], 0.14], [GF.cornice[0], 0.12, 0.24], [GF.cornice[0] + 0.12, GF.cornice[1] - GF.cornice[0] - 0.12, 0.36]];
  for (const [y, h, d] of layers) { const z = t1 + ext1 * d; slab(b, f, (t0 + z) / 2, y, z - t0, h, d, 'sandstone'); }
}

/** Frieze and main cornice: bed moulding, console brackets, corona (w02-255 2024: brackets about 3 m apart). */
function entablature(b: BuildingTools, f: Frame, t0: number, t1: number, ext0: number, ext1: number) {
  const corona = EAVES - 0.38, mid = FRIEZE[1] + 0.18;
  const layers: [number, number, number][] = [[FRIEZE[0], FRIEZE[1] - FRIEZE[0], 0.1], [FRIEZE[1], 0.18, 0.22], [mid, corona - mid, 0.32], [corona, 0.38, 0.6]];
  for (const [y, h, d] of layers) {
    const a = t0 - ext0 * d / 0.6, z = t1 + ext1 * d / 0.6;
    slab(b, f, (a + z) / 2, y, z - a, h, d, 'stone');
  }
  for (let t = t0 + 0.9; t < t1 - 0.5; t += 1.5) slab(b, f, t, FRIEZE[1] + 0.05, 0.22, corona - FRIEZE[1] - 0.05, 0.52, 'stone');
}

/**
 * Weteringschans (edge 5): the stone ground storey with the shopfronts, the wooden side door and HOTEL V on the fascia;
 * three houses of three bays between panelled stone pilasters, segmental-headed windows, the stone aedicule round each
 * middle bay with the pediment hood and balcony on storey two, the arched surround on storey three (with a balcony on
 * the middle house), frieze and cornice, and the three stone dormers with flared cheeks.
 */
function weteringschans(b: BuildingTools) {
  const {f} = edge(FRONT);
  const t = (th: number) => T0 + th;
  // ground storey (w01-346 2022/2018): pier, wooden door with louvred transom, pier, shopfront, piers under the pilasters
  rusticPier(b, f, t(0), t(1.67), 0, GF.fascia[0]);
  slab(b, f, t(2.635), 0, 1.93, 0.18, 0.12, 'sandstone');
  slab(b, f, t(2.635), 0.18, 1.93, 2.35, 0.06, 'ochre');
  for (const s of [-0.48, 0, 0.48]) slab(b, f, t(2.635) + s, 0.3, 0.06, 2.1, 0.05, 'ochre', 0.06);
  slab(b, f, t(2.635), 2.53, 1.93, 0.87, 0.06, 'dark');
  for (let y = 2.6; y < 3.35; y += 0.11) slab(b, f, t(2.635), y, 1.85, 0.04, 0.05, 'dark', 0.06);
  rusticPier(b, f, t(3.6), t(3.9), 0, GF.fascia[0]);
  shop(b, f, t(3.9), t(7.26), []);
  rusticPier(b, f, t(7.26), t(8.04), 0, GF.fascia[0]);
  shop(b, f, t(8.04), t(14.39), [t(9.16), t(13.23)]);
  rusticPier(b, f, t(14.39), t(15.08), 0, GF.fascia[0]);
  shop(b, f, t(15.08), t(21.07), [t(16.18), t(19.95)]);
  rusticPier(b, f, t(21.07), t(FRONT_W) + 0.16, 0, GF.fascia[0]);
  // wall lamps on the piers
  for (const th of [0.84, 7.65, 14.73]) slab(b, f, t(th), 3.0, 0.16, 0.22, 0.22, 'dark', 0.16);
  fascia(b, f, t(0), t(FRONT_W), 1);
  // HOTEL V: black letters on the fascia over the middle house, the V in a ring (w01-346 2022: 0.5 m tall, 9.9-12.3 m)
  hotelV(b, f, t(10.95), t(12.25));

  // upper storeys
  for (const [c, w] of PILASTERS) pilaster(b, f, t(c), w, GF.cornice[1], FRIEZE[0]);
  for (const [k, a] of AXES.entries()) {
    for (const s of [-SIDE, SIDE]) {
      const c = t(a + s);
      segWin(b, f, c, S2, WIN);
      segBand(b, f, c, S2[1] + 0.12, WIN + 0.36, 0.18, 0.24, 0.05, 'red');
      segWin(b, f, c, S3, WIN);
      segBand(b, f, c, S3[1] + 0.12, WIN + 0.36, 0.18, 0.24, 0.05, 'red');
    }
    middleBay(b, f, t(a), k === 1);
  }
  entablature(b, f, t(0), t(FRONT_W), 0.6, 0.6);
  // the stone dormers with flared cheeks on the 3DBAG bumps (2018 leaf-off crop: cap 2.1 m, base 2.85 m, cap top 17.3 m)
  for (const a of AXES) dormer(b, f, t(a));
}

/**
 * HOTEL V on the fascia: condensed black capitals 0.56 m tall and the V in a 0.8 m ring (w01-346 2022: HOTEL 1.9 m wide;
 * the 2024 Huidekoperstraat crop: the ring 0.8-0.9 m across). `ht` and `rc`: centres of the word and the ring.
 */
function hotelV(b: BuildingTools, f: Frame, ht: number, rc: number) {
  letters(b, f, 'HOTEL', ht, 3.72, 0.14, 0.066, 0.05, 'dark', 0.08);
  ringSlab(b, f, rc, 4.0, 0.33, 0.4, 0.05, 'dark', 0.14, 24);
  letters(b, f, 'V', rc, 3.74, 0.14, 0.07, 0.05, 'dark', 0.065);
}

/** Middle bay of a house: aedicule with pediment hood and balcony on storey two, arched surround on storey three. */
function middleBay(b: BuildingTools, f: Frame, c: number, upperBalcony: boolean) {
  const w = 1.3;
  // storey two: French doors from the balcony floor, stone jambs and lintel, segmental pediment hood on consoles
  segWin(b, f, c, [5.3, S2[1]], w, {sill: false, transom: 0.22});
  for (const s of [-1, 1]) slab(b, f, c + s * (w / 2 + 0.2), 5.15, 0.3, S2[1] - 5.15 + 0.15, 0.12, 'stone');
  slab(b, f, c, S2[1] + 0.05, w + 0.7, 0.36, 0.12, 'stone');
  for (const s of [-1, 1]) slab(b, f, c + s * (w / 2 + 0.24), S2[1] + 0.05, 0.2, 0.36, 0.22, 'stone');
  poly(b, f, c, S2[1] + 0.41, segOutline(w + 1.0, 0.42, 0.28), 0.3, 'stone');
  balcony(b, f, c, 5.3);
  // storey three: arched stone surround with a keystone; the middle house has a balcony
  segWin(b, f, c, S3, w, {sill: !upperBalcony});
  for (const s of [-1, 1]) slab(b, f, c + s * (w / 2 + 0.16), S3[0] - 0.05, 0.22, S3[1] - S3[0] - 0.1, 0.12, 'stone');
  segBand(b, f, c, S3[1] - 0.14, w + 0.54, 0.3, 0.26, 0.2, 'stone');
  slab(b, f, c, S3[1] + 0.02, 0.24, 0.3, 0.18, 'stone');
  if (upperBalcony) balcony(b, f, c, S3[0] - 0.4);
}

/** Stone dormer with flared cheeks (kit scrollDormer), two-light window, moulded cap. */
function dormer(b: BuildingTools, f: Frame, c: number) {
  // body 2.36 m: 4-15 cm outside the 3DBAG bump's cheeks (2.06-2.28 m), so no side face shares the cheek's plane
  const y0 = EAVES, y1 = 16.9, body = 2.36;
  const {outline} = scrollDormer({t: 0, width: body, flare: 0.25, y0: 0, coveH: 0.55, y1: y1 - y0});
  poly(b, f, c, y0, outline, 0.16, 'stone');
  segWin(b, f, c, [15.05, 16.5], 1.4, {out: 0.16, rise: 0.06, sill: false, transom: 0.3});
  slab(b, f, c, y1, body + 0.3, 0.2, 0.36, 'stone');
  // its top 0.15 m over the 3DBAG bump roof (17.29-17.41 m) so the two never share a plane
  slab(b, f, c, y1 + 0.2, body + 0.5, 0.46, 0.48, 'stone');
}

/**
 * Huidekoperstraat (edge 0, viewer's left = the Weteringschans corner): the corner house's return with the stone ground
 * storey (shop window, HOTEL V, the white triple door), three upper bays (a small window by the corner, a blind niche,
 * a segmental-headed window) between the corner pilasters; then the brick screen wall with the gate and its fanlight;
 * then Huidekoperstraat 19: two storeys of three bays, cream bracketed cornice and a dormer.
 */
function huidekoperstraat(b: BuildingTools) {
  let f = WEST_A;
  const END = 10.7;
  // ground storey (2024 rectification: t = (x - 20) * 10.7 / 565)
  rusticPier(b, f, 0, 0.85, 0, GF.fascia[0]);
  shop(b, f, 0.85, 6.91, [1.93, 5.78]);
  rusticPier(b, f, 6.91, 7.58, 0, GF.fascia[0]);
  // the white triple door with its three-light fanlight
  const dc = 8.76, dw = 2.36;
  slab(b, f, dc, 0, dw, 0.12, 0.12, 'sandstone');
  slab(b, f, dc, 0.12, dw, GF.glassTop - 0.12, 0.06, 'white');
  for (const k of [-1, 0, 1]) slab(b, f, dc + k * 0.74, 0.45, 0.5, 2.0, 0.06, 'glass', 0.06);
  slab(b, f, dc, 2.82, dw, 0.08, 0.06, 'white', 0.06);
  for (const k of [-1, 0, 1]) slab(b, f, dc + k * 0.74, 2.95, 0.6, 0.36, 0.06, 'glass', 0.06);
  rusticPier(b, f, 9.94, END, 0, GF.fascia[0]);
  fascia(b, f, 0, END);
  slab(b, f, 7.24, 3.0, 0.16, 0.22, 0.22, 'dark', 0.16);
  hotelV(b, f, 3.55, 4.95);
  // upper storeys: corner pilaster (wrapping the corner), the end pilaster, the three bays
  pilaster(b, f, 0.26, 0.76, GF.cornice[1], FRIEZE[0]);
  pilaster(b, f, 10.42, 0.57, GF.cornice[1], FRIEZE[0]);
  for (const [y0, y1] of [[S2[0], S2[0] + 1.25], [S3[0], S3[0] + 1.25]] as [number, number][]) {
    segWin(b, f, 1.42, [y0, y1], 0.95, {rise: 0.05, transom: 0.3});
    segBand(b, f, 1.42, y1 + 0.15, 1.25, 0.14, 0.22, 0.05, 'red');
  }
  for (const [y0, y1] of [S2, S3]) {
    // blind niche: a recessed brick panel with its corbelled sill and relieving arch
    slab(b, f, 4.13, y0 - 0.3, 1.27 + 0.24, 0.3, 0.1, 'red');
    slab(b, f, 4.13 - 0.69, y0, 0.12, y1 - y0, 0.06, 'brick');
    slab(b, f, 4.13 + 0.69, y0, 0.12, y1 - y0, 0.06, 'brick');
    segBand(b, f, 4.13, y1 + 0.02, 1.6, 0.2, 0.24, 0.05, 'red');
    segWin(b, f, 6.72, [y0, y1], 1.14);
    segBand(b, f, 6.72, y1 + 0.12, 1.5, 0.18, 0.24, 0.05, 'red');
  }
  entablature(b, f, 0, END, 0, 0.6);

  // the screen wall and gate between the corner house and no. 19 (2016 crop: 10.7-14.5 m, 4.8 m tall)
  f = WEST_B;
  const g0 = END, g1 = 14.5, gc = (g0 + g1) / 2, top = 4.8;
  // (3DBAG stops at its 1.73 m courtyard roof here, so the wall is drawn whole: piers, fanlight, the brick over it, coping)
  const ga = 11.0, gz = 14.25, gw = gz - ga, gm = (ga + gz) / 2;
  for (const [a, z] of [[g0, ga], [gz, g1]]) slab(b, f, (a + z) / 2, 0, z - a, top, 0.52, 'greyBrick', -0.42);
  // the fanlight on a brick backing (its host wall: 3DBAG has no wall above 1.73 m here), white frame, four panes
  slab(b, f, gm, 3.2, gw, 0.75, 0.44, 'greyBrick', -0.42);
  slab(b, f, gm, 3.2, gw, 0.75, 0.06, 'white', 0.02);
  for (let k = 0; k < 4; k++) slab(b, f, ga + gw * (k + 0.5) / 4, 3.3, 0.66, 0.55, 0.06, 'glass', 0.08);
  slab(b, f, gm, 3.95, gw, top - 3.95, 0.52, 'greyBrick', -0.42);
  slab(b, f, gc, top - 0.3, g1 - g0 + 0.1, 0.3, 0.2, 'greyBrick', 0.1);
  // the black iron gate in front of a dark backing (the passage behind it)
  // (above the 3DBAG courtyard roof at 1.73 m nothing sinks: the backing and bars stand on the wall line, not through the roof)
  // the backing stands 0.12 m out: the BAG ring's jog (6 cm) is in the opening
  slab(b, f, gm, 0, gw, 1.7, 0.12, 'dark');
  const sink = getSink();
  setSink(0);
  slab(b, f, gm, 1.7, gw, 1.5, 0.12, 'dark');
  for (let t = ga + 0.1; t < gz - 0.05; t += 0.13) slab(b, f, t, 0, 0.03, 3.15, 0.03, 'bronze', 0.17);
  slab(b, f, gm, 3.08, gw, 0.06, 0.04, 'bronze', 0.17);
  setSink(sink, true);

  // Huidekoperstraat 19 (14.5-21.08 m): three bays, the middle one on the 3DBAG dormer bump (17.7 m)
  // everything stops 0.1 m short of the pand's end: the shell's south wall stands in that plane
  const h0 = g1, h1 = 21.08 - 0.1;
  const bays = [16.09, 18.04, 19.99];
  slab(b, f, (h0 + h1) / 2, 0, h1 - h0, 0.5, 0.1, 'dark');
  slab(b, f, (h0 + h1) / 2, 4.3, h1 - h0, 0.25, 0.1, 'red');
  slab(b, f, (h0 + h1) / 2, 4.55, h1 - h0, 0.35, 0.05, 'red');
  for (const c of bays) {
    segWin(b, f, c, [0.75, 3.3], 1.05, {rise: 0.04, transom: 0.28});
    segWin(b, f, c, [5.3, 7.9], 1.05, {rise: 0.04, transom: 0.28});
  }
  slab(b, f, (h0 + h1) / 2, 8.5, h1 - h0, 0.55, 0.1, 'stone');
  slab(b, f, (h0 + h1) / 2, 9.05, h1 - h0, 0.3, 0.26, 'stone');
  slab(b, f, (h0 + h1) / 2, 9.35, h1 - h0, 0.55, 0.5, 'stone');
  for (const c of [h0 + 0.35, 17.065, 19.015, h1 - 0.25]) slab(b, f, c, 8.55, 0.22, 0.8, 0.42, 'stone');
  // the dormer: cream front over the 3DBAG bump (17.0-19.07 m, to 12.26 m), two lights, flat cap above the bump roof
  slab(b, f, 18.04, 9.9, 2.3, 2.4, 0.12, 'stone');
  segWin(b, f, 18.04, [10.25, 11.75], 1.3, {out: 0.12, rise: 0.03, sill: false, transom: 0.3});
  slab(b, f, 18.04, 12.2, 2.6, 0.4, 0.4, 'stone');
}

/**
 * The 8.5 m brick bay at the east end of the Weteringschans front (edge 5, 0-2.07 m; the aimed views in aim/ne): the
 * gated doorway on a dark plinth, one window on the upper storey, a coping.
 */
function eastBay(b: BuildingTools) {
  const {f} = edge(FRONT);
  const c = 1.03;
  slab(b, f, c + 0.06, 0, 1.88, 0.6, 0.1, 'dark');
  slab(b, f, c, 0.6, 1.15, 2.0, 0.06, 'dark');
  for (let t = c - 0.5; t <= c + 0.51; t += 0.125) slab(b, f, t, 0.6, 0.03, 1.95, 0.03, 'bronze', 0.08);
  slab(b, f, c, 2.6, 1.4, 0.2, 0.12, 'stone');
  segWin(b, f, c, [5.4, 6.9], 1.0, {rise: 0.02, transom: 0.3});
  ledgeStrip(b, f, c + 0.06, 8.18, 1.88, 0.26, 0.12, 'stone');
}
