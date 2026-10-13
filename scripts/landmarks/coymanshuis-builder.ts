import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {wallsOf} from './worship-walls';
import {archBand, archSlab, frameOf, poly, put, setSink, slab} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import source from './coymanshuis-footprints.json';

/**
 * Coymanshuis (Keizersgracht 177): Jacob van Campen's first design (1625) for Balthasar and Johannes Coymans, an eight-axis brick
 * front on a cream-painted ground storey, with Ionic pilasters on the bel-etage and Composite pilasters on the first floor
 * (sash windows replaced the cross windows around 1780; the attic became a full storey in 1876). The BAG pand 0363100012165021
 * also contains the two neighbouring houses at the ends of the front, so the model carries all three canal fronts:
 *   - 3DBAG wall 13 (22.7 m, bearing 299): the Coymanshuis, eight axes, two arched doors on the two middle axes;
 *   - 3DBAG wall 9 (7.9 m, same line, to the north): a three-axis brick house crowned by a cream attic with a balustrade and cartouche;
 *   - 3DBAG wall 43 (8.2 m, bearing 284, to the south): a three-axis cream-painted house under a hipped roof.
 * Window heights and axes were measured by eye from the 2025 municipal panorama taken from the opposite quay
 * (recording_2025-06-16_04-42-37_02935) and the 2021 oblique views. Massing is the 3DBAG LoD2.2 shell.
 */
