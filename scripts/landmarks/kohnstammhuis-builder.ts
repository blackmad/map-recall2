import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {setSink, slab, archSlab, disc, put} from './nearbar-kit';
import {rawWall} from './big-kit';
import {quad, windowGrid, sillsFromTop, centredColumns} from './big-facade';
import source from './kohnstammhuis-footprints.json';

/**
 * Kohnstammhuis (Philip Kohnstamm building of the Hogeschool van Amsterdam), Wibautstraat 2: the former Rijksbelastingkantoor by
 * Gijsbert Friedhoff with M. Bolten, 1954-1958 (seven-storey cross wing 1970, Bolten and Jo Vegter), rijksmonument 530868. BAG pand
 * 0363100012125963. Massing is the 3DBAG LoD2.2 shell (native east/south metres from the BAG centroid): a 46 m slab with two 32 m
 * end pavilions, the low entrance hall along Wibautstraat (wall 240, 14 m) and the long west wing (28.5 m).
 * Read from municipal panoramas (artifacts/landmark-lanes/kohnstammhuis, t runs along the viewer's right as in big-kit rawWall):
 *  - Wibautstraat front, wall 240 (63 m, ref-240-*.jpg, 2018-2024): brick end bays t 0-8.6 and 54.4-63 with a double door at the head
 *    of a stair, a coat of arms (Dutch royal arms left, Amsterdam arms right), a tall four-row window above and a leaded window; between
 *    them a colonnade of 27 round concrete pilasters on a 1.76 m pitch (26 bays) with tall six-pane windows (y 2.1-11.3), a rusticated
 *    plinth with a barred arched basement vent in every bay, and a patterned frieze under the pent roof;
 *  - slab, wall 262 (ref-262-*.jpg): rows of small windows in a 1.85 m grid above the hall roof;
 *  - pavilion end walls 185 and 153 (5 columns, 1.85 m pitch, 8 rows at 3.5 m) and the south pavilion's west face 72 (8 columns, 1.97 m);
 *  - low south block, wall 41 (ref-41.jpg): six windows on two storeys over barred arched basement vents.
 * INFERRED (no photograph from that side): the west wing, the courtyard walls and the north/west faces of the slab and pavilions,
 * drawn with the measured window module (1.0 x 2.2 m, 1.85 m pitch, 3.5 m storeys counted down from the wall top).
 * Not modelled: the 1970 wing's later cladding detail, arcaded top-floor mosaic, signage, roof plant, railings.
 */
const surfaces = (source as {surfaces: {type: string; rings: number[][][]}[]}).surfaces;
const WIN = {w: 1.0, h: 2.2};

