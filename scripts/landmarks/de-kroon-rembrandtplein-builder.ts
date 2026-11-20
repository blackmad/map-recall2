import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, getSink, letters, ringFrame, segBand, setSink, slab, type Frame} from './nearbar-kit';
import source from './de-kroon-rembrandtplein-footprints.json';

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
type C = Parameters<BuildingTools['add']>[1];
const c = (s: string) => s as unknown as C;

export function buildDeKroonRembrandtplein(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as Src;
  const ring = src.facadeRing;
  // white on the plein block and the tower (z > 10 m, south of the inner court), brick behind; the tower top is slate
  const plein = (s: Surface) => s.rings[0].every(p => p[2] > 10);
  addShell(b, src as never, {
    wall: 'brick', roof: 'concrete',
    wallFor: s => (plein(s) ? 'sandstone' : 'brick'),
    roofFor: s => (plein(s) && s.rings[0].some(p => p[1] > 22.4) ? 'slate' : 'concrete'),
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
    slab(b, u, T_(7.7), 12.55, 7.6 * k, 0.3, 0.9, 'sandstone'); // over the 3DBAG balcony roof (12.7 m)
    for (const ta of [4.1, 6.4, 9.0, 11.3]) slab(b, u, T_(ta), 11.3, 0.35, 1.3, 0.62, 'sandstone');
    for (let t = T_(4.0); t <= T_(11.45); t += 0.25) slab(b, u, t, 12.83, 0.035, 1.0, 0.035, 'bronze', 0.8);
    slab(b, u, T_(7.7), 13.8, 7.5 * k, 0.06, 0.08, 'bronze', 0.77);
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
    // stepped crest over the tower face (simplified: two white steps and a finial in front of the slate top)
    slab(b, f, 3.3, 21.2, 3.4, 1.25, 0.35, 'sandstone', -0.1);
    slab(b, f, 3.3, 22.4, 1.8, 0.9, 0.3, 'sandstone', -0.1);
    slab(b, f, 3.3, 21.15, 3.6, 0.14, 0.42, 'stone', -0.1);
    slab(b, f, 3.3, 23.28, 0.25, 0.8, 0.25, 'stone', -0.05);
    // the first-floor entrance: arched door under a dark name board
    archSlab(b, f, 3.5, 0.0, 1.5, 2.9, 0.08, 'stone');
    archSlab(b, f, 3.5, 0.05, 1.25, 2.75, 0.12, 'dark');
    slab(b, f, 3.5, 3.1, 1.5, 1.4, 0.1, 'bronze');
  }

  // ---------- Amstel front (ring edge 9) ----------
  {
    const {f, len} = ringFrame(ring, 9);
    slab(b, f, len / 2, 0, len - 0.2, 7.6, 0.06, 'stone');
    for (let k = 0; k < 4; k++) {
      const t = (len * (k + 0.5)) / 4;
      archSlab(b, f, t, 0.3, 1.25, 6.7, 0.1, 'frame');
      archSlab(b, f, t, 0.35, 1.1, 6.55, 0.14, 'glass');
      slab(b, f, t, 3.4, 1.1, 0.08, 0.18, 'frame');
      for (const y of k === 0 || k === 3 ? [8.6, 11.3] : [8.6, 11.3, 13.7]) {
        slab(b, f, t, y, 1.15, 1.6, 0.08, 'frame');
        slab(b, f, t, y + 0.05, 1.0, 1.5, 0.12, 'glass');
        slab(b, f, t, y - 0.14, 1.35, 0.1, 0.14, 'stone');
      }
    }
  }
  setSink(sink0);
}
