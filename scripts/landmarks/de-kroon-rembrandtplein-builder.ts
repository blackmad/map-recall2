import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, getSink, letters, ringFrame, segBand, setSink, slab, type Frame} from './nearbar-kit';
import source from './de-kroon-rembrandtplein-footprints.json';
import {bellCrestOutline, gableWall, pinnacle, pointedGable, reshapeShell} from './shell-gable-fit';

/**
 * CAFE-RESTAURANT DE KROON, Rembrandtplein 17 (BAG pand 0363100012171127, 1898, G. van Arkel; gemeentelijk monument 209036:
 * "twee verdiepingen onder een plat dak en links is een hoektoren ... sobere Jugendstil", the first-floor balcony enlarged in
 * 1990). The pand runs back to Amstel 82. Massing: the 3DBAG LoD2.2 shell (de-kroon-rembrandtplein-footprints.json,
 * bag-shell-prepare.ts), white on the plein block and the tower, brick behind. Drawn here from rectified Gemeente Amsterdam
 * panoramas (CC BY 4.0; 50 px/m crops of the brief), per item in de-kroon-rembrandtplein-inventory.json:
 *  - the Rembrandtplein front (ring edge 1, t from the west; TMX7316010203-001664_pano_0000_001931, 2020, and
 *    TMX7316010203-002865_pano_0002_000132, 2022): an arcade of white piers with curved brackets, the glazed first-floor winter
 *    garden behind a cast-iron balcony rail, five second-floor windows under hood moulds, the central balcony on brackets,
 *    the dentil cornice, and the roof rail with finials round the "CAFE DE KROON" board;
 *  - the corner tower's plein face (3DBAG wall (-13.3, 16.8) -> (-7.5, 16.5); TMX7316010203-001177_pano_0000_000661, 2019):
 *    the round domed tourelle on its west corner, arched windows, the balustraded balcony and the corbel frieze, the arched
 *    door of the first-floor entrance under its name board;
 *  - the Amstel front (ring edge 9; TMX7316010203-000717_pano_0000_000150, 2018): tall round-arched windows in a stone
 *    two-storey base under brick upper storeys.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
/** The Amstel front's single eaves line (w04-354 crop: the tiled frieze tops at 14.3-14.6 m). */
const AM_EAVES = 14.3;
type C = Parameters<BuildingTools['add']>[1];
const c = (s: string) => s as unknown as C;

