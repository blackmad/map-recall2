import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {getSink, letters, poly, setSink, slab, type Frame} from './nearbar-kit';
import {frameAt, makeFrontKit, type Chord, type Sec} from './street-front-kit';
import {TriSink, type XZ} from './venue-kit';
import {blobOutline, spokeLamp, strokeTiles, venloGlasshouse, type Decal} from './hall-kit';
import source from './garage-noord-footprints.json' with {type: 'json'};

/**
 * GARAGE NOORD, Gedempt Hamerkanaal 40, Amsterdam-Noord (BAG pand 0363100012079768, bouwjaar 1917; OSM node 5891849386
 * amenity=nightclub; the Sichuan Territory restaurant, OSM node 12979333989 amenity=restaurant cuisine=chinese, fills its
 * glazed front). A 1917 brick works shed, 9.7 x 12.4 m, measured on rectified Gemeente Amsterdam panoramas (CC BY 4.0):
 * recording_2025-09-04_07-46-10_00631 and the 2024-10-22 recording (the current state), TMX7316010203-002572_pano_0000_001788
 * (2022) and the 2016 captures of the north-east and north-west walls; the glasshouse plan from the PDOK HR orthophoto.
 * From the south-east (s along the front from BAG ring vertex 2, the party corner with the Skatecafe):
 *  - a brick front to a 7.0 m parapet; over its middle (s 1.76-7.24) a teal corrugated false front, 1 m deep from the ground, 7.2 m at the
 *    sides and 8.5 m at the apex, with a white rake trim and the Sichuan Territory emblem (cream oval, red hexagons with
 *    characters, red lettering, the dragon on top) at about 6.6 m;
 *  - behind it the 3DBAG pitched roof, ridge 8.0 m running back from the front at s 4.9, eaves 6.1 m on the south-west side
 *    and a flatter 6.6 m piece on the north-east side;
 *  - in front, the restaurant's glasshouse on the yard: a Venlo block of four ridges (eaves 3.0, ridges 3.9 m) against the
 *    wall over s -3.8..9.7, and a lower five-ridge glazed room (eaves 2.9, ridges 3.2 m) out to 12.5 m over s -3.8..11.9,
 *    mint-green frame, red characters on its front glass;
 *  - two rust "sunburst" lamp masts in front of it, a wheel of drooping spokes with a lamp on every tip.
 * Native frame of garage-noord-footprints.json: x east, z south, y up from the 3DBAG ground (0.98 m NAP).
 */
type Shell = {nativeRing: XZ[]};
const R = (source as unknown as Shell).nativeRing;
const FR: Chord = {a: R[2], b: R[5]};
const F: Frame = (({origin, tangent, n}) => ({origin, tangent, n}))(frameAt(FR, 0, 0));
const P3 = (s: number, y: number, o: number) => [F.origin[0] + F.tangent[0] * s + F.n[0] * o, y, F.origin[1] + F.tangent[1] * s + F.n[1] * o];
const P2 = (s: number, o: number): XZ => [F.origin[0] + F.tangent[0] * s + F.n[0] * o, F.origin[1] + F.tangent[1] * s + F.n[1] * o];
const D = (s: number, y: number, o: number) => [F.tangent[0] * s + F.n[0] * o, y, F.tangent[1] * s + F.n[1] * o];
const shifted = (o: number): Frame => ({origin: P2(0, o), tangent: F.tangent, n: F.n});

const W = 9.74, DEEP = 12.41, PARAPET = 7.0;
// roof profile across the front (s, y): 3DBAG LoD2.2 pieces
const ROOF: [number, number][] = [[0, 6.1], [4.9, 8.0], [7.29, 6.66], [W, 6.6]];
const TEAL0 = 1.76, TEAL1 = 7.24, TEAL_FOOT = 0, RIB_FOOT = 3.0, TEAL_SIDE = 7.2, TEAL_APEX = 8.5, TEAL_D = 1.0;
const TM = (TEAL0 + TEAL1) / 2, TH = (TEAL1 - TEAL0) / 2;
const tealTop = (t: number) => TEAL_SIDE + (TEAL_APEX - TEAL_SIDE) * (1 - Math.abs(t - TM) / TH);

