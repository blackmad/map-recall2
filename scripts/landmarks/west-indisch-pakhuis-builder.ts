import type {BuildingTools} from './cultural-builders';
import {addShell, planarPolygon} from './worship-shell';
import {wallsOf} from './worship-walls';
import {archBand, archSlab, disc, poly, ringSlab, setSink, slab} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import source from './west-indisch-pakhuis-footprints.json';

/**
 * West-Indisch Pakhuis (West India Company warehouses, 's-Gravenhekje 1A, BAG 0363100012170633, 1641-42, rijksmonument 1222).
 * Massing is the 3DBAG LoD2.2 shell in native east/south metres. Four storeys of red brick with cream natural-stone
 * bands. Detail follows the municipal panoramas of 2024/2025 and the RCE and Wikimedia photographs listed in the
 * research record:
 *  - NW front (27 m): twelve window axes on three upper storeys in the pattern shuttered-door, window, window,
 *    mirrored about the centre; the shuttered axes are the old hoist doors (tall, with blue shutters and a railing);
 *    ground tier of barred windows over low hatches, a pair of big loading doors at the right, and a blue-grey painted
 *    plinth with an arched door at the left; cream string courses and a bracketed cornice; two trapezium gables
 *    (oeil-de-boeuf, volute ears, date plaque) with the triangular WIC pediment standing in front between them;
 *  - NE side (21.6 m): eight axes, painted plinth with arched door, one narrow shouldered gable with a hoist beam,
 *    and a small cartouche pediment on the eaves;
 *  - SW and SE courtyard faces: charcoal painted brick; the window rhythm is inferred (no wide photograph).
 * Lettering (ANNO / 1642 / 1641 date stones, the monogram) is left as blank plaques.
 */
