import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, planarPolygon, type Surface} from './worship-shell';
import {getSink, letters, put, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {irregularOpenings, rasterFront, type IrregularRowSpec, type RasterRow} from '../../src/canalRecall/landmarks/rasterFront';
import source from './pakhuis-afrika-footprints.json';

/**
 * PAKHUIS AFRIKA, Jollemanhof 19 / Oostelijke Handelskade (BAG pand 0363100012087187, BAG 2009; rijksmonument 523314).
 * The register: a warehouse built in 1915 for N.V. Handelskade to a design by A.J. Joling, its exterior remodelled in 1935
 * by J. de Bie Leuveling Tjeenk. It has five storeys of brick in cross bond around a reinforced-concrete mushroom-column
 * skeleton. The city-side front has a concrete frame of nine bays with brick infill. The IJ side has a loading platform
 * (losperron) across the full width. Metal letters 'Afrika' are fixed front and back.
 * The 2009 redevelopment is one BAG pand with the warehouse: a block cantilevered over the warehouse roof and a
 * 34.5 m tower standing on the city side.
 *
 * Massing: the 3DBAG LoD2.2 shell (pakhuis-afrika-footprints.json, bag-shell-prepare.ts):
 *  - the 18.2 m warehouse;
 *  - the upper block to 34.5 m over the whole width, its north face set back behind the warehouse roof and its
 *    south face over the city-side front;
 *  - the tower (facade-ring edges 3, 4 and 5) to the ground.
 * The 3DBAG fills the dark gap between the warehouse roof and the cantilever's soffit (about 21 m, with raking concrete
 * struts). Here the upper block's south walls are cut at the soffit and the gap is rebuilt as a recess.
 *
 * Fronts are read from Gemeente Amsterdam panoramas (CC BY 4.0). Positions are metres along each facade-ring edge from
 * the viewer's left:
 *  - IJ front (edge 0, w01-16): TMX7316010203-002313_pano_0003_000555 (2021), 33.4 px/m;
 *  - city-side warehouse front (edge 2, w04-196) and the tower south face (edge 4, w05-196):
 *    TMX7316010203-001195_pano_0000_003234 / _003229 (2019), 47.8 and 49.9 px/m;
 *  - tower east face (edge 5, w02-106): TMX7316010203-001667_pano_0000_001352 (2020);
 *  - the 'AFRIKA' end (edge 6, w06-196): recording_2024-10-23_12-42-53_00390 (2024).
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;
const edge = (i: number) => ringFrame(ring, i);

/** TOP: the skin's parapet stands 12 cm over the 3DBAG roof edge (34.48-34.50 m). */
const SOFFIT = 21.0, TOP = 34.62;
/** The skin's glass plane stands OFF in front of the 3DBAG wall; its grey frame of piers and ledges stands in front of the glass. */
const OFF = 0.1, SKIN = 0.22;
/** Depth of the gap under the cantilever behind the upper block's south face (w04: the struts stand well inside it). */
const GAP = 2.2;
/** Upper-block south walls (cut at the soffit) and its set-back north walls (dark glass curtain, w01). */
const UPPER_SOUTH = [82, 59];
const UPPER_NORTH = new Set([9, 13, 24, 27, 69, 85, 62]);
/** The end walls rising straight to 34.5 m (west 80, east 61): brick to the warehouse roof, the skin above. */
const ENDS = [80, 61];

const ring0 = (i: number) => src.surfaces[i].rings[0];

/** Sutherland-Hodgman: the part of a 3D polygon where `keep(p) >= 0`. */
function clipRing(r: number[][], keep: (p: number[]) => number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i], c = r[(i + 1) % r.length], fa = keep(a), fc = keep(c);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fc >= 0)) { const u = fa / (fa - fc); out.push(a.map((v, k) => v + (c[k] - v) * u)); }
  }
  return out;
}
function wallPiece(b: BuildingTools, r: number[][], colour: string, ...keeps: ((p: number[]) => number)[]) {
  let p = r;
  for (const k of keeps) p = clipRing(p, k);
  if (p.length < 3) return;
  const g = planarPolygon([p]);
  if (g) b.add(g, colour as never);
}
/** Frame of a 3DBAG wall polygon: origin at the viewer's-left base corner, n its outward (Newell) normal. */
function wallFrame(i: number): {f: Frame; len: number; base: number} {
  const r = ring0(i);
  const n3 = [0, 0, 0];
  for (let k = 0; k < r.length; k++) {
    const a = r[k], c = r[(k + 1) % r.length];
    n3[0] += (a[1] - c[1]) * (a[2] + c[2]); n3[2] += (a[0] - c[0]) * (a[1] + c[1]);
  }
  const L = Math.hypot(n3[0], n3[2]), n: [number, number] = [n3[0] / L, n3[2] / L];
  // ringFrame convention: n = [-tz, tx], so the tangent is [n.z, -n.x]
  const tangent: [number, number] = [n[1], -n[0]];
  const ts = r.map(p => p[0] * tangent[0] + p[2] * tangent[1]);
  const t0 = Math.min(...ts), t1 = Math.max(...ts), d = r[0][0] * n[0] + r[0][2] * n[1];
  const origin: [number, number] = [tangent[0] * t0 + n[0] * d, tangent[1] * t0 + n[1] * d];
  return {f: {origin, tangent, n}, len: t1 - t0, base: Math.min(...r.map(p => p[1]))};
}