export function buildDeKroonRembrandtplein(_w: number, _d: number, b: BuildingTools) {
  const raw = source as unknown as Src;
  const ring = raw.facadeRing;
  // r8 (coordinator hold, 2026-11-20): the 3DBAG Amstel front is a lopsided lump (13.9 m east eaves, 18.4 m off-axis peak,
  // 14.7 m west) where the photo shows one 14.3 m eaves line under a symmetric pointed topgevel; its roof behind steps between
  // 17.0 and 18.5 m in 30 cm jogs. The tower roof is a 25.2 m pyramid where the photo shows a curved crest a little over the
  // name board. The shell is edited (vertices only) to one eaves line, one 17.4 m ridge and a tower roof compressed above 19 m.
  const amstel = ringFrame(ring, 9);
  const src: Src = {...raw, surfaces: reshapeShell(raw.surfaces, {
    fronts: [{frame: amstel.f, t0: 0, t1: amstel.len, front: 0.6, eaves: AM_EAVES, ridge: {lo: 16.8, hi: 18.6, to: 17.4, maxDepth: 13}}],
    compress: [{inside: (x, z) => x > -14 && x < -6.4 && z > 11.5 && z < 17.2, y0: 19, s: 0.5}],
  })};
  // white on the plein block and the tower (z > 10 m, south of the inner court), brick behind; the tower top is slate
  const plein = (s: Surface) => s.rings[0].every(p => p[2] > 10);
  addShell(b, src as never, {
    wall: 'brick', roof: 'concrete',
    wallFor: s => (plein(s) ? 'sandstone' : 'brick'),
    roofFor: s => (plein(s) && s.rings[0].some(p => p[1] > 19.6) ? 'slate' : 'concrete'),
  });
  const sink0 = getSink();
  setSink(0.12, true);

  // ---------- Rembrandtplein front (ring edge 1) ----------
  {
    const {f, len} = ringFrame(ring, 1);
    // arcade: six white piers with curved brackets to the first-floor slab; shopfronts between them
    const piers = [1.3, 3.9, 6.3, 9.0, 11.5, 14.0];
    for (let i = 0; i < piers.length; i++) {
      const t = piers[i];
      slab(b, f, t, 0, 0.42, 5.55, 0.3, 'sandstone');
      if (i < piers.length - 1) archBand(b, f, (t + piers[i + 1]) / 2, 4.3, piers[i + 1] - t - 0.4, 1.0, 0.28, 0.26, 'sandstone', 0, 10);
    }
    for (let i = 0; i < piers.length - 1; i++) {
      const t = (piers[i] + piers[i + 1]) / 2, w = piers[i + 1] - piers[i] - 0.6;
      slab(b, f, t, 0.05, w + 0.1, 4.2, 0.08, 'frame');
      slab(b, f, t, 0.1, w - 0.1, 4.05, 0.12, 'glass');
      slab(b, f, t, 2.75, w - 0.1, 0.08, 0.16, 'frame');
      slab(b, f, t, 0.1, 0.07, 4.05, 0.16, 'frame');
    }
    slab(b, f, 0.45, 0.05, 0.7, 2.4, 0.08, 'ochre'); // the oak side door at the west end
    // first-floor slab and the cast-iron balcony rail in front of the winter garden
    slab(b, f, len / 2, 5.5, len - 0.1, 0.35, 0.75, 'sandstone');
    for (let t = 0.25; t <= len - 0.2; t += 0.3) slab(b, f, t, 5.82, 0.035, 1.05, 0.035, 'bronze', 0.62);
    slab(b, f, len / 2, 6.82, len - 0.3, 0.06, 0.08, 'bronze', 0.6);
    slab(b, f, len / 2, 5.9, len - 0.3, 0.05, 0.05, 'bronze', 0.61);
    for (let t = 0.4; t <= len - 0.3; t += 0.6) slab(b, f, t, 6.15, 0.36, 0.42, 0.02, 'bronze', 0.63); // scroll panels
    // the glazed winter garden of the one-storey pavilion (3DBAG front block 0-9.3 m): glass between white mullions, fascia
    slab(b, f, len / 2, 5.88, len - 1.4, 2.42, 0.09, 'frame');
    slab(b, f, len / 2, 5.93, len - 1.6, 2.32, 0.13, 'canopyGlass');
    for (let t = 1.25; t <= len - 0.8; t += 1.2) slab(b, f, t, 5.93, 0.09, 2.32, 0.17, 'frame');
    slab(b, f, len / 2, 8.31, len - 0.2, 0.97, 0.13, 'sandstone');
    slab(b, f, len / 2, 9.2, len - 0.1, 0.16, 0.2, 'stone');

    // ---------- the upper front, set back 4.4 m behind the pavilion (3DBAG wall 10.5-17.6 m). The 2020 crop is rectified on
    // the pavilion plane, 14 m from the camera: heights and widths read there are scaled by (14 + 4.4) / 14 about the camera.
    const B = 4.25, k = 1.31, tc = 9.6; // the 3DBAG upper wall wanders n -4.3..-4.5: draw from its most forward line
    const u: Frame = {origin: [f.origin[0] - f.n[0] * B, f.origin[1] - f.n[1] * B], tangent: f.tangent, n: f.n};
    const T_ = (ta: number) => tc + (ta - tc) * k;
    // first-floor window heads peeping over the pavilion roof
    for (const ta of [2.0, 4.6, 7.0, 9.4, 12.0, 14.6]) { const t = T_(ta); if (t > 0.6 && t < len - 0.9) segBand(b, u, t, 10.55, 1.9, 0.45, 0.14, 0.06, 'stone'); }
    // second floor: five windows under hood moulds
    for (const [ta, wa] of [[2.9, 1.0], [5.35, 1.3], [7.75, 1.3], [9.95, 1.3], [12.6, 1.0]] as [number, number][]) {
      const t = Math.max(T_(ta), 1.75), w = wa * k; // the first clears the tower's jog at t 0.9
      slab(b, u, t, 12.95, w + 0.14, 2.6, 0.08, 'frame');
      slab(b, u, t, 13.02, w, 2.45, 0.12, 'glass');
      slab(b, u, t, 13.02, 0.06, 2.45, 0.16, 'frame');
      slab(b, u, t, 14.75, w, 0.06, 0.16, 'frame');
      segBand(b, u, t, 15.6, w + 0.6, 0.3, 0.16, 0.1, 'stone');
      slab(b, u, t, 12.86, w + 0.35, 0.12, 0.14, 'stone');
    }
    // the central balcony on four brackets
    // r8: spans the three middle windows only (judge: it read over four bays)
    slab(b, u, T_(7.7), 12.55, 6.4 * k, 0.3, 0.9, 'sandstone'); // over the 3DBAG balcony roof (12.7 m)
    for (const ta of [4.7, 6.6, 8.8, 10.7]) slab(b, u, T_(ta), 11.3, 0.35, 1.3, 0.62, 'sandstone');
    for (let t = T_(4.6); t <= T_(10.85); t += 0.25) slab(b, u, t, 12.83, 0.035, 1.0, 0.035, 'bronze', 0.8);
    slab(b, u, T_(7.7), 13.8, 6.3 * k, 0.06, 0.08, 'bronze', 0.77);
    // dentil cornice and the roof rail with finials and the name board
    slab(b, u, len / 2, 16.5, len - 0.6, 0.22, 0.2, 'stone');
    for (let t = 0.5; t <= len - 0.5; t += 0.36) slab(b, u, t, 16.7, 0.16, 0.22, 0.34, 'sandstone');
    slab(b, u, len / 2, 16.9, len - 0.4, 0.22, 0.5, 'sandstone');
    for (let t = 0.6; t <= len - 0.6; t += 0.24) slab(b, u, t, 17.55, 0.03, 0.78, 0.03, 'bronze', 0.05);
    slab(b, u, len / 2, 18.3, len - 1.1, 0.05, 0.05, 'bronze', 0.04);
    for (let t = 0.6; t <= len - 0.6; t += 1.2) slab(b, u, t, 18.28, 0.07, 0.4, 0.07, 'bronze', 0.03);
    slab(b, u, T_(7.75), 17.58, 9.6, 0.9, 0.06, 'sandstone', 0.12);
    letters(b, u, 'CAFE DE KROON', T_(7.75), 17.72, 0.18, 0.095, 0.05, 'bronze', 0.09);
  }

  // ---------- the corner tower's plein face (3DBAG wall (-13.3, 16.8) -> (-7.5, 16.5), t from the west) ----------
  {
    const A = [-13.3, 16.8], B = [-7.5, 16.5], L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const tg: [number, number] = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
    const f: Frame = {origin: [A[0], A[1]], tangent: tg, n: [-tg[1], tg[0]]};
    const at = (t: number, out: number) => [A[0] + tg[0] * t + f.n[0] * out, A[1] + tg[1] * t + f.n[1] * out];
    // round tourelle with a dome on the west corner, from a corbel at 6 m
    const [tx, tz] = at(1.0, 0.55);
    b.add(new T.ConeGeometry(0.85, 1.2, 16, 1, true).rotateX(Math.PI).translate(tx, 5.4, tz), c('sandstone'));
    b.add(new T.CylinderGeometry(0.85, 0.85, 10.4, 16).translate(tx, 6.0 + 5.2, tz), c('sandstone'));
    for (const y of [9.0, 12.4, 16.1]) b.add(new T.CylinderGeometry(0.92, 0.92, 0.18, 16).translate(tx, y, tz), c('stone'));
    b.add(new T.SphereGeometry(0.88, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.5, 1).translate(tx, 16.38, tz), c('slate'));
    b.add(new T.CylinderGeometry(0.04, 0.04, 1.0, 6).translate(tx, 18.3, tz), c('bronze'));
    // slit windows round the tourelle's street side
    for (const y0 of [6.8, 10.0, 13.4]) for (const a of [-0.9, 0, 0.9]) {
      const g = new T.BoxGeometry(0.34, 1.7, 0.1).translate(0, 0.85, 0.83).rotateY(Math.atan2(f.n[0], f.n[1]) + a).translate(tx, y0, tz);
      b.add(g, c('glass'));
    }
    // balustraded balcony across the face, arched windows above, corbel frieze
    slab(b, f, 3.6, 6.5, 4.0, 0.25, 0.9, 'sandstone');
    for (let t = 1.85; t <= 5.45; t += 0.3) slab(b, f, t, 6.73, 0.14, 0.79, 0.14, 'sandstone', 0.68);
    slab(b, f, 3.6, 7.5, 3.9, 0.14, 0.9, 'sandstone');
    for (const [y0, y1] of [[7.85, 10.6], [12.2, 14.8]]) {
      archSlab(b, f, 3.3, y0, 1.75, y1 - y0 + 0.08, 0.08, 'frame');
      archSlab(b, f, 3.3, y0 + 0.05, 1.6, y1 - y0, 0.12, 'glass');
      slab(b, f, 3.3, y0 + 0.05, 0.06, y1 - y0 - 0.8, 0.16, 'frame');
      archBand(b, f, 3.3, y1 - 0.79, 2.15, 1.07, 0.18, 0.05, 'stone');
    }
    for (let t = 2.0; t <= 5.6; t += 0.4) archBand(b, f, t, 15.4, 0.4, 0.2, 0.06, 0.12, 'stone', 0, 4);
    slab(b, f, 3.7, 15.62, 4.0, 0.15, 0.2, 'stone');
    for (const t of [2.8, 3.8]) {
      slab(b, f, t, 17.1, 0.72, 1.5, 0.08, 'frame');
      slab(b, f, t, 17.15, 0.6, 1.4, 0.12, 'glass');
    }
    // curved crest over the tower face (2019/2020 panoramas: concave shoulders into a round head, a little over the name
    // board), standing on the compressed face top (~20.1 m), with a stone coping course and a finial
    slab(b, f, 3.4, 19.9, 3.9, 0.22, 0.3, 'stone', -0.05);
    gableWall(b, f, bellCrestOutline({axis: 3.4, half: 1.8, neckHalf: 0.75, footY: 20.05, shoulderY: 21.0, neckTopY: 21.3}), 0.4, c('sandstone'), 0.06);
    slab(b, f, 3.4, 22.0, 0.14, 0.7, 0.16, 'bronze', -0.05);
    // the first-floor entrance: arched door under a dark name board
    archSlab(b, f, 3.5, 0.0, 1.5, 2.9, 0.08, 'stone');
    archSlab(b, f, 3.5, 0.05, 1.25, 2.75, 0.12, 'dark');
    slab(b, f, 3.5, 3.1, 1.5, 1.4, 0.1, 'bronze');
  }

  // ---------- Amstel front (ring edge 9; w04-354 crop, 50 px/m): five bays on a 1.91 m pitch about t 5.5 ----------
  {
    const {f, len} = amstel;
    const ax = 5.5, bays = [-2, -1, 0, 1, 2].map(k => ax + k * 1.91);
    // two-storey stone base: five round-arched windows (transom at 3.4 m) under a plain band 6.1-7.1 m
    slab(b, f, len / 2, 0, len - 0.2, 7.1, 0.06, 'stone');
    slab(b, f, len / 2, 6.1, len - 0.1, 1.0, 0.12, 'stone');
    for (const t of bays) {
      archSlab(b, f, t, 0.1, 1.05, 5.8, 0.1, 'frame');
      archSlab(b, f, t, 0.15, 0.92, 5.65, 0.14, 'glass');
      slab(b, f, t, 3.4, 0.92, 0.08, 0.18, 'frame');
      // two brick storeys: segment-headed windows under bicolour heads, dark sills
      for (const [y0, y1] of [[7.25, 9.5], [10.7, 12.9]]) {
        slab(b, f, t, y0, 1.12, y1 - y0, 0.08, 'frame');
        slab(b, f, t, y0 + 0.05, 0.98, y1 - y0 - 0.1, 0.12, 'glass');
        slab(b, f, t, y0 - 0.14, 1.3, 0.12, 0.14, 'stone');
        segBand(b, f, t, y1 + 0.02, 1.5, 0.18, 0.26, 0.1, 'stone');
      }
    }
    // tiled frieze under the eaves line, the symmetric pointed topgevel with its copings, foot pinnacles and finial,
    // the three-light gable window, and the corner pinnacles
    slab(b, f, len / 2, AM_EAVES - 0.4, len - 0.1, 0.45, 0.16, 'stone');
    pointedGable(b, f, {axis: ax, half: 2.7, footY: AM_EAVES, apexY: 18.1}, {wall: c('brick'), coping: c('stone'), thick: 0.45, out: 0.05});
    // the gable window sits in the gable wall: no sink (it would reach through the roof slope behind), staggered backs
    const sk = getSink();
    setSink(0);
    slab(b, f, ax, 14.55, 2.7, 1.55, 0.13, 'stone', 0);
    for (const dt of [-0.85, 0, 0.85]) {
      slab(b, f, ax + dt, 14.62, 0.72, 1.35, 0.22, 'frame', -0.05);
      slab(b, f, ax + dt, 14.67, 0.6, 1.25, 0.31, 'glass', -0.1);
    }
    setSink(sk, true);
    for (const t of [0.35, len - 0.35]) pinnacle(b, f, t, AM_EAVES - 0.3, 1.4, 0.4, c('brick'), c('stone'), 0.04);
  }
  setSink(sink0);
}
