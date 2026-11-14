import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {wallsOf} from './worship-walls';
import {archSlab, archBand, facePanel, frameOf, getSink, leanSlab, ledgeStrip, letters, poly, put, setSink, slab, type Frame} from './nearbar-kit';
import {corbelBalconyProfile, lozenge, lozengeCross, piercedHoles, rowCentres} from '../../src/canalRecall/landmarks/brickInlay';
import {paneGrid} from '../../src/canalRecall/landmarks/paneGrid';
import source from './asscher-diamantslijperij-footprints.json';

/**
 * DIAMANTSLIJPERIJ ASSCHER, Tolstraat 127-129 (BAG pand 0363100012237135, bouwjaar 1907, rijksmonument 527800): the
 * Asscher diamond-cutting works by G. van Arkel, "castle-like", with huge windows for the polishers (en.wikipedia Royal
 * Asscher Diamond Company); converted to flats in 2017 (Asscherkwartier), the tower still the firm's head office.
 * Massing is the 3DBAG LoD2.2 shell (asscher-diamantslijperij-footprints.json, native east/south metres); every facade
 * detail is read from the Gemeente Amsterdam panoramas (CC BY 4.0), asscher-diamantslijperij-inventory.json:
 *  - Tolstraat front (w04, 12.9 m, recording_2025-07-14_08-27-06_01061): five bays, two corner turrets with pierced
 *    parapets, a low stone-coped centre gable, white ASSCHER letters under a crown and the 1907 tablet, two closed stone
 *    balconies on corbels, round-headed windows in the three middle bays of the first and third floors, tile panels.
 *  - Cullinanplein front (w01, 74 m, TMX7316010203-000782_pano_0000_002149 2018 and TMX7316010203-002112_pano_0001_000113
 *    2021): fourteen bays of wide factory windows on four floors, red lozenge crosses in the spandrels, a red diaper
 *    cornice band, a parapet of brick piers with iron railings between; the east tower with round-headed attic lights,
 *    a three-arch loggia, the big arched stair window, the DIAMANTSLIJPERIJ plaque and the round-arched entrance.
 *  - Tolstraat side (w03, recording_2024-09-04_09-37-25_00577): windows in groups of three and two in grey stone
 *    dressings, the north gable with three small lights.
 *  - the courtyard (north) side, the wing's north face and the forecourt side of the west wing have no usable photo:
 *    the factory window rhythm carried round (inferred).
 */
