import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, poly, ringFrame, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import source from './nieuwe-achtergracht-129-footprints.json';

/**
 * NIEUWE ACHTERGRACHT 129 / NIEUWE PRINSENGRACHT 130, Roeterseiland (BAG pand 0363100012253754, BAG 1932; gemeentelijk
 * monument 209057): the former Geologisch en Mineralogisch Instituut (Nieuwe Prinsengracht side) and Laboratorium voor
 * organische chemie en thermodynamica (Nieuwe Achtergracht side), built 1930-1931 by the Dienst der Publieke Werken,
 * "vermoedelijk door A.R. Hulshoff", sculpture by Hildo Krop. Dark brown brick in stacked bond round a courtyard, a high
 * souterrain, three storeys of white-framed oriel window strips, an overhanging light eaves board and hipped tiled roofs
 * with small white dormers; the entrance tower with its glass-block stair strip at the west end of the Nieuwe Achtergracht
 * front, and on the Nieuwe Prinsengracht front the stepped chimney tower, the block of small square windows and the
 * projecting glazed stair (vliesgevel) over the entrance with a Krop figure on a brick pier.
 *
 * Massing: the 3DBAG LoD2.2 shell (nieuwe-achtergracht-129-footprints.json, bag-shell-prepare.ts) as scanned. Fronts read
 * from rectified Gemeente Amsterdam panoramas (CC BY 4.0), per item in nieuwe-achtergracht-129-inventory.json; positions
 * are metres along each facade-ring edge from the viewer's left (ringFrame):
 *  - Nieuwe Achtergracht front (edge 33, w02-163, TMX7316010203-001975_pano_0000_000883 2021, 39.75 px/m; 2019 second
 *    view): tower 0-5.4 m, twelve oriel axes at a 3.09 m pitch, the stacked balcony box 43.3-47.9 m, the east end with
 *    slit windows and a ribbon over the souterrain, fourteen dormers;
 *  - Nieuwe Prinsengracht front (edge 41, w03-30, TMX7316010203-001975_pano_0000_001010 2021 and the 2017 view at
 *    40.76 px/m): thirteen oriel axes at a 2.63 m pitch, the chimney tower 36.4-39.3 m (measured on a 2021 thumbnail at
 *    heading 234: shaft to about 21 m, the narrower top to about 24.3 m), the small-window block, the glazed stair;
 *  - the curved corner and the north front of the NW wing (edges 3-7, w14-343, 49.9 px/m): eight axes and six dormers;
 *  - the two oblique east ends on the square at the head of the island (edges 34 and 40, panoramas
 *    TMX7316010203-001975_pano_0000_000878 and _001027, 2021): six axes each;
 *  - the west sides and the courtyard (no panorama): plain window rows, inferred from the register ("vensterreeksen").
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;
const S = src.surfaces;

/** Storey rows of the oriel strips (w02-163 2021, ground at y 735 px), shared by every front. */
const ROWS: [number, number][] = [[3.4, 5.7], [7.55, 9.85], [11.6, 13.95]];
const SOUT: [number, number] = [0.95, 1.75];
/** Bottom of the eaves board (w02-163: 14.67-14.97 m). */
const EAVE = 14.5;

const edge = (i: number) => ringFrame(ring, i);
const pt = (f: Frame, t: number, d: number): [number, number] => [f.origin[0] + f.tangent[0] * t + f.n[0] * d, f.origin[1] + f.tangent[1] * t + f.n[1] * d];
const roofAt = (f: Frame, t: number, d: number) => { const [x, z] = pt(f, t, d); return roofHeightAt(S, x, z); };

export function buildNieuweAchtergracht129(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {
    wall: 'brick', roof: 'slate',
    // flat roofs (the towers, the small-window block, the stair, the entrance volumes) are bitumen, the hips are tiled
    roofFor: s => {
      const ys = s.rings[0].map(p => p[1]);
      return Math.max(...ys) - Math.min(...ys) < 0.4 ? 'dark' : 'slate';
    },
  });
  const sink0 = getSink();
  setSink(0.12, true);
  achtergrachtFront(b);
  prinsengrachtFront(b);
  northWing(b);
  eastEnds(b);
  inferredSides(b);
  setSink(sink0);
}

/** Thin glazing bar: no sink and shallower than it is wide (the openings audit reads its face, not its sides). */
function bar(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, out: number) {
  const s0 = getSink();
  setSink(0);
  slab(b, f, t, y, w, h, 0.04, 'frame', out);
  setSink(s0, true);
}