type Pt = [number, number];
export function buildWestIndischPakhuis(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const walls = wallsOf(source as never);
  const swFaces = new Set(walls.filter(w => w.n[0] * -0.65 + w.n[1] * 0.76 > 0.92 && w.length > 1.5).map(w => w.index));
  const surfaces = (source as never as {surfaces: {type: string; rings: number[][][]}[]}).surfaces;
  addShell(b, source as never, {wall: 'brick', roof: 'slate', skip: (_s, i) => swFaces.has(i)});
  for (const i of swFaces) {
    const g = planarPolygon(surfaces[i].rings);
    if (g) b.add(g, 'greyBrick' as never);
  }
  b.mark?.('shell');
  setSink(0.16);

  /** Frame along ring edge a -> c: x runs a -> c (viewer's right facing the wall from outside), z out. */
  const edge = (a: Pt, c: Pt, off = 0): Frame => {
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]), t: Pt = [(c[0] - a[0]) / len, (c[1] - a[1]) / len];
    const n: Pt = [-t[1], t[0]];
    return {origin: [a[0] + n[0] * off, a[1] + n[1] * off], tangent: t, n};
  };
  const NW = edge([-1.869, -15.452], [-24.43, -0.39], 0.2), NWlen = 27.12;
  const NE = edge([15.876, -3.171], [-1.869, -15.452], 0.28), NElen = 21.6;
  const SWa = edge([-24.43, -0.39], [-11.243, 10.83], -0.26), SWalen = 17.3;
  const SWb = edge([-6.871, 16.909], [2.355, 24.714], -0.28), SWblen = 12.1;
  const SE = edge([2.355, 24.714], [10.33, 15.627]), SElen = 12.1;

  const rows: [number, number][] = [[4.85, 1.65], [7.6, 1.75], [10.6, 1.35]];   // small windows: sill, height
  const tall: [number, number][] = [[4.0, 2.0], [6.9, 2.0], [9.8, 2.0]];          // shuttered hoist-door axes

  /** Cream-framed sash window: surround, dark glass, white bars. */
  const win = (f: Frame, t: number, y: number, w: number, h: number, o: {cols?: number; rows?: number; shutters?: boolean; rail?: boolean} = {}) => {
    slab(b, f, t, y - 0.13, w + 0.34, h + 0.3, 0.07, 'stone');
    slab(b, f, t, y, w, h, 0.12, 'glass');
    const cols = o.cols ?? 2, rws = o.rows ?? 3;
    for (let k = 1; k < cols; k++) slab(b, f, t - w / 2 + w * k / cols, y, 0.05, h, 0.16, 'white');
    for (let r = 1; r < rws; r++) slab(b, f, t, y + h * r / rws, w, 0.045, 0.16, 'white');
    slab(b, f, t, y - 0.19, w + 0.5, 0.11, 0.2, 'stone');
    if (o.shutters) for (const s of [-1, 1]) {
      slab(b, f, t + s * (w / 2 + 0.58), y - 0.05, 0.9, h + 0.1, 0.07, 'blue', 0.12);
      for (let k = 1; k <= 5; k++) slab(b, f, t + s * (w / 2 + 0.58), y - 0.05 + (h + 0.1) * k / 6, 0.9, 0.025, 0.09, 'white', 0.13);
    }
    if (o.rail) {
      slab(b, f, t, y + 0.1, w, 0.04, 0.16, 'dark'); slab(b, f, t, y + 0.78, w, 0.05, 0.18, 'dark');
      for (let k = 0; k <= 8; k++) slab(b, f, t - w / 2 + w * k / 8, y + 0.1, 0.025, 0.7, 0.16, 'dark');
    }
  };
  /** Ground-tier barred window over a low hatch. */
  const barred = (f: Frame, t: number, w: number, hatch = true) => {
    slab(b, f, t, 1.4, w + 0.34, 2.35, 0.07, 'stone');
    slab(b, f, t, 1.55, w, 2.05, 0.12, 'glass');
    const n = Math.max(2, Math.round(w / 0.32));
    for (let k = 0; k <= n; k++) slab(b, f, t - w / 2 + w * k / n, 1.55, 0.035, 2.05, 0.2, 'dark');
    slab(b, f, t, 2.55, w, 0.04, 0.2, 'dark');
    if (hatch) { slab(b, f, t, 0.2, w + 0.3, 1.2, 0.07, 'stone'); slab(b, f, t, 0.3, w, 1.0, 0.11, 'dark'); }
  };
  const band = (f: Frame, t0: number, t1: number, y: number, h = 0.17, d = 0.1) => slab(b, f, (t0 + t1) / 2, y, t1 - t0, h, d, 'stone');
  const cornice = (f: Frame, t0: number, t1: number) => {
    band(f, t0, t1, 12.55, 0.3, 0.3);
    band(f, t0, t1, 12.85, 0.28, 0.5);
    band(f, t0, t1, 13.13, 0.18, 0.4);
  };
  const ellipse = (rx: number, ry: number): Pt[] => Array.from({length: 14}, (_, k) => [rx * Math.cos(k * 2 * Math.PI / 14), ry * Math.sin(k * 2 * Math.PI / 14)] as Pt);

  /** Trapezium gable plate with shouldered sides, coping, volute ears, oeil-de-boeuf and date plaque. */
  const gable = (f: Frame, c: number, base: number, wb: number, wt: number, h: number, o: {oeil?: boolean; plaque?: boolean} = {oeil: true, plaque: true}) => {
    const hb = wb / 2, ht = wt / 2;
    const left: Pt[] = [[-hb, 0], [-hb + 0.25, 0.4], [-ht, h]];
    const outline: Pt[] = [...left, ...left.map(p => [-p[0], p[1]] as Pt).reverse()];
    poly(b, f, c, base, outline, 0.45, 'brick');
    for (const s of [-1, 1]) {
      const edgeL: Pt[] = left.map(p => [s * -p[0], p[1]] as Pt);
      const outer = edgeL.map((p, i) => [p[0] + s * 0.24 * (i === 0 ? 0.6 : 1), p[1] + 0.02] as Pt);
      poly(b, f, c, base, [...outer, ...edgeL.slice().reverse()].map(p => [p[0], p[1]] as Pt), 0.58, 'stone');
      disc(b, f, c + s * (hb + 0.1), base + 0.25, 0.38, 0.55, 'stone', -0.05);
      disc(b, f, c + s * (hb + 0.1), base + 0.25, 0.17, 0.6, 'stone', 0.05);
    }
    slab(b, f, c, base + h - 0.05, wt + 0.7, 0.3, 0.62, 'stone');
    if (o.oeil) {
      ringSlab(b, f, c, base + h * 0.43, 0.36, 0.62, 0.55, 'stone', -0.05);
      disc(b, f, c, base + h * 0.43, 0.36, 0.5, 'dark', -0.05);
    }
    if (o.plaque) slab(b, f, c, base + h * 0.7, 1.5, 0.42, 0.55, 'stone');
    return {hb, ht};
  };

  // ============ NW front ============
  {
    const f = NW;
    const axes: [number, boolean][] = [[0.7, false], [3.4, true], [5.5, false], [7.2, false], [9.6, true], [11.9, false], [13.7, false], [16.1, true], [18.5, false], [20.4, false], [22.9, true], [25.6, false]];
    for (const [t, big] of axes) {
      (big ? tall : rows).forEach(([y, h], k) => win(f, t, y, big ? 1.5 : 0.95, h, big ? {cols: 2, rows: 3, shutters: true, rail: true} : {cols: 2, rows: 3}));
    }
    // string courses at each sill, ground cap band and the cornice
    for (const y of [4.6, 7.35, 10.35]) band(f, 0.2, NWlen - 0.2, y - 0.12);
    band(f, 0.2, NWlen - 0.2, 3.78, 0.2, 0.12);
    cornice(f, 0.1, NWlen - 0.1);
    for (const t of [3.0, 10.2, 16.0, 23.2]) slab(b, f, t, 13.2, 0.8, 0.65, 0.6, 'stone');

    // left ground tier: blue-grey painted plinth, arched door, windows
    slab(b, f, 3.85, 0.0, 7.7, 3.78, 0.1, 'concrete');
    archSlab(b, f, 2.9, 0.15, 1.4, 2.7, 0.14, 'dark');
    archBand(b, f, 2.9, 0.15, 1.7, 2.95, 0.2, 0.2, 'stone');
    slab(b, f, 2.9, 0.15, 2.0, 0.2, 0.3, 'stone');
    win(f, 1.5, 1.6, 0.55, 0.9, {cols: 1, rows: 2});
    win(f, 5.0, 1.55, 1.3, 1.6, {cols: 2, rows: 3});
    win(f, 6.9, 1.5, 1.45, 1.95, {cols: 2, rows: 4});
    // right ground tier: barred windows over hatches and the big loading doors
    for (const [t, w] of [[9.6, 1.5], [11.7, 1.3], [14.4, 0.95], [16.2, 1.9], [18.5, 1.0], [20.2, 1.6], [24.6, 2.0]] as Pt[]) barred(f, t, w);
    slab(b, f, 22.4, 0.1, 3.0, 3.35, 0.07, 'stone');
    slab(b, f, 22.4, 0.15, 2.7, 3.2, 0.12, 'dark');
    slab(b, f, 22.4, 0.15, 0.05, 3.2, 0.2, 'frame');
    slab(b, f, 22.4, 2.55, 2.7, 0.05, 0.2, 'frame');

    // gables A and B, pediment standing in front between them
    gable(f, 6.1, 13.6, 9.7, 7.3, 5.4);
    gable(f, 20.2, 13.6, 9.7, 7.3, 5.4);
    // pediment
    const pc = 13.1;
    poly(b, f, pc, 13.55, [[-5.4, 0], [5.4, 0], [0, 3.5]], 0.4, 'brick', 0.2);
    poly(b, f, pc, 13.4, [[-5.65, 0], [5.65, 0], [5.65, 0.34], [-5.65, 0.34]], 0.55, 'stone', 0.2);
    for (const s of [-1, 1]) {
      const rake: Pt[] = [[s * 5.65, 0.2], [s * 5.4, 0.2], [0, 3.55], [s * 0.0, 3.85]];
      poly(b, f, pc, 13.4, s < 0 ? rake.slice().reverse() : rake, 0.55, 'stone', 0.2);
      poly(b, f, pc + s * 1.55, 14.2, ellipse(0.4, 0.55), 0.3, 'stone', 0.55);
    }
    poly(b, f, pc, 14.1, ellipse(0.75, 1.0), 0.3, 'stone', 0.55);
    poly(b, f, pc, 14.45, ellipse(0.42, 0.55), 0.1, 'dark', 0.85);
    slab(b, f, pc, 13.6, 0.5, 0.35, 0.3, 'stone', 0.55);
  }

  // ============ NE side (towards Prins Hendrikkade): t runs from the east end towards the north corner ============
  {
    const f = NE;
    const axes: [number, boolean][] = [[2.3, true], [4.9, false], [7.5, false], [10.1, false], [12.7, false], [15.3, false], [17.9, false], [20.3, false]];
    for (const [t, big] of axes) {
      if (big) tall.slice(0, 2).forEach(([y, h]) => win(f, t, y, 1.2, h, {cols: 2, rows: 3, shutters: true}));
      else rows.forEach(([y, h]) => win(f, t, y, 0.95, h, {cols: 2, rows: 3}));
    }
    win(f, 2.3, 10.0, 1.0, 1.7, {cols: 2, rows: 3});
    for (const y of [4.6, 7.35, 10.35]) band(f, 0.3, NElen - 0.2, y - 0.12);
    band(f, 0.3, NElen - 0.2, 3.78, 0.2, 0.12);
    cornice(f, 0.1, NElen - 0.1);
    slab(b, f, NElen / 2, 0.0, NElen, 3.78, 0.1, 'concrete');
    archSlab(b, f, 16.6, 0.15, 1.3, 2.6, 0.14, 'dark');
    archBand(b, f, 16.6, 0.15, 1.6, 2.85, 0.2, 0.2, 'stone');
    for (const [t, w] of [[2.3, 1.2], [5.2, 1.1], [8.0, 1.1], [10.8, 1.1], [13.5, 1.1], [19.7, 1.1]] as Pt[]) win(f, t, 1.6, w, 1.5, {cols: 2, rows: 3});
    // one narrow shouldered gable at the east end with a hoist beam
    gable(f, 2.3, 13.6, 4.6, 2.5, 5.4, {oeil: false, plaque: true});
    slab(b, f, 2.3, 16.5, 0.26, 0.3, 1.0, 'dark', 0.25);
    slab(b, f, 2.3, 16.3, 0.55, 0.1, 0.4, 'stone', 0.2);
    disc(b, f, 2.3, 16.65, 0.22, 0.2, 'dark', 1.25);
    // cartouche pediment on the eaves
    poly(b, f, 9.6, 13.05, [[-1.2, 0], [1.2, 0], [0, 1.15]], 0.5, 'stone', 0.0);
    poly(b, f, 9.6, 13.35, ellipse(0.22, 0.28), 0.6, 'dark', 0);
  }

  // ============ SW / SE courtyard faces (charcoal brick; rhythm inferred) ============
  const courtyard = (f: Frame, len: number, n: number, pitch: number) => {
    const t0 = (len - pitch * (n - 1)) / 2;
    for (let k = 0; k < n; k++) {
      const t = t0 + pitch * k;
      win(f, t, 3.4, 1.8, 2.2, {cols: 3, rows: 4});
      win(f, t, 6.8, 1.5, 2.0, {cols: 2, rows: 3});
      win(f, t, 10.0, 1.2, 1.7, {cols: 2, rows: 3});
      slab(b, f, t, 0.5, 1.2, 0.9, 0.08, 'stone');
      slab(b, f, t, 0.6, 0.9, 0.6, 0.12, 'dark');
    }
    for (const y of [3.1, 6.55, 9.75]) band(f, 0.3, len - 0.3, y - 0.12);
    band(f, 0.1, len - 0.1, 12.7, 0.3, 0.35);
  };
  courtyard(SWa, SWalen, 5, 3.4);
  courtyard(SWb, SWblen, 3, 3.6);
  courtyard(SE, SElen, 3, 3.6);
}
