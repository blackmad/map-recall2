import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {archBand, archSlab, facePanel, getSink, leanSlab, ledgeStrip, poly, put, segBand, setSink, slab, type Frame} from './nearbar-kit';
import {glyphRuns} from './mixed-case-glyphs';
import source from './de-nieuwe-liefde-footprints.json';

/**
 * DE NIEUWE LIEFDE, Da Costakade 102 (BAG pand 0363100012236796, bouwjaar 1904, rijksmonument 524834): built as a wine
 * warehouse with tasting rooms to a design by L.J. Neumeyer, one of the first reinforced-concrete (Monier) buildings in
 * the Netherlands; the parish house and cinema De Liefde from 1932, a cultural centre now (nl.wikipedia De Nieuwe Liefde).
 * Massing is the 3DBAG LoD2.2 shell (de-nieuwe-liefde-footprints.json, native east/south metres); the Da Costakade front
 * (BAG vertices 10 .. 0, 19.45 m, two 4 m bays projecting 0.15 m and two 1.8 m piers projecting 0.13 m) is laid out from
 * the Gemeente Amsterdam panoramas (CC BY 4.0), de-nieuwe-liefde-inventory.json:
 *  - across the canal (b_20241129_0829_Track28_Sphere_00061/00064, Nov 2024, bare trees): white render, two identical
 *    pointed gables on the bays with domed finials, a slate mansard between and beside them, two-light cross windows
 *    under hoods on the second floor, a big segmental-headed window per bay on the first floor, grey ground-floor arches.
 *  - the quay (recording_2025-07-31_10-53-44_00617..00622, TMX7316010203-000052_pano_0002_000112 2016): the blue-grey
 *    plinth, the round-arched entrance on the north pier and its twin on the south pier in thick grey horseshoe
 *    surrounds, the segmental ground windows, the dark "De Nieuwe Liefde" letters over the south bay.
 *  - the north and south sides are party walls; the rear hall has no usable capture (shell only).
 */
