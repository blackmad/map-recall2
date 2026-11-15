import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {letters, poly, ringFrame, segBand, setSink, getSink, slab, type Frame} from './nearbar-kit';
import source from './reinwardt-academie-footprints.json';

/**
 * REINWARDT ACADEMIE, Hortusplantsoen 2 (BAG pand 0363100012181859): the double school designed in 1897 on the former
 * St. Antonies churchyard (municipal monument 202056), now the museology academy, with its brick stair tower and the red
 * pavilion of the later extension. Massing: the 3DBAG LoD2.2 shell (reinwardt-academie-footprints.json, bag-shell-prepare.ts).
 * Details from rectified Gemeente Amsterdam panoramas (CC BY 4.0) at 49.8 px/m, per wall in reinwardt-academie-inventory.json:
 *  - main front (ring edge 6, 13.3 m, TMX7316010203-002542_pano_0000_000144): four bays of large white multi-pane windows on
 *    three floors (segmental heads on the ground and top floors), herringbone spandrel panels, stone courses, brick pilaster
 *    strips, a bracketed timber eave and two small pointed dormers;
 *  - the west wing (ring edge 8, 7.1 m, TMX7316010203-002544_pano_0000_002779): two arched ground-floor windows, wide
 *    five-light windows on the upper floors and a big cream timber gable with a herringbone tympanum and a small window;
 *  - the stair tower (ring edge 13, recording_2025-06-19_03-28-47_02976): small windows, two lanterns and the
 *    REINWARDT ACADEMIE letters; the red pavilion with its window band (edges 17 and 22).
 */
