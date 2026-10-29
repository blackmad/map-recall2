import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {raisedLettering} from './ornament-kit';
import {
  TriSink, at, band, box, coping, cresting, disc, drum, frame, frustum, grown, hipRoofX, opening, openingOutline, panel, prismX, prismZ,
  plaque, quoins, rect, reveal, rib, slab, spire, strip, type Opening, type OpeningOptions, type P2, type WallFrame,
} from '../../src/canalRecall/buildingRecipe/ornateFrontKit';

type Colour = Parameters<BuildingTools['add']>[1];

/**
 * Amsterdam Centraal, the Cuypersgebouw (P.J.H. Cuypers and A.L. van Gendt, 1881-1889) and its east wing, BAG pand
 * 0363100012185598. Replaces the 2026-09 parametric `station()` box (244 x 29 m centred on the OSM station outline, so
 * its front stood 11.5 m out on the Stationsplein and its entrance 31 m west of the real one).
 *
 * Frame: the model's own (x along the front towards bearing 120.65, z out towards the Stationsplein, bearing 210.65; origin
 * the catalogue anchor). Plan from the BAG outline (PDOK WFS, CC0) and the OSM building:parts in the building tiles;
 * heights and every opening, band and ornament measured from Gemeente Amsterdam panoramas (CC BY 4.0) with a pinhole
 * camera at the panorama position (artifacts/centraal-lane/, inventory scripts/landmarks/centraal-station-inventory.json):
 *   TMX7316010203-002532_pano_0000_001491 (2022, 47 m out on the axis): central block, towers, dials, gable, arms, wings
 *   TMX7316010203-001643_pano_0000_000089 (2020): west pavilion; TMX7316010203-001643_pano_0000_000078 (2020): west wing
 *   recording_2025-06-16_06-42-40_02702 (2025): east pavilion with the royal waiting room gable
 *   TMX7316010203-001668_pano_0000_001165 (2020): the east wing (4 storeys, three gables, chimneys)
 *
 * Plan (x): west low wing -126.1..-59.4 (front z -3.0 / -4.9), west pavilion -59.4..-40.2 (z 4.6), west main wing
 * -40.2..8.4 and east main wing 53.8..101.8 (z 3.1; gabled risalits at -24.95, -6.2, 68.6, 87.35), towers 8.4..15.9 and
 * 46.4..53.8 (z 7.9..14.6), central block 15.9..46.4 (front z 14.0), east pavilion 101.8..121.9 (royal waiting room
 * gable 107.6..116.9 projecting to z 14.6), east wing 127.65..246.4 (z 0 .. -15.9). Rear wall of the main block z -15.8
 * (inside the Zuidkap, drawn plain).
 */
