import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {local, extrude, door, frame, onWall, tris, win, type Kit, type V2, type Col} from './church-kit';
import {put, poly, ringSlab, type Frame} from './nearbar-kit';
import {neckGable, type NeckGableSpec} from './neck-gable';
import {clipZ, saddleX} from './cromhouthuizen-builder';
import source from './waldorf-astoria-herengracht-footprints.json';

/**
 * Waldorf Astoria Amsterdam, Herengracht 542-556 (BAG panden 0363100012171090 = 556, 0363100012178774 = 546-554,
 * 0363100012253806 = 542-544; the hotel since 2014, VBO 0363010012112912). Six canal fronts, east to west:
 *   556  brick, five bays, stone door portal with fanlight on a double stoop, cornice, a dormer and chimney;
 *   554  white stucco Louis XIV front, five bays with festoons, a small iron balcony over the door, modillion cornice,
 *        balustrade with a sculpture group over the middle and an urn on the corner;
 *   550-552  brick double house, seven bays with dark glazing bars, white console cornice, two neck dormers with hoist beams;
 *   548  brick, five bays around a white frontispiece: door with a round fanlight, balcony, the hotel flag, console cornice,
 *        balustrade with a crested cartouche (two coats of arms) and urns on the corners;
 *   546  brick, five bays of segment-headed windows round a white frontispiece with a door and an oculus over it, a stoop with
 *        a white balustrade, cornice and a neck dormer;
 *   542-544  plain brick, five bays over a raised basement, hipped slate roof with two dormers and two chimneys.
 * House-number assignment of 554 and 550-552 follows the order along the front (the BAG pand 0363100012178774 holds all
 * of 546-554), not a per-house BAG record. Herengracht 540 (pand 0363100012171082, also hotel floor space) is not modelled.
 *
 * Local frame (church-kit `local`): x along the front from the east party line of 556 (toward the Utrechtsestraat) to the
 * west party line of 542, y up from the pavement, z out of the front toward the canal (the building is z <= 0). Openings,
 * cornices and ornaments were read on Gemeente Amsterdam panorama TMX7316010203-001975_pano_0000_000032 rectified onto
 * the BAG front plane (1 m grid, 25 px/m); depth and roof heights from the BAG rings and 3DBAG
 * (waldorf-astoria-herengracht-footprints.json). Inventory: waldorf-astoria-herengracht-inventory.json.
 */
export const AXIS_DEG = source.axisDeg;
export const ORIGIN: V2 = source.origin as V2;
const END = source.frontLengthM;
const DEPTH = 14.0; // front houses; the rear wings behind them are lower (3DBAG)

type Row = [number, number];
type House = {
  id: string; x0: number; x1: number; wall: 'brick' | 'stone';
  bays: number[]; w: number; rows: Row[]; head?: 'flat' | 'segment'; bar: Col; cols: number; rowM: number;
  basement?: Row; door?: number; corniceY: [number, number]; eaves: number; ridge: number;
};