export function buildGarageNoord(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}, decal?: Decal) {
  const sink0 = getSink();
  setSink(0.12, true);
  const K = makeFrontKit(b, 0);
  const M = new TriSink();
  const up = [0, 1, 0];

  // ---- massing: walls and the pitched roof -------------------------------------------------------------------------
  for (let k = 0; k + 1 < ROOF.length; k++) {
    const [s0, y0] = ROOF[k], [s1, y1] = ROOF[k + 1];
    M.quad('slate', P3(s0, y0, 0), P3(s1, y1, 0), P3(s1, y1, -DEEP), P3(s0, y0, -DEEP), D(-(y1 - y0), s1 - s0, 0));
  }
  const back = D(0, 0, -1);
  M.fan('brick', [P3(0, 0, -DEEP), P3(W, 0, -DEEP), ...[...ROOF].reverse().map(([s, y]) => P3(s, y, -DEEP))], back);
  M.quad('brick', P3(0, 0, 0), P3(0, 0, -DEEP), P3(0, ROOF[0][1], -DEEP), P3(0, ROOF[0][1], 0), D(-1, 0, 0));
  M.quad('brick', P3(W, 0, 0), P3(W, 0, -DEEP), P3(W, ROOF[3][1], -DEEP), P3(W, ROOF[3][1], 0), D(1, 0, 0));
  // the thin grey flue pipe near the front of the north-east wall (2016 capture TMX7316060226-000022_pano_0008_004261)
  b.add(new T.CylinderGeometry(0.09, 0.09, 7.4, 8).translate(0, 3.7, 0), 'concrete', ...(P3(W + 0.3, 0, -2.2) as [number, number, number]));
  b.mark?.('massing');

  // ---- front: brick to the parapet, an entrance behind the glasshouse, a teal downpipe -------------------------------
  const A: Sec = K.sec(FR, 0, W, 0, PARAPET, 'brick', 0);
  // the club entrance in the teal front (2022 capture TMX7316010203-002572_pano_0000_001788), behind the glasshouse since 2024
  slab(b, F, TM, 0, 2.6, 2.7, 0.05, 'dark', TEAL_D);
  K.opening(A, 1.2, 0.05, 1.0, 2.3, {frame: 'dark', back: 'dark', depth: 0.15, edge: 0.06});
  slab(b, F, 8.55, 0, 0.12, PARAPET - 0.3, 0.12, 'blue', 0.2);
  K.coping(A, PARAPET, 0.1, 0.05, 'concrete', 0, TEAL0, 0.3);
  K.coping(A, PARAPET, 0.1, 0.05, 'concrete', TEAL1, W, 0.3);
  K.flush();
  M.flush(b);
  b.mark?.('front');

  // ---- the teal corrugated false gable, white rake trim, ribs -----------------------------------------------------------
  poly(b, F, TM, TEAL_FOOT, [[-TH, 0], [TH, 0], [TH, TEAL_SIDE - TEAL_FOOT], [0, TEAL_APEX - TEAL_FOOT], [-TH, TEAL_SIDE - TEAL_FOOT]], TEAL_D, 'blue', 0);
  for (let t = TEAL0 + 0.25; t < TEAL1 - 0.1; t += 0.5) slab(b, F, t, RIB_FOOT, 0.08, tealTop(t) - RIB_FOOT - 0.2, 0.09, 'blue', TEAL_D);
  const trim = 0.16;
  poly(b, F, TM, TEAL_FOOT, [[-TH - 0.05, TEAL_SIDE - TEAL_FOOT + 0.1], [0, TEAL_APEX - TEAL_FOOT + 0.12], [TH + 0.05, TEAL_SIDE - TEAL_FOOT + 0.1], [TH + 0.05, TEAL_SIDE - TEAL_FOOT + 0.1 - trim], [0, TEAL_APEX - TEAL_FOOT + 0.12 - trim * 1.1], [-TH - 0.05, TEAL_SIDE - TEAL_FOOT + 0.1 - trim]], 0.2, 'ochre', TEAL_D);
  // emblem plate: the cream oval with the two hexagon shields at its sides
  const EY = 6.55, ERX = 1.32, ERY = 0.72;
  poly(b, F, TM, EY, blobOutline(ERX, ERY, 20, 2.2), 0.22, 'ochre', TEAL_D);
  const hex = (r: number): [number, number][] => Array.from({length: 6}, (_, k) => [r * Math.cos(Math.PI / 6 + k * Math.PI / 3), r * Math.sin(Math.PI / 6 + k * Math.PI / 3)]);
  for (const sg of [-1, 1]) poly(b, F, TM + sg * 1.22, EY + 0.18, hex(0.3), 0.32, 'red', TEAL_D);
  b.mark?.('teal gable');

  // ---- the restaurant glasshouse ----------------------------------------------------------------------------------------
  venloGlasshouse(b, F, {s0: -3.8, s1: 9.7, depth: 6.5, eaves: 3.0, ridge: 3.9, bays: 4, glass: 'glass', frame: 'green', postPitch: 1.7});
  const FO = shifted(6.5);
  venloGlasshouse(b, FO, {s0: -3.8, s1: 11.9, depth: 6.0, eaves: 2.9, ridge: 3.2, bays: 5, glass: 'glass', frame: 'green', plinth: {h: 0.35, c: 'green'}, postPitch: 1.75});
  // the mint fascia over the front glass
  const FF = shifted(12.5);
  slab(b, FF, (-3.8 + 11.9) / 2, 2.55, 15.9, 0.32, 0.14, 'green', 0.06);
  b.mark?.('glasshouse');

  // ---- sunburst lamp masts -----------------------------------------------------------------------------------------------
  for (const [s, o, ph] of [[1.3, 13.6, 0], [9.4, 13.9, 0.17]] as const) {
    const [x, z] = P2(s, o);
    spokeLamp(b, x, z, {pole: 6.6, r: 3.0, n: 18, droop: 0.3, hub: 4.4, c: 'bronze', lamp: 'dark', phase: ph, poleR: 0.13});
  }
  b.mark?.('lamps');

  // ---- decals: emblem lettering and characters, the dragon, the red characters on the glass -----------------------------
  if (decal) {
    const on = (hexc: string) => ({add: (g: T.BufferGeometry) => decal(g, hexc)}) as unknown as BuildingTools;
    const front = TEAL_D + 0.22 + 0.09;
    letters(on('#b8322a'), F, 'SICHUAN', TM, EY + 0.04, front, 0.034, 0.01, 'white', 0.052);
    letters(on('#b8322a'), F, 'TERRITORY', TM, EY - 0.4, front, 0.029, 0.01, 'white', 0.046);
    poly(on('#2b2a2c'), F, TM, EY + ERY - 0.05, blobOutline(0.55, 0.22, 14, 2.4), 0.01, 'white', front);
    for (const [sg, k] of [[-1, 0], [1, 1]] as const) strokeTiles(decal, F, 1, TM + sg * 1.22, EY + 0.18 - 0.17, 0.34, 0, '#f4efe2', TEAL_D + 0.32 + 0.09, 20 + k);
    const red = '#c8322a', out = 0.16;
    poly(on(red), FF, -2.6, 1.55, blobOutline(0.42, 0.42, 16, 2), 0.01, 'white', out);
    strokeTiles(decal, FF, 2, 0.3, 1.85, 0.5, 0.12, red, out, 0);
    strokeTiles(decal, FF, 2, 4.4, 1.85, 0.5, 0.12, red, out, 2);
    strokeTiles(decal, FF, 3, 9.3, 1.85, 0.5, 0.12, red, out, 4);
  }
  setSink(sink0);
}