export function buildPakhuisAfrika(_w: number, _d: number, b: BuildingTools) {
  const skip = new Set([...UPPER_SOUTH, ...UPPER_NORTH, ...ENDS]);
  addShell(b, src as never, {wall: 'brick', roof: 'slate', skip: (_s, i) => skip.has(i),
    // the tower and the small rooftop housings are the grey concrete skin, not warehouse brick
    wallFor: (_s, i) => (i === 51 || i === 44 || i === 7 || i === 47 || i === 48 || i === 67 || i === 68 || ring0(i).every(p => p[1] >= 18.0) ? 'stone' : 'brick')});
  for (const i of UPPER_NORTH) wallPiece(b, ring0(i), 'glass');
  for (const i of UPPER_SOUTH) wallPiece(b, ring0(i), 'stone', p => p[1] - SOFFIT);
  for (const i of ENDS) { wallPiece(b, ring0(i), 'brick', p => 18.2 - p[1]); wallPiece(b, ring0(i), 'stone', p => p[1] - 18.2); }
  const sink0 = getSink();
  setSink(0.12, true);
  for (const i of UPPER_SOUTH) cantileverGap(b, i);
  upperSkin(b);
  // the set-back north face of the block (w01: a dark glass grid): steel transoms per storey and mullions about every 1.5 m
  for (const i of UPPER_NORTH) {
    const {f, len, base} = wallFrame(i);
    if (len < 1) continue;
    for (let y = SOFFIT + 2.7; y < TOP - 0.5; y += 2.7) if (y > base + 0.3) slab(b, f, len / 2, y, len - 0.1, 0.12, 0.06, 'bronze');
    const n = Math.round(len / 1.5);
    for (let k = 1; k < n; k++) slab(b, f, len * k / n, base + 0.05, 0.08, 34.4 - base, 0.06, 'bronze');
  }
  tower(b);
  ijFront(b);
  citySide(b);
  afrikaEnd(b);
  setSink(sink0);
}

/** One row of the mottled grey skin (seeded irregular openings) per storey, with the glass and the frame in front of the wall. */
function skin(b: BuildingTools, f: Frame, wall: number, levels: number[], top: number, seed: number, o: {ground?: boolean} = {}) {
  // 4 cm clear of the corner walls at both ends: their planes would cut the end faces of the piers and ledges
  const E = 0.04, length = wall - 2 * E;
  const rows: RasterRow[] = levels.map((y, k) => {
    const ground = o.ground && k === 0;
    const spec: IrregularRowSpec = ground
      ? {length, seed: seed * 31 + k, margin: 0.25, wide: [1.2, 2.4], narrow: [0.35, 0.6], pier: [0.45, 0.85], narrowShare: 0.5}
      : {length, seed: seed * 31 + k, margin: 0.25, wide: [1.3, 2.6], narrow: [0.4, 0.7], pier: [0.45, 0.9], narrowShare: 0.4};
    return ground ? {y0: y, y1: y + 4.3, openings: irregularOpenings(spec), kind: 'ground'} : {y0: y + 0.3, y1: y + 2.35, openings: irregularOpenings(spec), kind: 'window'};
  });
  const pieces = rasterFront({length, rows, bottom: levels[0], top, pierDepth: SKIN, ledgeDepth: SKIN,
    mottle: {seed, fraction: 0.25, minRun: 0.5, maxRun: 1.4}});
  const s0 = getSink();
  setSink(0);
  for (const p of pieces) {
    const colour = p.part === 'glass' ? 'glass' : p.tone ? 'pink' : 'stone';
    slab(b, f, E + (p.t0 + p.t1) / 2, p.y0, p.t1 - p.t0, p.y1 - p.y0, p.depth, colour, OFF + p.out);
  }
  setSink(s0, true);
}