export function buildReinwardtAcademie(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as {facadeRing: number[][]; surfaces: Surface[]; nativeRing: number[][]};
  const ring = src.facadeRing;
  const cen = (s: Surface) => { const r = s.rings[0]; return [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[2], 0) / r.length, Math.max(...r.map(p => p[1]))]; };
  addShell(b, src as never, {
    wall: 'brick', roof: 'slate',
    wallFor: s => { const [x, z, top] = cen(s); if (top < 6.7 && x < 3 && z > -3) return 'red'; if (z > 11.5 && x > 7.5) return 'concrete'; return 'brick'; },
    roofFor: s => { const [x, z] = cen(s); return z > 11.5 && x > 7.5 ? 'concrete' : 'slate'; },
  });
  const sink0 = getSink();
  setSink(0.05);
  // layers 4 cm apart: courses/panels 0.05, frames 0.09, glass 0.13, glazing bars 0.17
  /** Large school window: white frame, glass, mullions every `light` metres, transom, extra bars in the upper lights. */
  const win = (f: Frame, t: number, y0: number, y1: number, w: number, lights = 2, seg = false) => {
    slab(b, f, t, y0 - 0.04, w + 0.12, y1 - y0 + 0.08, 0.09, 'white');
    slab(b, f, t, y0, w - 0.06, y1 - y0, 0.13, 'glass');
    for (let k = 1; k < lights; k++) slab(b, f, t - w / 2 + (w * k) / lights, y0, 0.08, y1 - y0, 0.17, 'white');
    const tr = y0 + (y1 - y0) * 0.58;
    slab(b, f, t, tr, w - 0.06, 0.08, 0.17, 'white');
    for (let k = 0; k < lights; k++) {
      const c = t - w / 2 + (w * (k + 0.5)) / lights;
      slab(b, f, c, y0, 0.035, tr - y0, 0.17, 'white');
      slab(b, f, c, (tr + y1) / 2, w / lights - 0.08, 0.035, 0.17, 'white');
      slab(b, f, c, (y0 + tr) / 2, w / lights - 0.08, 0.035, 0.17, 'white');
    }
    slab(b, f, t, y0 - 0.16, w + 0.25, 0.12, 0.12, 'stone');
    if (seg) segBand(b, f, t, y1 + 0.02, w + 0.3, 0.22, 0.24, 0.05, 'greyBrick');
  };
  /** Stone courses common to the school fronts. */
  const courses = (f: Frame, len: number) => {
    const c = len / 2, w = len - 0.1;
    slab(b, f, c, 2.15, w, 0.2, 0.1, 'stone');
    slab(b, f, c, 6.3, w, 0.18, 0.08, 'stone');
    slab(b, f, c, 10.85, w, 0.12, 0.06, 'stone');
  };

  // ---------- east steps of the school front (ring edges 0, 2, 4): courses only ----------
  for (const i of [0, 2, 4]) { const {f, len} = ringFrame(ring, i); courses(f, len); }

  // ---------- main front (ring edge 6) ----------
  {
    const {f, len} = ringFrame(ring, 6);
    courses(f, len);
    // pilaster strips, broken by the stone courses (a strip crossing a course sits within 2 cm of its face)
    for (const t of [0.6, 3.8, 6.5, 9.2, 11.9]) for (const [y0, y1] of [[2.35, 6.3], [6.48, 10.85], [10.97, 14.65]]) slab(b, f, t, y0, 0.6, y1 - y0, 0.07, 'brick');
    for (const t of [2.2, 5.15, 7.85, 10.55]) {
      win(f, t, 2.45, 5.25, 2.0, 2, true);
      win(f, t, 6.6, 9.4, 2.0, 2);
      slab(b, f, t, 9.5, 2.0, 1.25, 0.05, 'ochre');
      win(f, t, 10.95, 14.0, 2.0, 2, true);
    }
    // bracketed timber eave
    slab(b, f, len / 2, 15.9, len + 0.2, 0.45, 0.85, 'concrete', -0.05);
    for (let t = 0.5; t < len; t += 0.93) slab(b, f, t, 14.75, 0.14, 1.15, 0.6, 'concrete');
    // two small pointed dormers in the roof
    for (const t of [3.8, 9.2]) {
      slab(b, f, t, 15.9, 1.1, 1.7, 0.7, 'concrete', -1.3);
      poly(b, f, t, 17.55, [[-0.62, 0], [0.62, 0], [0, 0.9]], 0.75, 'concrete', -1.32);
      slab(b, f, t, 16.45, 0.6, 0.85, 0.09, 'glass', -0.6);
    }
  }

  // ---------- west wing with the timber gable (ring edge 8) ----------
  {
    const {f, len} = ringFrame(ring, 8);
    const c = len / 2;
    courses(f, len);
    for (const t of [c - 1.3, c + 1.3]) win(f, t, 2.45, 5.25, 2.0, 2, true);
    win(f, c, 6.6, 9.7, 4.6, 5);
    slab(b, f, c, 9.8, 4.6, 1.0, 0.05, 'ochre');
    win(f, c, 11.0, 14.1, 4.6, 5);
    // herringbone tympanum with a small window, under the cream bargeboards
    poly(b, f, c, 14.95, [[-2.6, 0], [2.6, 0], [2.6, 0.8], [1.8, 1.9], [0.9, 2.4], [0, 2.6], [-0.9, 2.4], [-1.8, 1.9], [-2.6, 0.8]], 0.05, 'ochre');
    win(f, c, 15.6, 16.7, 0.9, 2);
    const half = len / 2 + 0.3, rise = 4.9, th = 0.38;
    poly(b, f, c, 14.9, [[-half, 0], [-half + 0.3, 0], [0, rise - th], [half - 0.3, 0], [half, 0], [0, rise]], 0.55, 'concrete', 0.1);
    slab(b, f, c, 14.75, len + 0.4, 0.25, 0.75, 'concrete', -0.05);
    for (const s of [-1, 1]) slab(b, f, c + s * (len / 2 - 0.25), 13.6, 0.18, 1.2, 0.6, 'concrete');
  }

  // ---------- stair tower (ring edge 13): small windows, lanterns, lettering ----------
  {
    const {f, len} = ringFrame(ring, 13);
    for (const y of [1.6, 8.6, 13.6]) for (const k of [-1, 0, 1]) {
      const t = len / 2 + k * 1.15;
      slab(b, f, t, y - 0.04, 0.68, 0.68, 0.09, 'white');
      slab(b, f, t, y, 0.56, 0.6, 0.13, 'glass');
      slab(b, f, t, y + 0.62, 0.8, 0.12, 0.06, 'stone');
    }
    letters(b, f, 'REINWARDT', len / 2 - 0.95, 4.7, 0.0, 0.034, 0.04, 'concrete', 0.04);
    letters(b, f, 'ACADEMIE', len / 2 + 0.95, 4.7, 0.0, 0.034, 0.04, 'concrete', 0.04);
    for (const t of [0.5, len / 2]) {
      slab(b, f, t, 6.9, 0.08, 0.08, 0.5, 'bronze');
      slab(b, f, t, 6.55, 0.26, 0.42, 0.26, 'bronze', 0.42);
    }
  }

  // ---------- red pavilion: window band on its two street walls (ring edges 17, 22) ----------
  // edge 17 is 6.1 m tall, edge 22 only 3.9 m (both 3DBAG walls stand on the BAG ring)
  for (const [i, y0, y1] of [[17, 1.75, 4.45], [22, 0.95, 3.2]] as [number, number, number][]) {
    const {f, len} = ringFrame(ring, i);
    slab(b, f, len / 2, 0, len - 0.1, Math.min(0.9, y0 - 0.15), 0.08, 'concrete');
    const n = Math.max(2, Math.round(len / 0.9));
    slab(b, f, len / 2, y0 - 0.05, len - 0.4, y1 - y0 + 0.1, 0.09, 'white');
    slab(b, f, len / 2, y0, len - 0.5, y1 - y0, 0.13, 'glass');
    for (let k = 0; k <= n; k++) slab(b, f, 0.25 + ((len - 0.5) * k) / n, y0, 0.07, y1 - y0, 0.17, 'white');
    slab(b, f, len / 2, y0 + (y1 - y0) * 0.52, len - 0.5, 0.07, 0.17, 'white');
  }
  setSink(sink0);
}