export function buildAsscherDiamantslijperij(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const sink0 = getSink();
  setSink(0.25, true);
  addShell(b, source as never, {wall: 'brick', roof: 'slate'});
  b.mark?.('shell');
  const walls = new Map(wallsOf(source as never).map(w => [w.index, w]));
  /** Frame of shell wall `i` with t measured from `t0` metres before its own origin (the ring vertex of the facade). */
  const edge = (i: number, back = 0): Frame => {
    const w = walls.get(i)!, f = frameOf(w);
    return {...f, origin: [f.origin[0] - f.tangent[0] * back, f.origin[1] - f.tangent[1] * back]};
  };

  // ---- shared pieces ----
  /** Factory window: frame, glass, cols x 2 panes with the transom high (upper lights), grey stone sill and head blocks. */
  const factoryWindow = (f: Frame, t: number, y0: number, y1: number, w: number, cols: number, frame = 'white') => {
    const h = y1 - y0;
    leanSlab(b, f, t, y0 - 0.06, w + 0.14, h + 0.12, 0.07, frame);
    facePanel(b, f, t, y0, w - 0.08, h - 0.08, 'glass', 0.12);
    for (const r of paneGrid({width: w, height: h, cols, rows: 2, bar: 0.07, frame: 0, rowWeights: [2.2, 1]})) facePanel(b, f, t + r.x, y0 + r.y, r.w, r.h, frame, 0.17);
    ledgeStrip(b, f, t, y0 - 0.16, w + 0.3, 0.12, 0.22, 'stone');
    for (const s of [-1, 1]) leanSlab(b, f, t + s * (w / 2 + 0.08), y1 - 0.3, 0.22, 0.34, 0.14, 'stone');
  };
  /** Round-headed window in a grey stone surround (springing blocks and keystone). */
  const archedWindow = (f: Frame, t: number, y0: number, y1: number, w: number, frame = 'bronze', void_ = false) => {
    archSlab(b, f, t, y0, w, y1 - y0, 0.12, void_ ? 'dark' : 'glass');
    if (!void_) {
      slab(b, f, t, y0, 0.06, y1 - y0 - w / 2, 0.17, frame);
      slab(b, f, t, y0 + (y1 - y0 - w / 2) * 0.62, w, 0.06, 0.17, frame);
    }
    archBand(b, f, t, y0, w + 0.2, y1 - y0 + 0.1, 0.1, 0.14, frame === 'white' ? 'stone' : frame);
    slab(b, f, t, y0 - 0.16, w + 0.3, 0.14, 0.22, 'stone');
    for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 + 0.08), y1 - w / 2 - 0.15, 0.24, 0.3, 0.18, 'stone');
    slab(b, f, t, y1 - 0.05, 0.22, 0.3, 0.18, 'stone');
  };
  const lozengeAt = (f: Frame, t: number, y: number, r: number, cross = false) => {
    for (const l of cross ? lozengeCross(0, 0, r) : [lozenge(0, 0, r)]) poly(b, f, t, y, l as [number, number][], 0.07, 'red');
  };

  // ==== Cullinanplein front (wall 11 frame, t from the inner corner with the west wing) ====
  const S = edge(11);
  {
    // Fourteen bays: centres from the 2021 rectified crop (32.6 px/m, x1.02 onto the 3DBAG wall), last one narrow.
    const bays = [2.58, 7.09, 11.58, 16.03, 20.5, 24.95, 30.11, 35.12, 39.6, 43.97, 48.42, 52.8, 57.18];
    const rows: [number, number][] = [[0.45, 3.25], [5.0, 7.5], [9.26, 11.66], [13.5, 15.85]];
    for (const t of bays) for (const [y0, y1] of rows) factoryWindow(S, t, y0, y1, 3.5, 4);
    for (const [y0, y1] of rows) factoryWindow(S, 59.95, y0, y1, 0.75, 1);
    // red lozenge crosses in the spandrels, one per bay between the window rows
    for (const t of bays) for (const y of [4.2, 8.4, 12.6]) lozengeAt(S, t, y, 0.09, true);
    // plinth, sill course under the ground floor
    slab(b, S, 30.5, 0, 60.88, 0.42, 0.1, 'red');
    // cornice: red diaper band with yellow lozenges, stone course over it; parapet piers and iron railing to the wall top
    slab(b, S, 30.5, 16.45, 61, 0.85, 0.08, 'red');
    for (const t of rowCentres(0.2, 60.8, 0.55)) poly(b, S, t, 16.87, lozenge(0, 0, 0.17) as [number, number][], 0.12, 'brick');
    slab(b, S, 30.5, 17.3, 61.1, 0.16, 0.2, 'stone');
    const piers = [0.3, 4.83, 9.34, 13.8, 18.27, 22.72, 27.53, 32.6, 37.36, 41.78, 46.2, 50.6, 54.99, 58.9];
    for (const t of piers) { slab(b, S, t, 17.46, 0.62, 1.12, 0.16, 'brick'); slab(b, S, t, 18.5, 0.72, 0.12, 0.2, 'stone'); }
    for (let k = 0; k + 1 < piers.length; k++) {
      const a = piers[k] + 0.31, c = piers[k + 1] - 0.31;
      facePanel(b, S, (a + c) / 2, 17.46, c - a, 0.84, 'dark', 0.07);
      slab(b, S, (a + c) / 2, 18.28, c - a, 0.06, 0.1, 'frame');
    }
    // downpipes
    for (const t of [13.8, 32.7, 46.2]) slab(b, S, t, 0, 0.12, 17.3, 0.14, 'frame');
  }
  // ==== East tower, south face (same plane, t 61.0 - 73.9) ====
  {
    const L0 = 61.0, mid = 67.6, L1 = 73.9;
    slab(b, S, mid, 0, 0.14, 21.8, 0.14, 'frame'); // downpipe pilaster between the two halves
    for (const [a, c] of [[L0 + 0.06, 63.1], [65.5, L1 - 0.06]]) slab(b, S, (a + c) / 2, 0, c - a, 0.42, 0.1, 'red');
    // attic storey: six round-headed lights in pairs of three
    for (const t of [62.6, 64.3, 66.0, 69.1, 70.8, 72.5]) archedWindow(S, t, 17.3, 19.9, 1.15, 'white');
    // third floor: five narrow lights left, a three-arch loggia right on a stone ledge
    for (const t of rowCentres(61.8, 66.9, 1.02)) factoryWindow(S, t, 13.4, 15.8, 0.6, 1);
    for (const t of [69.1, 70.8, 72.5]) archedWindow(S, t, 13.2, 15.9, 1.15, 'white', true);
    slab(b, S, 70.8, 12.95, 5.4, 0.16, 0.45, 'stone');
    // second floor: the big round-arched stair window in a stone hood (left); six narrow lights (right)
    archSlab(b, S, 64.3, 9.0, 4.2, 3.2, 0.12, 'glass');
    archBand(b, S, 64.3, 9.0, 4.55, 3.35, 0.22, 0.2, 'stone');
    slab(b, S, 64.3, 9.0, 4.0, 0.08, 0.17, 'white');
    for (const t of [63.2, 65.4]) slab(b, S, t, 9.0, 0.08, 1.6, 0.17, 'white');
    slab(b, S, 64.3, 10.55, 4.0, 0.08, 0.17, 'white');
    for (const t of rowCentres(68.0, 73.5, 0.92)) factoryWindow(S, t, 9.3, 11.7, 0.55, 1);
    // DIAMANTSLIJPERIJ plaque (lettering too small to set) over the first-floor balcony door
    slab(b, S, 64.3, 8.0, 4.0, 0.62, 0.16, 'sandstone');
    slab(b, S, 64.3, 8.22, 3.4, 0.07, 0.2, 'dark');
    // first floor: window, balcony door, window on a stone balcony; six narrow lights right
    for (const t of [62.7, 65.9]) factoryWindow(S, t, 5.0, 7.5, 0.8, 1);
    slab(b, S, 64.3, 5.3, 1.1, 2.2, 0.12, 'glass');
    slab(b, S, 64.3, 6.6, 1.1, 0.08, 0.17, 'white');
    {
      const pr = corbelBalconyProfile({yFloor: 4.5, yTop: 5.3, depth: 0.6, corbel: 0.6});
      const g = new T.ExtrudeGeometry(new T.Shape(pr.map(([o, y]) => new T.Vector2(o, y))), {depth: 4.6, bevelEnabled: false});
      // shape (o, y) -> rotate so o runs out of the wall and the extrusion runs along t
      g.rotateY(-Math.PI / 2).translate(2.3, 0, 0);
      put(b, S, g, 64.3, 0, -0.05, 'stone');
    }
    for (const t of rowCentres(68.0, 73.5, 0.92)) factoryWindow(S, t, 5.0, 7.5, 0.55, 1);
    // ground: round-arched entrance in a stone surround (left); six narrow lights (right)
    archSlab(b, S, 64.3, 0.3, 1.8, 3.3, 0.12, 'bronze');
    archBand(b, S, 64.3, 0.3, 2.4, 3.6, 0.3, 0.22, 'stone');
    for (const t of [62.4, 66.2]) factoryWindow(S, t, 0.9, 3.25, 0.8, 1);
    for (const t of rowCentres(68.0, 73.5, 0.92)) factoryWindow(S, t, 0.6, 3.25, 0.55, 1);
    // crenellated top: pierced parapet band under stone caps over the attic storey
    for (const [a, c, top] of [[L0, mid, 23.7], [mid, L1, 22.6]] as const) {
      slab(b, S, (a + c) / 2, top - 1.15, c - a, 0.14, 0.2, 'stone');
      for (const h of piercedHoles({t0: a, t1: c, yHole0: top - 0.85, yHole1: top - 0.45, holes: Math.round((c - a) / 0.9), hole: 0.36})) slab(b, S, (h.t0 + h.t1) / 2, h.y0, h.t1 - h.t0, h.y1 - h.y0, 0.06, 'dark');
      slab(b, S, (a + c) / 2, top - 0.02, c - a + 0.1, 0.14, 0.2, 'stone');
    }
  }

  // ==== Tolstraat front (wall 51 frame, t 0 - 12.9 from the west corner) ====
  const F = edge(51);
  {
    const bays = [1.37, 3.97, 6.12, 8.26, 10.83];
    slab(b, F, 6.45, 0, 12.78, 0.55, 0.1, 'red');
    // ground floor: five raised square windows
    for (const t of bays) factoryWindow(F, t, 0.9, 3.6, 1.4, 2, 'bronze');
    // first floor: square in the turrets, round-headed in the three middle bays
    for (const t of [bays[0], bays[4]]) factoryWindow(F, t, 5.4, 7.9, 1.4, 2, 'bronze');
    for (const t of bays.slice(1, 4)) archedWindow(F, t, 5.4, 7.95, 1.4);
    // ASSCHER in white capitals (approximate font: the photo's letters are a plain sans; 5x7 pixel glyphs), crown, 1907
    letters(b, F, 'ASSCHER', 6.12, 8.25 - 0.107, 0.12, 0.107, 0.05, 'white');
    // crown: band, three points, orb
    slab(b, F, 6.12, 9.1, 0.62, 0.16, 0.16, 'white');
    for (const dt of [-0.24, 0, 0.24]) poly(b, F, 6.12 + dt, 9.26, [[-0.09, 0], [0.09, 0], [0, dt === 0 ? 0.42 : 0.32]], 0.14, 'white');
    slab(b, F, 6.12, 9.72, 0.12, 0.12, 0.16, 'white');
    // 1907 tablet: pale tile field with dark figures and a rosette over them
    slab(b, F, 6.12, 9.95, 0.98, 1.55, 0.12, 'sandstone');
    letters(b, F, '1907', 6.12, 10.25 - 0.04, 0.12, 0.04, 0.05, 'dark', 0.06);
    slab(b, F, 6.12, 11.05, 0.2, 0.2, 0.17, 'red');
    // second floor: four windows, the tablet in the middle bay; closed stone balconies on corbels in the turret bays
    for (const t of [bays[0], bays[1], bays[3], bays[4]]) factoryWindow(F, t, 9.45, 12.1, 1.4, 2, 'bronze');
    for (const t of [bays[0], bays[4]]) {
      const pr = corbelBalconyProfile({yFloor: 8.95, yTop: 9.85, depth: 0.55, corbel: 0.75});
      const g = new T.ExtrudeGeometry(new T.Shape(pr.map(([o, y]) => new T.Vector2(o, y))), {depth: 2.0, bevelEnabled: false});
      g.rotateY(-Math.PI / 2).translate(1.0, 0, 0);
      put(b, F, g, t, 0, -0.05, 'stone');
    }
    // tile panels between the second and third floors
    for (const [t, w] of [[bays[1], 1.6], [bays[2], 1.75], [bays[3], 1.6]] as const) {
      slab(b, F, t, 12.35, w + 0.12, t === bays[2] ? 0.8 : 0.56, 0.1, 'stone');
      slab(b, F, t, 12.41, w, t === bays[2] ? 0.68 : 0.44, 0.15, 'concrete');
    }
    // third floor
    for (const t of [bays[0], bays[4]]) factoryWindow(F, t, 13.8, 16.5, 1.4, 2, 'bronze');
    for (const t of bays.slice(1, 4)) archedWindow(F, t, 13.8, 16.55, 1.4);
    // red lozenges beside the windows (single, as the photo shows them in the turret piers)
    for (const y of [4.6, 8.8, 13.2, 17.3]) for (const t of [0.35, 12.55]) lozengeAt(F, t, y, 0.13);
    // top floor: paired small lights in the turrets, three narrow lights under the gable
    for (const t of [bays[0], bays[4]]) for (const dt of [-0.38, 0.38]) factoryWindow(F, t + dt, 18.2, 20.1, 0.55, 1, 'bronze');
    for (const dt of [-0.5, 0, 0.5]) factoryWindow(F, 6.45 + dt, 18.4, 20.3, 0.32, 1, 'bronze');
    // turret tops: pierced parapet, stone caps and corner blocks
    for (const [a, c] of [[0, 4.4], [9.3, 12.9]] as const) {
      slab(b, F, (a + c) / 2, 22.55, c - a, 0.14, 0.22, 'stone');
      for (const h of piercedHoles({t0: a, t1: c, yHole0: 22.85, yHole1: 23.3, holes: 4, hole: 0.4})) slab(b, F, (h.t0 + h.t1) / 2, h.y0, h.t1 - h.t0, h.y1 - h.y0, 0.06, 'dark');
      slab(b, F, (a + c) / 2, 23.95, c - a + 0.1, 0.18, 0.22, 'stone');
      for (const t of [a + 0.27, c - 0.27]) slab(b, F, t, 23.3, 0.4, 0.95, 0.24, 'stone');
    }
    // centre gable: stone coping from the shoulders to the apex and a finial block
    {
      const s0 = 4.4, s1 = 9.3, ys = 22.5, apex = 23.35, run = (s1 - s0) / 2, len = Math.hypot(run, apex - ys), ang = Math.atan2(apex - ys, run);
      put(b, F, new T.BoxGeometry(len, 0.2, 0.24).rotateZ(ang).translate(0, 0, 0.12), s0 + run / 2, (ys + apex) / 2, 0, 'stone');
      put(b, F, new T.BoxGeometry(len, 0.2, 0.24).rotateZ(-ang).translate(0, 0, 0.12), s1 - run / 2, (ys + apex) / 2, 0, 'stone');
      slab(b, F, 6.85, apex - 0.1, 0.4, 0.55, 0.26, 'stone');
    }
  }

  // ==== Tolstraat side (west, wall 44 frame, t from the north end) ====
  const W = edge(44);
  {
    const rows: [number, number][] = [[1.5, 4.4], [6.1, 8.7], [10.4, 13.0], [14.7, 17.2]];
    const ts = [1.45, 3.1, 4.75, 6.45, 7.9, 10.0, 11.45, 13.6, 15.0, 17.2, 18.6, 21.0, 22.7];
    for (const t of ts) for (const [y0, y1] of rows) factoryWindow(W, t, y0, y1, 1.0, 1, 'bronze');
    for (const dt of [-0.6, 0, 0.6]) factoryWindow(W, 3.1 + dt, 19.2, 20.8, 0.38, 1, 'bronze');
    slab(b, W, 12.25, 0, 24.38, 0.55, 0.1, 'red');
    for (const y of [5.2, 9.5, 13.8]) for (const t of [5.6, 9.0, 12.5, 16.1, 19.9]) lozengeAt(W, t, y, 0.09, true);
  }
  // ==== Forecourt side of the west wing (wall 53 frame, t from the Tolstraat corner): inferred ====
  {
    const E = edge(53);
    for (const t of [1.6, 6.4, 9.6]) for (const [y0, y1] of [[1.5, 4.4], [6.1, 8.7], [10.4, 13.0], [14.7, 17.2]] as [number, number][]) factoryWindow(E, t, y0, y1, 1.4, 2, 'bronze');
    slab(b, E, 5.9, 0, 11.68, 0.55, 0.1, 'red');
  }
  // ==== East tower, east face (wall 38 frame, t from the south corner) ====
  {
    const E = edge(38);
    factoryWindow(E, 1.0, 11.1, 12.7, 0.6, 1);
    for (const t of [2.1, 2.85, 3.6]) factoryWindow(E, t, 11.1, 12.7, 0.6, 1);
    for (const y of [6.0, 2.1]) for (const t of [2.1, 2.85, 3.6]) factoryWindow(E, t, y, y + 1.0, 0.45, 1);
    for (const t of [1.4, 2.2, 3.0, 3.8]) slab(b, E, t, 1.2, 0.35, 0.4, 0.12, 'glass');
    for (const t of [1.2, 2.85]) archedWindow(E, t, 17.3, 19.9, 1.15, 'white');
  }
  // ==== East tower, north walls (walls 40, 48): inferred, narrow lights per floor and the attic arches carried round ====
  for (const [i, ts] of [[40, [1.4, 2.6, 3.8, 5.0]], [48, [1.2, 2.4, 3.6]]] as const) {
    const f = edge(i);
    for (const y of [0.6, 5.0, 9.3, 13.4]) for (const t of ts) factoryWindow(f, t, y, y + 2.4, 0.6, 1);
    for (const t of ts.length === 4 ? [1.6, 3.3, 5.0] : [1.4, 3.2]) archedWindow(f, t, 17.3, 19.9, 1.15, 'white');
  }
  // ==== Courtyard (north) side and the wing's north face: inferred, the factory rhythm carried round ====
  {
    const N = edge(96); // t from the tower end going west
    for (let t = 5.0; t < 59.5; t += 4.45) for (const [y0, y1] of [[0.45, 3.25], [5.0, 7.5], [9.26, 11.66], [13.5, 15.85]] as [number, number][]) factoryWindow(N, t, y0, y1, 3.5, 4);
    slab(b, N, 30.2, 17.3, 60.4, 0.16, 0.2, 'stone');
    const NW = edge(27);
    for (const t of [2.0, 4.5, 8.3, 11.0]) for (const [y0, y1] of [[1.5, 4.4], [6.1, 8.7], [10.4, 13.0], [14.7, 17.2]] as [number, number][]) factoryWindow(NW, t, y0, y1, 1.4, 2, 'bronze');
  }
  setSink(sink0);
}