/** The tower (edges 3, 4, 5): a 4.8 m ground storey and ten storeys at 2.82 m (w05: 140 px a storey at 49.9 px/m), parapet to 34.5 m. */
function tower(b: BuildingTools) {
  const levels = [0, ...Array.from({length: 10}, (_, k) => 4.8 + 2.82 * k)];
  // on the 3DBAG tower walls themselves (west 51, south 44, east 7): the facade ring runs a few cm off them
  for (const [i, seed] of [[51, 3], [44, 4], [7, 5]] as const) {
    const {f, len} = wallFrame(i);
    skin(b, f, len, levels, TOP, seed, {ground: true});
  }
}

/** The upper block over the warehouse: five storeys at 2.7 m from the soffit (w04), on its south faces and the two ends. */
function upperSkin(b: BuildingTools) {
  const levels = Array.from({length: 5}, (_, k) => SOFFIT + 2.7 * k);
  for (const [i, seed] of [[82, 11], [59, 12]] as const) {
    const {f, len} = wallFrame(i);
    skin(b, f, len, levels, TOP, seed);
  }
  for (const [i, seed] of [[80, 13], [61, 14]] as const) {
    const {f, len} = wallFrame(i);
    // the ends (no photo square-on): the skin from the soffit level; the gap is not drawn on the ends
    skin(b, f, len, levels, TOP, seed);
  }
}

/** The dark gap under the cantilever behind an upper-block south wall: back wall, floor, soffit, end caps and raking struts. */
function cantileverGap(b: BuildingTools, i: number) {
  const {f, len, base} = wallFrame(i);
  const h = SOFFIT - base;
  const s0 = getSink();
  setSink(0);
  // 6 cm clear of the 3DBAG corner walls at both ends (their planes would otherwise cut the pieces' end faces)
  const m = 0.06, w = len - 2 * m;
  slab(b, f, len / 2, base, w, h, 0.2, 'blue', -GAP);
  slab(b, f, len / 2, base - 0.12, w, 0.12, GAP, 'slate', -GAP);
  slab(b, f, len / 2, SOFFIT - 0.3, w, 0.3, GAP - 0.2, 'concrete', -GAP + 0.2);
  // the west end is closed by the 3DBAG corner wall; an end cap at the east end, 0.1 m clear of the tower's corner wall
  for (const t of [len - 0.2]) slab(b, f, t, base, 0.2, h, GAP - 0.25, 'stone', -GAP + 0.2);
  // struts (w04: four on the 24 m face, raking about 20 degrees along the wall), from the floor to the soffit
  const n = Math.max(1, Math.round(len / 5.2));
  for (let k = 0; k < n; k++) {
    const t = len * (k + 0.5) / n, rake = 0.36, l = h / Math.cos(rake);
    const g = new T.BoxGeometry(0.45, l, 0.45).rotateZ(rake).translate(0, h / 2, 0.22);
    put(b, f, g, t, base, -1.4, 'concrete');
  }
  setSink(s0, true);
}