export function buildCentraalCuypers(b: BuildingTools) {
  const S = new TriSink();
  const F = (x: number, z: number): WallFrame => frame([x, z], [1, 0]);          // a front: faces +z, t = x - x0
  const R = (x: number, z: number): WallFrame => frame([x, z], [-1, 0]);         // a rear: faces -z, t runs west
  const E = (x: number, z: number): WallFrame => frame([x, z], [0, -1]);         // an east end: faces +x, t runs north
  const W = (x: number, z: number): WallFrame => frame([x, z], [0, 1]);          // a west end: faces -x, t runs south

  type Win = {o: Opening; surround?: number; sill?: number; ring?: string; opt?: OpeningOptions; cutOnly?: boolean};
  /** A wall panel with its openings cut, stone surrounds in the wall plane, reveals, glass and stone bars. */
  function wall(f: WallFrame, c: string, outline: P2[], wins: Win[]) {
    const holes = wins.map(w => openingOutline(w.surround ? grown(w.o, w.surround, w.sill ?? w.surround) : w.o));
    // A hole crossing the outline or another hole triangulates into overlapping faces (z-fighting): refuse it at build time.
    const box2 = (pts: P2[]) => [Math.min(...pts.map(p => p[0])), Math.max(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[1]))];
    const ob = box2(outline);
    holes.forEach((h, i) => {
      const hb = box2(h);
      if (hb[0] < ob[0] - 1e-6 || hb[1] > ob[1] + 1e-6 || hb[2] < ob[2] - 1e-6 || hb[3] > ob[3] + 1e-6) throw new Error(`centraal: opening ${i} at t ${wins[i].o.t.toFixed(2)} y ${wins[i].o.y} leaves its wall (${ob.map(v => v.toFixed(2))}) at ${at(f, wins[i].o.t, wins[i].o.y).map(v => v.toFixed(1))}`);
      for (let j = 0; j < i; j++) { const jb = box2(holes[j]); if (hb[0] < jb[1] - 1e-6 && jb[0] < hb[1] - 1e-6 && hb[2] < jb[3] - 1e-6 && jb[2] < hb[3] - 1e-6) throw new Error(`centraal: openings ${j} and ${i} overlap at ${at(f, wins[i].o.t, wins[i].o.y).map(v => v.toFixed(1))}`); }
    });
    panel(S, c, f, outline, holes);
    for (const w of wins) {
      if (w.surround) panel(S, w.ring ?? 'stone', f, openingOutline(grown(w.o, w.surround, w.sill ?? w.surround)), [openingOutline(w.o)]);
      if (!w.cutOnly) opening(S, f, w.o, w.opt);
    }
  }
  const evenly = (t0: number, t1: number, n: number) => Array.from({length: n}, (_, i) => t0 + (t1 - t0) * (i + 0.5) / n);
  const cross2: OpeningOptions = {mullions: 1, transoms: [0.68], panes: [2, 4], mullionW: 0.13};
  const cross3: OpeningOptions = {mullions: 2, transoms: [0.7], panes: [3, 4], mullionW: 0.13};

  // ---- dormer (wings, towers): brick-red cheeks, a dark light, a pointed slate hood and a finial -------------------------
  function dormer(x: number, z: number, y: number, w = 1.0, h = 1.25, faceZ = 1) {
    const z0 = faceZ > 0 ? z - 1.1 : z, z1 = faceZ > 0 ? z : z + 1.1;
    box(S, 'red', x - w / 2, x + w / 2, y, y + h, z0, z1);
    const fz = faceZ > 0 ? z1 : z0;
    plaque(S, 'dark', faceZ > 0 ? F(x - w / 2, fz) : R(x + w / 2, fz), rect(0.2, w - 0.2, y + 0.18, y + h - 0.12), 0, 0.07);
    frustum(S, 'slate', x - w / 2 - 0.12, x + w / 2 + 0.12, z0 - 0.05, z1 + 0.12, y + h, y + h + 1.1, [w / 2 + 0.12, 0.62]);
    spire(S, 'frame', x, faceZ > 0 ? z1 - 0.1 : z0 + 0.1, y + h + 0.9, y + h + 1.75, 0.05, 0, 4);
  }
  // ---- mansard over a block: front edge z1 (eaves y0), top flat at y1, back edge z0; ends open where they abut -----------
  function mansard(x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, inset: number, c = 'slate') {
    prismX(S, c, [[z1 + 0.25, y0], [z1 - inset, y1], [z0 + inset, y1], [z0 - 0.25, y0]], x0, x1, [true, true]);
  }
  /** Coping on a gable edge a -> b (the wall outline's own edge), running `ext` past both ends, closed at the back. */
  function gableCoping(f: WallFrame, a: P2, b: P2, w: number, d1: number, ext = 0.15) {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l;
    coping(S, 'stone', f, [a[0] - ux * ext, a[1] - uy * ext], [b[0] + ux * ext, b[1] + uy * ext], w, 0, d1, true);
  }
  function roofCrest(x0: number, x1: number, z: number, y: number) { cresting(S, 'frame', F(x0, z), 0, x1 - x0, y, 0.55, 0.42); }

  // =====================================================================================================================
  // MAIN WINGS (x -40.2..8.4 and 53.8..101.8, front z 3.1, rear z -15.8): ground storey with plinth, two storeys of
  // segment-headed cross windows in stone surrounds with ornamented tympana, iron wall anchors, tile frieze, cornice,
  // mansard with dormers and ridge cresting.
  // =====================================================================================================================
  const WING_Z = 3.1, REAR_Z = -15.8, EAVES = 17.5, MANSARD_TOP = 22.4;
  const RISALITS = [-24.95, -6.2, 68.6, 87.35], RIS_W = 6.8, RIS_OUT = 0.45;
  function wingRun(x0: number, x1: number) {
    // window bays: the spans between risalits, about 3.7 m each
    const bays: number[] = [];
    const cuts = RISALITS.filter(c => c > x0 && c < x1).sort((a, b) => a - b);
    let s = x0;
    for (const c of [...cuts, Infinity]) {
      const e = c === Infinity ? x1 : c - RIS_W / 2;
      const n = Math.max(1, Math.round((e - s) / 3.75));
      bays.push(...evenly(s, e, n));
      if (c !== Infinity) s = c + RIS_W / 2;
    }
    const f = F(x0, WING_Z), t = (x: number) => x - x0;
    const g: Win[] = [], up1: Win[] = [], up2: Win[] = [];
    for (const x of bays) {
      g.push({o: {t: t(x), y: 1.1, w: 2.2, h: 3.0, head: 'segment', rise: 0.3}, opt: {mullions: 1, transoms: [0.72], depth: 0.25}});
      up1.push({o: {t: t(x), y: 5.6, w: 1.95, h: 4.6, head: 'segment', rise: 0.16}, surround: 0.2, sill: 0.16, opt: cross2});
      up2.push({o: {t: t(x), y: 11.4, w: 1.95, h: 4.1, head: 'segment', rise: 0.16}, surround: 0.2, sill: 0.16, opt: cross2});
    }
    wall(f, 'sandstone', rect(0, x1 - x0, 0, 1.0), []);
    wall(f, 'brick', rect(0, x1 - x0, 1.0, 5.25), g);
    wall(f, 'brick', rect(0, x1 - x0, 5.25, 10.95), up1);
    wall(f, 'brick', rect(0, x1 - x0, 10.95, 16.05), up2);
    // stone courses: plinth top, sill courses, the impost and head bands that run across the piers (Cuypers' banding)
    slab(S, 'stone', f, 0, x1 - x0, 0.92, 1.08, 0, 0.12, false);
    for (const [y0, y1] of [[5.25, 5.45], [10.95, 11.15]]) slab(S, 'stone', f, 0, x1 - x0, y0, y1, 0, 0.14, false);
    for (const [y0, y1, rows] of [[7.7, 7.84, up1], [9.4, 9.52, up1], [13.2, 13.34, up2], [14.8, 14.92, up2]] as const)
      band(S, 'stone', f, 0, x1 - x0, y0, y1, 0.08, rows.map(w => grown(w.o, 0.2, 0.16)));
    for (const w of [...up1, ...up2]) {
      // ornamented tympanum over each head: an ochre tile field under a stone relieving arch
      const top = w.o.y + w.o.h + 0.2;
      // Faces 6.5 cm apart (wall 0, tiles 0.065, arch 0.13): at 7/10 cm the tiles and the arch sat 3 cm apart, one quantisation step of
      // the 14-bit export (2.6 cm over this 432 m model), and the IJ canopy ribs' new north bound (2026-10-29) shifted the grid so 72
      // tympana fell into the 2-3 cm z-fight band.
      slab(S, 'ochre', f, w.o.t - 1.0, w.o.t + 1.0, top, top + 0.34, 0, 0.065, false);
      coping(S, 'stone', f, [w.o.t - 1.2, top], [w.o.t, top + 0.48], 0.14, 0, 0.13);
      coping(S, 'stone', f, [w.o.t, top + 0.48], [w.o.t + 1.2, top], 0.14, 0, 0.13);
    }
    for (let i = 0; i + 1 < bays.length; i++) {
      // wrought-iron wall anchors between the windows (the dark crosses at both floor levels)
      const tm = t((bays[i] + bays[i + 1]) / 2);
      if (RISALITS.some(c => Math.abs(c - (bays[i] + bays[i + 1]) / 2) < RIS_W / 2 + 0.3)) continue;
      for (const y of [10.4, 15.8]) { rib(S, 'dark', f, [tm, y - 0.42], [tm, y + 0.42], 0.09, 0, 0.07); rib(S, 'dark', f, [tm - 0.26, y], [tm + 0.26, y], 0.09, 0, 0.07); }
    }
    // tile frieze and cornice
    wall(f, 'brick', rect(0, x1 - x0, 16.05, 17.5), []);
    slab(S, 'ochre', f, 0, x1 - x0, 16.3, 16.95, 0, 0.07, false);
    slab(S, 'stone', f, 0, x1 - x0, 17.15, 17.5, 0, 0.32, false);
    mansard(x0, x1, REAR_Z, WING_Z, EAVES, MANSARD_TOP, 2.6);
    roofCrest(x0, x1, WING_Z - 2.75, MANSARD_TOP);
    for (let i = 0; i < bays.length; i += 2) if (!RISALITS.some(c => Math.abs(c - bays[i]) < RIS_W / 2 + 0.6)) dormer(bays[i], WING_Z - 0.35, 18.6);
    // rear wall inside the train shed: plain brick with the window rows as recessed dark lights
    const rf = R(x1, REAR_Z), rw: Win[] = [];
    for (const x of bays) for (const y of [5.8, 11.4]) rw.push({o: {t: x1 - x, y, w: 1.8, h: 3.8, head: 'segment', rise: 0.3}, opt: {depth: 0.18, glass: 'dark', reveal: 'brick'}});
    wall(rf, 'brick', rect(0, x1 - x0, 0, EAVES), rw);
    slab(S, 'stone', rf, 0, x1 - x0, 17.15, 17.5, 0, 0.3, false);
  }
  wingRun(-40.2, 8.4);
  wingRun(53.8, 101.8);

  // ---- gabled risalits: two windows a storey, stone quoins, a dormer gable with oculi, copings and pinnacles ------------
  for (const cx of RISALITS) {
    const x0 = cx - RIS_W / 2, x1 = cx + RIS_W / 2, z = WING_Z + RIS_OUT, f = F(x0, z), h = RIS_W / 2;
    const wins = (y: number, hh: number): Win[] => [-1.55, 1.55].map(dt => ({o: {t: h + dt, y, w: 1.85, h: hh, head: 'segment' as const, rise: 0.16}, surround: 0.2, sill: 0.16, opt: cross2}));
    wall(f, 'sandstone', rect(0, RIS_W, 0, 1.0), []);
    wall(f, 'brick', rect(0, RIS_W, 1.0, 5.25), [{o: {t: h, y: 1.1, w: 2.4, h: 3.0, head: 'segment', rise: 0.3}, opt: {mullions: 1, transoms: [0.72]}}]);
    wall(f, 'brick', rect(0, RIS_W, 5.25, 10.95), wins(5.6, 4.6));
    wall(f, 'brick', rect(0, RIS_W, 10.95, 16.05), wins(11.4, 4.1));
    // gable: shoulders at 19.4, apex 24.4 (measured 24.4 m; finial to 26.6)
    const g: P2[] = [[0, 16.05], [RIS_W, 16.05], [RIS_W, 19.4], [h, 24.4], [0, 19.4]];
    wall(f, 'brick', g, [{o: {t: h, y: 18.0, w: 1.5, h: 2.5, head: 'round'}, surround: 0.18, opt: {mullions: 1, transoms: [0.6], panes: [2, 3], depth: 0.1}}]);
    for (const dt of [-2.2, 2.2]) { drum(S, 'stone', f, h + dt, 19.6, 0.42, 0, 0.1, 10); disc(S, 'ochre', f, h + dt, 19.6, 0.26, 0.17, 8); }
    gableCoping(f, [0, 19.4], [h, 24.4], 0.32, 0.18); gableCoping(f, [h, 24.4], [RIS_W, 19.4], 0.32, 0.18);
    for (const [t0, t1] of [[0, 0.35], [RIS_W - 0.35, RIS_W]] as const) slab(S, 'stone', f, t0, t1, 0, 19.4, 0, 0.12, true);
    quoins(S, 'stone', f, 0.3, 1.0, 16, 0.42, 0.75, 0.42, 0.1, 1);
    quoins(S, 'stone', f, RIS_W - 0.3, 1.0, 16, 0.42, 0.75, 0.42, 0.1, -1);
    for (const [y0, y1] of [[5.25, 5.45], [10.95, 11.15], [16.05, 16.3]]) slab(S, 'stone', f, 0, RIS_W, y0, y1, 0, 0.16, false);
    spire(S, 'stone', x0 + 0.05, z + 0.1, 19.4, 21.4, 0.22, 0, 4);
    spire(S, 'stone', x1 - 0.05, z + 0.1, 19.4, 21.4, 0.22, 0, 4);
    box(S, 'stone', cx - 0.3, cx + 0.3, 24.2, 25.1, z - 0.35, z + 0.2);
    spire(S, 'stone', cx, z - 0.07, 25.1, 26.6, 0.25, 0, 4);
    // gable roof behind the gable face, back into the mansard
    prismZ(S, 'slate', [[x0 + 0.1, 19.4], [x1 - 0.1, 19.4], [cx, 24.3]], z - 4.6, z - 0.2, [true, true]);
    // side returns of the 0.45 m projection
    panel(S, 'brick', W(x0, WING_Z), rect(0, RIS_OUT, 0, 19.4)); panel(S, 'brick', E(x1, z), rect(0, RIS_OUT, 0, 19.4));
  }

  // =====================================================================================================================
  // TOWERS (8.4..15.9 and 46.4..53.8, front z 14.6, back z 7.9): rusticated stone base, the relief storey (three gilt
  // bust tondi, a figure frieze on gold, three roundels), the arched storey (centre cross window, two blind arches with
  // gilt mosaic tympana), the dial storey (west: red clock dial with twelve hour plaques and gilt hands; east: the wind
  // dial, a stone compass rose with a red ring and a gilt pointer), the arcade storey, cornice, slate spire roof with
  // dormers and corner pinnacles, lantern and the tall finial.
  // =====================================================================================================================
  const TOWER_TOP = 27.4;
  function tower(x0: number, x1: number, wind: boolean) {
    const z0 = 7.9, z1 = 14.6, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const faces: [WallFrame, number, boolean][] = [[F(x0, z1), w, true], [W(x0, z0), d, x0 < 31], [E(x1, z1), d, x1 > 31], [R(x1, z0), w, false]];
    for (const [f, len, outer] of faces) {
      const front = f.u[0] === 1;
      if (!front && !outer) {
        // inner side and back: hidden by the hall and the blocks behind the towers up to their eaves (23.55)
        wall(f, 'brick', rect(0, len, 23.55, 24.1), []);
        const [a, bb] = f.u[1] === -1 ? [0, 0.6] : [len - 0.6, len];
        if (f.u[0] === 0) { wall(f, 'sandstone', rect(a, bb, 0, 4.8), []); wall(f, 'brick', rect(a, bb, 4.8, 23.55), []); }
        const arcH: Win[] = evenly(0.5, len - 0.5, 5).map(t => ({o: {t, y: 24.35, w: 0.82, h: 1.9, head: 'round' as const}, opt: {depth: 0.2, glass: 'dark', reveal: 'stone'}}));
        wall(f, 'brick', rect(0, len, 24.1, 26.8), arcH);
        for (const [y0, y1] of [[24.1, 24.3], [26.4, 26.8]]) slab(S, 'stone', f, 0, len, y0, y1, 0, 0.1, false);
        quoins(S, 'stone', f, 0.0, 23.55, 26.4, 0.45, 0.85, 0.45, 0.12, 1);
        quoins(S, 'stone', f, len, 23.55, 26.4, 0.45, 0.85, 0.45, 0.12, -1);
        continue;
      }
      // rusticated stone base: proud courses with recessed joints
      wall(f, 'sandstone', rect(0, len, 0, 4.8), []);
      for (let y = 0.35; y < 4.6; y += 0.62) slab(S, 'sandstone', f, 0.02, len - 0.02, y, y + 0.52, 0, 0.06, true);
      // relief storey (front and the outer side alike, as photographed): three roundels with figures, the figure frieze
      // under a gilt sky, three gilt tondi with busts
      wall(f, 'stone', rect(0, len, 4.8, 11.2), []);
      slab(S, 'stone', f, 0.45, len - 0.45, 4.95, 11.0, 0, 0.1, true);
      const sp = (len - 1.2) / 3;
      for (let k = 0; k < 3; k++) {
        const t = len / 2 + (k - 1) * sp;
        drum(S, 'sandstone', f, t, 5.95, 0.82, 0.1, 0.16, 12);
        figure(f, t, 5.35, 1.0, 0.23, 'stone');
        drum(S, 'gold', f, t, 10.25, 0.62, 0.1, 0.15, 12);
        drum(S, 'stone', f, t, 10.25, 0.32, 0.15, 0.26, 8);
      }
      panel(S, 'gold', f, rect(0.7, len - 0.7, 8.35, 9.45), [], 0.17);
      panel(S, 'sandstone', f, rect(0.7, len - 0.7, 7.05, 8.35), [], 0.17);
      for (const t of [len / 2 - sp / 2, len / 2 + sp / 2]) slab(S, 'stone', f, t - 0.09, t + 0.09, 7.0, 9.5, 0.1, 0.24, true);
      for (let k = 0; k < 6; k++) figure(f, 1.25 + k * (len - 2.5) / 5, 7.15, 2.05, 0.23, 'stone');
      slab(S, 'stone', f, 0.5, len - 0.5, 9.5, 9.62, 0.1, 0.22, false);
      slab(S, 'stone', f, -0.05, len + 0.05, 11.2, 11.6, 0, 0.22, false);
      // arched storey
      // three arches a face; the 6.7 m sides take narrower ones so the stone rings keep a pier between them
      const asp = (len - 1.2) / 3;
      const arches: Win[] = [-1, 0, 1].map((k) => ({o: {t: len / 2 + k * asp, y: 12.0, w: k === 0 ? Math.min(1.55, asp - 0.45) : Math.min(1.4, asp - 0.6), h: 5.2, head: 'round' as const}, surround: 0.2,
        opt: k === 0 ? {...cross2, panes: [2, 5] as [number, number]} : {depth: 0.14, glass: 'brick', reveal: 'stone'}}));
      wall(f, 'brick', rect(0, len, 11.6, 17.6), arches);
      for (const a of arches) if (a.opt?.glass === 'brick') panel(S, 'gold', f, openingOutline({...a.o, y: a.o.y + a.o.h - a.o.w / 2 - 0.05, h: a.o.w / 2 + 0.05}), [], -0.07);
      slab(S, 'stone', f, -0.05, len + 0.05, 17.6, 18.15, 0, 0.18, false);
      wall(f, 'brick', rect(0, len, 18.15, 19.6), []);
      for (let k = 0; k < 7; k++) slab(S, 'stone', f, 0.5 + k * (len - 1.0) / 6 - 0.16, 0.5 + k * (len - 1.0) / 6 + 0.16, 18.3, 19.45, 0, 0.07, false);
      // dial storey
      wall(f, 'brick', rect(0, len, 19.6, 24.1), []);
      dial(f, len / 2, 21.85, wind);
      // arcade storey: five small arches a face
      const arc: Win[] = evenly(0.5, len - 0.5, 5).map(t => ({o: {t, y: 24.35, w: 0.82, h: 1.9, head: 'round' as const}, opt: {depth: 0.2, glass: 'dark', reveal: 'stone'}}));
      wall(f, 'brick', rect(0, len, 24.1, 26.8), arc);
      for (const [y0, y1] of [[24.1, 24.3], [26.4, 26.8]]) slab(S, 'stone', f, 0, len, y0, y1, 0, 0.1, false);
      quoins(S, 'stone', f, 0.0, 4.8, 26.4, 0.45, 0.85, 0.45, 0.12, 1);
      quoins(S, 'stone', f, len, 4.8, 26.4, 0.45, 0.85, 0.45, 0.12, -1);
    }
    box(S, 'stone', x0 - 0.35, x1 + 0.35, 26.8, 27.4, z0 - 0.35, z1 + 0.35);
    // spire roof, dormers, pinnacles, lantern, finial (eaves 27.4, lantern 33.4-35.0, finial to 41.8 measured)
    frustum(S, 'slate', x0 - 0.2, x1 + 0.2, z0 - 0.2, z1 + 0.2, TOWER_TOP, 33.4, [(w + 0.4) / 2 - 0.85, (d + 0.4) / 2 - 0.85]);
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) { spire(S, 'stone', px, pz, TOWER_TOP, 28.4, 0.28, 0.28, 4); spire(S, 'stone', px, pz, 28.4, 30.0, 0.28, 0, 4); }
    dormer(cx, z1 + 0.05, 27.95, 1.0, 1.2);
    spire(S, 'frame', cx, cz, 33.4, 35.0, 0.85, 0.85, 8);
    cresting(S, 'frame', F(cx - 0.6, cz), 0, 1.2, 35.0, 0.5, 0.25);
    spire(S, 'red', cx, cz, 35.0, 38.6, 0.55, 0.32, 8);
    spire(S, 'gold', cx, cz, 38.6, 39.3, 0.42, 0.42, 8);
    spire(S, 'red', cx, cz, 39.3, 41.2, 0.36, 0.08, 8);
    spire(S, 'gold', cx, cz, 41.2, 41.8, 0.12, 0, 6);
  }
  /** Simplified relief figure: head disc on a tapering body, standing `h` tall from y on the wall (low relief). */
  function figure(f: WallFrame, t: number, y: number, h: number, d: number, c: string) {
    const bw = h * 0.22;
    panel(S, c, f, [[t - bw, y], [t + bw, y], [t + bw * 0.8, y + h * 0.78], [t - bw * 0.8, y + h * 0.78]], [], d);
    disc(S, c, f, t, y + h * 0.87, h * 0.11, d, 6);
  }
  function dial(f: WallFrame, t: number, y: number, wind: boolean) {
    panel(S, 'stone', f, rect(t - 1.7, t + 1.7, y - 1.75, y + 1.75), [], 0.12);
    slab(S, 'stone', f, t - 1.85, t + 1.85, y - 1.9, y - 1.72, 0, 0.2, true);
    slab(S, 'stone', f, t - 1.85, t + 1.85, y + 1.72, y + 1.9, 0, 0.2, true);
    drum(S, wind ? 'stone' : 'red', f, t, y, 1.5, 0.12, 0.2, 24);
    disc(S, 'gold', f, t, y, 1.66, 0.2, 24, 0.16);
    if (!wind) {
      // twelve hour plaques (grey-green roundels) and gilt hands at ten past ten
      for (let k = 0; k < 12; k++) { const a = Math.PI / 2 - k * Math.PI / 6; drum(S, 'green', f, t + 1.12 * Math.cos(a), y + 1.12 * Math.sin(a), 0.24, 0.2, 0.26, 8); }
      rib(S, 'gold', f, [t, y], [t - 0.62, y + 0.36], 0.13, 0.2, 0.3);
      rib(S, 'gold', f, [t, y], [t + 0.88, y + 0.5], 0.08, 0.2, 0.34);
      drum(S, 'gold', f, t, y, 0.12, 0.2, 0.38, 8);
    } else {
      // wind dial: compass-rose rays on stone, a red ring and the gilt pointer (aimed SW, as photographed)
      drum(S, 'red', f, t, y, 0.82, 0.2, 0.26, 20);
      for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, r0 = k % 2 ? 1.0 : 0.3, r1 = 1.36; rib(S, 'bronze', f, [t + r0 * Math.cos(a), y + r0 * Math.sin(a)], [t + r1 * Math.cos(a), y + r1 * Math.sin(a)], k % 4 ? 0.04 : 0.07, 0.2, 0.32); }
      plaque(S, 'gold', f, [[t - 0.95, y - 0.75], [t - 0.75, y - 0.95], [t + 0.25, y + 0.55], [t + 0.15, y + 1.1], [t - 0.25, y + 0.6]], 0.26, 0.38);
      drum(S, 'gold', f, t, y, 0.12, 0.38, 0.42, 8);
    }
  }
  tower(8.4, 15.9, false);
  tower(46.4, 53.8, true);

  // =====================================================================================================================
  // CENTRAL BLOCK (15.9..46.4, front z 14.0): stone ground storey with the entrances and the station sign, five
  // first-floor cross windows, three round-arched windows with carved tympana between two square ones, pier quoins,
  // medallions, the frieze of provincial and city arms, cornice, balustrade, the central gable with the gilt state arms
  // and its pinnacles and wind-vane finial, hipped slate roof.
  // =====================================================================================================================
  {
    const x0 = 15.9, x1 = 46.4, z = 14.0, f = F(x0, z), L = x1 - x0, bays = [0, 1, 2, 3, 4].map(k => 3.05 + 6.1 * k);
    const ground: Win[] = bays.map((t, k) => ({o: {t, y: 0.15, w: k === 0 || k === 4 ? 3.0 : 4.6, h: 3.45}, opt: {mullions: k === 0 || k === 4 ? 1 : 2, depth: 0.45, glass: 'glass', reveal: 'sandstone'}}));
    wall(f, 'sandstone', rect(0, L, 0, 4.85), ground);
    const sign = raisedLettering({text: 'AMSTERDAM CENTRAAL', heightM: 0.46, maxWidthM: 10.5, depthM: 0.04});
    slab(S, 'concrete', f, 6.0, L - 6.0, 3.72, 4.45, 0, 0.32, true);
    pushGeometry(sign.geometry, 'white', (p) => at(f, L / 2 + p[0], 4.08 - sign.heightM / 2 + p[1], 0.32 + p[2]));
    slab(S, 'stone', f, -0.05, L + 0.05, 4.85, 5.2, 0, 0.18, false);
    const first: Win[] = bays.map(t => ({o: {t, y: 5.35, w: 2.6, h: 4.4}, surround: 0.22, sill: 0.12, opt: cross3}));
    wall(f, 'brick', rect(0, L, 5.2, 11.2), first);
    for (let k = 0; k < 4; k++) drum(S, 'stone', f, 6.1 * (k + 1), 10.55, 0.36, 0, 0.1, 10);
    slab(S, 'stone', f, -0.05, L + 0.05, 11.2, 11.45, 0, 0.16, false);
    const second: Win[] = bays.map((t, k) => k === 0 || k === 4
      ? {o: {t, y: 11.85, w: 2.4, h: 5.2}, surround: 0.22, sill: 0.18, opt: cross3}
      : {o: {t, y: 11.85, w: 3.3, h: 5.55}, surround: 0.24, sill: 0.18, opt: {mullions: 2, transoms: [0.62], panes: [3, 5], mullionW: 0.14}});
    const great = (w: Win): Win => ({...w, o: {...w.o, h: w.o.h + w.o.w / 2 + 0.05, head: 'round', segs: 8}, cutOnly: true});
    wall(f, 'brick', rect(0, L, 11.45, 20.15), second.map(w => w.o.w > 3 ? great(w) : w));
    // the three great windows: glazing to the springing, a carved stone tympanum in the arch
    for (const w of second.filter(w => w.o.w > 3)) {
      opening(S, f, w.o, w.opt);
      const spring = w.o.y + w.o.h, r = w.o.w / 2, arch = openingOutline({t: w.o.t, y: spring, w: w.o.w, h: r + 0.05, head: 'round', segs: 8});
      panel(S, 'sandstone', f, arch, [], -0.06);
      reveal(S, 'stone', f, arch, 0.06);
      for (const dt of [-0.9, 0, 0.9]) figure(f, w.o.t + dt, spring + 0.05, dt === 0 ? 1.45 : 1.05, 0.01, 'stone');
      slab(S, 'stone', f, w.o.t - r - 0.1, w.o.t + r + 0.1, spring - 0.08, spring + 0.06, -0.06, 0.06, false);
    }
    for (let k = 1; k < 5; k++) quoins(S, 'stone', f, 6.1 * k, 5.2, 20.1, 0.4, 0.62, 0.34, 0.1);
    // frieze of arms: twelve shields on a stone band, then cornice and balustrade
    wall(f, 'brick', rect(0, L, 20.15, 22.25), []);
    slab(S, 'stone', f, -0.1, L + 0.1, 20.15, 21.95, 0, 0.12, true);
    const shield = ['red', 'blue', 'gold', 'red', 'white', 'blue', 'gold', 'red', 'blue', 'white', 'gold', 'red'];
    for (let k = 0; k < 12; k++) {
      const t = 1.3 + k * (L - 2.6) / 11, y = 20.5;
      plaque(S, shield[k], f, [[t - 0.38, y + 1.1], [t - 0.38, y + 0.42], [t, y], [t + 0.38, y + 0.42], [t + 0.38, y + 1.1]], 0.12, 0.19);
      rib(S, k % 2 ? 'white' : 'gold', f, [t - 0.3, y + 0.75], [t + 0.3, y + 0.75], 0.12, 0.19, 0.25);
    }
    slab(S, 'stone', f, -0.3, L + 0.3, 21.95, 22.3, 0, 0.42, true);
    wall(f, 'dark', rect(0, L, 22.25, 23.55), []);
    for (let t = 0.45; t < L - 0.3; t += 0.42) slab(S, 'stone', f, t - 0.09, t + 0.09, 22.3, 23.3, 0.05, 0.28, false);
    slab(S, 'stone', f, -0.2, L + 0.2, 23.3, 23.55, 0, 0.36, true);
    for (const t of [0.35, L - 0.35]) { box(S, 'stone', x0 + t - 0.3, x0 + t + 0.3, 22.3, 24.2, z - 0.2, z + 0.4); spire(S, 'stone', x0 + t, z + 0.1, 24.2, 27.2, 0.26, 0, 4); }
    // central gable (measured: shoulders 24.6, apex 31.0, pinnacles to 27.6, pedestal to 32.2, finial 35.6)
    const gc = L / 2, gw = 3.7;
    const gf = F(x0, z + 0.05);
    wall(gf, 'brick', [[gc - gw, 23.55], [gc + gw, 23.55], [gc + gw, 24.6], [gc, 31.0], [gc - gw, 24.6]], [{o: {t: gc, y: 28.2, w: 0.5, h: 1.2, head: 'round'}, opt: {depth: 0.2, glass: 'dark'}}]);
    panel(S, 'brick', W(x0 + gc - gw, z - 1.0), rect(0, 1.05, 23.55, 24.6));
    panel(S, 'brick', E(x0 + gc + gw, z + 0.05), rect(0, 1.05, 23.55, 24.6));
    gableCoping(gf, [gc - gw, 24.6], [gc, 31.0], 0.35, 0.22, 0.2); gableCoping(gf, [gc, 31.0], [gc + gw, 24.6], 0.35, 0.22, 0.2);
    // the gilt state arms: two lions holding a crowned shield in a round-headed stone niche
    panel(S, 'stone', gf, openingOutline({t: gc, y: 23.6, w: 3.9, h: 3.4, head: 'round', segs: 8}), [], 0.08);
    panel(S, 'blue', gf, [[gc - 0.62, 25.7], [gc - 0.62, 24.55], [gc, 23.95], [gc + 0.62, 24.55], [gc + 0.62, 25.7]], [], 0.16);
    panel(S, 'gold', gf, [[gc - 0.3, 25.35], [gc - 0.3, 24.65], [gc, 24.35], [gc + 0.3, 24.65], [gc + 0.3, 25.35]], [], 0.23);
    for (const s of [-1, 1]) {
      panel(S, 'gold', gf, s < 0 ? [[gc - 1.75, 23.25], [gc - 0.7, 23.25], [gc - 0.7, 25.6], [gc - 1.0, 26.05], [gc - 1.45, 25.7], [gc - 1.75, 24.4]] : [[gc + 0.7, 23.25], [gc + 1.75, 23.25], [gc + 1.75, 24.4], [gc + 1.45, 25.7], [gc + 1.0, 26.05], [gc + 0.7, 25.6]], [], 0.17);
    }
    panel(S, 'gold', gf, [[gc - 0.55, 25.85], [gc + 0.55, 25.85], [gc + 0.62, 26.5], [gc + 0.3, 26.25], [gc, 26.7], [gc - 0.3, 26.25], [gc - 0.62, 26.5]], [], 0.18);
    for (const s of [-1, 1]) { box(S, 'stone', x0 + gc + s * gw - 0.3, x0 + gc + s * gw + 0.3, 22.3, 25.4, z - 0.25, z + 0.45); spire(S, 'stone', x0 + gc + s * gw, z + 0.1, 25.4, 27.6, 0.26, 0, 4); }
    box(S, 'stone', x0 + gc - 0.5, x0 + gc + 0.5, 30.3, 32.2, z - 0.55, z + 0.3);
    spire(S, 'stone', x0 + gc, z - 0.12, 32.2, 33.8, 0.38, 0.2, 8);
    spire(S, 'bronze', x0 + gc, z - 0.12, 33.8, 35.6, 0.08, 0.04, 6);
    panel(S, 'gold', F(x0 + gc, z - 0.12), rect(0.05, 0.75, 34.9, 35.45));
    prismZ(S, 'slate', [[x0 + gc - gw + 0.1, 24.6], [x0 + gc + gw - 0.1, 24.6], [x0 + gc, 30.9]], z - 7.5, z + 0.03, [true, false]);
    // hipped roof over the hall (eaves 23.55, ridge 30.0) and the blocks behind the towers
    frustum(S, 'slate', x0 - 0.1, x1 + 0.1, REAR_Z, z + 0.1, 23.55, 30.0, [8.6, 14.8]);
    for (const xd of [x0 + 6.5, x1 - 6.5]) dormer(xd, z - 3.6, 25.2, 1.0, 1.3);
    roofCrest(x0 + 8.5, x1 - 8.5, -0.85, 30.0);
    // the blocks behind the towers (x 8.4..15.9 and 46.4..53.8, back to the shed) carry the wing mansard on to the hall
    for (const [bx0, bx1] of [[8.4, 15.9], [46.4, 53.8]] as const) {
      panel(S, 'brick', R(bx1, REAR_Z), rect(0, bx1 - bx0, 0, EAVES));
      mansard(bx0, bx1, REAR_Z, 7.9, EAVES, MANSARD_TOP, 2.6);
    }
    // the recesses between the wing fronts and the towers (x 8.4 / 53.8, z 3.1..7.9)
    panel(S, 'brick', W(8.4, WING_Z), rect(0, 7.9 - WING_Z, 0, 17.5));
    panel(S, 'brick', E(53.8, 7.9), rect(0, 7.9 - WING_Z, 0, 17.5));
    // the hall's back wall inside the train shed
    wall(R(x1, REAR_Z), 'brick', rect(0, L, 0, 23.55), evenly(1.0, L - 1.0, 5).map(t => ({o: {t, y: 12.3, w: 2.4, h: 7.0, head: 'round' as const}, opt: {depth: 0.2, glass: 'dark', reveal: 'brick'}})));
  }

  // =====================================================================================================================
  // PAVILIONS. West (-59.4..-40.2, z 4.6): gabled west bay, a 4-bay middle with three window rows and gilt mosaic panels,
  // the tower bay with its pyramid roof and lantern finial. East (101.8..121.9, z 4.5) with the royal waiting room gable
  // (107.6..116.9, z 14.6): portal, arms relief, seven lancets, gilt frieze, three cross windows, gable with oculi, copings,
  // pinnacles and the crowning statue.
  // =====================================================================================================================
  {
    const x0 = -59.4, x1 = -40.2, z = 4.6, f = F(x0, z), L = x1 - x0, eaves = 18.3;
    // the gable bay's single windows, the four middle bays, and the tower bay's three narrow lights a storey (photographed 2020)
    const cols = [2.5, ...evenly(5.0, 13.6, 4)], towerLights = [15.85, 16.5, 17.15];
    const rows: [number, number][] = [[5.3, 2.4], [8.5, 2.3], [12.6, 3.9]];
    wall(f, 'sandstone', rect(0, L, 0, 4.9), evenly(4.0, 15.5, 4).map(t => ({o: {t, y: 0.2, w: 1.6, h: 3.4}, opt: {mullions: 1, depth: 0.35}})));
    wall(f, 'brick', rect(0, L, 4.9, eaves), rows.flatMap(([y, h]) => [
      ...cols.map((t, k) => ({o: {t, y, w: k === 0 ? 1.4 : 1.6, h, head: h > 3 ? 'segment' as const : 'flat' as const, rise: 0.28}, surround: 0.18, sill: 0.14, opt: h > 3 ? cross2 : {mullions: 1, panes: [2, 2] as [number, number]}})),
      ...towerLights.map(t => ({o: {t, y, w: 0.48, h, head: 'round' as const}, surround: 0.07, sill: 0.1, opt: {transoms: h > 3 ? [0.6] : [], depth: 0.18}})),
    ]));
    for (const t of evenly(5.0, 13.6, 4)) panel(S, 'gold', f, rect(t - 0.8, t + 0.8, 11.2, 12.2), [], 0.06);
    for (const y of [4.9, 8.0, 11.0, eaves - 0.4]) slab(S, 'stone', f, 0, L, y, y + 0.22, 0, 0.16, false);
    quoins(S, 'stone', f, 0.0, 4.9, eaves - 0.4, 0.42, 0.8, 0.42, 0.1, 1);
    quoins(S, 'stone', f, 4.6, 4.9, eaves - 0.4, 0.42, 0.7, 0.4, 0.1);
    quoins(S, 'stone', f, L - 5.2, 4.9, eaves - 0.4, 0.42, 0.7, 0.4, 0.1);
    quoins(S, 'stone', f, L, 4.9, eaves - 0.4, 0.42, 0.8, 0.42, 0.1, -1);
    slab(S, 'stone', f, -0.2, L + 0.2, eaves - 0.4, eaves, 0, 0.35, true);
    // west gabled bay (apex 26.0, pinnacle 27.6)
    wall(f, 'brick', [[0, eaves], [4.9, eaves], [4.9, 20.6], [2.45, 26.0], [0, 20.6]], [{o: {t: 2.45, y: 19.2, w: 1.3, h: 2.4, head: 'round'}, surround: 0.16, opt: {...cross2, depth: 0.1}}]);
    gableCoping(f, [0, 20.6], [2.45, 26.0], 0.3, 0.18); gableCoping(f, [2.45, 26.0], [4.9, 20.6], 0.3, 0.18);
    spire(S, 'stone', x0 + 2.45, z - 0.1, 26.0, 27.6, 0.22, 0, 4);
    prismZ(S, 'slate', [[x0 + 0.1, 20.6], [x0 + 4.8, 20.6], [x0 + 2.45, 25.9]], z - 5, z - 0.2, [true, true]);
    // tower bay (x -45.8..-40.2): three arched lights over the gilt mosaic panels, pyramid roof (apex 26.3), finial 29.3
    const tb0 = L - 5.6;
    wall(f, 'brick', rect(tb0, L, eaves, 21.0), [-1.5, 0, 1.5].map(dt => ({o: {t: tb0 + 2.8 + dt, y: 18.6, w: 1.0, h: 2.0, head: 'round' as const}, opt: {depth: 0.2, glass: 'glass', reveal: 'stone'}})));
    panel(S, 'brick', W(x0 + tb0, z - 5.6), rect(0, 5.6, eaves, 21.0)); panel(S, 'brick', E(x1, z), rect(0, 5.6, eaves, 21.0));
    panel(S, 'brick', R(x1, z - 5.6), rect(0, 5.6, eaves, 21.0));
    slab(S, 'stone', f, tb0 - 0.2, L + 0.2, 20.8, 21.1, 0, 0.3, true);
    frustum(S, 'slate', x0 + tb0, x1, z - 5.6, z, 21.0, 26.3, [2.8, 2.8]);
    spire(S, 'stone', x0 + tb0 + 2.8, z - 2.8, 26.3, 27.4, 0.3, 0.3, 8); spire(S, 'gold', x0 + tb0 + 2.8, z - 2.8, 27.4, 29.3, 0.2, 0, 6);
    // the middle's mansard to 21.7 with dormers, the west side wall and the rear
    mansard(x0 + 4.9, x0 + tb0, REAR_Z, z, eaves, 21.7, 2.4);
    mansard(x0, x0 + 4.9, REAR_Z, z - 5, eaves, 21.7, 2.4);
    mansard(x0 + tb0, x1, REAR_Z, z - 5.6, eaves, 21.7, 2.4);
    roofCrest(x0 + 4.9, x0 + tb0, z - 2.55, 21.7);
    for (const t of evenly(5.0, 13.6, 4)) dormer(x0 + t, z - 1.1, 20.1);
    wall(W(x0, REAR_Z), 'brick', rect(0, z - REAR_Z, 0, eaves), [5.5, 9.5, 14.0, 17.5].map(t => ({o: {t, y: 13.6, w: 1.5, h: 3.0, head: 'segment' as const, rise: 0.25}, surround: 0.16, opt: cross2})));
    slab(S, 'stone', W(x0, REAR_Z), 0, z - REAR_Z, eaves - 0.4, eaves, 0, 0.3, false);
    panel(S, 'brick', R(x1, REAR_Z), rect(0, L, 0, eaves));
    panel(S, 'brick', E(x1, z), rect(0, z - WING_Z, 0, eaves));
  }
  {
    // east pavilion side parts, wing-like (eaves 17.5, mansard to 25.0)
    for (const [x0, x1] of [[101.8, 107.6], [116.9, 121.9]] as const) {
      const z = 4.5, f = F(x0, z), L = x1 - x0, c = L / 2;
      wall(f, 'sandstone', rect(0, L, 0, 1.0), []);
      wall(f, 'brick', rect(0, L, 1.0, 5.25), [{o: {t: c, y: 1.1, w: 2.2, h: 3.0, head: 'segment', rise: 0.3}, opt: {mullions: 1, transoms: [0.72]}}]);
      wall(f, 'brick', rect(0, L, 5.25, 17.5), [5.6, 11.4].map(y => ({o: {t: c, y, w: 1.95, h: y < 10 ? 4.6 : 4.1, head: 'segment' as const, rise: 0.16}, surround: 0.2, sill: 0.16, opt: cross2})));
      for (const y of [5.25, 10.95]) slab(S, 'stone', f, 0, L, y, y + 0.2, 0, 0.14, false);
      slab(S, 'ochre', f, 0, L, 16.3, 16.95, 0, 0.07, false);
      slab(S, 'stone', f, -0.1, L + 0.1, 17.15, 17.5, 0, 0.32, true);
      quoins(S, 'stone', f, x0 < 110 ? 0 : L, 1.0, 16.2, 0.42, 0.8, 0.42, 0.1, x0 < 110 ? 1 : -1);
      dormer(x0 + c, z - 0.2, 18.65);
    }
    mansard(101.8, 121.9, REAR_Z, 4.5, EAVES, 25.0, 2.8);
    panel(S, 'brick', W(101.8, WING_Z), rect(0, 4.5 - WING_Z, 0, 17.5));
    // east end wall (x 121.9) over the notch to the east wing and above its roof
    wall(E(121.9, 4.5), 'brick', [[0, 0], [12.8, 0], [12.8, 12.0], [20.3, 12.0], [20.3, 17.5], [0, 17.5]], [{o: {t: 3.0, y: 5.6, w: 1.6, h: 4.0, head: 'segment', rise: 0.3}, surround: 0.18, opt: cross2}, {o: {t: 3.0, y: 11.4, w: 1.6, h: 3.8, head: 'segment', rise: 0.3}, surround: 0.18, opt: cross2}, {o: {t: 8.6, y: 11.4, w: 1.6, h: 3.8, head: 'segment', rise: 0.3}, surround: 0.18, opt: cross2}]);
    slab(S, 'stone', E(121.9, 4.5), 0, 20.3, 17.15, 17.5, 0, 0.3, false);
    panel(S, 'brick', R(121.9, REAR_Z), rect(0, 121.9 - 101.8, 0, 17.5));
    // royal waiting room gable block
    const x0 = 107.6, x1 = 116.9, z = 14.6, f = F(x0, z), L = x1 - x0, c = L / 2;
    wall(f, 'sandstone', rect(0, L, 0, 4.3), [{o: {t: c, y: 0.2, w: 1.9, h: 3.6}, opt: {depth: 0.5, glass: 'dark', reveal: 'sandstone'}}]);
    for (const dt of [-1.35, 1.35]) slab(S, 'stone', f, c + dt - 0.2, c + dt + 0.2, 0, 3.9, 0, 0.3, true);
    slab(S, 'stone', f, c - 1.7, c + 1.7, 3.9, 4.3, 0, 0.35, true);
    panel(S, 'stone', f, rect(c - 1.4, c + 1.4, 4.4, 6.9), [], 0.12);
    panel(S, 'gold', f, [[c - 0.5, 6.4], [c - 0.5, 5.3], [c, 4.8], [c + 0.5, 5.3], [c + 0.5, 6.4]], [], 0.18);
    figure(f, c - 0.95, 4.55, 1.9, 0.19, 'sandstone'); figure(f, c + 0.95, 4.55, 1.9, 0.19, 'sandstone');
    const lancets: Win[] = [...evenly(0.3, c - 1.5, 3), ...evenly(c + 1.5, L - 0.3, 3)].map(t => ({o: {t, y: 5.1, w: 0.72, h: 4.4, head: 'pointed' as const, rise: 0.55}, opt: {depth: 0.2, panes: [1, 4] as [number, number]}}));
    lancets.push({o: {t: c, y: 7.2, w: 0.72, h: 2.3, head: 'pointed', rise: 0.55}, opt: {depth: 0.2}});
    wall(f, 'brick', rect(0, L, 4.3, 9.85), lancets);
    // The gilt frieze and its figures stop at the quoins (0.8 m blocks 12 cm proud): ending at 0.35 m the gold ran 4 cm behind the
    // quoin faces, one quantisation step at the 14-bit export grid (zfight-tight, 2026-10-29).
    panel(S, 'gold', f, rect(0.85, L - 0.85, 9.95, 11.35), [], 0.08);
    for (let k = 0; k < 7; k++) figure(f, 1.15 + k * (L - 2.3) / 6, 10.0, 1.25, 0.14, 'stone');
    slab(S, 'stone', f, 0, L, 9.85, 9.98, 0, 0.16, false); slab(S, 'stone', f, 0, L, 11.35, 11.5, 0, 0.16, false);
    wall(f, 'brick', rect(0, L, 11.5, 19.1), evenly(0.6, L - 0.6, 3).map(t => ({o: {t, y: 11.65, w: 1.65, h: 4.0}, surround: 0.2, sill: 0.12, opt: cross2})));
    for (const [y0, y1] of [[15.95, 16.15], [18.6, 19.1]] as const) slab(S, 'stone', f, -0.1, L + 0.1, y0, y1, 0, 0.3, true);
    wall(f, 'brick', [[0, 19.1], [L, 19.1], [L, 20.6], [c, 24.8], [0, 20.6]], [{o: {t: c, y: 20.4, w: 1.3, h: 2.4, head: 'pointed', rise: 0.6}, surround: 0.15, opt: {mullions: 1, panes: [2, 3]}}]);
    for (const dt of [-2.6, 2.6]) { drum(S, 'stone', f, c + dt, 20.3, 0.45, 0, 0.1, 10); drum(S, 'dark', f, c + dt, 20.3, 0.3, 0.1, 0.17, 10); }
    gableCoping(f, [0, 20.6], [c, 24.8], 0.35, 0.2, 0.2); gableCoping(f, [c, 24.8], [L, 20.6], 0.35, 0.2, 0.2);
    for (const px of [x0, x1]) { box(S, 'stone', px - 0.32, px + 0.32, 19.1, 21.3, z - 0.6, z + 0.2); spire(S, 'stone', px, z - 0.2, 21.3, 23.0, 0.28, 0, 4); }
    box(S, 'stone', x0 + c - 0.45, x0 + c + 0.45, 24.4, 25.7, z - 0.7, z + 0.15);
    spire(S, 'bronze', x0 + c, z - 0.28, 25.7, 28.4, 0.24, 0.17, 6); disc(S, 'bronze', F(x0 + c, z - 0.06), 0, 28.75, 0.22, 0, 6);
    strip(S, 'bronze', F(x0 + c, z - 0.06), [0.35, 26.4], [0.35, 29.6], 0.05, 0);
    quoins(S, 'stone', f, 0, 0, 18.6, 0.45, 0.8, 0.45, 0.12, 1); quoins(S, 'stone', f, L, 0, 18.6, 0.45, 0.8, 0.45, 0.12, -1);
    // side faces (2017 panorama from the west): the west side has the royal entrance, a round-headed portal with timber
    // doors in rusticated stone, and a carved figure frieze above; the east side two cross windows over a stone cartouche
    {
      const sw = W(x0, 4.5), se = E(x1, z), D = z - 4.5;
      wall(sw, 'sandstone', rect(0, D, 0, 5.4), [{o: {t: D - 3.6, y: 0.03, w: 3.0, h: 4.6, head: 'round'}, surround: 0.35, sill: 0.015, ring: 'stone', opt: {depth: 0.45, glass: 'red', reveal: 'sandstone'}}]);
      for (let y = 0.35; y < 5.2; y += 0.62) for (const [a, bb] of [[0.05, D - 5.6], [D - 1.6, D - 0.05]] as const) slab(S, 'sandstone', sw, a, bb, y, y + 0.52, 0, 0.06, true);
      for (const dt of [-1.85, 1.85]) slab(S, 'stone', sw, D - 3.6 + dt - 0.22, D - 3.6 + dt + 0.22, 0, 4.4, 0, 0.35, true);
      wall(sw, 'brick', rect(0, D, 5.4, 19.1), [{o: {t: 2.6, y: 11.6, w: 1.6, h: 4.0}, surround: 0.2, opt: cross2}, {o: {t: D - 3.0, y: 11.6, w: 1.6, h: 4.0}, surround: 0.2, opt: cross2}, {o: {t: 2.6, y: 5.9, w: 1.6, h: 3.4}, surround: 0.2, opt: cross2}]);
      panel(S, 'stone', sw, rect(D - 6.2, D - 0.6, 6.0, 9.6), [], 0.1);
      for (let k = 0; k < 6; k++) figure(sw, D - 5.75 + k * 0.95, 6.25, 2.6, 0.16, 'sandstone');
      wall(se, 'brick', rect(0, D, 0, 19.1), [{o: {t: 5.05, y: 11.6, w: 1.6, h: 4.0}, surround: 0.2, opt: cross2}, {o: {t: 5.05, y: 5.6, w: 1.6, h: 4.0}, surround: 0.2, opt: cross2}]);
      panel(S, 'stone', se, [[3.6, 9.9], [6.5, 9.9], [6.8, 10.6], [5.05, 11.35], [3.3, 10.6]], [], 0.1);
      panel(S, 'gold', se, [[4.7, 10.85], [4.7, 10.25], [5.05, 10.0], [5.4, 10.25], [5.4, 10.85]], [], 0.17);
      for (const sf of [sw, se]) { quoins(S, 'stone', sf, 0, 5.4, 18.6, 0.45, 0.8, 0.45, 0.12, 1); for (const [y0, y1] of [[15.95, 16.15], [18.6, 19.1]] as const) slab(S, 'stone', sf, -0.1, D + 0.1, y0, y1, 0, 0.3, true); }
    }
    prismZ(S, 'slate', [[x0 - 0.15, 19.1], [x1 + 0.15, 19.1], [x0 + c, 24.7]], 0.0, z - 0.02, [true, false]);
  }

  // =====================================================================================================================
  // WEST LOW WING (-126.1..-59.4; front z -3.0, -4.9 west of -103): ground storey behind a long zinc canopy, one row of
  // grouped segment-headed windows, cornice, mansard (8.1 -> 12.9) with dormers and the small slate spire turret.
  // =====================================================================================================================
  {
    const parts: [number, number, number][] = [[-126.1, -103.0, -4.9], [-103.0, -59.4, -3.0]];
    for (const [x0, x1, z] of parts) {
      const f = F(x0, z), L = x1 - x0, groups = Math.round(L / 7.2), wins: Win[] = [];
      for (const gx of evenly(0, L, groups)) for (const dt of [-1.25, 0, 1.25]) wins.push({o: {t: gx + dt, y: 5.25, w: 0.98, h: 2.05, head: 'segment', rise: 0.2}, surround: 0.12, sill: 0.12, opt: {mullions: 1, panes: [2, 2]}});
      const shops: Win[] = evenly(0, L, Math.round(L / 4.6)).map(t => ({o: {t, y: 0.2, w: 2.4, h: 3.5}, opt: {mullions: 1, depth: 0.3}}));
      wall(f, 'brick', rect(0, L, 0, 4.85), shops);
      wall(f, 'brick', rect(0, L, 4.85, 8.1), wins);
      slab(S, 'stone', f, 0, L, 4.85, 5.1, 0, 0.12, false);
      slab(S, 'ochre', f, 0, L, 7.55, 7.85, 0, 0.07, false);
      slab(S, 'stone', f, -0.1, L + 0.1, 7.85, 8.1, 0, 0.3, true);
      mansard(x0, x1, -15.4, z, 8.1, 12.9, 2.2);
      for (const gx of evenly(0, L, groups)) dormer(x0 + gx, z - 0.3, 9.2, 0.95, 1.15);
      // zinc canopy (wall at 4.95 m, front edge 4.1 m, 5.5 m deep) on slender posts, a thin red-brown fascia
      prismX(S, 'frame', [[z, 4.95], [z + 5.5, 4.1], [z + 5.5, 3.92], [z, 4.7]], x0 + 0.5, x1 - 0.5);
      for (const t of evenly(0.5, L - 0.5, Math.round(L / 6))) box(S, 'bronze', x0 + t - 0.08, x0 + t + 0.08, 0, 3.92, z + 5.2, z + 5.36);
      box(S, 'red', x0 + 0.5, x1 - 0.5, 3.8, 4.12, z + 5.5, z + 5.56);
      panel(S, 'brick', R(x1, -15.4), rect(0, L, 0, 8.1));
    }
    panel(S, 'brick', W(-103.0, -4.9), rect(0, 1.9, 0, 8.1));
    wall(W(-126.1, -15.4), 'brick', rect(0, 10.5, 0, 8.1), [{o: {t: 5.25, y: 5.25, w: 1.0, h: 2.0, head: 'segment', rise: 0.2}, opt: {mullions: 1}}]);
    // turret at x -88: square brick stage over the roof, slate spire, finial (measured spire top 18.2)
    const tx = -88, tz = -6.4;
    box(S, 'brick', tx - 1.3, tx + 1.3, 8.1, 15.0, tz - 1.3, tz + 1.3);
    for (const f of [F(tx - 1.3, tz + 1.3)]) opening(S, f, {t: 1.3, y: 13.05, w: 0.6, h: 1.4, head: 'round'}, {depth: 0.1, glass: 'dark'});
    slab(S, 'stone', F(tx - 1.3, tz + 1.3), -0.1, 2.7, 14.7, 15.0, 0, 0.2, true);
    frustum(S, 'slate', tx - 1.45, tx + 1.45, tz - 1.45, tz + 1.45, 15.0, 17.6, [1.45, 1.45]);
    spire(S, 'gold', tx, tz, 17.4, 18.3, 0.06, 0, 4);
  }

  // =====================================================================================================================
  // EAST WING (127.65..246.4, front z 0, rear z -15.9): stone ground storey with red doors and transom lights, brick
  // above with pilaster strips every two bays, two rows of cream-framed cross windows, stone cornice, slate roof
  // (eaves 15.2, ridge 21.0), stepped gables at 139.7..145.7 and 227.4..233.5, the three pointed gables 178.2..196.3,
  // chimneys and a hipped east end. Drawn by the city layer as a flat 20 m box before this lane.
  // =====================================================================================================================
  {
    const x0 = 127.65, x1 = 246.4, z = 0, L = x1 - x0, f = F(x0, z), eaves = 15.2, ridge = 21.0;
    // gables: two tall ones (139.7..145.7, photographed 2021 with a three-light window; 227.4..233.5 under scaffolding in
    // 2025, drawn the same) and the three lower pointed gables of the 4-storey middle (178.2..196.3)
    const gables: [number, number, number][] = [[139.7, 145.7, 24.5], [178.2, 184.2, 21.4], [184.2, 190.2, 21.4], [190.2, 196.3, 21.4], [227.4, 233.5, 24.5]];
    const n = Math.round(L / 3.05), bays = evenly(0.4, L - 0.4, n);
    const doors: Win[] = [], low: Win[] = [], rowB: Win[] = [], rowA: Win[] = [];
    const sash: OpeningOptions = {mullions: 1, transoms: [0.68], panes: [2, 3], bar: 'white', mullion: 'white', reveal: 'white', depth: 0.16};
    bays.forEach((t, k) => {
      if (k % 2 === 0) doors.push({o: {t, y: 0.15, w: 1.35, h: 3.0}, opt: {depth: 0.18, glass: 'red', reveal: 'stone'}});
      else doors.push({o: {t, y: 1.0, w: 1.35, h: 2.2}, opt: {mullions: 1, depth: 0.2, mullion: 'white', reveal: 'stone'}});
      low.push({o: {t, y: 3.35, w: 1.35, h: 1.05}, opt: {mullions: 1, depth: 0.15, mullion: 'white', reveal: 'stone'}});
      rowB.push({o: {t, y: 5.6, w: 1.55, h: 3.0}, sill: 0.12, opt: sash});
      rowA.push({o: {t, y: 10.0, w: 1.55, h: 3.1}, sill: 0.12, opt: sash});
    });
    wall(f, 'stone', rect(0, L, 0, 4.8), [...doors, ...low]);
    wall(f, 'brick', rect(0, L, 4.8, eaves), [...rowB, ...rowA]);
    for (const w of [...rowB, ...rowA]) slab(S, 'stone', f, w.o.t - w.o.w / 2 - 0.1, w.o.t + w.o.w / 2 + 0.1, w.o.y - 0.14, w.o.y, 0, 0.1, true);
    // brick pilaster strips between every bay (photographed 2020-2024), stone piers below
    for (let k = 0; k <= n; k++) { const t = k === 0 ? 0.2 : k >= n ? L - 0.2 : (bays[k - 1] + bays[k]) / 2; slab(S, 'brick', f, t - 0.22, t + 0.22, 4.8, eaves - 0.5, 0, 0.12, false); if (k % 2 === 0) slab(S, 'stone', f, t - 0.26, t + 0.26, 0, 4.8, 0, 0.1, false); }
    slab(S, 'stone', f, 0, L, 4.6, 4.9, 0, 0.19, false);
    slab(S, 'stone', f, 0, L, 9.55, 9.75, 0, 0.19, false);
    slab(S, 'stone', f, -0.2, L + 0.2, eaves - 0.5, eaves, 0, 0.32, true);
    for (const [g0, g1, apex] of gables) {
      const t0 = g0 - x0, t1 = g1 - x0, c = (t0 + t1) / 2, tall = apex > 23;
      const prof: P2[] = [[t0, eaves], [t1, eaves], [c, apex]];
      wall(f, 'brick', prof, tall
        ? [...[-1.1, 0, 1.1].map(dt => ({o: {t: c + dt, y: 15.9, w: 0.95, h: 2.6}, sill: 0.1, opt: {mullions: 0, transoms: [0.7], panes: [1, 3] as [number, number], bar: 'white', reveal: 'white'}})), {o: {t: c, y: 19.8, w: 0.9, h: 1.5, head: 'round' as const}, opt: {reveal: 'white', panes: [1, 2] as [number, number], bar: 'white'}}]
        : [{o: {t: c - 0.8, y: 16.0, w: 1.15, h: 2.5}, sill: 0.1, opt: sash}, {o: {t: c + 0.8, y: 16.0, w: 1.15, h: 2.5}, sill: 0.1, opt: sash}]);
      gableCoping(f, [t0, eaves], [c, apex], 0.3, 0.18, 0.12); gableCoping(f, [c, apex], [t1, eaves], 0.3, 0.18, 0.12);
      box(S, 'stone', g0 + (g1 - g0) / 2 - 0.25, g0 + (g1 - g0) / 2 + 0.25, apex - 0.1, apex + 0.6, z - 0.4, z + 0.12);
      prismZ(S, 'slate', [[g0, eaves], [g1, eaves], [(g0 + g1) / 2, apex]], tall ? -11.4 : -4.8, z - 0.02, [true, false]);
      if (tall) for (const cx of [g0 - 0.9, g1 + 0.9]) { box(S, 'brick', cx - 0.45, cx + 0.45, 16.5, 21.6, -3.6, -2.5); box(S, 'stone', cx - 0.56, cx + 0.56, 21.6, 21.85, -3.71, -2.39); }
    }
    // roof: gabled along x, abutting the pavilion connector in the west, hipped at the east end
    hipRoofX(S, 'slate', x0, x1, z, -15.9, eaves, ridge, -7.95, ['gable', 'hip'], 7.0);
    for (const cx of [133.5, 158.0, 171.5, 205.0, 216.0, 239.0, 186.0]) { box(S, 'brick', cx - 0.5, cx + 0.5, 18.0, 23.2, -9.0, -7.6); box(S, 'stone', cx - 0.62, cx + 0.62, 23.2, 23.45, -9.12, -7.48); }
    // ends and rear
    wall(E(x1, z), 'brick', rect(0, 15.9, 0, eaves), [3.0, 6.5, 9.4, 12.9].flatMap(t => [{o: {t, y: 5.6, w: 1.5, h: 3.0}, opt: {mullions: 1, mullion: 'white', reveal: 'white'}}, {o: {t, y: 10.0, w: 1.5, h: 3.1}, opt: {mullions: 1, mullion: 'white', reveal: 'white'}}]));
    slab(S, 'stone', E(x1, z), -0.2, 16.1, eaves - 0.5, eaves, 0, 0.3, false);
    wall(W(x0, -8.33), 'brick', rect(0, 8.33, 0, eaves), [{o: {t: 4.2, y: 5.6, w: 1.5, h: 3.0}, opt: {mullions: 1, mullion: 'white', reveal: 'white'}}, {o: {t: 4.2, y: 10.0, w: 1.5, h: 3.1}, opt: {mullions: 1, mullion: 'white', reveal: 'white'}}]);
    const rearWins: Win[] = bays.filter((_, k) => k % 2 === 0).flatMap(t => [5.6, 10.0].map(y => ({o: {t: L - t, y, w: 1.5, h: 3.0}, opt: {depth: 0.15, glass: 'dark', reveal: 'white'}})));
    wall(R(x1, -15.9), 'brick', rect(0, L, 0, eaves), rearWins);
    panel(S, 'brick', W(x0, -15.9), rect(0, 15.9 - 8.33, 12.0, eaves));
    // connector to the pavilion (122..127.65, z -15.8..-8.33, 12 m)
    box(S, 'brick', 121.9, x0, 0, 12.0, -15.8, -8.33);
    prismX(S, 'slate', [[-8.33 + 0.2, 12.0], [-12.0, 14.0], [-15.8 - 0.2, 12.0]], 121.9, x0, [false, false]);
  }

  // ---- red iron canopy along the east main wing (54..101.8), with the crowned cartouches --------------------------------
  {
    const x0 = 54.6, x1 = 107.2, z = WING_Z, d = 5.2;
    prismX(S, 'frame', [[z, 5.35], [z + d, 4.75], [z + d, 4.55], [z, 5.1]], x0, x1);
    box(S, 'red', x0, x1, 4.3, 4.95, z + d, z + d + 0.12);
    for (const t of evenly(0, x1 - x0, 8)) { box(S, 'bronze', x0 + t - 0.1, x0 + t + 0.1, 0, 4.3, z + d - 0.3, z + d - 0.1); box(S, 'bronze', x0 + t - 0.05, x0 + t + 0.05, 4.4, 4.6, z, z + d - 0.1); }
    for (const t of [4.7, 23.4, 42.1]) { drum(S, 'white', F(x0 + t, z + d + 0.12), 0, 4.62, 0.42, 0, 0.06, 10); panel(S, 'gold', F(x0 + t, z + d + 0.12), [[-0.32, 4.85], [0.32, 4.85], [0.38, 5.25], [0.15, 5.1], [0, 5.32], [-0.15, 5.1], [-0.38, 5.25]], [], 0.13); }
  }

  // ---- emit one geometry per colour ----------------------------------------------------------------------------------
  function pushGeometry(g: T.BufferGeometry, c: string, map: (p: [number, number, number]) => [number, number, number]) {
    const p = g.getAttribute('position'), idx = g.index;
    const v = (i: number) => map([p.getX(i), p.getY(i), p.getZ(i)]);
    const n = idx ? idx.count : p.count;
    for (let i = 0; i + 2 < n; i += 3) { const a = idx ? idx.getX(i) : i, bq = idx ? idx.getX(i + 1) : i + 1, e = idx ? idx.getX(i + 2) : i + 2; S.tri(c, v(a), v(bq), v(e)); }
  }
  for (const [c, arr] of S.tris) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(arr, 3));
    g.computeVertexNormals();
    b.add(g, c as Colour);
  }
  return S.count();
}