/**
 * One oriel light of the window strips (register: "als erkers opgezette verticale vensterstroken"): a white frame box
 * 0.22 m proud, the pane, and the original division the photos show: a strip of small panes along the foot and the head.
 */
function oriel(b: BuildingTools, f: Frame, t: number, [y0, y1]: [number, number], w: number) {
  slab(b, f, t, y0 - 0.06, w + 0.12, y1 - y0 + 0.12, 0.22, 'frame');
  slab(b, f, t, y0 + 0.06, w - 0.12, y1 - y0 - 0.12, 0.06, 'glass', 0.22);
  const iw = w - 0.12, foot = y0 + 0.42, head = y1 - 0.4;
  bar(b, f, t, foot, iw, 0.06, 0.28);
  bar(b, f, t, head, iw, 0.06, 0.28);
  for (let k = 1; k < 5; k++) bar(b, f, t - iw / 2 + (iw * k) / 5, y0 + 0.06, 0.05, foot - y0 - 0.06, 0.28);
  slab(b, f, t, y0 - 0.2, w + 0.3, 0.14, 0.34, 'greyBrick');
}

/** A plain flush window (inferred sides, the slits, the small squares): frame, pane, optional sill. */
function plain(b: BuildingTools, f: Frame, t: number, y0: number, y1: number, w: number, sill = true, out = 0) {
  slab(b, f, t, y0 - 0.06, w + 0.12, y1 - y0 + 0.12, 0.1, 'frame', out);
  slab(b, f, t, y0 + 0.05, w - 0.1, y1 - y0 - 0.1, 0.05, 'glass', out + 0.1);
  if (sill) slab(b, f, t, y0 - 0.16, w + 0.2, 0.1, 0.16, 'greyBrick', out);
}

/**
 * A run of oriel axes with the souterrain: brick piers between the axes, the plinth band with its water table, a low
 * souterrain window under every axis, and the eaves board over the run.
 */
function axes(b: BuildingTools, f: Frame, ts: number[], w: number, o: {t0: number; t1: number; eaves?: boolean; piers?: boolean}) {
  const mid = (o.t0 + o.t1) / 2, len = o.t1 - o.t0;
  slab(b, f, mid, 0, len - 0.2, 2.45, 0.1, 'brick');
  slab(b, f, mid, 2.45, len - 0.2, 0.16, 0.2, 'greyBrick');
  for (const t of ts) {
    for (const r of ROWS) oriel(b, f, t, r, w);
    plain(b, f, t, SOUT[0], SOUT[1], Math.min(1.6, w - 0.3), false, 0.1);
  }
  if (o.piers !== false) for (let k = 0; k + 1 < ts.length; k++) {
    const gap = ts[k + 1] - ts[k] - w - 0.36;
    if (gap > 0.3) slab(b, f, (ts[k] + ts[k + 1]) / 2, 2.61, gap, EAVE - 2.61, 0.12, 'brick');
  }
  if (o.eaves !== false) eaves(b, f, o.t0, o.t1);
}

/** The overhanging light eaves board ("overstekende daklijst"). */
function eaves(b: BuildingTools, f: Frame, t0: number, t1: number) {
  slab(b, f, (t0 + t1) / 2, EAVE, t1 - t0, 0.45, 0.85, 'concrete');
}

/**
 * Small white dormer with a gabled roof and a divided light (register: "de dakvenstertjes vertonen nog de originele
 * karakteristieke roedeverdeling"), its front 1.0 m behind the wall on the 3DBAG roof plane.
 */
function dormer(b: BuildingTools, f: Frame, t: number, back = 1.0) {
  const h = roofAt(f, t, -back);
  if (h === null || h < EAVE || h > 19) return;
  slab(b, f, t, h - 0.35, 0.9, 1.55, 1.5, 'concrete', -back - 1.5);
  const s0 = getSink();
  setSink(0);
  slab(b, f, t, h + 0.05, 0.6, 0.85, 0.05, 'frame', -back);
  slab(b, f, t, h + 0.1, 0.5, 0.75, 0.05, 'glass', -back + 0.05);
  setSink(s0, true);
  bar(b, f, t, h + 0.45, 0.5, 0.05, -back + 0.1);
  bar(b, f, t, h + 0.1, 0.05, 0.75, -back + 0.1);
  poly(b, f, t, h + 1.2, [[-0.6, 0], [0.6, 0], [0, 0.5]], 1.7, 'slate', -back - 1.6);
}

/**
 * Nieuwe Achtergracht front (edge 33, w02-163, 2021; t from the west): the entrance tower 0-5.4 m (glass-block stair
 * strip, two small windows, the cantilevered canopy over the stoop and door), twelve oriel axes, the stacked balcony box
 * 43.3-47.9 m, the east end with five slit windows on two storeys and a ribbon over the souterrain, fourteen dormers.
 */
