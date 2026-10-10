import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, planarPolygon} from './worship-shell';
import {wallsOf} from './worship-walls';
import type {Wall} from './worship-walls';
import {awning, frameOf, put, setSink, slab} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import source from './krasnapolsky-footprints.json';

/**
 * Grand Hotel Krasnapolsky (Dam 9-15), BAG pand 0363100012165293: one 3DBAG shell for the whole hotel block (about 130 m across). Only the
 * Dam front is detailed; Warmoesstraat, Pijlsteeg, Sint Jansstraat and the courtyard walls stay plain shell (inferred, no photographs).
 * The Dam front is a gently curved chain of 3DBAG walls facing about 310 degrees (north-west), from the north-east end to the south-west end:
 *  - walls 36, 27, 30, 361, 32, 33, 259, 39, 194 (about 62 m): the modern stone-clad wing of the hotel: glazed ground floor, regular stone
 *    storeys with paired windows, cornice at 20.4 m and set-back glazed attic levels (3DBAG walls above 20 m are drawn as glass).
 *    The window rhythm of this wing comes from oblique and partly screened photographs and is approximate;
 *  - walls 63, 68, 64, 72 (about 13 m): a lower brick building with a glazed ground floor;
 *  - walls 73 and 74 (25 m): the old Krasnapolsky front, measured from the 2025 panorama taken from the Dam (recording_2025-07-03_03-29-47_02598):
 *    café ground floor under dark awnings with basement vents, a stone first floor with three big balcony windows and the entrance under a
 *    dark canopy flanked by two lantern turrets, two brick storeys between stone string courses (three double windows, a group of three narrow
 *    windows over the entrance and an end window), a frieze of ornament panels, a top storey of balcony windows and the cornice.
 * t runs along each wall to the viewer's right (towards the south-west).
 */