export function buildDeNieuweLiefde(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const sink0 = getSink();
  setSink(0.25, true);
  // ---- front frame: origin at BAG vertex 10 (south end), t north along the quay, n out over the water ----
  const src = source as unknown as {surfaces: {type: string; rings: number[][][]}[]; nativeRing: number[][]};
  const ring = src.nativeRing;
  const a = ring[10], c = ring[0], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const tg: [number, number] = [(c[0] - a[0]) / L, (c[1] - a[1]) / L];
  const F: Frame = {origin: [a[0], a[1]], tangent: tg, n: [-tg[1], tg[0]]};
  // The 3DBAG front walls carry a lopsided gable (its first peak at t 6.9 over a bay centred at 5.5; the panorama shows
  // two identical gables centred on the bays). Clip every front wall at the mansard foot and draw the gables below.
  const off = (p: number[]) => (p[0] - a[0]) * F.n[0] + (p[2] - a[1]) * F.n[1];
  const EAVES = 13.85;
  const clipY = (r: number[][], ymax: number) => {
    const out: number[][] = [];
    for (let i = 0; i < r.length; i++) {
      const p = r[i], q = r[(i + 1) % r.length], pin = p[1] <= ymax, qin = q[1] <= ymax;
      if (pin) out.push(p);
      if (pin !== qin) { const k = (ymax - p[1]) / (q[1] - p[1]); out.push([p[0] + (q[0] - p[0]) * k, ymax, p[2] + (q[2] - p[2]) * k]); }
    }
    return out;
  };
  const surfaces = src.surfaces.map(sf => sf.type === 'WallSurface' && sf.rings[0].every(p => Math.abs(off(p)) < 0.3) && Math.max(...sf.rings[0].map(p => p[1])) > EAVES
    ? {...sf, rings: [clipY(sf.rings[0], EAVES)]} : sf);
  // ... and the 3DBAG mansard strip (the small roof and cheek pieces 1.5 m deep above the eaves, which follow the same
  // lopsided gable): replaced by one mansard plane and a pitched roof behind each gable, drawn below.
  const inStrip = (sf: {type: string; rings: number[][][]}) => sf.type !== 'GroundSurface' && sf.rings[0].every(p => off(p) > -1.6 && p[1] > 13.3);
  addShell(b, {surfaces, nativeRing: ring} as never, {wall: 'concrete', roof: 'slate', skip: sf => inStrip(sf)});
  b.mark?.('shell');
  /** Native point at t along the front, `o` out of the base plane, height y. */
  const P = (t: number, o: number, y: number) => [a[0] + tg[0] * t + F.n[0] * o, y, a[1] + tg[1] * t + F.n[1] * o];
  const tris = (pts: number[][], idx: number[], colour: string, role?: string) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pts.flat(), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    if (role) g.userData.role = role;
    b.add(g, colour as never);
  };
  const MANSARD_TOP = 17.1, MANSARD_BACK = -1.5;
  // mansard plane: from the cornice line to the 3DBAG flat top 1.5 m back, the full width of the front
  tris([P(0, 0, EAVES), P(19.45, 0, EAVES), P(19.45, MANSARD_BACK, MANSARD_TOP), P(0, MANSARD_BACK, MANSARD_TOP)], [0, 2, 1, 0, 3, 2], 'slate', 'roof');
  /** Face offset of the front at t: piers 0.13 m, bays 0.15 m proud of the base plane. */
  const outAt = (t: number) => ((t > 0.67 && t < 2.43) || (t > 8.22 && t < 9.99) ? 0.13 : (t > 3.48 && t < 7.48) || (t > 12.78 && t < 16.78) ? 0.15 : 0);
  const BAYS = [5.48, 14.78], SOUTH_PIER = 1.55, NORTH_PIER = 9.1;

  /** Segmental-headed outline of width w, springing `ys` above its base, rise `rise` (12 arc steps). */
  const segOutline = (w: number, ys: number, rise: number): [number, number][] => {
    const R = (w * w / 4 + rise * rise) / (2 * rise), pts: [number, number][] = [[-w / 2, 0], [w / 2, 0]];
    for (let i = 0; i <= 12; i++) { const x = w / 2 - w * i / 12; pts.push([x, ys + rise - R + Math.sqrt(R * R - x * x)]); }
    return pts;
  };
  const segTop = (w: number, ys: number, rise: number, x: number) => {
    const R = (w * w / 4 + rise * rise) / (2 * rise);
    return ys + rise - R + Math.sqrt(Math.max(0, R * R - x * x));
  };

  // ---- plinth (blue-grey render to 1.6 m), split at the arches that come down through it ----
  const plinthCuts = [[NORTH_PIER - 1.1, NORTH_PIER + 1.1]];
  const segs = [[0, 0.67], [0.67, 2.43], [2.43, 3.48], [3.48, 7.48], [7.48, 8.22], [8.22, 9.99], [9.99, 12.78], [12.78, 16.78], [16.78, 19.45]];
  for (const [s0, s1] of segs) {
    let parts = [[s0, s1]];
    for (const [k0, k1] of plinthCuts) parts = parts.flatMap(([p0, p1]) => (k1 <= p0 || k0 >= p1 ? [[p0, p1]] : [[p0, k0], [k1, p1]].filter(([q0, q1]) => q1 - q0 > 0.05)));
    for (const [p0, p1] of parts) {
      const i0 = p0 === 0 ? 0.06 : 0, i1 = p1 === 19.45 ? 0.06 : 0;
      leanSlab(b, F, (p0 + i0 + p1 - i1) / 2, 0, p1 - p0 - i0 - i1, 1.6, 0.05, 'stone', outAt((p0 + p1) / 2));
    }
  }

  // ---- ground floor ----
  // segmental windows on the bays: multi-pane glazing in a thick grey surround whose legs reach the plinth
  for (const t of BAYS) {
    const o = outAt(t) + 0.05, w = 3.5, ys = 0.95, rise = 0.55;
    poly(b, F, t, 1.6, segOutline(w, ys, rise), 0.02, 'glass', o);
    // bars stop under the surround's inner edge (segBand: outer arc of chord w + 0.7, rise + 0.12, 0.35 thick)
    const bandIn = (x: number) => segTop(w + 0.7, ys, rise + 0.12, x) - 0.35;
    for (let k = 1; k < 8; k++) {
      const x = -w / 2 + w * k / 8;
      slab(b, F, t + x, 1.6, 0.06, Math.min(segTop(w, ys, rise, x), bandIn(x)) - 0.02, 0.03, 'frame', o + 0.02);
    }
    slab(b, F, t, 2.35, w, 0.06, 0.03, 'frame', o + 0.02);
    segBand(b, F, t, 1.6 + ys, w + 0.7, rise + 0.12, 0.35, 0.14, 'stone', outAt(t));
    for (const s of [-1, 1]) slab(b, F, t + s * (w / 2 + 0.17), 1.6, 0.35, ys + 0.05, 0.1, 'stone', outAt(t));
  }
  // round arches on the piers: the entrance (north) and its glazed twin (south), grey horseshoe surrounds
  for (const [t, door] of [[SOUTH_PIER, false], [NORTH_PIER, true]] as const) {
    const o = outAt(t), w = door ? 1.5 : 1.25, top = door ? 3.55 : 3.35;
    archSlab(b, F, t, door ? 0 : 1.6, w, top - (door ? 0 : 1.6), 0.02, 'dark', o + 0.03, 10);
    if (door) {
      facePanel(b, F, t, 0.05, 1.2, 2.45, 'glass', o + 0.1);
      slab(b, F, t, 2.5, 1.3, 0.08, 0.03, 'frame', o + 0.11);
    } else {
      archSlab(b, F, t, 1.6, w - 0.16, top - 1.68, 0.02, 'glass', o + 0.07, 10);
      slab(b, F, t, 1.6, 0.06, top - 1.6 - w / 2, 0.03, 'frame', o + 0.12);
    }
    archBand(b, F, t, door ? 0 : 1.6, w + 0.7, top + 0.35 - (door ? 0 : 1.6), 0.35, 0.12, 'stone', o, 10);
  }
  // the name over the south bay, between the ground arch and the first-floor sill
  {
    const text = 'De Nieuwe Liefde', px = 0.04, pxY = 0.05, t0 = BAYS[0], y0 = 3.62, o = outAt(t0);
    const {runs, width} = glyphRuns(text, px);
    for (const r of runs) ledgeStrip(b, F, t0 - width / 2 + (r.t0 + r.t1) / 2, y0 + r.y0 / px * pxY, r.t1 - r.t0, (r.y1 - r.y0) / px * pxY, 0.035, 'dark', o);
  }

  // ---- first floor ----
  // the big segmental window per bay: narrow light | two-light centre | narrow light, cream posts, raised arch moulding
  for (const t of BAYS) {
    const o = outAt(t), w = 3.8, y0 = 4.85, ys = 2.75, rise = 0.55;
    poly(b, F, t, y0, segOutline(w, ys, rise), 0.03, 'glass', o);
    for (const x of [-1.0, 1.0]) slab(b, F, t + x, y0, 0.2, segTop(w, ys, rise, x) - 0.02, 0.06, 'white', o + 0.03);
    slab(b, F, t, y0, 0.07, segTop(w, ys, rise, 0) - 0.02, 0.04, 'frame', o + 0.04);
    for (const [x0, x1] of [[-1.9, -1.1], [-0.9, 0.9], [1.1, 1.9]]) slab(b, F, t + (x0 + x1) / 2, y0 + 2.2, x1 - x0, 0.07, 0.04, 'frame', o + 0.04);
    ledgeStrip(b, F, t, y0 - 0.14, w + 0.4, 0.14, 0.18, 'white', o);
    segBand(b, F, t, y0 + ys + 0.05, w + 0.7, rise + 0.2, 0.22, 0.08, 'white', o);
    for (const s of [-1, 1]) {
      slab(b, F, t + s * (w / 2 + 0.24), y0 + 1.7, 0.22, ys - 1.65, 0.08, 'white', o);
      slab(b, F, t + s * (w / 2 + 0.24), y0 + 1.5, 0.36, 0.2, 0.08, 'white', o);
    }
  }
  // the round-headed window on the south pier under its own moulding
  {
    const t = SOUTH_PIER, o = outAt(t), y0 = 4.85, w = 1.0, h = 3.0;
    archSlab(b, F, t, y0, w, h, 0.03, 'glass', o + 0.03, 10);
    slab(b, F, t, y0 + 2.0, w, 0.06, 0.04, 'frame', o + 0.05);
    slab(b, F, t, y0, 0.06, 2.0, 0.04, 'frame', o + 0.05);
    archBand(b, F, t, y0 + 0.6, w + 0.5, h - 0.35, 0.2, 0.08, 'white', o, 10);
    ledgeStrip(b, F, t, y0 - 0.14, w + 0.3, 0.14, 0.16, 'white', o);
  }

  // ---- second floor: cross windows under hoods on brackets ----
  const crossWindow = (t: number, w: number, y0: number, h: number, o: number, hood = true) => {
    leanSlab(b, F, t, y0 - 0.05, w + 0.12, h + 0.1, 0.04, 'white', o);
    facePanel(b, F, t, y0, w - 0.06, h - 0.06, 'glass', o + 0.09);
    facePanel(b, F, t, y0, 0.07, h - 0.06, 'frame', o + 0.13);
    facePanel(b, F, t, y0 + h * 0.66, w - 0.06, 0.07, 'frame', o + 0.13);
    ledgeStrip(b, F, t, y0 - 0.15, w + 0.25, 0.12, 0.16, 'white', o);
    if (hood) {
      slab(b, F, t, y0 + h + 0.12, w + 0.4, 0.14, 0.45, 'bronze', o);
      for (const s of [-1, 1]) leanSlab(b, F, t + s * (w / 2 + 0.08), y0 + h - 0.32, 0.1, 0.44, 0.38, 'bronze', o);
    }
  };
  for (const t of BAYS) for (const s of [-1, 1]) crossWindow(t + s * 1.0, 1.45, 9.95, 1.95, outAt(t));
  crossWindow(SOUTH_PIER, 1.15, 9.95, 1.95, outAt(SOUTH_PIER), false);

  // ---- eaves cornice on the stretches between the gables ----
  for (const [s0, s1] of [[0.06, 2.9], [8.06, 12.2], [17.36, 19.39]]) {
    const tm = (s0 + s1) / 2;
    ledgeStrip(b, F, tm, 13.05, s1 - s0, 0.3, 0.32, 'white', outAt(tm));
    ledgeStrip(b, F, tm, 12.85, s1 - s0, 0.2, 0.14, 'white', outAt(tm));
  }

  // ---- the twin gables: shoulder block and pointed top, coping, windows, iron shoulder brackets, domed finial ----
  for (const t of BAYS) {
    const o = outAt(t), d = 0.14, og = o + d, half = 2.4, yb = 12.85, ysh = 14.35, peak = 17.55;
    poly(b, F, t, yb, [[-half, 0], [half, 0], [half, ysh - yb], [half - 0.25, ysh - yb], [0, peak - yb], [-(half - 0.25), ysh - yb], [-half, ysh - yb]], d, 'concrete', o);
    // coping along both slopes and the shoulder tops
    for (const s of [-1, 1]) {
      const x0 = s * (half - 0.25), y0 = ysh - yb, x1 = 0, y1 = peak - yb, len = Math.hypot(x1 - x0, y1 - y0);
      const ux = (x1 - x0) / len, uy = (y1 - y0) / len, k = 0.16;
      const [px, py] = s < 0 ? [uy, -ux] : [-uy, ux]; // into the gable: the coping is a band on its face, under the roof
      const j = 0.04; // starts 4 cm inside the rake so its top never lies in the gable's own sloping top face
      poly(b, F, t, yb, [[x0 + px * j, y0 + py * j], [x1 + px * j, y1 + py * j], [x1 + px * (k + j), y1 + py * (k + j)], [x0 + px * (k + j), y0 + py * (k + j)]], 0.07, 'white', og - 0.02);
      slab(b, F, t + s * (half - 0.12), ysh, 0.36, 0.12, d + 0.06, 'white', o);
      // wrought-iron shoulder bracket
      slab(b, F, t + s * (half - 0.45), ysh - 0.75, 0.05, 0.9, 0.06, 'dark', og);
      slab(b, F, t + s * (half - 0.65), ysh - 0.05, 0.45, 0.05, 0.06, 'dark', og);
    }
    // two-light window and the small top light
    // shallow sink here: the mansard plane runs 0.3-0.6 m behind the gable face at these heights
    setSink(0.06, true);
    crossWindow(t, 1.1, 14.0, 1.85, og, false);
    leanSlab(b, F, t, 16.05, 0.55, 0.6, 0.04, 'white', og);
    facePanel(b, F, t, 16.1, 0.43, 0.5, 'glass', og + 0.09);
    setSink(0.25, true);
    // domed finial on a pedestal at the peak
    slab(b, F, t, peak - 0.25, 0.6, 0.55, 0.55, 'concrete', o - 0.1);
    put(b, F, new T.SphereGeometry(0.28, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), t, peak + 0.3, o + 0.18, 'bronze');
    put(b, F, new T.ConeGeometry(0.05, 0.6, 6).translate(0, 0.3, 0), t, peak + 0.55, o + 0.18, 'bronze');
    // pitched roof behind the gable, from its slopes back through the mansard, closed where it rises above the flat top
    const k = (peak - ysh) / (half - 0.25), dx = (peak - MANSARD_TOP) / k;
    for (const s of [-1, 1]) {
      const e = t + s * (half - 0.25);
      tris([P(e, o, ysh), P(t, o, peak), P(t, MANSARD_BACK, peak), P(e, MANSARD_BACK, ysh)], s < 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3], 'slate', 'roof');
    }
    tris([P(t - dx, MANSARD_BACK, MANSARD_TOP), P(t + dx, MANSARD_BACK, MANSARD_TOP), P(t, MANSARD_BACK, peak)], [0, 2, 1], 'slate');
  }
  setSink(sink0);
}