function achtergrachtFront(b: BuildingTools) {
  const {f, len} = edge(33);
  const ts = [7.04, 10.09, 13.18, 16.25, 19.27, 22.36, 25.43, 28.55, 31.67, 34.77, 37.89, 41.03];
  axes(b, f, ts, 2.0, {t0: 5.4, t1: len});
  for (const t of [8.4, 11.2, 14.0, 16.9, 19.7, 22.7, 25.6, 28.4, 31.3, 33.6, 37.0, 40.0, 42.9, 45.8]) dormer(b, f, t);
  // entrance tower: glass-block stair strip, small windows, the canopy over the stoop
  glassBlocks(b, f, 0.95, 1.1, 3.6, 18.6, 0.08);
  for (const y of [9.1, 12.9]) plain(b, f, 2.9, y, y + 0.85, 0.6);
  slab(b, f, 2.7, 3.35, 5.4, 0.3, 1.3, 'concrete');
  slab(b, f, 3.4, 0.5, 1.6, 2.6, 0.06, 'dark');
  slab(b, f, 3.4, 0, 3.0, 0.5, 1.2, 'greyBrick');
  // stacked balcony box (two balconies under a flat canopy, glazed doors behind)
  const bx = 45.6, bw = 4.6;
  for (const [y0, y1] of [[5.85, 7.6], [9.95, 11.75]]) slab(b, f, bx, y0, bw, y1 - y0, 1.45, 'brick');
  slab(b, f, bx, 13.95, bw + 0.2, 0.3, 1.6, 'concrete');
  for (const s of [-1, 1]) slab(b, f, bx + s * (bw / 2 + 0.06), 7.6, 0.12, 6.35, 1.4, 'brick');
  for (const [y0, y1] of [[7.75, 9.8], [11.85, 13.85]]) plain(b, f, bx, y0, y1, 2.6, false);
  plain(b, f, bx, ROWS[0][0], ROWS[0][1], 1.9);
  slab(b, f, 43.7, 0.4, 1.1, 2.2, 0.06, 'dark', 0.1);
  // east end: slit windows and the ribbon over the souterrain
  for (const t of [48.6, 49.7, 50.8, 51.9, 53.0]) for (const y of [7.3, 11.3]) plain(b, f, t, y, y + 1.25, 0.32, false);
  for (const [a, c] of [[47.9, 50.0], [50.15, 52.25], [52.4, 54.5]]) plain(b, f, (a + c) / 2, 3.3, 4.0, c - a);
}

/** A glass-block strip: pane, white border and the block grid (horizontal joints every 0.5 m, one vertical). */
function glassBlocks(b: BuildingTools, f: Frame, t: number, w: number, y0: number, y1: number, out: number) {
  slab(b, f, t, y0 - 0.08, w + 0.16, y1 - y0 + 0.16, 0.08, 'frame', out);
  slab(b, f, t, y0, w, y1 - y0, 0.05, 'glass', out + 0.08);
  for (let y = y0 + 0.5; y < y1 - 0.2; y += 0.5) bar(b, f, t, y, w, 0.06, out + 0.13);
  bar(b, f, t, y0, 0.06, y1 - y0, out + 0.13);
}

/**
 * Nieuwe Prinsengracht front (edge 41, w03-30; t from the south-east): thirteen oriel axes, eleven dormers, the chimney
 * tower, the block of small square windows (flat roof 16.1 m), the projecting glazed stair over the entrance, the brick
 * pier with the Krop figure in front of it, and the canopy over the entrance in the recess (edge 1).
 */