const GLASS_FROM = 20.2;
export function buildKrasnapolsky(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  setSink(0.1);
  const high = (s: {type: string; rings: number[][][]}) => s.type === 'WallSurface' && Math.min(...s.rings[0].map(p => p[1])) >= GLASS_FROM && Math.max(...s.rings[0].map(p => p[1])) - Math.min(...s.rings[0].map(p => p[1])) >= 1.5;
  addShell(b, source as never, {wall: 'stone', roof: 'slate', skip: s => high(s)});
  for (const s of source.surfaces as never as {type: string; rings: number[][][]}[]) {
    if (!high(s)) continue;
    const g = planarPolygon(s.rings);
    if (g) b.add(g, 'glass' as never);
  }
  b.mark?.('shell');
  const walls = new Map(wallsOf(source as never).map(w => [w.index, w]));
  const W = (i: number): Wall => walls.get(i)!;

  /** Sash window with optional stone surround. */
  const sash = (f: Frame, t: number, y: number, wd: number, h: number, cols: number, rows: number, surround = 0.18, col = 'white') => {
    if (surround > 0) {
      for (const s of [-1, 1]) slab(b, f, t + s * (wd / 2 + surround / 2), y - 0.1, surround, h + 0.3, 0.1, 'stone');
      slab(b, f, t, y + h, wd + 2 * surround, 0.2, 0.14, 'stone');
      slab(b, f, t, y - 0.16, wd + 2 * surround + 0.1, 0.12, 0.2, 'stone');
    }
    slab(b, f, t, y, wd, h, 0.08, 'glass');
    for (let k = 1; k < cols; k++) slab(b, f, t - wd / 2 + wd * k / cols, y, 0.05, h, 0.12, col);
    for (let r = 1; r < rows; r++) slab(b, f, t, y + h * r / rows - 0.02, wd, 0.05, 0.12, col);
    slab(b, f, t, y + h - 0.03, wd + 0.04, 0.05, 0.12, col);
  };
  const balcony = (f: Frame, t0: number, t1: number, y: number) => {
    const w = t1 - t0, c = (t0 + t1) / 2;
    slab(b, f, c, y, w, 0.18, 0.75, 'stone');
    slab(b, f, c, y + 0.95, w, 0.07, 0.72, 'dark', 0.0);
    slab(b, f, c, y + 0.18, w, 0.07, 0.66, 'dark');
    for (let t = t0 + 0.12; t < t1 - 0.05; t += 0.22) slab(b, f, t, y + 0.18, 0.04, 0.8, 0.05, 'dark', 0.66);
    slab(b, f, c, y + 0.95, w, 0.07, 0.07, 'dark', 0.66);
    for (const s of [t0 + 0.05, t1 - 0.05]) slab(b, f, s, y + 0.18, 0.08, 0.85, 0.72, 'dark');
  };

  // ============ the old front: walls 73 (20.3 m) and 74 (4.7 m) ============
  const oldBay = (f: Frame, t: number, wd: number, opts: {cafe?: boolean} = {}) => {
    // basement vents under the bay
    for (const dt of [-1.0, 0, 1.0]) slab(b, f, t + dt, 0.2, 0.8, 0.45, 0.1, 'dark');
    if (opts.cafe !== false) {
      // café window under a dark awning
      slab(b, f, t, 1.15, wd - 0.2, 1.85, 0.12, 'glass');
      slab(b, f, t, 1.0, wd, 0.16, 0.14, 'sandstone');
      slab(b, f, t, 1.0, 0.05, 2.0, 0.18, 'frame');
      awning(b, f, t, 3.0, wd, 2.0, 0.7, 'dark');
    }
  };
  {
    const w = W(73), f = frameOf(w), L = w.length;
    // brick cladding above the stone storeys, with stone ground and first floor left as the shell
    slab(b, f, L / 2, 11.2, L, 9.2, 0.05, 'brick');
    // stone quoin/pier strips at the ends of the brick part
    // string courses
    slab(b, f, L / 2, 10.9, L, 0.4, 0.28, 'white');
    slab(b, f, L / 2, 17.8, L, 0.3, 0.3, 'white');
    slab(b, f, L / 2, 5.2, L, 0.2, 0.16, 'white');
    slab(b, f, L / 2, 0, L, 0.35, 0.14, 'sandstone');
    const big = [1.9, 7.0, 12.0];
    for (const t of big) {
      oldBay(f, t, 3.3);
      sash(f, t, 6.9, 2.9, 2.7, 3, 3);
      balcony(f, t - 1.8, t + 1.8, 6.3);
      sash(f, t, 11.5, 2.9, 2.5, 3, 3);
      slab(b, f, t, 14.2, 2.9, 0.55, 0.12, 'stone');
      for (const dt of [-0.9, 0.9]) put(b, f, new T.CylinderGeometry(0.17, 0.17, 0.08, 10).rotateX(Math.PI / 2), t + dt, 14.5, 0.12, 'white');
      sash(f, t, 15.2, 2.9, 2.2, 3, 2);
      sash(f, t, 18.4, 3.2, 1.8, 3, 2, 0.15);
      balcony(f, t - 1.9, t + 1.9, 17.55);
    }
    // entrance bay: canopy, lantern turrets, first-floor windows over the entrance, group of three narrow windows
    slab(b, f, 17.4, 0, 5.6, 3.3, 0.1, 'dark');
    slab(b, f, 17.4, 0.1, 4.8, 2.9, 0.16, 'glass');
    awning(b, f, 17.4, 3.2, 7.0, 1.3, 2.1, 'dark');
    for (const t of [15.1, 19.9]) {
      slab(b, f, t, 5.4, 1.3, 2.2, 0.35, 'stone');
      put(b, f, new T.CylinderGeometry(0.55, 0.62, 1.5, 10).translate(0, 0.75, 0), t, 7.0, 0.25, 'dark');
      put(b, f, new T.SphereGeometry(0.58, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.5, 0), t, 7.0, 0.25, 'dark');
    }
    balcony(f, 15.7, 20.9, 6.3);
    for (const t of [16.7, 18.9]) sash(f, t, 6.9, 1.4, 2.7, 2, 3, 0.14);
    for (const [y, h] of [[11.5, 2.5], [15.2, 2.2]] as [number, number][]) for (const t of [16.3, 17.7, 19.1]) sash(f, t, y, 0.9, h, 1, 3, 0.1);
    for (const t of [16.3, 17.7, 19.1]) slab(b, f, t, 18.4, 0.9, 1.8, 0.1, 'glass');
    slab(b, f, 17.7, 14.2, 3.9, 0.55, 0.12, 'stone');
    slab(b, f, L / 2, 20.4, L + 0.4, 0.5, 0.5, 'white');
    slab(b, f, L / 2, 20.9, L + 0.2, 0.18, 0.62, 'stone');
    // café windows flanking the entrance on this wall
    slab(b, f, 19.3 + 0.9, 1.15, 1.1, 1.85, 0.1, 'glass');
  }
  {
    const w = W(74), f = frameOf(w), L = w.length;
    slab(b, f, L / 2, 11.2, L, 9.2, 0.05, 'brick');
    slab(b, f, L / 2, 10.9, L, 0.4, 0.28, 'white');
    slab(b, f, L / 2, 17.8, L, 0.3, 0.3, 'white');
    slab(b, f, L / 2, 5.2, L, 0.2, 0.16, 'white');
    slab(b, f, L / 2, 0, L, 0.35, 0.14, 'sandstone');
    const t = 2.3;
    oldBay(f, t, 2.6);
    sash(f, t, 6.9, 2.0, 2.7, 2, 3);
    balcony(f, t - 1.3, t + 1.3, 6.3);
    sash(f, t, 11.5, 2.0, 2.5, 2, 3);
    sash(f, t, 15.2, 2.0, 2.2, 2, 2);
    sash(f, t, 18.4, 2.2, 1.8, 2, 2, 0.15);
    slab(b, f, L / 2, 20.4, L + 0.4, 0.5, 0.5, 'white');
    slab(b, f, L / 2, 20.9, L + 0.2, 0.18, 0.62, 'stone');
  }

  // ============ modern stone-clad wing and the lower brick building: approximate rhythm ============
  const modern = (w: Wall, top: number, brickUpper: boolean) => {
    const f = frameOf(w), L = w.length;
    if (L < 1.4) return;
    // glazed ground floor between stone piers
    const glassL = L - 0.8;
    if (glassL > 1.2) {
      slab(b, f, L / 2, 0.6, glassL, 3.5, 0.1, 'glass');
      for (let t = 0.4; t < L - 0.3; t += 2.6) slab(b, f, t, 0.6, 0.08, 3.5, 0.14, 'dark');
      slab(b, f, L / 2, 0.5, glassL, 0.2, 0.16, 'sandstone');
      slab(b, f, L / 2, 4.1, glassL, 0.15, 0.2, 'dark');
    }
    slab(b, f, L / 2, 5.0, L, 0.25, 0.2, 'white');
    if (brickUpper) slab(b, f, L / 2, 10.9, L, top - 10.9 - 0.6, 0.05, 'brick');
    // storeys of paired windows
    const rowsY = brickUpper ? [6.2, 11.4, 15.0] : [5.6, 9.3, 13.0, 16.7];
    const rowH = brickUpper ? [2.4, 2.4, 2.2] : [2.1, 2.1, 2.1, 2.1];
    const nCols = Math.max(1, Math.floor((L - 0.6) / 3.0));
    const pitch = (L - 0.6) / nCols;
    for (let r = 0; r < rowsY.length; r++) {
      if (rowsY[r] + rowH[r] > top - 0.7) continue;
      for (let k = 0; k < nCols; k++) {
        const t = 0.3 + pitch * (k + 0.5);
        if (brickUpper) sash(f, t, rowsY[r], Math.min(2.0, pitch - 1.0), rowH[r], 2, 3, 0.14);
        else {
          const ww = Math.min(1.25, (pitch - 0.7) / 2);
          for (const dt of [-0.7, 0.7].map(v => v * Math.min(1, pitch / 3.0))) slab(b, f, t + dt, rowsY[r], ww, rowH[r], 0.1, 'glass');
          for (const dt of [-0.7, 0.7].map(v => v * Math.min(1, pitch / 3.0))) { slab(b, f, t + dt, rowsY[r] - 0.1, ww + 0.25, 0.1, 0.16, 'white'); slab(b, f, t + dt, rowsY[r], 0.05, rowH[r], 0.14, 'frame'); slab(b, f, t + dt, rowsY[r] + rowH[r] / 2, ww, 0.05, 0.14, 'frame'); }
        }
      }
    }
    slab(b, f, L / 2, top - 0.5, L + 0.2, 0.5, 0.35, 'white');
  };
  for (const i of [36, 27]) modern(W(i), 16.3, false);
  for (const i of [30, 361, 32, 33, 259, 39, 194]) modern(W(i), 20.5, false);
  for (const i of [63, 68, 64, 72]) modern(W(i), 20.3, true);
}