/** Window axes of the IJ front (w01: 125 ... 1560 px at 33.4 px/m) and its storey rows. */
const IJ_AXES = [3.74, 9.27, 14.8, 20.0, 25.6, 30.9, 36.3, 41.7, 46.6];
const IJ_ROWS: [number, number][] = [[6.1, 8.0], [9.0, 10.9], [11.8, 13.7], [14.6, 16.4]];
/** Balconies per row (bottom up), per axis: d = tilted steel drop balcony, s = grey slatted box (w01, 2021). */
const IJ_BALCONIES = ['dddddd ssd', 'ddddds sds', 'dssdssdss', 'sdsdsddds'].map(r => r.replace(/ /g, ''));

/** The IJ front (edge 0): concrete frame and floor bands on brick, red-framed windows, the balconies, the loading platform. */
function ijFront(b: BuildingTools) {
  const {f, len} = edge(0);
  // concrete columns between the window axes and at the ends, floor bands under each window row and the parapet band
  const cols = [0.5, ...IJ_AXES.slice(1).map((a, k) => (a + IJ_AXES[k]) / 2), len - 0.5];
  for (const c of cols) slab(b, f, c, 2.5, 0.5, 14.9, 0.12, "concrete");
  for (const [y0] of IJ_ROWS) ledge(b, f, len, y0 - 0.55);
  ledge(b, f, len, 17.4);
  IJ_AXES.forEach((t, k) => {
    IJ_ROWS.forEach(([y0, y1], r) => {
      window(b, f, t, y0, 1.7, y1 - y0, 'red');
      const kind = IJ_BALCONIES[r][k];
      if (kind === 'd') dropBalcony(b, f, t, y0);
      else slattedBalcony(b, f, t, y0);
    });
    // platform storey: the entrance on the middle axis to the ground, windows elsewhere
    if (k === 4) slab(b, f, t, 0, 4.4, 4.9, 0.12, 'dark', OFF);
    else window(b, f, t, 2.55, 1.8, 2.3, 'bronze');
  });
  for (const t of [1.4, 48.8]) slab(b, f, t, 2.55, 0.95, 2.2, 0.1, 'dark', OFF);
  // base under the platform: a glazed door and a few small windows (w01, 2021)
  for (const t of [30.8, 32.6, 37.4, 39.2]) window(b, f, t, 1.0, 0.8, 0.6, 'bronze');
  // the loading platform across the full width, its railing and the two flights at the entrance
  const s0 = getSink();
  setSink(0);
  const door: [number, number] = [IJ_AXES[4] - 2.3, IJ_AXES[4] + 2.3];
  for (const [a, c] of [[0.1, door[0]], [door[1], len - 0.1]]) slab(b, f, (a + c) / 2, 2.3, c - a, 0.22, 1.6, 'concrete', 0);
  const posts = Math.round((len - 0.4) / 1.6);
  for (let k = 0; k <= posts; k++) {
    const t = 0.2 + (len - 0.4) * k / posts;
    if (Math.abs(t - IJ_AXES[4]) < 2.3) continue;
    slab(b, f, t, 2.52, 0.06, 1.0, 0.06, 'bronze', 1.5);
  }
  for (const [a, c] of [[0.2, IJ_AXES[4] - 2.3], [IJ_AXES[4] + 2.3, len - 0.2]]) slab(b, f, (a + c) / 2, 3.47, c - a, 0.06, 0.06, 'bronze', 1.5);
  for (let s = 0; s < 6; s++) slab(b, f, IJ_AXES[4], 2.3 - (s + 1) * 0.38, 4.2, 0.38, 0.22 * (s + 1), 'concrete', OFF + 0.2);
  setSink(s0, true);
}
function ledge(b: BuildingTools, f: Frame, len: number, y: number) {
  slab(b, f, len / 2, y, len - 0.1, 0.3, 0.16, 'concrete');
}
/** A window: glass OFF in front of the wall with a frame of four bars just proud of it. */
function window(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, frame: string) {
  const s0 = getSink();
  setSink(0);
  slab(b, f, t, y, w, h, 0.04, 'glass', OFF - 0.04);
  for (const [dt, dy, ww, hh] of [[0, 0, w, 0.08], [0, h - 0.08, w, 0.08], [-(w - 0.08) / 2, 0.08, 0.08, h - 0.16], [(w - 0.08) / 2, 0.08, 0.08, h - 0.16]]) slab(b, f, t + dt, y + dy, ww, hh, 0.06, frame, OFF);
  setSink(s0, true);
}
/** Tilted steel drop balcony under a window: a deck falling away from the wall and two hangers from the window head. */
function dropBalcony(b: BuildingTools, f: Frame, t: number, y: number) {
  const depth = 1.2, tilt = 0.2;
  const deck = new T.BoxGeometry(2.3, 0.08, depth).translate(0, 0, depth / 2).rotateX(tilt);
  put(b, f, deck, t, y - 0.08, OFF, 'bronze');
  const drop = Math.sin(tilt) * depth, reach = Math.cos(tilt) * depth;
  // hangers from the wall at the window head (H over the deck's root) to the deck's outer edge
  const H = 1.9, rise = H + drop, l = Math.hypot(rise, reach);
  for (const s of [-1, 1]) {
    const rod = new T.BoxGeometry(0.05, l, 0.05).rotateX(-Math.atan2(reach, rise)).translate(0, (H - drop) / 2, reach / 2);
    put(b, f, rod, t + s * 1.1, y - 0.08, OFF, 'bronze');
  }
}
/** Grey slatted box balcony in front of the lower part of a window. */
function slattedBalcony(b: BuildingTools, f: Frame, t: number, y: number) {
  const s0 = getSink();
  setSink(0);
  slab(b, f, t, y - 0.15, 1.86, 0.08, 0.55, 'greyBrick', OFF);
  slab(b, f, t, y - 0.07, 1.86, 0.85, 0.06, 'greyBrick', OFF + 0.49);
  for (const s of [-1, 1]) slab(b, f, t + s * 0.9, y - 0.07, 0.06, 0.85, 0.49, 'greyBrick', OFF);
  setSink(s0, true);
}