function prinsengrachtFront(b: BuildingTools) {
  const {f, len} = edge(41);
  const ts = [4.37, 7.07, 9.69, 12.34, 14.99, 17.62, 20.26, 22.89, 25.49, 28.12, 30.72, 33.34, 35.94];
  axes(b, f, ts, 2.0, {t0: 0, t1: 36.95});
  for (const t of [8.2, 10.6, 13.1, 15.5, 18.0, 20.5, 22.9, 25.4, 27.8, 30.3, 32.8]) dormer(b, f, t);
  // chimney tower: the brick strip down the front, the shaft through the roof to 21 m, the narrower top to 24.3 m
  slab(b, f, 38.0, 0, 1.9, 15.0, 3.25, 'brick', -3.0);
  slab(b, f, 37.85, 14.9, 2.9, 6.1, 3.0, 'brick', -3.0);
  slab(b, f, 37.85, 20.85, 3.1, 0.2, 3.2, 'brick', -3.1);
  slab(b, f, 37.85, 21.05, 2.0, 3.25, 2.0, 'brick', -2.5);
  slab(b, f, 37.85, 24.3, 2.2, 0.2, 2.2, 'brick', -2.6);
  // block of small square windows, its coping 5 cm over the 3DBAG roof (16.1 m)
  slab(b, f, 42.95, 0, 7.6, 2.45, 0.1, 'brick');
  for (const t of [40.85, 41.9, 42.95, 44.0]) for (const y of [3.8, 7.8, 11.9]) plain(b, f, t, y, y + 0.62, 0.62, false);
  slab(b, f, 42.95, 15.85, 7.6, 0.3, 0.15, 'concrete');
  // the projecting glazed stair (vliesgevel): glass box 0.9 m proud with its white grid and cap
  const g0 = 46.9, g1 = 52.4, gy0 = 3.9, gy1 = 14.2, gc = (g0 + g1) / 2, gw = g1 - g0;
  slab(b, f, gc, gy0 - 0.15, gw + 0.3, 0.15, 1.05, 'concrete');
  slab(b, f, gc, gy0, gw, gy1 - gy0, 0.9, 'glass');
  for (let k = 0; k <= 10; k++) bar(b, f, g0 + (gw * k) / 10, gy0, 0.07, gy1 - gy0, 0.9);
  for (let y = gy0 + 0.6; y < gy1 - 0.1; y += 0.6) bar(b, f, gc, y, gw, 0.07, 0.9);
  slab(b, f, gc, gy1, gw + 0.5, 0.4, 1.3, 'concrete');
  slab(b, f, gc, 0, gw, gy0 - 0.15, 0.1, 'brick');
  // the brick pier carrying a Hildo Krop figure (French limestone; simplified to a standing block figure)
  slab(b, f, 50.6, 0, 1.3, 6.4, 1.6, 'brick');
  slab(b, f, 50.6, 6.4, 1.5, 0.2, 1.7, 'stone');
  slab(b, f, 50.6, 6.6, 0.75, 1.0, 0.6, 'stone', 0.5);
  slab(b, f, 50.6, 7.6, 0.32, 0.36, 0.32, 'stone', 0.64);
  // entrance recess (edge 1): canopy, door, stoop
  const r = edge(1);
  slab(b, r.f, r.len / 2, 3.6, r.len, 0.3, 2.4, 'concrete');
  slab(b, r.f, r.len / 2, 0.5, 2.0, 2.7, 0.06, 'dark');
  slab(b, r.f, r.len / 2, 0, 3.4, 0.5, 1.2, 'greyBrick');
}

/** The curved corner (edges 3-6) and the north front of the NW wing (edge 7, w14-343): oriel axes, eaves, dormers. */
function northWing(b: BuildingTools) {
  const curve: [number, number[], number][] = [[3, [1.6, 4.3], 1.85], [4, [], 1.3], [5, [], 1.3], [6, [], 1.6]];
  for (const [i, ts, w] of curve) {
    const {f, len} = edge(i);
    axes(b, f, ts, w, {t0: -0.05, t1: len + 0.05, piers: false});
  }
  const {f, len} = edge(7);
  axes(b, f, [0, 1, 2, 3, 4, 5, 6, 7].map(k => 1.04 + 2.62 * k), 1.85, {t0: -0.05, t1: len});
  for (const t of [3.0, 5.1, 7.1, 9.1, 11.2, 13.3]) dormer(b, f, t);
}

/**
 * The two oblique east ends on the square (edges 34 and 40, 2021 panoramas 000878 and 001027): six axes each. Their hip
 * dormers are left out: on the 3DBAG hip planes every placement pierces the neighbouring plane.
 */
function eastEnds(b: BuildingTools) {
  for (const i of [34, 40]) {
    const {f, len} = edge(i);
    const ts = [0, 1, 2, 3, 4, 5].map(k => len / 2 + (k - 2.5) * 2.6);
    axes(b, f, ts, 1.7, {t0: 0, t1: len});
  }
}

/**
 * The courtyard: the BAG pand's inner ring (PDOK BAG OGC API, 2026-11-20; RD minus the anchor, z south, near-collinear
 * vertices within 0.25 m merged). Not in the facade ring bag-shell-prepare.ts writes; the 3DBAG shell has its walls.
 */