export function buildCoymanshuis(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  setSink(0.1);
  addShell(b, source as never, {wall: 'brick', roof: 'slate'});
  b.mark?.('shell');
  const walls = new Map(wallsOf(source as never).map(w => [w.index, w]));

  /** Sash window: glass, glazing bars, sill, flat lintel and optional cream surround. */
  const sash = (f: Frame, t: number, y: number, wd: number, h: number, cols: number, rows: number, surround = 0.2) => {
    if (surround > 0) {
      for (const s of [-1, 1]) slab(b, f, t + s * (wd / 2 + surround / 2), y - 0.05, surround, h + 0.1 + 0.18, 0.12, 'white');
      slab(b, f, t, y + h + 0.05, wd + 2 * surround, 0.18, 0.14, 'white');
    }
    slab(b, f, t, y - 0.16, wd + 2 * surround + 0.18, 0.12, 0.2, 'stone');
    slab(b, f, t, y, wd, h, 0.1, 'glass');
    for (let k = 1; k < cols; k++) slab(b, f, t - wd / 2 + wd * k / cols, y, 0.05, h, 0.14, 'frame');
    for (let r = 1; r < rows; r++) slab(b, f, t, y + h * r / rows - 0.02, wd, 0.05, 0.14, 'frame');
    slab(b, f, t, y + h - 0.03, wd + 0.06, 0.05, 0.14, 'frame');
  };

  // ---------------- the Coymanshuis (wall 13) ----------------
  {
    const w = walls.get(13)!, f = frameOf(w), L = w.length, AX = 8, P = L / AX, ax = (k: number) => P * (k + 0.5), c = L / 2;
    // cream ground storey with joint lines, base moulding and string course
    slab(b, f, c, 0, L, 3.15, 0.04, 'stone');
    for (let y = 0.7; y < 3.1; y += 0.6) slab(b, f, c, y, L, 0.04, 0.14, 'sandstone');
    slab(b, f, c, 0, L, 0.32, 0.16, 'stone');
    slab(b, f, c, 3.15, L, 0.3, 0.26, 'white');
    for (let k = 0; k < AX; k++) {
      if (k === 3 || k === 4) {
        // arched door with a glazed fanlight in a cream arch, standing on the street (two doors on the central pair of axes)
        archSlab(b, f, ax(k), 0, 2.0, 3.0, 0.14, 'white');
        archSlab(b, f, ax(k), 0.08, 1.55, 2.7, 0.2, 'dark');
        archSlab(b, f, ax(k), 1.9, 1.35, 0.9, 0.24, 'glass');
        slab(b, f, ax(k), 1.88, 1.55, 0.06, 0.26, 'frame');
        slab(b, f, ax(k), 0.08, 0.05, 1.8, 0.26, 'frame');
      } else sash(f, ax(k), 0.55, 1.25, 1.55, 3, 3, 0.14);
    }
    // brick pilasters with cream bases and capitals: Ionic on the bel-etage, Composite on the first floor
    const order = (y0: number, y1: number, composite: boolean) => {
      for (let k = 0; k <= AX; k++) {
        const t = k * P, pw = k === 0 || k === AX ? 0.42 : 0.6;
        slab(b, f, t, y0, pw, y1 - y0, 0.07, 'brick');
        slab(b, f, t, y0, pw + 0.22, 0.2, 0.12, 'white');
        slab(b, f, t, y1 - 0.42, pw + 0.18, 0.42, 0.14, 'white');
        if (!composite) for (const s of [-1, 1]) slab(b, f, t + s * (pw / 2 + 0.05), y1 - 0.62, 0.12, 0.28, 0.14, 'white');
        else slab(b, f, t, y1 - 0.62, pw + 0.05, 0.22, 0.14, 'white');
      }
    };
    order(3.45, 7.75, false);
    for (let k = 0; k < AX; k++) {
      const t = ax(k);
      sash(f, t, 3.65, 1.3, 3.55, 3, 4, 0.2);
    }
    // string cornice over the bel-etage with console blocks above the pilasters
    slab(b, f, c, 7.75, L, 0.22, 0.26, 'white');
    slab(b, f, c, 7.97, L, 0.16, 0.34, 'white');
    for (let k = 0; k <= AX; k++) slab(b, f, k * P, 7.45, 0.35, 0.35, 0.3, 'white');
    order(8.35, 13.25, true);
    for (let k = 0; k < AX; k++) {
      const t = ax(k);
      sash(f, t, 9.35, 1.3, 3.1, 3, 3, 0.2);
      // alternating small frontons are lost since the c.1780 sashes; keep a pale lintel band only
    }
    slab(b, f, c, 13.25, L, 0.22, 0.26, 'white');
    slab(b, f, c, 13.47, L, 0.16, 0.34, 'white');
    for (let k = 0; k <= AX; k++) slab(b, f, k * P, 12.95, 0.35, 0.35, 0.3, 'white');
    // top floor added in 1876, plain brick with smaller sashes
    for (let k = 0; k < AX; k++) sash(f, ax(k), 14.4, 1.25, 1.65, 3, 2, 0.16);
    // eaves cornice with modillions
    slab(b, f, c, 16.25, L, 0.2, 0.46, 'white');
    slab(b, f, c, 16.45, L, 0.15, 0.5, 'white');
    for (let t = 0.3; t < L - 0.2; t += 0.45) slab(b, f, t, 16.0, 0.2, 0.3, 0.4, 'white');
  }

  // ---------------- north neighbour (wall 9): three brick axes under a cream balustraded attic ----------------
  {
    const w = walls.get(9)!, f = frameOf(w), L = w.length, P = L / 3, ax = (k: number) => P * (k + 0.5), c = L / 2;
    slab(b, f, c, 0, L, 3.0, 0.04, 'stone');
    slab(b, f, c, 3.0, L, 0.22, 0.2, 'white');
    // ground storey: door on the left axis, windows on the other two
    slab(b, f, ax(0), 0, 1.5, 2.8, 0.14, 'white');
    slab(b, f, ax(0), 0.12, 1.15, 2.55, 0.2, 'dark');
    slab(b, f, ax(0), 2.1, 1.15, 0.5, 0.24, 'glass');
    for (const k of [1, 2]) sash(f, ax(k), 0.55, 1.1, 1.5, 2, 3, 0.12);
    for (let k = 0; k < 3; k++) {
      sash(f, ax(k), 3.9, 1.2, 3.6, 3, 4, 0.12);
      sash(f, ax(k), 9.0, 1.2, 2.7, 3, 3, 0.12);
      sash(f, ax(k), 13.1, 1.2, 2.3, 3, 3, 0.12);
    }
    slab(b, f, c, 7.9, L, 0.14, 0.14, 'stone');
    slab(b, f, c, 11.9, L, 0.14, 0.14, 'stone');
    // cream attic, cornice, balustrade, cartouche and corner urns
    slab(b, f, c, 15.9, L, 0.2, 0.18, 'stone');
    slab(b, f, c, 16.1, L, 1.55, 0.05, 'white');
    slab(b, f, c, 17.6, L + 0.3, 0.3, 0.42, 'white');
    slab(b, f, c, 17.9, L + 0.3, 0.14, 0.5, 'white');
    for (let t = 0.25; t < L - 0.1; t += 0.4) slab(b, f, t, 18.04, 0.14, 0.7, 0.14, 'white', 0.18);
    slab(b, f, c, 18.74, L + 0.1, 0.12, 0.2, 'white', 0.1);
    for (const s of [0, 1]) put(b, f, new T.SphereGeometry(0.28, 8, 6), s ? L - 0.2 : 0.2, 19.08, 0.25, 'white');
    poly(b, f, c, 16.3, [[-1.3, 0], [1.3, 0], [1.3, 0.5], [0.6, 0.95], [0.5, 1.45], [0, 1.9], [-0.5, 1.45], [-0.6, 0.95], [-1.3, 0.5]], 0.16, 'stone');
    slab(b, f, c, 16.5, 0.9, 0.7, 0.2, 'sandstone');
  }

  // ---------------- south neighbour (wall 43): three cream-painted axes under a hipped roof ----------------
  {
    const w = walls.get(43)!, f = frameOf(w), L = w.length, P = L / 3, ax = (k: number) => P * (k + 0.5), c = L / 2;
    slab(b, f, c, 0, L, 17.0, 0.04, 'white');
    slab(b, f, c, 0, L, 0.3, 0.18, 'stone');
    for (let k = 0; k < 3; k++) {
      sash(f, ax(k), 0.85, 1.15, 1.7, 2, 3, 0.1);
      sash(f, ax(k), 4.3, 1.15, 2.7, 2, 4, 0.1);
      sash(f, ax(k), 9.0, 1.15, 2.7, 2, 4, 0.1);
      sash(f, ax(k), 13.4, 1.15, 2.2, 2, 3, 0.1);
    }
    for (const y of [3.0, 7.9, 12.3]) slab(b, f, c, y, L, 0.16, 0.2, 'stone');
    slab(b, f, c, 16.55, L + 0.3, 0.3, 0.4, 'stone');
    slab(b, f, c, 16.85, L + 0.3, 0.14, 0.5, 'stone');
  }
}
