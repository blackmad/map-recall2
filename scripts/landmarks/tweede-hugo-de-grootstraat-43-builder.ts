import type {BuildingTools} from './cultural-builders';
import {strut, type Col, type FR} from './modern-front-kit';
import {letters, slab} from './nearbar-kit';
import {slabBalcony} from './houthavens-shell';
import {at, buildHandBlock, longBand, type P2, type Src, type WallGeom, type Zone} from './hand-block-kit';
import source from './tweede-hugo-de-grootstraat-43-footprints.json';

/**
 * TWEEDE HUGO DE GROOTSTRAAT 43 (BAG pand 0363100012148379, 1995): a Dirk van den Broek supermarket
 * podium under three storeys of housing and a set-back top storey (lane hand-blocks-d-20261123; the kit batch held it in round 20261121q
 * on clipped windows and a hidden fascia; its upper fronts stand 2.4-9.5 m behind the footprint). Massing: the 3DBAG LoD2.2 shell (tweede-hugo-de-grootstraat-43-
 * footprints.json; podium 5.5 and 8.2 m, housing 16.4 m, top storey 19.0 m), rebuilt wall by wall by hand-block-kit.ts.
 * The podium's curved corners are cut into ~40 short 3DBAG walls that share one design, so every wall takes one storey
 * style by height (`zoned`), read off the rectified Gemeente Amsterdam panoramas (CC BY 4.0) in the inventory; heights
 * from the footprint-plane crops w01-114 (2019) and w03-24 (2025), scaled onto the 3DBAG 8.2 m podium roof:
 *  - a low brown-brick plinth, a red strip under dark-framed shop glass (0.45-3.6 m);
 *  - a brown-brick sign band (3.6-4.95 m) carrying the red "Dirk van den Broek" lettering on the corner fronts;
 *  - a glazed storey in dark blue-grey frames with a transom (4.95-7.55 m) under a projecting zinc fascia (to 8.3 m);
 *  - buff brick housing, three storeys of punched windows with light sills, curved balconies with glass rails at the ends
 *    of the long south-west front (s01-204, 2020);
 *  - the top storey: brick piers between wide glazed bays under a deep zinc eave.
 */
/**
 * 3DBAG walls 28 and 107 (8.2-16.4 m, the housing's end walls) run 1-6 cm from walls 70 and 90 (0-16.4 m) on crossing
 * planes: drawn whole, the pairs z-fight (audit:glb coplanar 1.8 m2). Each is cut to the strips that stand past its twin's
 * ends (0.2-0.8 m), so the corner stays closed; dropped whole, the shell opened a 22-26 m loop at the housing corner.
 */
const TWINS: [number, number][] = [[28, 70], [107, 90]];
const shell = source as unknown as Src;
type V3 = [number, number, number];
/** The parts of a 4-point vertical quad (top/foot at each end) outside the span of `twin` along the quad's own line. */
function outsideTwin(ring: V3[], twin: V3[]): V3[][] {
  const ends = [ring[0], ring[2]], [A, B] = ends, L2 = (B[0] - A[0]) ** 2 + (B[2] - A[2]) ** 2;
  const tOf = (p: V3) => ((p[0] - A[0]) * (B[0] - A[0]) + (p[2] - A[2]) * (B[2] - A[2])) / L2;
  const ts = twin.map(tOf), lo = Math.max(0, Math.min(...ts)), hi = Math.min(1, Math.max(...ts));
  const at = (t: number): [V3, V3] => {
    const x = A[0] + (B[0] - A[0]) * t, z = A[2] + (B[2] - A[2]) * t;
    const foot = ring[1][1] + (ring[2][1] - ring[1][1]) * t, top = ring[0][1] + (ring[3][1] - ring[0][1]) * t;
    return [[x, top, z], [x, foot, z]];
  };
  const quad = (t0: number, t1: number): V3[] => { const [a0, a1] = at(t0), [b0, b1] = at(t1); return [a0, a1, b1, b0]; };
  return [...(lo > 0.01 ? [quad(0, lo)] : []), ...(hi < 0.99 ? [quad(hi, 1)] : [])];
}
const cutAway = new Map(TWINS.map(([d, t]) => [d, outsideTwin(shell.surfaces[d].rings[0] as V3[], shell.surfaces[t].rings[0] as V3[])]));
const src: Src = {...shell, surfaces: shell.surfaces.flatMap((sf, i) => cutAway.has(i) ? cutAway.get(i)!.map(r => ({...sf, rings: [r]})) : [sf])};

const HOUSE: Col = 'brick', PODIUM: Col = 'greyBrick', FRAME: Col = 'frame', ZINC: Col = 'concrete', RED: Col = 'red', SILL: Col = 'stone';

const PODIUM_BANDS: [number, Col][] = [[0.45, PODIUM], [0.85, RED], [3.6, FRAME], [4.95, PODIUM], [7.55, FRAME], [8.3, ZINC], [99, HOUSE]];
const HOUSING_ROWS = [[9.2, 10.7], [11.9, 13.4], [14.6, 16.0]].map(y => ({y: y as [number, number], pitch: 2.7, w: 1.2, o: {depth: 0.15, edge: 0.06, cols: 2, sill: SILL}}));

