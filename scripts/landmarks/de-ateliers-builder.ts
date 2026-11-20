import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archSlab, letters, poly, ringFrame, setSink, getSink, slab, type Frame} from './nearbar-kit';
import source from './de-ateliers-footprints.json';

/**
 * DE ATELIERS, Stadhouderskade 86 (BAG pand 0363100012119240, BAG year 1883): the former Quellinusschool, a two-storey
 * brick school of tall bays on the Singelgracht. Massing: the 3DBAG LoD2.2 shell (de-ateliers-footprints.json,
 * bag-shell-prepare.ts).
 *
 * Read from rectified Gemeente Amsterdam panoramas (CC BY 4.0, 50 px/m): w10-6 recording_2024-09-04_05-35-54_03349
 * (2024) for the bay; w09/w11/w12/w13 for the other bays, the corner pavilions and the entrance; w02-275
 * TMX7316010203-001674_pano_0000_003199 (2020) and w03-98 TMX7316010203-001674_pano_0000_003222 (2020) for the sides.
 *  - Six 6.8 m bays on the Stadhouderskade (ring edges 14, 18, 24, 40, 44, 48) between projecting brick pilasters (the
 *    1.2 m edges). Each bay has a grey stone plinth (0-1.1 m) and brick to a stone band at 2.7 m. Above that are a wide
 *    white-framed ground window (2.8 x 3.6 m, three lights and a transom) and a recessed brick panel each side. Next
 *    comes a grey stone entablature at 6.5-7.6 m with small consoles. The upper storey has one tall segment-headed window
 *    (2.8 x 4.2 m) in a white surround with a relief apron and a scrolled hood. The bay ends in a white frieze of
 *    garlands between consoles (14.9-15.9 m) and a white cornice under the 17 m wall top.
 *  - The centre: two pavilions with tall brick piers flank the entrance range (dark modern glazing, the "de ateliers"
 *    sign) and carry white-framed upper windows.
 *  - The side wings (edges 29 and 35): round-headed white-framed upper windows over plain ground windows, with the same
 *    frieze and cornice.
 * Colours are judged from the sunlit 2025 crops (w11, w12); the overcast crops read grey.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};

export function buildDeAteliers(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as Src;
  const ring = src.facadeRing;
  addShell(b, src as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.05, true);

  /** The frieze of garlands between consoles and the cornice, over [a, z] on frame f; `top` is the wall top. */
  const crown = (f: Frame, a: number, z: number, top: number, consoles: number[]) => {
    const mid = (a + z) / 2, W = z - a, c0 = top - 0.95, f0 = c0 - 1.0;
    slab(b, f, mid, f0 - 0.2, W, 0.2, 0.1, 'sandstone');
    slab(b, f, mid, f0, W, 1.0, 0.05, 'stone');
    for (const t of consoles) if (t > a + 0.15 && t < z - 0.15) slab(b, f, t, f0, 0.3, 1.0, 0.2, 'sandstone');
    // garlands: a hanging swag between each pair of consoles
    const cs = [a, ...consoles.filter(t => t > a + 0.15 && t < z - 0.15), z];
    for (let i = 0; i < cs.length - 1; i++) {
      const p = cs[i] + 0.2, q = cs[i + 1] - 0.2;
      if (q - p < 0.5) continue;
      swag(b, f, (p + q) / 2, f0 + 0.85, q - p, 0.45, 0.12);
    }
    slab(b, f, mid, c0, W, 0.25, 0.25, 'sandstone');
    slab(b, f, mid, c0 + 0.25, W - 0.06, 0.6, 0.55, 'sandstone'); // ends 8 cm short of the joints
  };
  /** A white-framed window with glazing bars: frame 5 cm, glass 10 cm, bars 15 cm. */
  const win = (f: Frame, t: number, y0: number, y1: number, w: number, cols: number, rows: number[], out = 0, frame = 'white') => {
    slab(b, f, t, y0 - 0.1, w + 0.24, y1 - y0 + 0.2, 0.05, frame, out);
    slab(b, f, t, y0, w, y1 - y0, 0.1, 'glass', out);
    for (let i = 1; i < cols; i++) slab(b, f, t - w / 2 + (i * w) / cols, y0, 0.07, y1 - y0, 0.15, 'sandstone', out);
    for (const y of rows) slab(b, f, t, y, w, 0.07, 0.15, 'sandstone', out);
  };

  // ================= the six bays on the Stadhouderskade =================
  const BAYS = [14, 18, 24, 40, 44, 48];
  const TOPS: Record<number, number> = {14: 17.0, 18: 17.0, 24: 16.8, 40: 16.85, 44: 17.0, 48: 16.95};
  for (const e of BAYS) {
    const {f, len} = ringFrame(ring, e);
    const c = len / 2, top = TOPS[e];
    slab(b, f, c, 0, len - 0.1, 1.1, 0.08, 'stone');
    slab(b, f, c, 2.6, len - 0.1, 0.18, 0.08, 'stone');
    win(f, c, 2.9, 6.3, 2.8, 3, [4.75]);
    for (const s of [-1, 1]) slab(b, f, c + s * 2.55, 3.3, 1.05, 2.9, 0.05, 'red');
    // the grey stone entablature with consoles at the window sides
    slab(b, f, c, 6.5, len - 0.1, 1.1, 0.15, 'stone');
    for (const s of [-1, 1]) slab(b, f, c + s * 1.65, 6.15, 0.3, 0.45, 0.22, 'stone');
    // upper storey: relief apron, segment-headed window in a white surround, scrolled hood; a stone sill band
    slab(b, f, c, 8.62, len - 0.1, 0.12, 0.06, 'stone');
    slab(b, f, c, 7.6, 3.7, 1.1, 0.1, 'sandstone');
    for (const s of [-1, 0, 1]) slab(b, f, c + s * 1.05, 7.75, s === 0 ? 0.9 : 0.5, 0.8, 0.06, 'white', 0.1);
    slab(b, f, c, 8.76, 3.7, 4.54, 0.05, 'white');
    archSlab(b, f, c, 8.8, 2.8, 4.25, 0.1, 'glass', 0, 10);
    for (const s of [-1, 1]) slab(b, f, c + s * 0.47, 8.8, 0.07, 3.55, 0.15, 'sandstone');
    for (const y of [10.2, 11.6]) slab(b, f, c, y, 2.8, 0.07, 0.15, 'sandstone');
    slab(b, f, c, 13.3, 4.0, 0.3, 0.2, 'sandstone');
    for (const s of [-1, 1]) slab(b, f, c + s * 1.75, 13.3, 0.35, 0.7, 0.24, 'sandstone');
    for (const s of [-1, 1]) slab(b, f, c + s * 2.55, 9.0, 1.05, 4.0, 0.05, 'red');
    crown(f, 0.05, len - 0.05, top, [c - 1.75, c, c + 1.75]);
  }
  // ================= the pilasters between the bays (the 1.2 m edges) =================
  for (const e of [16, 22, 26, 38, 42, 46]) {
    const {f, len} = ringFrame(ring, e);
    const c = len / 2, top = e === 26 ? 17.8 : 16.85;
    slab(b, f, c, 0, len - 0.1, 1.2, 0.08, 'stone');
    slab(b, f, c, 6.5, len - 0.1, 1.1, 0.15, 'stone');
    slab(b, f, c, 3.2, 0.7, 3.0, 0.05, 'red');
    slab(b, f, c, 8.6, 0.7, 5.6, 0.05, 'red');
    crown(f, 0.05, len - 0.05, top, [c]);
  }

  // ================= the centre: two pavilions and the entrance range =================
  {
    // pavilion fronts (west edges 4/6, east edges 56/58) and the low centre (edges 2, 60, 62)
    const PAV: [number, number][] = [[6, 17.6], [4, 16.4], [56, 17.4], [58, 16.3]];
    for (const [e, top] of PAV) {
      const {f, len} = ringFrame(ring, e);
      const c = len / 2;
      slab(b, f, c, 0, len - 0.1, 1.1, 0.08, 'stone');
      slab(b, f, c, 6.5, len - 0.1, 1.1, 0.15, 'stone');
      win(f, c, 7.95, Math.min(top - 2.3, 13.6), Math.min(1.0, len - 0.4), 2, [10.4], 0, 'sandstone'); // short shell pieces host no frame: painted surround
      crown(f, 0.05, len - 0.05, top, []);
    }
    // the entrance range: dark modern glazing between brick piers, the sign over the west door
    for (const e of [2, 60, 62]) {
      const {f, len} = ringFrame(ring, e);
      if (len < 0.7) continue;
      const c = len / 2;
      slab(b, f, c, 0, len - 0.1, 0.5, 0.08, 'stone');
      slab(b, f, c, 0.5, len - 0.3, 5.6, 0.05, 'bronze');
      slab(b, f, c, 0.6, len - 0.5, 2.4, 0.1, 'glass');
      slab(b, f, c, 3.8, len - 0.5, 2.1, 0.1, 'glass');
      slab(b, f, c, 6.5, len - 0.1, 1.1, 0.15, 'stone');
      win(f, c, 7.95, 13.4, Math.min(1.6, len - 0.5), 2, [10.4], 0, 'sandstone');
      crown(f, 0.05, len - 0.05, 16.4, []);
    }
    {
      const {f, len} = ringFrame(ring, 2);
      letters(b, f, 'DE ATELIERS', len / 2, 3.15, 0.05, 0.035, 0.03, 'gold');
    }
    // the pavilion piers' sides (edges 9 and 53): stone base and the entablature return
    for (const e of [9, 53]) {
      const {f, len} = ringFrame(ring, e);
      slab(b, f, len / 2, 0, len - 0.1, 1.1, 0.08, 'stone');
      slab(b, f, len / 2, 6.5, len - 0.1, 1.1, 0.15, 'stone');
      crown(f, 0.05, len - 0.05, 17.4, []);
    }
    // the ball finials on the pavilion corners (w11, w12)
    for (const p of [[-5.85, -4.85], [4.9, -3.85]] as [number, number][]) {
      b.add(new T.CylinderGeometry(0.3, 0.38, 0.5, 12).translate(p[0], 17.85, p[1] + 0.25), 'sandstone' as never);
      b.add(new T.SphereGeometry(0.42, 14, 10).translate(p[0], 18.5, p[1] + 0.25), 'sandstone' as never);
    }
  }

  // ================= the side wings (edges 29 west and 35 east) =================
  for (const [e, top] of [[29, 16.05], [35, 16.35]] as [number, number][]) {
    const {f, len} = ringFrame(ring, e);
    slab(b, f, len / 2, 0, len - 0.1, 1.1, 0.08, 'stone');
    slab(b, f, len / 2, 6.5, len - 0.1, 0.9, 0.15, 'stone');
    const n = Math.round((len - 2) / 3.9), p = (len - 2) / n;
    for (let i = 0; i < n; i++) {
      const t = 1 + p * (i + 0.5);
      win(f, t, 2.9, 6.1, 1.7, 2, [4.7]);
      slab(b, f, t, 7.9, 2.3, 5.4, 0.05, 'white');
      archSlab(b, f, t, 8.1, 1.7, 5.0, 0.1, 'glass', 0, 8);
      slab(b, f, t, 8.1, 0.07, 4.1, 0.15, 'sandstone');
      slab(b, f, t, 10.6, 1.7, 0.07, 0.15, 'sandstone');
    }
    crown(f, 0.05, len - 0.05, top, Array.from({length: n + 1}, (_, i) => 1 + p * i));
  }
  setSink(sink0);
}

/** A hanging garland: a crescent whose top edge is at y, sagging `sag` at its middle, `th` thick. */
function swag(b: BuildingTools, f: Frame, t: number, y: number, w: number, sag: number, th: number) {
  const pts: [number, number][] = [];
  const n = 8;
  for (let i = 0; i <= n; i++) { const x = -w / 2 + (w * i) / n, s = Math.sin((Math.PI * i) / n); pts.push([x, -sag * s]); }
  for (let i = n; i >= 0; i--) { const x = -w / 2 + (w * i) / n, s = Math.sin((Math.PI * i) / n); pts.push([x, -sag * s + th + 0.06 * (1 - s)]); }
  poly(b, f, t, y, pts, 0.1, 'sandstone', 0.04);
}
