import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, disc, getSink, poly, put, ringFrame, ringSlab, segBand, setSink, slab, type Frame} from './nearbar-kit';
import {balustrade} from '../../src/canalRecall/landmarks/balustrade';
import source from './huis-fuld-footprints.json';

/**
 * HUIS FULD, KEIZERSGRACHT 452 (BAG pand 0363100012174769; rijksmonument 2609), the corner of the Keizersgracht and the
 * Molenpad. Register (RCE): "Dubbel hoekpand, gebouwd in 1685, geheel verbouwd in 1860/61 door Cornelis Outshoorn, met van
 * rijke stucversieringen voorziene gepleisterde gevels onder bewerkte lijst, en zandstenen pui met balcon": a double corner
 * house of 1685, rebuilt 1860-61 by Cornelis Outshoorn, its rendered fronts rich in stucco ornament under a worked cornice,
 * with a sandstone ground storey and a balcony.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts): the main block to the 16.0 m wall tops along
 * both street fronts (hipped roof to 19-21 m), the low yard wing and gate-house along the Molenpad to the west.
 *
 * Keizersgracht front (facade ring edge 7, 17.6 m, w02-77) read from the rectified Gemeente Amsterdam panorama
 * TMX7316010203-001666_pano_0000_002780 (2020, frontal, sunlit; w02-77.alt.jpg) with the oblique 2018 crop
 * TMX7316010203-000707_pano_0000_000330 (shaded, depth of the portico, balcony and cornice). The 2020 crop spans the front
 * from its Molenpad corner (x 5 px) to the brick neighbour (x 828 px): t = (x - 5) * 0.02139; heights are fitted to the
 * 3DBAG wall top (16.0 m) at the cornice's crown: h = (905 - y) * 0.0199 with the pavement at y 905. The front is
 * symmetric about the door (axes at +-3.75 and +-6.7 m):
 *  - grey stone basement to 1.55 m with barred cellar lights, a white water table, then the channelled ground storey (the
 *    register's sandstone pui) with four tall windows in eared architraves under flat hoods;
 *  - the entrance: an arched door with a fanlight in an arched surround, two columns carrying the balcony on its consoles,
 *    narrow side lights, and the double stoop with cast-iron railings and roundels;
 *  - the first storey over a moulded band: balustered aprons, tall windows with relief friezes under projecting hoods;
 *  - the balcony door in an aedicule with a segmental pediment, two oval medallions and the sculpted crest over it;
 *  - square attic windows, the relief frieze, and the worked cornice on modillions;
 *  - rusticated quoins at both corners.
 * Molenpad side (ring edge 6, 18.6 m, w01-152): only the east end is in view (2024, 2025; the rest hidden behind
 * Keizersgracht 454 from every panorama): the same storeys, cornice and quoins with blind windows. Six blind axes on the
 * front's rhythm (inferred beyond the two in view). Yard wall on the Molenpad (ring edge 4, w03-167; 2025, 2021): white
 * gate piers with dark caps, iron gates, and the wrought-iron arch carrying a lantern.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const FRONT = ringFrame(src.facadeRing, 7), SIDE = ringFrame(src.facadeRing, 6), YARD = ringFrame(src.facadeRing, 4);
const F = FRONT.f, L = FRONT.len, MID = L / 2;
type Col = 'white' | 'ochre' | 'concrete' | 'stone' | 'greyBrick' | 'glass' | 'frame' | 'dark' | 'bronze' | 'slate';

// Storey lines (m above the 3DBAG ground), from the 2020 crop
const BASE = 1.55, WATER: [number, number] = [1.55, 1.95];
const G = {sill: 2.33, head: 5.45, hood: [5.45, 5.8] as [number, number]};
const BAND = {frieze: [5.8, 6.27] as [number, number], cornice: [6.27, 6.67] as [number, number]};
const F1 = {apron: [6.67, 7.36] as [number, number], head: 9.95, frieze: [10.05, 10.55] as [number, number], hood: [10.55, 10.95] as [number, number]};
const F2 = {sill: 11.34, head: 12.44};
const TOP = {arch: [12.75, 13.0] as [number, number], frieze: [13.0, 14.0] as [number, number], bed: [14.0, 14.35] as [number, number], corona: [15.1, 15.6] as [number, number], crown: 16.0};
const AXES = [MID - 6.7, MID - 3.75, MID + 3.75, MID + 6.7];
const WIN_W = 1.6, ARCH_W = 0.17, QUOIN = 0.75;
const COLS = [MID - 1.3, MID + 1.3];
const LANDING = 1.7;

export function buildHuisFuld(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {wall: 'ochre', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.04);
  // Keizersgracht front
  basement(F, AXES, true);
  groundStorey(b);
  firstStorey(F, AXES, false);
  attic(F, AXES, false);
  centreBay(b);
  entablature(F, 0, L);
  quoins(F, 0, L);
  stoop(b);
  // Molenpad side: blind axes on the front's rhythm
  const sAxes = [-7.25, -4.35, -1.45, 1.45, 4.35, 7.25].map(v => SIDE.len / 2 + v);
  basement(SIDE.f, sAxes, false);
  groundBlind(SIDE.f, SIDE.len, sAxes);
  firstStorey(SIDE.f, sAxes, true);
  attic(SIDE.f, sAxes, true);
  entablature(SIDE.f, 0, SIDE.len);
  quoins(SIDE.f, 0, SIDE.len);
  // the main block's west face over the yard (w06-257, 2018/2025): two plain axes and the cornice carried round
  const BACK = ringFrame(src.facadeRing, 5);
  for (const t of [BACK.len / 2 - 1.55, BACK.len / 2 + 1.55]) {
    plainWindow(BACK.f, t, G.sill + 0.3, G.head - 0.3, 1.2);
    plainWindow(BACK.f, t, F1.apron[1], F1.head, 1.2);
    plainWindow(BACK.f, t, F2.sill, F2.head, 1.1);
  }
  slab(b, BACK.f, BACK.len / 2, TOP.bed[0], BACK.len, TOP.bed[1] - TOP.bed[0], 0.25, 'ochre');
  slab(b, BACK.f, BACK.len / 2, TOP.corona[0], BACK.len + 1.0, TOP.crown - TOP.corona[0], 0.8, 'ochre');
  for (let k = 0; k < 11; k++) slab(b, BACK.f, 0.3 + k * (BACK.len - 0.6) / 10, TOP.bed[1], 0.14, TOP.corona[0] - TOP.bed[1], 0.6, 'concrete');
  // yard wall on the Molenpad
  yardGate(b);
  setSink(sink0);

  function basement(f: Frame, axes: number[], front: boolean) {
    slab(b, f, (front ? L : SIDE.len) / 2, 0, front ? L : SIDE.len, BASE, 0.08, 'stone');
    if (front) for (const [t0, t1] of [[-0.02, MID - 1.05], [MID + 1.05, L + 0.02]]) slab(b, f, (t0 + t1) / 2, WATER[0], t1 - t0, WATER[1] - WATER[0], 0.16, 'ochre');
    else slab(b, f, SIDE.len / 2, WATER[0], SIDE.len + 0.04, WATER[1] - WATER[0], 0.16, 'ochre');
    // barred cellar lights under the axes (2018: four bays of bars in a stone frame)
    for (const t of axes) {
      if (front && Math.abs(t - MID) < 5) continue; // the inner axes' cellar lights sit behind the stoop flights
      cellar(f, t, 1.3);
    }
    if (front) cellar(f, MID, 0.7);
  }
  function cellar(f: Frame, t: number, w: number) {
    slab(b, f, t, 0.3, w, 0.95, 0.04, 'glass', 0.08);
    for (let k = 0; k <= Math.round(w / 0.16); k++) slab(b, f, t - w / 2 + k * w / Math.round(w / 0.16), 0.3, 0.03, 0.95, 0.03, 'bronze', 0.12);
    slab(b, f, t, 0.25, w + 0.16, 0.05, 0.12, 'stone', 0.08);
  }

  /** Window in an eared architrave: glass recessed behind the surround, white sashes, sill and optional consoles. */
  function window(f: Frame, t: number, y0: number, y1: number, w: number, o: {ears?: boolean; transom?: number; consoles?: boolean; blind?: boolean}) {
    const a = ARCH_W, d = 0.24, trim: Col = o.blind ? 'ochre' : 'white';
    // architrave: four sides, so the glass sits 0.14 m back
    slab(b, f, t - w / 2 - a / 2, y0, a, y1 - y0 + a, d, trim);
    slab(b, f, t + w / 2 + a / 2, y0, a, y1 - y0 + a, d, trim);
    slab(b, f, t, y1, w, a, d, trim);
    if (o.ears) for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 + a + 0.05), y1 - 0.12, 0.12, 0.29, d, 'ochre');
    // sill
    slab(b, f, t, y0 - 0.12, w + 2 * a + 0.2, 0.12, 0.22, trim);
    if (o.consoles) for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 + 0.05), y0 - 0.38, 0.16, 0.26, 0.18, 'concrete');
    if (o.blind) { slab(b, f, t, y0, w, y1 - y0, 0.09, 'concrete'); return; }
    slab(b, f, t, y0, w, y1 - y0, 0.02, 'glass', 0.07);
    // sashes: a white frame, the middle mullion and the transom (2020: two-light casements with a transom)
    slab(b, f, t, y0, 0.07, y1 - y0, 0.05, 'frame', 0.09);
    for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 - 0.04), y0, 0.08, y1 - y0, 0.05, 'frame', 0.09);
    slab(b, f, t, y1 - 0.06, w, 0.06, 0.05, 'frame', 0.09);
    if (o.transom) slab(b, f, t, o.transom, w, 0.07, 0.05, 'frame', 0.09);
  }
  function plainWindow(f: Frame, t: number, y0: number, y1: number, w: number) {
    for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 + 0.06), y0, 0.12, y1 - y0, 0.2, 'white');
    slab(b, f, t, y1, w + 0.24, 0.12, 0.2, 'white');
    slab(b, f, t, y0 - 0.1, w + 0.3, 0.1, 0.24, 'stone');
    slab(b, f, t, y0, w, y1 - y0, 0.02, 'glass', 0.07);
    slab(b, f, t, y0, 0.07, y1 - y0, 0.05, 'frame', 0.09);
    slab(b, f, t, (y0 + y1) / 2 + 0.2, w, 0.06, 0.05, 'frame', 0.09);
  }
  function hood(f: Frame, t: number, y: number, w: number, h: number, out: number) {
    slab(b, f, t, y, w, h * 0.45, out * 0.6, 'ochre');
    slab(b, f, t, y + h * 0.45, w + 0.16, h * 0.55, out, 'ochre');
  }

  function groundStorey(bb: BuildingTools) {
    void bb;
    // channelled rustication (2018: nine courses with deep horizontal joints), broken by the openings
    const gaps: [number, number][] = [
      ...AXES.map(t => [t - WIN_W / 2 - ARCH_W - 0.05, t + WIN_W / 2 + ARCH_W + 0.05] as [number, number]),
      [MID - 1.7, MID + 1.7],
      [0, QUOIN], [L - QUOIN, L],
    ];
    channelled(F, WATER[1], BAND.frieze[0], gaps);
    for (const t of AXES) {
      window(F, t, G.sill, G.head, WIN_W, {ears: true, transom: 4.55, consoles: true});
      hood(F, t, G.hood[0], WIN_W + 2 * ARCH_W + 0.2, G.hood[1] - G.hood[0], 0.24);
    }
    // band between the storeys: relief frieze and the moulded cornice
    reliefRun(F, 0, L, BAND.frieze[0], BAND.frieze[1] - BAND.frieze[0], 0.7);
    slab(b, F, L / 2, BAND.cornice[0], L, 0.18, 0.22, 'ochre');
    slab(b, F, L / 2, BAND.cornice[0] + 0.18, L + 0.06, BAND.cornice[1] - BAND.cornice[0] - 0.18, 0.34, 'ochre');
  }
  function groundBlind(f: Frame, len: number, axes: number[]) {
    const gaps = [...axes.map(t => [t - WIN_W / 2 - ARCH_W - 0.05, t + WIN_W / 2 + ARCH_W + 0.05] as [number, number]), [0, QUOIN] as [number, number], [len - QUOIN, len] as [number, number]];
    channelled(f, WATER[1], BAND.frieze[0], gaps, len);
    for (const t of axes) {
      window(f, t, G.sill, G.head, WIN_W, {ears: true, consoles: true, blind: true});
      hood(f, t, G.hood[0], WIN_W + 2 * ARCH_W + 0.2, G.hood[1] - G.hood[0], 0.24);
    }
    reliefRun(f, 0, len, BAND.frieze[0], BAND.frieze[1] - BAND.frieze[0], 1.4);
    slab(b, f, len / 2, BAND.cornice[0], len, 0.18, 0.22, 'ochre');
    slab(b, f, len / 2, BAND.cornice[0] + 0.18, len + 0.06, BAND.cornice[1] - BAND.cornice[0] - 0.18, 0.34, 'ochre');
  }
  function channelled(f: Frame, y0: number, y1: number, gaps: [number, number][], len = L) {
    const n = Math.round((y1 - y0) / 0.43), ch = (y1 - y0) / n;
    const sorted = [...gaps].sort((p, q) => p[0] - q[0]);
    for (let c = 0; c < n; c++) {
      let p0 = 0;
      for (const [g0, g1] of [...sorted, [len, len] as [number, number]]) {
        if (g0 > p0 + 0.1) slab(b, f, (p0 + g0) / 2, y0 + c * ch + 0.025, g0 - p0, ch - 0.05, 0.05, 'ochre');
        p0 = Math.max(p0, g1);
      }
    }
  }
  /** A stucco relief run: low garland lozenges and rosettes at `pitch` on a band (simplified from the 2018 crop). */
  function reliefRun(f: Frame, t0: number, t1: number, y: number, h: number, pitch: number) {
    slab(b, f, (t0 + t1) / 2, y, t1 - t0, h, 0.04, 'ochre');
    const n = Math.max(1, Math.floor((t1 - t0 - 2 * QUOIN) / pitch));
    for (let k = 0; k < n; k++) {
      const t = t0 + QUOIN + (k + 0.5) * (t1 - t0 - 2 * QUOIN) / n;
      poly(b, f, t, y + h * 0.2, [[-pitch * 0.32, h * 0.3], [0, 0], [pitch * 0.32, h * 0.3], [0, h * 0.6]], 0.04, 'concrete', 0.04);
    }
  }

  function firstStorey(f: Frame, axes: number[], blind: boolean) {
    const len = f === F ? L : SIDE.len;
    // moulded apron band, balustered under each window (2020: five balusters per apron)
    slab(b, f, len / 2, F1.apron[0], len, 0.12, 0.12, 'ochre');
    for (const t of axes) {
      if (!blind) {
        const lay = balustrade({width: WIN_W + 0.2, height: F1.apron[1] - F1.apron[0] - 0.24, post: 0.16, plinth: 0.08, rail: 0.1, baluster: 0.13, pitch: 0.27});
        const y = F1.apron[0] + 0.12;
        slab(b, f, t, y, WIN_W + 0.2, F1.apron[1] - F1.apron[0] - 0.24, 0.05, 'concrete');
        for (const p of lay.posts) slab(b, f, t + p.x, y + p.y, p.w, p.h, 0.14, 'ochre');
        for (const k of lay.balusters) slab(b, f, t + k.x, y + k.y, k.w, k.h, 0.1, 'ochre');
        slab(b, f, t, y + lay.rail.y, WIN_W + 0.24, lay.rail.h, 0.16, 'ochre');
      }
      window(f, t, F1.apron[1], F1.head, blind ? WIN_W : WIN_W - 0.2, {ears: true, transom: 9.05, blind});
      // relief frieze between consoles, and the projecting hood (2020: cornice on two scrolled consoles)
      const w = WIN_W + 2 * ARCH_W + 0.3;
      slab(b, f, t, F1.frieze[0], w - 0.4, F1.frieze[1] - F1.frieze[0], 0.06, 'concrete');
      poly(b, f, t, F1.frieze[0] + 0.08, [[-0.45, 0.17], [0, 0], [0.45, 0.17], [0, 0.34]], 0.05, 'ochre', 0.06);
      for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 - 0.12), F1.frieze[0] - 0.15, 0.2, F1.frieze[1] - F1.frieze[0] + 0.15, 0.22, 'ochre');
      hood(f, t, F1.hood[0], w + 0.1, F1.hood[1] - F1.hood[0], 0.34);
    }
  }
  function attic(f: Frame, axes: number[], blind: boolean) {
    for (const t of axes) window(f, t, F2.sill, F2.head, 1.3, {ears: true, blind});
  }
  function entablature(f: Frame, t0: number, t1: number) {
    const w = t1 - t0, c = (t0 + t1) / 2;
    slab(b, f, c, TOP.arch[0], w, TOP.arch[1] - TOP.arch[0], 0.1, 'ochre');
    // the relief frieze (2020: garlands and cartouches the whole width)
    slab(b, f, c, TOP.frieze[0], w, TOP.frieze[1] - TOP.frieze[0], 0.05, 'ochre');
    const n = Math.round((w - 1) / 1.1);
    for (let k = 0; k < n; k++) {
      const t = t0 + 0.5 + (k + 0.5) * (w - 1) / n;
      poly(b, f, t, TOP.frieze[0] + 0.25, [[-0.5, 0.35], [-0.25, 0.05], [0, 0], [0.25, 0.05], [0.5, 0.35], [0.25, 0.25], [0, 0.22], [-0.25, 0.25]], 0.06, 'concrete', 0.05);
      disc(b, f, t + 0.55, TOP.frieze[0] + 0.6, 0.12, 0.07, 'concrete', 0.05);
    }
    // the worked cornice: bed moulding, modillions under the corona, corona and crown
    slab(b, f, c, TOP.bed[0], w + 0.1, TOP.bed[1] - TOP.bed[0], 0.28, 'ochre');
    slab(b, f, c, TOP.bed[1], w + 0.2, 0.18, 0.42, 'ochre');
    const m = Math.round(w / 0.55);
    for (let k = 0; k < m; k++) slab(b, f, t0 + (k + 0.5) * w / m, TOP.bed[1] + 0.18, 0.16, TOP.corona[0] - TOP.bed[1] - 0.18, 0.95, 'concrete');
    slab(b, f, c, TOP.corona[0], w + 1.9, TOP.corona[1] - TOP.corona[0], 1.05, 'ochre');
    slab(b, f, c, TOP.corona[1], w + 2.1, TOP.crown - TOP.corona[1], 1.15, 'ochre');
  }
  function quoins(f: Frame, t0: number, t1: number) {
    // rusticated quoins (2020: alternating long and short blocks with V joints) from the water table to the attic architrave
    const n = Math.round((TOP.arch[0] - WATER[1]) / 0.42), ch = (TOP.arch[0] - WATER[1]) / n;
    for (let c = 0; c < n; c++) {
      const w = c % 2 ? QUOIN - 0.22 : QUOIN;
      const y = WATER[1] + c * ch;
      slab(b, f, t0 + w / 2, y + 0.03, w, ch - 0.06, 0.09, 'ochre');
      slab(b, f, t1 - w / 2, y + 0.03, w, ch - 0.06, 0.09, 'ochre');
    }
  }

  function centreBay(bb: BuildingTools) {
    // door: arched surround, dark panelled leaves, fanlight with radiating bars (2020; 2018)
    archBand(bb, F, MID, LANDING, 2.0, 5.57 - LANDING, 0.24, 0.16, 'white');
    // the door stands 0.16 m back in its surround (leaves front at 0.1, panels 0.14, surround 0.16 + the arch's reveal)
    slab(bb, F, MID, LANDING, 1.52, 2.75, 0.1, 'dark');
    archSlab(bb, F, MID, LANDING + 2.75, 1.52, 0.76, 0.1, 'glass');
    slab(bb, F, MID, LANDING + 2.72, 1.52, 0.06, 0.05, 'frame', 0.1);
    for (const dx of [-0.36, 0, 0.36]) slab(bb, F, MID + dx, LANDING + 2.78, 0.04, 0.62 - Math.abs(dx) * 0.5, 0.04, 'frame', 0.1);
    for (const dx of [-0.36, 0.36]) for (const y of [LANDING + 0.3, LANDING + 1.55]) slab(bb, F, MID + dx, y, 0.5, 1.0, 0.04, 'dark', 0.1);
    slab(bb, F, MID, LANDING, 0.05, 2.72, 0.05, 'frame', 0.1);
    // narrow side lights beside the columns
    for (const s of [-1, 1]) window(F, MID + s * 1.75, 3.6, 5.2, 0.42, {});
    // columns (smooth shafts on pedestals, moulded capitals) and their pilasters on the wall
    for (const t of COLS) {
      slab(bb, F, t, LANDING, 0.5, 0.45, 0.85, 'ochre', 0.1);
      const shaft = new T.CylinderGeometry(0.19, 0.22, 5.65 - LANDING - 0.45, 12).translate(0, (5.65 - LANDING - 0.45) / 2, 0);
      put(bb, F, shaft, t, LANDING + 0.45, 0.52, 'ochre');
      slab(bb, F, t, 5.65, 0.55, 0.12, 0.85, 'ochre', 0.1);
      slab(bb, F, t, 5.77, 0.62, 0.28, 0.92, 'concrete', 0.08);
      slab(bb, F, t, LANDING, 0.45, 6.05 - LANDING, 0.12, 'ochre');
    }
    // entablature over the columns and the two scrolled consoles carrying the balcony (2018)
    slab(bb, F, MID, 6.05, 3.4, 0.4, 0.95, 'ochre');
    for (const t of COLS) poly(bb, F, t, 6.45, [[-0.22, 0], [0.22, 0], [0.22, 0.51], [-0.22, 0.51]], 1.2, 'concrete');
    // balcony slab and its balustrade (2020: eight balusters a side of the middle post, returns at the ends)
    slab(bb, F, MID, 6.96, 4.2, 0.4, 1.4, 'ochre');
    const lay = balustrade({width: 4.0, height: 0.9, post: 0.22, plinth: 0.12, rail: 0.12, baluster: 0.14, pitch: 0.26, bays: 2});
    const y = 7.36, out = 1.15;
    for (const p of lay.posts) slab(bb, F, MID + p.x, y + p.y, p.w, p.h, 0.22, 'ochre', out);
    for (const k of lay.balusters) slab(bb, F, MID + k.x, y + k.y, k.w, k.h, 0.14, 'ochre', out + 0.04);
    slab(bb, F, MID, y, 4.0, lay.plinth.h, 0.22, 'ochre', out);
    slab(bb, F, MID, y + lay.rail.y, 4.06, lay.rail.h, 0.26, 'ochre', out - 0.02);
    for (const s of [-1, 1]) {
      slab(bb, F, MID + s * 1.9, y, 0.2, 0.9, out, 'ochre');
      for (let k = 1; k < 4; k++) slab(bb, F, MID + s * 1.9, y + 0.12, 0.12, 0.66, 0.1, 'ochre', k * out / 4 - 0.05);
    }
    // balcony door in an aedicule: glazed doors, flanking pilasters, entablature and the segmental pediment
    slab(bb, F, MID, y, 1.2, 9.95 - y, 0.02, 'glass', 0.07);
    slab(bb, F, MID, y, 0.07, 9.95 - y, 0.05, 'frame', 0.09);
    slab(bb, F, MID, 9.05, 1.2, 0.07, 0.05, 'frame', 0.09);
    for (const s of [-1, 1]) {
      slab(bb, F, MID + s * 0.68, y, 0.16, 9.95 - y, 0.14, 'ochre');
      slab(bb, F, MID + s * 0.95, y, 0.32, 10.05 - y, 0.24, 'ochre');
      slab(bb, F, MID + s * 0.95, 9.7, 0.4, 0.35, 0.3, 'concrete');
    }
    slab(bb, F, MID, 9.95, 1.5, 0.12, 0.14, 'ochre');
    slab(bb, F, MID, 10.05, 2.4, 0.3, 0.32, 'ochre');
    // segmental pediment over an arched niche with a cartouche (2020: y 300-400)
    archSlab(bb, F, MID, 10.35, 1.5, 1.45, 0.03, 'concrete', 0.02);
    segBand(bb, F, MID, 10.35, 2.5, 0.85, 0.24, 0.3, 'ochre');
    slab(bb, F, MID, 10.35, 2.5, 0.12, 0.3, 'ochre');
    poly(bb, F, MID, 10.55, [[-0.38, 0], [0.38, 0], [0.45, 0.35], [0.3, 0.7], [0, 0.82], [-0.3, 0.7], [-0.45, 0.35]], 0.12, 'ochre', 0.05);
    // two oval medallions either side of the pediment
    for (const s of [-1, 1]) {
      const g = new T.CylinderGeometry(0.3, 0.3, 0.1, 16).rotateX(Math.PI / 2).scale(1, 1.35, 1).translate(0, 0, 0.05);
      put(bb, F, g, MID + s * 1.7, 11.75, 0.04, 'concrete');
      ringSlab(bb, F, MID + s * 1.7, 11.75, 0.3, 0.4, 0.08, 'ochre', 0.02, 16);
    }
    // the sculpted crest over the pediment, into the frieze (2020: a cartouche between two reclining figures, simplified)
    poly(bb, F, MID, 11.75, [[-0.55, 0], [0.55, 0], [0.62, 0.6], [0.45, 1.3], [0.2, 1.75], [0, 1.95], [-0.2, 1.75], [-0.45, 1.3], [-0.62, 0.6]], 0.3, 'ochre', 0.06);
    poly(bb, F, MID, 12.0, [[-0.3, 0.1], [0.3, 0.1], [0.32, 0.8], [0, 1.1], [-0.32, 0.8]], 0.12, 'concrete', 0.36);
    for (const s of [-1, 1]) {
      poly(bb, F, MID + s * 0.95, 11.7, [[-0.5, 0], [0.5, 0], [0.35 * s, 0.5], [-0.2 * s, 0.75], [-0.45 * s, 0.4]].map(([x, yy]) => [x, yy] as [number, number]), 0.25, 'concrete', 0.06);
      disc(bb, F, MID + s * 1.1, 12.6, 0.16, 0.25, 'concrete', 0.06);
    }
  }

  function stoop(bb: BuildingTools) {
    // landing in front of the door and two flights down either side along the front (2020: nine steps; 2018)
    const D = 1.55, RISE = LANDING / 9, RUN = 0.34;
    slab(bb, F, MID, 0, 3.6, LANDING - 0.08, D, 'stone');
    slab(bb, F, MID, LANDING - 0.08, 3.7, 0.08, D + 0.06, 'greyBrick');
    for (const s of [-1, 1]) {
      for (let k = 0; k < 8; k++) {
        const top = LANDING - (k + 1) * RISE, t0 = MID + s * (1.8 + k * RUN);
        slab(bb, F, t0 + s * RUN / 2, 0, RUN, top, D - 0.1, 'greyBrick', 0.05);
      }
      // cheek wall under the flight
      poly(bb, F, MID + s * 1.8, 0, (s > 0 ? [[0, 0], [8 * RUN, 0], [0, LANDING]] : [[0, 0], [0, LANDING], [-8 * RUN, 0]]) as [number, number][], 0.2, 'stone', D - 0.05);
      railing(bb, s, D);
    }
    // front railing of the landing
    for (let k = 0; k <= 6; k++) slab(bb, F, MID - 1.7 + k * 3.4 / 6, LANDING, 0.04, 0.95, 0.04, 'bronze', D - 0.06);
    slab(bb, F, MID, LANDING + 0.92, 3.5, 0.06, 0.08, 'bronze', D - 0.08);
    for (const dx of [-1.1, 0, 1.1]) ringSlab(bb, F, MID + dx, LANDING + 0.5, 0.15, 0.22, 0.04, 'bronze', D - 0.06, 14);
  }
  function railing(bb: BuildingTools, s: number, D: number) {
    const RUN = 0.34, t0 = MID + s * 1.8, t1 = MID + s * (1.8 + 8 * RUN);
    const out = D - 0.06;
    // sloped handrail (parallelogram in the wall plane) from the landing down to a newel at the foot
    const pts: [number, number][] = [[0, LANDING + 0.95], [t1 - t0, 0.95], [t1 - t0, 0.89], [0, LANDING + 0.89]];
    poly(bb, F, t0, 0, s > 0 ? pts : pts.map(([x, y]) => [x, y] as [number, number]).reverse(), 0.06, 'bronze', out);
    poly(bb, F, t0, 0, (s > 0 ? [[0, LANDING + 0.15], [t1 - t0, 0.15], [t1 - t0, 0.1], [0, LANDING + 0.1]] : [[0, LANDING + 0.1], [t1 - t0, 0.1], [t1 - t0, 0.15], [0, LANDING + 0.15]]) as [number, number][], 0.04, 'bronze', out);
    for (let k = 0; k <= 8; k++) {
      const t = t0 + (t1 - t0) * k / 8, foot = LANDING * (1 - k / 8);
      slab(bb, F, t, foot, 0.035, 0.95, 0.035, 'bronze', out);
      if (k % 2 === 1) ringSlab(bb, F, t, foot + 0.5, 0.12, 0.18, 0.03, 'bronze', out, 12);
    }
    slab(bb, F, t1, 0, 0.12, 1.15, 0.12, 'bronze', out - 0.03);
    disc(bb, F, t1, 1.15, 0.09, 0.12, 'bronze', out - 0.03);
  }

  function yardGate(bb: BuildingTools) {
    const f = YARD.f, len = YARD.len;
    // gate piers (2025: white rendered with dark caps) and iron gates; the wrought-iron arch with the lantern on the west gate
    const piers = [0.35, 6.3, len - 0.35];
    for (const t of piers) {
      slab(bb, f, t, 0, 0.7, 3.2, 0.3, 'ochre');
      slab(bb, f, t, 3.2, 0.86, 0.2, 0.46, 'slate');
    }
    for (const [a, z] of [[0.7, 5.95], [6.65, len - 0.7]]) {
      slab(bb, f, (a + z) / 2, 0.05, z - a, 2.45, 0.02, 'dark', 0.03);
      const n = Math.round((z - a) / 0.14);
      for (let k = 1; k < n; k++) slab(bb, f, a + (z - a) * k / n, 0.05, 0.03, 2.65, 0.05, 'bronze', 0.05);
      for (const y of [0.15, 2.0, 2.62]) slab(bb, f, (a + z) / 2, y, z - a - 0.02, 0.06, 0.06, 'bronze', 0.05);
    }
    const c = 3.3;
    slab(bb, f, c, 2.8, 5.3, 0.3, 0.12, 'ochre', 0.1);
    for (const s of [-1, 1]) {
      // the scroll arch (2025: two C-scrolls rising from the gate head to the lantern foot, curled ends outward)
      ringSlab(bb, f, c + s * 0.55, 3.55, 0.3, 0.38, 0.04, 'bronze', 0.16, 14);
      ringSlab(bb, f, c + s * 1.3, 3.35, 0.2, 0.26, 0.04, 'bronze', 0.16, 12);
      ringSlab(bb, f, c + s * 1.9, 3.25, 0.12, 0.17, 0.04, 'bronze', 0.16, 10);
    }
    slab(bb, f, c, 3.1, 0.07, 1.05, 0.06, 'bronze', 0.15);
    // lantern: tapered frosted-glass box with a dark cap and finial (drawn in the pale relief colour so the window audit does not count it as a west-face opening)
    const lan = new T.CylinderGeometry(0.4, 0.22, 0.85, 6).translate(0, 0.425, 0);
    put(bb, f, lan, c, 4.15, 0.45, 'concrete');
    put(bb, f, new T.ConeGeometry(0.45, 0.3, 6).translate(0, 0.15, 0), c, 5.0, 0.45, 'bronze');
    slab(bb, f, c, 3.95, 0.2, 0.2, 0.5, 'bronze', 0.25);
    // iron railing on the yard wall to the east of the gate (2018: w04, w05)
    for (let k = 0; k <= 24; k++) slab(bb, f, 6.7 + (len - 7.4) * k / 24, 3.4, 0.03, 1.1, 0.03, 'bronze', 0.1);
  }
}