/** Fronts with the supermarket's name on the sign band: the footprint wall line from hand-block-walls.ts and the sign width. */
const SIGNS: {a: P2; b: P2; n: P2; w: number}[] = [
  {a: [34.03, 5.38], b: [26.84, 2.1], n: [0.4146, -0.91], w: 6.6}, // w03-24, the main corner (2025)
  {a: [-0.53, -8], b: [-4.68, -9.81], n: [0.4005, -0.9163], w: 4.2}, // w12-24 (2021)
  {a: [35.46, 14.63], b: [36.6, 7.51], n: [0.9874, 0.1583], w: 6.4}, // w06-99 (2021)
];
function sign(b: BuildingTools, F: FR, w: WallGeom) {
  for (const S of SIGNS) {
    if (w.n[0] * S.n[0] + w.n[1] * S.n[1] < 0.97) continue;
    const c: P2 = [(S.a[0] + S.b[0]) / 2, (S.a[1] + S.b[1]) / 2];
    if (Math.abs((c[0] - F.f.origin[0]) * F.f.n[0] + (c[1] - F.f.origin[1]) * F.f.n[1]) > 1.0) continue;
    const t = (c[0] - F.f.origin[0]) * F.f.tangent[0] + (c[1] - F.f.origin[1]) * F.f.tangent[1];
    if (t < 0 || t > F.len) continue;
    const half = Math.min(S.w, F.len - 0.3) / 2, tc = Math.min(Math.max(t, half + 0.15), F.len - half - 0.15);
    // bold block letters (the pixel font is upper case only; the sign is mixed case): 107 pixel columns over the sign width
    letters(b, F.f, 'DIRK VAN DEN BROEK', tc, 3.72, 0.02, (half * 2) / 107, 0.07, RED, 0.12);
  }
}

function zoned(w: WallGeom): Zone {
  if (w.yb > 16) {
    // the top storey: wide glazed bays between brick piers (on its full-height walls; the sloped roof's low walls stay brick), a deep zinc eave
    return {bands: [[99, HOUSE]], rows: w.yt < 18.8 || w.yb > 16.8 ? [] : [{y: [w.yb + 0.25, Math.min(w.yt - 0.35, w.yb + 2.25)], pitch: 2.6, gap: 0.7, o: {depth: 0.2, edge: 0.07, cols: 2}}],
      extra: (b, F) => { if (w.yt - w.yb > 1.5) longBand(b, F, 0, F.len, w.yt - 0.3, w.yt + 0.05, 0.9, ZINC); }};
  }
  // strips under 0.9 m (corner returns, the cut twins) stay solid
  const rows = w.len < 0.9 ? [] : [
    {y: [0.9, 3.5] as [number, number], pitch: 2.2, gap: 0.1, o: {depth: 0.12, edge: 0.06, bars: [2.0]}},
    {y: [5.05, 7.45] as [number, number], pitch: 1.5, gap: 0.1, o: {depth: 0.12, edge: 0.06, bars: [1.65]}},
    ...HOUSING_ROWS,
  ];
  return {bands: w.yb > 8 ? [[99, HOUSE]] : PODIUM_BANDS, rows, extra: (b, F) => {
    // the zinc fascia over the glazed storey, on the podium walls only (the housing walls rise straight past it)
    if (w.yb < 1 && w.yt < 9) longBand(b, F, 0, F.len, 7.55, 8.35, 0.3, ZINC);
    if (w.yb < 1) sign(b, F, w);
  }};
}

/** s01-204, the long south-west housing front (crop 39.5 px/m): curved-ended balconies at both ends, three decks. */
const S01 = {a: [-31.38, -0.92] as P2, b: [27.67, 25.22] as P2, n: [-0.4047, 0.9144] as P2};
function balconies(b: BuildingTools) {
  const L = Math.hypot(S01.b[0] - S01.a[0], S01.b[1] - S01.a[1]), u: P2 = [(S01.b[0] - S01.a[0]) / L, (S01.b[1] - S01.a[1]) / L];
  const f = {origin: S01.a, tangent: u, n: S01.n};
  for (const [t0, t1] of [[1.4, 6.1], [51.2, 60.0]]) for (const y of [8.45, 11.15, 13.85]) slabBalcony(b, f, t0, t1, y, 1.5, {slab: ZINC, rail: 'blue', railH: 1.05});
}

const frameOn = (a: P2, c: P2, n: P2): FR => {
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
  return {f: {origin: a, tangent: [(c[0] - a[0]) / L, (c[1] - a[1]) / L], n}, len: L};
};
/** s04-25 (2022, 50 px/m): the recessed loggias' slender blue-grey columns and rails; w07-294 (2017): the corner tower's pilotis. */
function columns(b: BuildingTools) {
  const S04 = frameOn([32.58, 12.62], [19.55, 6.63], [0.418, -0.9084]);
  for (const s of [7.0, 9.2, 11.5]) strut(b, at(S04, s, 0.12, 8.25), at(S04, s, 0.12, 16.35), 0.07, FRAME, 6);
  // open steel rails: top and bottom rail, a baluster every 0.6 m
  for (const y of [9.25, 11.95, 14.65]) {
    for (const yy of [y, y + 0.95]) slab(b, S04.f, 9.7, yy, 8.8, 0.05, 0.05, FRAME, 0.1);
    for (let s = 5.6; s < 14.1; s += 0.6) slab(b, S04.f, s, y + 0.05, 0.03, 0.9, 0.03, FRAME, 0.11);
  }
  const W07 = frameOn([-30.08, -8.87], [-32.78, -2.89], [-0.9117, -0.4108]);
  for (const s of [2.2, 4.6]) strut(b, at(W07, s, 0.6, 0), at(W07, s, 0.6, 5.5), 0.22, SILL, 8);
}

export function buildTweedeHugoDeGrootstraat43(_w: number, _d: number, b: BuildingTools) {
  buildHandBlock(b, {src, fronts: [], wall: HOUSE, roof: 'slate', ledge: ZINC, setbackAbove: 99, gridDefaults: {edge: 0.06}, zoned});
  balconies(b);
  columns(b);
}
