import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {setSink} from './nearbar-kit';
import {rawWall} from './big-kit';
import {windowGrid, planeDeviation} from './big-facade';
import source from './hva-rhijnspoorplein-2-footprints.json';

/**
 * Hogeschool van Amsterdam, Rhijnspoorplein 2 (BAG pand 0363100012245513, 2023; 21,435 m2 education): the newest HvA block of the
 * Amstelcampus, a 33 m wing with a 54 m tower in the east, clad in pale stone with a deep concrete frame grid. Architect and name not
 * identified in the sources found (BAG names none), so ordinary: no landmark card. Massing is the 3DBAG LoD2.2 shell (native
 * east/south metres from the BAG centroid). Read from municipal panoramas (artifacts/landmark-lanes/hva-rhijnspoorplein-2, t along the
 * viewer's right as in big-kit rawWall, 20 px/m):
 *  - north-west front, wall 55 (66 m, ref-nw.jpg, 2022-2025; the middle 22 m tile shows the 2020 structure and is not used for counts):
 *    storeys on a 3.5 m pitch with sill 3.5 m for the first row, window fields about 2.5 m high in the pale frame; the lower three
 *    storeys hold wide windows (about 3.1 m on a 3.75 m bay), the upper storeys narrow slits (three per bay);
 *  - tower faces 37 (north), 167 (east) and 34/57 (south-west): the same frame language, 8-9 storeys of mixed wide and slit windows over
 *    an open or glazed ground floor (ref-tower-*.jpg, 2020-2025, partly behind site hoardings).
 * INFERRED: every wall without a photograph (the south-east sawtooth wall, the inner volumes, wall 172), drawn with the same module.
 * Not modelled: the open ground-floor portico of the tower (the shell is closed to the ground), colour variants of the glazing, roof plant.
 */
const surfaces = (source as {surfaces: {type: string; rings: number[][][]}[]}).surfaces;
const S0 = 3.5, P = 3.5, H = 2.4;

export function buildHvaRhijnspoorplein2(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'stone', roof: 'concrete'});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  setSink(0.3);
  surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface') return;
    const w = rawWall(source as never, i);
    if (!(w.len >= 2.5) || !Number.isFinite(w.f.n[0]) || w.top - w.base < 4 || planeDeviation(source as never, w) > 0.12) return;
    const inner = w.len - 0.8, n = Math.max(1, Math.round(inner / 3.75)), bay = inner / n;
    for (let k = 0, y = S0; y + H <= w.top - 0.6; k++, y += P) {
      if (y < w.base + 0.5) continue;
      if (k < 3) {
        windowGrid(b, w, {t0: 0.4 + bay / 2, pitch: bay, n, w: Math.max(0.9, bay - 0.7), h: k === 0 ? 3.0 : H, sills: [y], frame: 'frame', ring: 0.08});
      } else {
        // three slits per bay
        const sp = bay / 3;
        windowGrid(b, w, {t0: 0.4 + sp / 2, pitch: sp, n: n * 3, w: 0.78, h: H, sills: [y], frame: 'frame', ring: 0.07});
      }
    }
  });
  setSink(0);
}