/** Per house, measured on the rectified panorama (metres along the front, heights above the pavement). */
export const HOUSES: House[] = [
  {id: '556', x0: 0, x1: 15.2, wall: 'brick', bays: [1.9, 4.6, 7.75, 10.5, 13.75], w: 1.4, rows: [[3.0, 6.45], [7.4, 9.95], [10.6, 12.45]], bar: 'white', cols: 3, rowM: 0.5,
    basement: [0.6, 1.7], door: 7.75, corniceY: [13.0, 14.0], eaves: 14.0, ridge: 18.4},
  {id: '554', x0: 15.2, x1: 30.1, wall: 'stone', bays: [17.2, 19.6, 22.8, 26.0, 28.5], w: 1.45, rows: [[2.85, 6.05], [7.4, 10.05], [11.3, 13.3]], bar: 'white', cols: 3, rowM: 0.4,
    door: 22.8, corniceY: [15.0, 15.8], eaves: 15.8, ridge: 19.4},
  {id: '550-552', x0: 30.1, x1: 47.2, wall: 'brick', bays: [31.3, 33.9, 36.1, 38.4, 41.3, 43.6, 45.8], w: 1.5, rows: [[2.3, 5.9], [7.4, 10.5], [11.8, 13.9]], bar: 'frame', cols: 2, rowM: 1.05,
    basement: [0.15, 1.3], corniceY: [14.7, 16.0], eaves: 16.0, ridge: 19.5},
  {id: '548', x0: 47.2, x1: 61.8, wall: 'brick', bays: [48.8, 51.2, 54.8, 58.4, 60.8], w: 1.6, rows: [[2.1, 5.7], [7.3, 10.6], [11.8, 14.1]], bar: 'white', cols: 3, rowM: 0.4,
    door: 54.8, corniceY: [14.7, 16.5], eaves: 16.5, ridge: 19.5},
  {id: '546', x0: 61.8, x1: 76.65, wall: 'brick', bays: [64.0, 66.3, 70.0, 73.5, 75.8], w: 1.5, rows: [[2.6, 6.3], [7.65, 10.3], [11.6, 13.7]], head: 'segment', bar: 'white', cols: 2, rowM: 0.9,
    basement: [0.4, 1.5], door: 70.0, corniceY: [14.2, 15.8], eaves: 15.8, ridge: 19.4},
  {id: '542-544', x0: 76.65, x1: END, wall: 'brick', bays: [79.3, 82.0, 84.7, 87.5, 90.0], w: 1.6, rows: [[4.2, 7.6], [8.8, 11.4], [12.3, 14.4]], bar: 'white', cols: 2, rowM: 0.85,
    basement: [0.8, 2.7], corniceY: [15.4, 16.0], eaves: 16.0, ridge: 21.3},
];

const sphere = (r: number, sx = 1, sy = 1, sz = 1, w = 6, h = 4) => new T.SphereGeometry(r, w, h).scale(sx, sy, sz);
const ringOf = (pand: string): V2[] => (source.pands as Record<string, {ringLocal: number[][]}>)[pand].ringLocal.slice(0, -1).map(p => [p[0], p[1]] as V2);

/** Hipped roof over a rectangle: eaves all round, ridge parallel to x, hips inset by `hip` at both ends. */
function hipRoof(k: Kit, x0: number, x1: number, zf: number, zb: number, e: number, r: number, hip: number) {
  const zm = (zf + zb) / 2, up = (_c: T.Vector3, n: T.Vector3) => n.y > 0;
  const a = [x0, e, zf], b = [x1, e, zf], c = [x1, e, zb], d = [x0, e, zb], p = [x0 + hip, r, zm], q = [x1 - hip, r, zm];
  tris(k, [[a, b, q], [a, q, p], [c, d, p], [c, p, q], [b, c, q], [d, a, p]], 'slate', up);
}