/** The city-side warehouse front (edge 2, w04-196 at 47.8 px/m, the parapet scaled to the 3DBAG 18.2 m). */
function citySide(b: BuildingTools) {
  const {f, len} = wallFrame(49); // the 3DBAG wall runs 0.2-0.4 m inside facade-ring edge 2
  // the arcade: concrete columns with the shopfront glazing set back, under a light beam at 4.4-4.8 m
  const bays: [number, number][] = [[7.2, 10.0], [11.0, 15.0], [16.0, 19.9], [21.1, len - 0.3]];
  for (const [a, c] of bays) slab(b, f, (a + c) / 2, 0, c - a, 4.3, 0.06, 'glass', OFF - 0.06);
  slab(b, f, len / 2, 4.4, len - 0.1, 0.4, 0.16, 'concrete');
  for (const c of [10.5, 15.5, 20.5]) slab(b, f, c, 0, 0.9, 4.4, 0.3, 'concrete');
  for (const c of [4.8, 16.15]) slab(b, f, c, 4.8, 0.4, 13.0, 0.12, 'concrete');
  ledge(b, f, len, 17.6);
  for (let k = 0; k < 4; k++) {
    const y = 6.2 + 3.1 * k;
    for (const t of [1.8, 3.4, 12.6, 14.2]) window(b, f, t, y, 0.75, 1.3, 'bronze');
    window(b, f, 7.85, y - 0.3, 2.1, 2.0, 'red');
    window(b, f, 19.7, y - 0.3, 3.2, 2.2, 'bronze');
    window(b, f, 23.3, y - 0.3, 2.2, 2.2, 'bronze');
    ledge(b, f, len, y - 0.75);
  }
}

/** The east part of the city-side front (edge 6, w06-196): three axes of small windows over the 'AFRIKA' letters and a canopy. */
function afrikaEnd(b: BuildingTools) {
  const {f, len} = wallFrame(58); // 0.2-0.4 m inside facade-ring edge 6
  for (let k = 0; k < 4; k++) for (const t of [1.7, len / 2, len - 1.7]) window(b, f, t, 6.6 + 2.9 * k, 0.8, 1.0, 'bronze');
  letters(b, f, 'AFRIKA', len / 2, 4.75, OFF, 0.085, 0.05, 'bronze');
  slab(b, f, len / 2, 0, len - 1.2, 3.6, 0.06, 'glass', OFF - 0.06);
  slab(b, f, len / 2, 3.8, len - 0.4, 0.2, 1.4, 'concrete');
}