export function buildKohnstammhuis(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'brick', roof: 'concrete'});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  setSink(0.3);
  const SPECIAL = new Set([240, 185, 153, 72, 41, 262]);

  // ---------- Wibautstraat front: wall 240 ----------
  {
    const w = rawWall(source as never, 240), f = w.f;
    const T0 = 8.6, T1 = 54.35, N = 26, P = (T1 - T0) / N;
    slab(b, f, (T0 - 0.2 + T1 + 0.2) / 2, 0, T1 - T0 + 0.4, 2.0, 0.18, 'concrete'); // plinth
    slab(b, f, (T0 - 0.4 + T1 + 0.4) / 2, 11.7, T1 - T0 + 0.8, 1.6, 0.45, 'concrete'); // patterned frieze
    slab(b, f, (T0 - 0.4 + T1 + 0.4) / 2, 11.5, T1 - T0 + 0.8, 0.2, 0.55, 'dark');
    for (let k = 0; k <= N; k++) {
      const t = T0 + k * P;
      put(b, f, new T.CylinderGeometry(0.42, 0.42, 9.7, 10).translate(0, 4.85, 0), t, 2.0, 0.05, 'concrete');
    }
    for (let k = 0; k < N; k++) {
      const t = T0 + (k + 0.5) * P;
      quad(b, f, t, 2.05, 1.12, 9.4, 'frame', 0.03);
      quad(b, f, t, 2.15, 0.96, 9.2, 'glass', 0.06);
      for (let m = 1; m <= 5; m++) quad(b, f, t, 2.15 + m * 9.2 / 6 - 0.03, 1.0, 0.06, 'frame', 0.08);
      archSlab(b, f, t, 0.55, 0.9, 0.7, 0.06, 'dark', 0.15);
    }
    // end pavilions: door at the head of a stair, coat of arms, tall window, leaded window
    const end = (stairT: number, doorT: number, doorW: number, arms: string, winT: number, leadT: number) => {
      slab(b, f, stairT, 0, 4.6, 1.9, 1.6, 'concrete');
      slab(b, f, doorT, 1.9, doorW, 3.1, 0.1, 'dark', 0.02);
      disc(b, f, doorT, 7.0, 0.9, 0.12, arms, 0.02);
      slab(b, f, winT, 7.3, 2.4, 3.7, 0.06, 'frame', 0.01);
      slab(b, f, winT, 7.4, 2.2, 3.5, 0.08, 'glass', 0.01);
      for (let m = 1; m < 4; m++) slab(b, f, winT, 7.4 + m * 3.5 / 4, 2.2, 0.06, 0.1, 'frame', 0.01);
      slab(b, f, winT, 7.4, 0.06, 3.5, 0.1, 'frame', 0.01);
      slab(b, f, leadT, 3.0, 1.3, 1.7, 0.08, 'frame', 0.01);
      slab(b, f, leadT, 3.1, 1.1, 1.5, 0.1, 'glass', 0.01);
    };
    end(2.6, 2.6, 3.0, 'gold', 3.0, 6.2);
    end(59.8, 59.75, 2.0, 'red', 59.7, 56.5);
  }

  // ---------- window grids ----------
  const grid = (i: number, cols: {t0: number; pitch: number; n: number}, sills: number[], dims = WIN) => {
    const w = rawWall(source as never, i);
    windowGrid(b, w, {...cols, ...dims, sills, frame: 'concrete'});
  };
  const w185 = rawWall(source as never, 185), w153 = rawWall(source as never, 153), w72 = rawWall(source as never, 72), w262 = rawWall(source as never, 262);
  grid(185, {t0: 0.65, pitch: 1.85, n: 5}, sillsFromTop(w185.top, 3.7, 3.5, 2.4));
  grid(153, {t0: 3.25, pitch: 1.85, n: 5}, sillsFromTop(w153.top, 3.7, 3.5, 2.4));
  grid(72, {t0: 1.85, pitch: 1.97, n: 8}, sillsFromTop(w72.top, 3.7, 3.5, 2.4));
  grid(262, {...centredColumns(w262.len, 1.85, 0.9)}, sillsFromTop(w262.top, 3.7, 3.4, w262.base + 1.2));
  // low south block, wall 41
  {
    const w = rawWall(source as never, 41);
    windowGrid(b, w, {t0: 2.4, pitch: 2.0, n: 6, w: 1.0, h: 1.9, sills: [3.4, 6.2], frame: 'concrete'});
    for (let c = 0; c < 6; c++) archSlab(b, w.f, 2.4 + c * 2.0, 0.9, 1.0, 0.8, 0.06, 'dark', 0.1);
  }
  // inferred walls: the same module
  surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface' || SPECIAL.has(i)) return;
    const w = rawWall(source as never, i);
    if (!(w.len >= 3) || !Number.isFinite(w.f.n[0]) || w.top - w.base < 5.5) return;
    const min = w.base < 0.5 ? 2.4 : w.base + 1.0;
    windowGrid(b, w, {...centredColumns(w.len, 1.85, 1.0), ...WIN, sills: sillsFromTop(w.top, 3.7, 3.5, min), frame: 'concrete'});
  });
  setSink(0);
}