const COURTYARD: number[][] = [[5.37, -19.28], [26.89, -6.84], [24.23, -2.14], [26.99, -0.54], [25.22, 2.68], [21.47, 2.27],
  [21.17, 5.11], [24.91, 5.53], [25.93, 9.06], [22.88, 9.98], [24.45, 15.18], [10.21, 19.6], [9.41, 16.97], [10.56, 16.63],
  [10.07, 14.98], [11.82, 14.45], [8.27, 2.7], [-0.25, 5.28], [3.3, 17.03], [5.04, 16.5], [5.54, 18.14], [6.89, 17.74],
  [7.68, 20.36], [0.62, 22.49], [-5.84, 0.5]];

/**
 * West and courtyard sides with no panorama (outer edges 8, 9, 12, 20, 24; courtyard edges of 5 m and more): the
 * register's "overwegend strakke muurbehandeling ... bepaald door de vensterreeksen": flush windows on the storeys under
 * the wall's own eaves at a 2.62 m pitch, the plinth and water table, the eaves board where the roof is pitched.
 */
function inferredSides(b: BuildingTools) {
  for (const i of [8, 9, 12, 20, 24]) plainSide(b, edge(i).f, edge(i).len);
  COURTYARD.forEach((_, i) => {
    const {f, len} = ringFrame(COURTYARD, i, 0, true);
    // edge 23 (the west courtyard wall) stands behind a lower scanned volume: its windows would be buried
    if (len >= 5 && i !== 23) plainSide(b, f, len, true);
  });
}
/** Median offset of the 3DBAG wall polygons lying along a frame (|d| < 0.8 m): where the scanned wall really stands. */
function wallOffset(f: Frame, len: number) {
  const ds: number[] = [];
  for (const s of S) {
    if (s.type !== 'WallSurface') continue;
    const loc = s.rings[0].map(p => ({t: (p[0] - f.origin[0]) * f.tangent[0] + (p[2] - f.origin[1]) * f.tangent[1], d: (p[0] - f.origin[0]) * f.n[0] + (p[2] - f.origin[1]) * f.n[1]}));
    if (loc.every(q => Math.abs(q.d) < 0.8 && q.t > -0.5 && q.t < len + 0.5)) ds.push(...loc.map(q => q.d));
  }
  ds.sort((x, y) => x - y);
  return ds.length ? ds[Math.floor(ds.length / 2)] : 0;
}
/** Whether one scanned wall polygon in the frame's plane (|d| < 0.25 m) spans t +- half and stands to height y. */
function walled(f: Frame, t: number, half: number, y: number) {
  return S.some(s => {
    if (s.type !== 'WallSurface') return false;
    const r = s.rings[0], loc = r.map(p => ({t: (p[0] - f.origin[0]) * f.tangent[0] + (p[2] - f.origin[1]) * f.tangent[1], d: (p[0] - f.origin[0]) * f.n[0] + (p[2] - f.origin[1]) * f.n[1]}));
    return loc.every(q => Math.abs(q.d) < 0.25) && Math.min(...loc.map(q => q.t)) <= t - half && Math.max(...loc.map(q => q.t)) >= t + half && Math.max(...r.map(p => p[1])) >= y;
  });
}
function plainSide(b: BuildingTools, f0: Frame, len: number, snap = false) {
  const off = snap ? wallOffset(f0, len) : 0;
  const f: Frame = {...f0, origin: [f0.origin[0] + f0.n[0] * off, f0.origin[1] + f0.n[1] * off]};
  const n = Math.floor((len - 2.4) / 2.62) + 1;
  if (n < 1) return;
  const ts = Array.from({length: n}, (_, k) => len / 2 + (k - (n - 1) / 2) * 2.62);
  // the wall's eaves at its middle: the low wing on edge 12 has two storeys under an 11 m eaves
  const h = roofAt(f, len / 2, -0.3) ?? EAVE, h2 = roofAt(f, len / 2, -2.3) ?? h;
  const pitched = h2 - h > 0.8, top = pitched ? h - 0.45 : h;
  let placed = 0;
  for (const t of ts) for (const [y0, y1] of ROWS) if (y1 < top - 0.4 && walled(f, t, 1.0, y1 + 0.3)) { plain(b, f, t, y0, y1, 1.7); placed++; }
  // a courtyard wall the scan does not carry gets nothing (its plinth would stand off the shell)
  if (snap && !placed) return;
  slab(b, f, len / 2, 0, len - 0.2, 2.45, 0.1, 'brick');
  slab(b, f, len / 2, 2.45, len - 0.2, 0.16, 0.2, 'greyBrick');
  if (pitched) slab(b, f, len / 2, top, len, 0.45, 0.85, 'concrete');
  // a flat roof gets a brick coping 5 cm over the 3DBAG roof
  else slab(b, f, len / 2, h - 0.25, len, 0.3, 0.12, 'brick');
}