export function buildWaldorfAstoriaHerengracht(_w: number, _d: number, b: BuildingTools) {
  const k: Kit = local(b, AXIS_DEG, ORIGIN);
  const F: Frame = frame([0, 0], [0, 1]);
  /** The wall frame moved out onto a frontispiece or portal face `d` proud of the wall. */
  const FP = (d: number): Frame => frame([0, d], [0, 1]);
  /** Bays standing on a frontispiece: 548 and 546 (the door bays). */
  const onFrontispiece = (h: House, t: number) => (h.id === '548' || h.id === '546') && Math.abs(t - h.door!) < 0.1;
  const S = (t: number, y: number, w: number, h: number, d: number, c: Col, out = 0) => onWall(k, F, t, y, w, h, d, c, out);
  const P = (g: T.BufferGeometry, t: number, y: number, out: number, c: Col) => put(k, F, g, t, y, out, c);

  // ---------- masses ----------
  // front houses: one block each to its cornice; 554's stucco is a 0.3 m skin on its block
  for (const h of HOUSES) {
    const front = h.wall === 'stone' ? -0.3 : 0;
    extrude(k, [[h.x0 + 0.04, front], [h.x1 - 0.04, front], [h.x1 - 0.04, -DEPTH], [h.x0 + 0.04, -DEPTH]], 0, h.eaves, 'brick');
    if (h.wall === 'stone') S((h.x0 + h.x1) / 2, 0, h.x1 - h.x0 - 0.08, h.eaves, 0.3, 'stone', -0.3);
  }
  // rear wings: the BAG rings behind the front houses, flat roofs (3DBAG 11-13 m above the pavement)
  for (const pand of Object.keys(source.pands)) {
    const r = clipZ(ringOf(pand), -40, -DEPTH - 0.05);
    if (r.length < 3) continue;
    extrude(k, r, 0, 12.0, 'brick');
    extrude(k, r, 12.0, 12.12, 'slate');
  }
  // roofs: saddles parallel to the canal; 542-544 hipped
  for (const h of HOUSES) {
    if (h.id === '542-544') hipRoof(k, h.x0 + 0.04, h.x1 - 0.04, -0.2, -DEPTH, h.eaves, h.ridge, 4.0);
    else saddleX(k, h.x0 + 0.04, h.x1 - 0.04, -0.2, -DEPTH, h.eaves, h.ridge);
  }
  // chimneys (3DBAG 22-23 m NAP on 542-544; photo on 556)
  for (const [t, z, top] of [[9.6, -5.0, 17.6], [73.2, -3.2, 20.4], [83.6, -3.6, 21.6]] as const) {
    k.add(new T.BoxGeometry(1.1, top - 12, 0.7), 'brick', t, 12 + (top - 12) / 2, z);
    k.add(new T.BoxGeometry(1.25, 0.15, 0.85), 'stone', t, top + 0.07, z);
  }

  // ---------- windows: every house its own rhythm ----------
  for (const h of HOUSES) {
    for (const t of h.bays) {
      h.rows.forEach(([y0, y1], i) => {
        if (i === 0 && h.door !== undefined && Math.abs(t - h.door) < 0.1) return;
        const fr = onFrontispiece(h, t) ? FP(0.1) : F;
        win(k, fr, t, {w: h.w, y0, y1, head: onFrontispiece(h, t) ? 'flat' : h.head ?? 'flat', bars: h.cols - 1, rowM: h.rowM, surround: 'white', bar: h.bar});
      });
      if (h.basement && !(h.door !== undefined && Math.abs(t - h.door) < 0.1)) {
        const [y0, y1] = h.basement;
        win(k, F, t, {w: h.w - 0.2, y0, y1, head: 'flat', bars: 1, rowM: 0.6, surround: 'white', bar: 'white'});
      }
    }
    // cornice: frieze, crown moulding, consoles in pairs over the piers
    const [c0, c1] = h.corniceY, mid = (h.x0 + h.x1) / 2, wid = h.x1 - h.x0;
    S(mid, c0, wid, c1 - c0 - 0.3, 0.12, 'stone');
    S(mid, c1 - 0.3, wid, 0.36, 0.5, 'stone'); // its top stands 6 cm over the block's roof line
    if (h.id !== '542-544') {
      const piers = [h.x0 + 0.35, ...h.bays.slice(1).map((t, i) => (t + h.bays[i]) / 2), h.x1 - 0.35];
      for (const t of piers) {
        const pair = h.id === '554' ? [0] : [-0.15, 0.15];
        for (const s of pair) S(t + s, c0 - (h.id === '554' ? 0 : 0.65), 0.14, (c1 - 0.3) - (c0 - (h.id === '554' ? 0 : 0.65)), 0.32, 'stone');
      }
      if (h.id === '554') for (let t = h.x0 + 0.4; t < h.x1 - 0.2; t += 0.55) S(t, c1 - 0.45, 0.16, 0.15, 0.4, 'stone'); // modillions
    }
  }

  // ---------- balustrades, urns ----------
  const baluster = () => new T.LatheGeometry([new T.Vector2(0.001, 0), new T.Vector2(0.08, 0.02), new T.Vector2(0.05, 0.15), new T.Vector2(0.1, 0.38), new T.Vector2(0.045, 0.66), new T.Vector2(0.07, 0.72), new T.Vector2(0.001, 0.73)], 6);
  const balustrade = (t0: number, t1: number, y: number, z: number, h = 1.15, posts: number[] = []) => {
    k.add(new T.BoxGeometry(t1 - t0, 0.2, 0.42), 'stone', (t0 + t1) / 2, y + 0.1, z);
    const ps = [t0 + 0.2, ...posts, t1 - 0.2];
    for (const t of ps) k.add(new T.BoxGeometry(0.38, h, 0.42), 'stone', t, y + h / 2, z);
    for (let i = 0; i + 1 < ps.length; i++) {
      const a = ps[i] + 0.3, c = ps[i + 1] - 0.3, n = Math.max(1, Math.floor((c - a) / 0.27));
      for (let j = 0; j <= n; j++) k.add(baluster().scale(1, (h - 0.38) / 0.73, 1), 'stone', a + (c - a) * j / n, y + 0.2, z);
    }
    k.add(new T.BoxGeometry(t1 - t0, 0.18, 0.46), 'stone', (t0 + t1) / 2, y + h - 0.09, z);
  };
  const urn = (t: number, y: number, z: number, s = 1) => {
    k.add(new T.BoxGeometry(0.5 * s, 0.35 * s, 0.5 * s), 'stone', t, y + 0.17 * s, z);
    k.add(new T.LatheGeometry([new T.Vector2(0.001, 0), new T.Vector2(0.14, 0), new T.Vector2(0.1, 0.12), new T.Vector2(0.28, 0.45), new T.Vector2(0.22, 0.72), new T.Vector2(0.12, 0.8), new T.Vector2(0.05, 1.05), new T.Vector2(0.001, 1.1)].map(v => v.multiplyScalar(s)), 8), 'stone', t, y + 0.35 * s, z);
  };

  // ---------- 556: stone door portal with fanlight, framed window over it, double stoop ----------
  {
    const t = 7.75;
    S(t, 0, 3.3, 7.2, 0.12, 'stone'); // portal surround: pilasters and entablature
    S(t, 7.0, 3.6, 0.3, 0.35, 'stone');
    S(t, 2.5, 1.15, 2.9, 0.18, 'dark');
    win(k, FP(0.12), t, {w: 1.15, y0: 5.5, y1: 6.45, head: 'flat', bars: 2, rowM: 0.5, surround: 'white', bar: 'white'});
    for (const s of [-1, 1]) S(t + s * 1.35, 7.3, 0.35, 2.9, 0.16, 'stone'); // carved frame around the middle first-floor window
    P(sphere(0.3, 1.4, 0.7, 0.5), t, 10.15, 0.12, 'stone');
    stoop(6.1, 9.1, 2.5, 'both', 'iron');
    for (const tt of [2.6, 12.9]) lantern(tt, 4.4);
  }

  // ---------- 554: stucco palace ----------
  {
    const h = HOUSES[1], t = h.door!;
    // festoons over the bel-etage and first-floor windows, drop ornaments between the middle bays
    for (const bt of h.bays) for (const y of [6.5, 10.45]) {
      for (let j = 0; j <= 4; j++) { const u = j / 4 - 0.5; P(sphere(0.1, 1.3, 1, 0.6), bt + u * 1.1, y + 0.3 - 0.25 * (1 - 4 * u * u), 0.04, 'stone'); }
      for (const s of [-1, 1]) P(sphere(0.08, 1, 1.6, 0.6), bt + s * 0.62, y + 0.25, 0.04, 'stone');
    }
    for (const bt of [21.3, 24.4]) for (const y of [8.0, 12.0]) P(sphere(0.12, 0.8, 4, 0.5), bt, y, 0.04, 'stone');
    // door with a glazed transom, a cornice hood on consoles, the balcony over it
    S(t, 2.4, 1.2, 2.2, 0.06, 'dark');
    win(k, F, t, {w: 1.2, y0: 4.75, y1: 6.05, head: 'flat', bars: 2, rowM: 0.45, surround: 'white', bar: 'white'});
    S(t, 6.35, 3.0, 0.35, 0.75, 'stone');
    for (const s of [-1, 1]) S(t + s * 1.3, 5.6, 0.22, 0.75, 0.6, 'stone');
    railing(t - 0.95, t + 0.95, 6.7, 0.75, 0.75);
    // attic: balustrade over the cornice, a panel over the middle bays carrying the sculpture group, the corner urn
    balustrade(h.x0 + 0.3, 20.6, h.eaves, -0.15, 1.2, [17.2, 19.0]);
    balustrade(25.0, h.x1 - 0.2, h.eaves, -0.15, 1.2, [26.6, 28.5]);
    k.add(new T.BoxGeometry(4.4, 1.6, 0.5), 'stone', 22.8, h.eaves + 0.8, -0.2);
    k.add(new T.BoxGeometry(2.4, 0.7, 0.12), 'stone', 22.8, h.eaves + 0.45, 0.1); // relief tablet
    for (const [dx, dy, r, sx, sy] of [[-1.2, 0.3, 0.32, 1.4, 1], [-0.45, 0.65, 0.35, 0.8, 1.9], [0.25, 0.75, 0.38, 0.9, 2.1], [0.9, 0.4, 0.3, 1.3, 1.2], [1.5, 0.15, 0.22, 1.5, 0.8], [0, 0.15, 0.3, 3.2, 0.7]] as const)
      k.add(sphere(r, sx, sy, 0.9, 7, 5), 'stone', 22.8 + dx, h.eaves + 1.6 + dy, -0.2);
    urn(15.75, h.eaves, -0.2, 1.15);
    stoop(20.9, 24.3, 2.4, 'both', 'iron');
    for (const tt of [20.2, 28.0]) lantern(tt, 4.3);
  }

  // ---------- 550-552: two neck dormers on the cornice line ----------
  for (const t of [36.3, 43.6]) neckDormer(t, 1.3, 16.0, 17.1, 18.5, 19.2, 'frame');

  // ---------- 548: white frontispiece, round-headed door, balcony, flag, crest ----------
  {
    const h = HOUSES[3], t = h.door!;
    S(t, 0, 3.7, h.corniceY[0], 0.1, 'stone');
    for (const s of [-1, 1]) S(t + s * 1.65, 0, 0.4, h.corniceY[0], 0.2, 'stone'); // rusticated pilaster strips
    door(k, FP(0.1), t, {w: 1.2, y0: 1.7, y1: 5.0, fan: true}); // panelled door under a round fanlight in a stone surround
    S(t, 6.2, 2.6, 0.3, 0.6, 'stone');
    railing(t - 0.95, t + 0.95, 6.5, 0.8, 0.6);
    balustrade(h.x0 + 0.2, 52.4, h.eaves, -0.15, 1.15, [50.0]);
    balustrade(57.2, h.x1 - 0.2, h.eaves, -0.15, 1.15, [59.6]);
    // crest: scrolled cartouche over the cornice with two coats of arms
    poly(k, F, t, h.eaves, [[-2.6, 0], [2.6, 0], [2.3, 1.4], [1.4, 2.4], [0.6, 3.1], [0, 3.6], [-0.6, 3.1], [-1.4, 2.4], [-2.3, 1.4]], 0.45, 'stone', -0.35);
    for (const s of [-1, 1]) {
      P(new T.CylinderGeometry(0.42, 0.42, 0.25, 12).rotateX(Math.PI / 2).translate(0, 0, 0.12), t + s * 1.85, h.eaves + 0.8, 0.0, 'stone'); // side scrolls
      ringSlab(k, F, t + s * 1.85, h.eaves + 0.8, 0.18, 0.42, 0.3, 'stone', 0.0, 12);
      poly(k, F, t + s * 0.42, h.eaves + 1.55, [[-0.36, 0.55], [0.36, 0.55], [0.36, 0.0], [0, -0.45], [-0.36, 0.0]], 0.18, s < 0 ? 'red' : 'green', 0.1);
    }
    P(sphere(0.32, 1.6, 0.8, 0.5), t, h.eaves + 2.75, 0.1, 'stone');
    for (const tt of [h.x0 + 0.5, h.x1 - 0.3]) urn(tt, h.eaves + 1.15, -0.2);
    stoop(52.8, 55.9, 1.7, 'both', 'iron');
    for (const tt of [52.6, 57.0]) lantern(tt, 4.6);
    // the hotel flag on its pole from the frontispiece
    const pole = new T.CylinderGeometry(0.04, 0.04, 3.4, 6).translate(0, 1.7, 0).rotateX(Math.PI / 4);
    k.add(pole, 'bronze', 53.6, 7.6, 0.0);
    const flag = new T.BoxGeometry(0.03, 2.6, 1.2).translate(0, -1.3, 0);
    k.add(flag, 'pink', 53.6, 7.6 + 2.35, 2.35 - 0.6);
  }

  // ---------- 546: frontispiece with oculus over the door, stoop with a white balustrade, neck dormer ----------
  {
    const h = HOUSES[4], t = h.door!;
    S(t, 0, 4.2, h.corniceY[0], 0.1, 'stone');
    for (const s of [-1, 1]) S(t + s * 1.95, 0, 0.3, h.corniceY[0], 0.18, 'stone');
    S(t, 1.9, 1.1, 3.1, 0.16, 'dark');
    ringSlab(k, F, t, 5.8, 0.36, 0.55, 0.22, 'stone', 0.1, 16);
    put(k, F, new T.CylinderGeometry(0.37, 0.37, 0.08, 16).rotateX(Math.PI / 2).translate(0, 0, 0.04), t, 5.8, 0.1, 'glass');
    S(t, 7.15, 3.6, 0.35, 0.55, 'stone');
    stoop(67.7, 70.7, 1.9, 'right', 'balusters');
    roofDormer(t, 15.8, -0.9); // white dormer with a gable over the frontispiece
  }

  // ---------- 542-544: dormers in the hipped roof ----------
  for (const t of [81.6, 87.1]) roofDormer(t, 16.0, -1.2);
  // 542-544 entrance in the raised basement
  S(80.65, 0, 0.8, 2.2, 0.06, 'dark');

  // ---------- helpers that need the frame ----------
  /** Gabled dormer set back in the roof: stone box, its window on the front face, slate saddle. */
  function roofDormer(t: number, base: number, zf: number) {
    const top = base + 1.8, zb = zf - 2.4;
    k.add(new T.BoxGeometry(1.7, top - base + 0.3, zf - zb), 'stone', t, base - 0.3 + (top - base + 0.3) / 2, (zf + zb) / 2);
    win(k, frame([0, zf], [0, 1]), t, {w: 1.1, y0: base + 0.25, y1: base + 1.5, head: 'flat', bars: 1, rowM: 0.6, surround: 'white', bar: 'white'});
    tris(k, [[[t - 1.0, top, zf + 0.05], [t + 1.0, top, zf + 0.05], [t, top + 0.6, zf + 0.05]]], 'stone', (_c, n) => n.z > 0);
    tris(k, [[[t - 1.0, top, zf + 0.05], [t, top + 0.6, zf + 0.05], [t, top + 0.6, zb]], [[t - 1.0, top, zf + 0.05], [t, top + 0.6, zb], [t - 1.0, top, zb]],
      [[t + 1.0, top, zf + 0.05], [t + 1.0, top, zb], [t, top + 0.6, zb]], [[t + 1.0, top, zf + 0.05], [t, top + 0.6, zb], [t, top + 0.6, zf + 0.05]]], 'slate', (_c, n) => n.y > 0);
  }
  function lantern(t: number, y: number) {
    P(new T.BoxGeometry(0.05, 0.05, 0.45).translate(0, 0, 0.21), t, y + 0.3, 0, 'bronze');
    k.add(new T.BoxGeometry(0.26, 0.42, 0.26), 'glass', t, y, 0.55);
    k.add(new T.ConeGeometry(0.22, 0.2, 4).rotateY(Math.PI / 4), 'bronze', t, y + 0.31, 0.55);
    k.add(new T.BoxGeometry(0.3, 0.05, 0.3), 'bronze', t, y - 0.23, 0.55);
  }
  /** Small iron balcony: slab on the wall, posts and a top rail. */
  function railing(t0: number, t1: number, y: number, depth: number, h: number) {
    k.add(new T.BoxGeometry(t1 - t0, 0.16, depth), 'stone', (t0 + t1) / 2, y + 0.08, depth / 2);
    const n = Math.round((t1 - t0) / 0.14);
    for (let j = 0; j <= n; j++) k.add(new T.BoxGeometry(0.025, h, 0.025), 'bronze', t0 + 0.04 + (t1 - t0 - 0.08) * j / n, y + 0.16 + h / 2, depth - 0.06);
    for (const s of [0, 1]) k.add(new T.BoxGeometry(0.025, h, 0.025), 'bronze', s ? t1 - 0.04 : t0 + 0.04, y + 0.16 + h / 2, depth / 2);
    k.add(new T.BoxGeometry(t1 - t0, 0.05, 0.05), 'bronze', (t0 + t1) / 2, y + 0.16 + h, depth - 0.06);
    k.add(new T.BoxGeometry(0.05, 0.05, depth), 'bronze', t0 + 0.04, y + 0.16 + h, depth / 2);
    k.add(new T.BoxGeometry(0.05, 0.05, depth), 'bronze', t1 - 0.04, y + 0.16 + h, depth / 2);
  }
  /**
   * Stoop in the BAG stoop bump (t0..t1, 1.3 m deep): a landing at the door sill and flights down along the facade to
   * one or both sides; iron railings, or stone balusters (546).
   */
  function stoop(t0: number, t1: number, top: number, sides: 'both' | 'right', rail: 'iron' | 'balusters') {
    const D = 1.25, mid = (t0 + t1) / 2, land = sides === 'both' ? 1.3 : 1.2;
    const l0 = sides === 'both' ? mid - land / 2 : t0, l1 = l0 + land;
    k.add(new T.BoxGeometry(l1 - l0, top, D), 'stone', (l0 + l1) / 2, top / 2, D / 2);
    const flights: [number, number][] = sides === 'both' ? [[l0, -1], [l1, 1]] : [[l1, 1]];
    for (const [from, dir] of flights) {
      const len = dir < 0 ? from - t0 : t1 - from, n = Math.max(3, Math.round(top / 0.18)), run = len / n;
      for (let i = 0; i < n; i++) {
        const h = top * (n - i) / (n + 1);
        k.add(new T.BoxGeometry(run + 0.002, h, D - 0.05), 'stone', from + dir * run * (i + 0.5), h / 2, (D - 0.05) / 2);
      }
      const ang = Math.atan2(top, len), railLen = Math.hypot(len, top);
      if (rail === 'iron') {
        k.add(new T.BoxGeometry(railLen, 0.05, 0.05).rotateZ(-dir * ang), 'bronze', from + dir * len / 2, top / 2 + 0.9, D - 0.08);
        for (let i = 0; i <= 4; i++) k.add(new T.BoxGeometry(0.03, 0.9, 0.03), 'bronze', from + dir * len * i / 4, top * (1 - i / 4) + 0.45, D - 0.08);
      } else {
        k.add(new T.BoxGeometry(railLen, 0.14, 0.24).rotateZ(-dir * ang), 'stone', from + dir * len / 2, top / 2 + 0.85, D - 0.14);
        for (let i = 1; i < 6; i++) k.add(new T.BoxGeometry(0.1, 0.7, 0.1), 'stone', from + dir * len * i / 6, top * (1 - i / 6) + 0.35, D - 0.14);
      }
    }
    if (rail === 'iron') {
      k.add(new T.BoxGeometry(l1 - l0, 0.05, 0.05), 'bronze', (l0 + l1) / 2, top + 0.9, D - 0.08);
      for (let i = 0; i <= 4; i++) k.add(new T.BoxGeometry(0.03, 0.9, 0.03), 'bronze', l0 + (l1 - l0) * i / 4, top + 0.45, D - 0.08);
    } else {
      k.add(new T.BoxGeometry(l1 - l0, 0.14, 0.24), 'stone', (l0 + l1) / 2, top + 0.78, D - 0.14);
      for (let i = 0; i <= 4; i++) k.add(baluster().scale(0.8, 0.9, 0.8), 'stone', l0 + 0.1 + (l1 - l0 - 0.2) * i / 4, top, D - 0.14);
    }
  }
  /** Neck dormer on the facade plane over the cornice: claws, a pediment, its window, a hoist beam and a slate cheek roof behind. */
  function neckDormer(t: number, half: number, base: number, clawTop: number, corniceY: number, apex: number, bar: Col, beam = true) {
    const g: NeckGableSpec = {x0: t - half - 0.75, x1: t + half + 0.75, axis: t, neckHalf: half, shoulderY: base, clawTopY: clawTop, corniceY, corniceH: 0.25, corniceHalf: half + 0.2, apexY: apex, thick: 0.4};
    neckGable(k, F, g, {wall: 'stone', trim: 'stone'});
    win(k, F, t, {w: half * 2 - (beam ? 0.7 : 0.9), y0: base + 0.25, y1: corniceY - (beam ? 0.6 : 0.35), head: 'flat', bars: 1, rowM: 0.7, surround: 'white', bar});
    if (beam) P(new T.BoxGeometry(0.18, 0.2, 1.1).translate(0, 0.1, 0.5), t, corniceY - 0.45, 0, 'frame');
    // cheek and roof behind the dormer face
    const z0 = -0.4, z1 = -3.2, x0 = t - half, x1 = t + half;
    extrude(k, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], base - 0.3, corniceY, 'stone');
    tris(k, [[[x0 - 0.1, corniceY, z0], [x1 + 0.1, corniceY, z0], [t, corniceY + 0.7, z0]]], 'slate', (_c, n) => n.z > 0);
    tris(k, [[[x0 - 0.1, corniceY, z0], [t, corniceY + 0.7, z0], [t, corniceY + 0.7, z1]], [[x0 - 0.1, corniceY, z0], [t, corniceY + 0.7, z1], [x0 - 0.1, corniceY, z1]],
      [[x1 + 0.1, corniceY, z0], [x1 + 0.1, corniceY, z1], [t, corniceY + 0.7, z1]], [[x1 + 0.1, corniceY, z0], [t, corniceY + 0.7, z1], [t, corniceY + 0.7, z0]]], 'slate', (_c, n) => n.y > 0);
  }

  // 556 dormer (gabled, set back in the roof)
  k.add(new T.BoxGeometry(2.0, 2.3, 2.4), 'stone', 3.9, 14.0 + 1.15, -1.9);
  win(k, frame([0, -0.7], [0, 1]), 3.9, {w: 1.2, y0: 14.3, y1: 15.9, head: 'flat', bars: 1, rowM: 0.8, surround: 'white', bar: 'white'});
  tris(k, [[[2.8, 16.3, -0.7], [5.0, 16.3, -0.7], [3.9, 17.0, -0.7]]], 'stone', (_c, n) => n.z > 0);
  tris(k, [[[2.8, 16.3, -0.7], [3.9, 17.0, -0.7], [3.9, 17.0, -3.1]], [[2.8, 16.3, -0.7], [3.9, 17.0, -3.1], [2.8, 16.3, -3.1]],
    [[5.0, 16.3, -0.7], [5.0, 16.3, -3.1], [3.9, 17.0, -3.1]], [[5.0, 16.3, -0.7], [3.9, 17.0, -3.1], [3.9, 17.0, -0.7]]], 'slate', (_c, n) => n.y > 0);
}
