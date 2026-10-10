import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import type {Surface} from './worship-shell';
import {setSink, slab} from './nearbar-kit';
import {rawWall, topOf} from './big-kit';
import source from './oostenburgermiddenstraat-228-footprints.json';

/**
 * Oostenburgermiddenstraat 228-636 / "STORK" block (BAG 0363100012254998, 2023; Oostenburg, ~197 flats): a 40 m weathering-steel (corten) tower
 * on a 23-27 m wing of dark glazed brick (SW) and light brick (NW). 3DBAG LoD2.2 massing (both BuildingParts) plus the facade rhythm counted
 * from rectified municipal panoramas (artifacts/landmark-lanes/oostenburgermiddenstraat-228, 16 px/m):
 *  - wall 6 (SW, 32.9 m, rect-w6.jpg): dark brick, 7 columns x 5 upper rows (3.96 m pitch, 2.5 x 2.8 m windows) over 6 glazed ground bays.
 *  - wall 19 (NW wing, 12.6 m, rect-w19.jpg): light brick, 6 columns x 7 rows (3.0 m pitch) with balustrades, arched entrance at the left.
 *  - wall 33 (tower NW, 20.6 m, rect-w33.jpg): corten, storey pairs framed by bands every 5.95 m, two alternating window rows (A/B),
 *    cantilevered terrace at t 4.1-10.3 on the top floors, STORK entrance sign.
 *  - wall 74 (tower NE, 23.7 m, rect-w74.jpg): corten, same bands, wide windows alternate floors at both ends, cantilevered terrace at t 6.1-11.7.
 *  - wall 11 (wing NW end, 11.3 m, rect-w11.jpg): dark brick with open access galleries at t 1.3-4.1.
 * INFERRED (no panorama sees them): tower SE/SW faces (59, 61, 34, 60), wing SE walls (12, 15) and inner walls: same colour and the nearest observed grid.
 * Not modelled: the rooftop plant, balcony railings other than the two terraces, the window louvre detail, bicycle racks, the lettering on the sign.
 */
const BAND_Y = [7.0, 13.0, 18.9, 24.8, 30.8];

export function buildOostenburgermiddenstraat228(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const maxY = (s: Surface) => Math.max(...s.rings[0].map(p => p[1]));
  const kind = (s: Surface) => { const y = maxY(s); return y > 30 ? 'copper' : y > 23.5 ? 'concrete' : 'greyBrick'; };
  const only = (k: string) => (s: Surface) => s.type !== 'WallSurface' || kind(s) !== k;
  addShell(b, source as never, {wall: 'greyBrick', roof: 'slate', skip: s => s.type === 'WallSurface' && kind(s) !== 'greyBrick'});
  addShell(b, source as never, {wall: 'concrete', roof: 'slate', skip: s => s.type !== 'WallSurface' || only('concrete')(s, 0)});
  addShell(b, source as never, {wall: 'copper', roof: 'slate', skip: s => s.type !== 'WallSurface' || only('copper')(s, 0)});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  setSink(0.3);
  const wall = (i: number) => rawWall(source as never, i);
  type F = ReturnType<typeof wall>['f'];

  const win = (f: F, top: number, t: number, y: number, w: number, h: number, louvre = false) => {
    h = Math.min(h, top - 0.3 - y);
    if (h < 0.5) return;
    slab(b, f, t, y - 0.06, w + 0.12, h + 0.12, 0.1, 'frame');
    slab(b, f, t, y, w, h, 0.14, 'glass');
    if (louvre) slab(b, f, t, y, w - 0.05, h * 0.38, 0.17, 'blue');
    else slab(b, f, t, y + h * 0.5 - 0.03, w, 0.06, 0.17, 'frame');
  };
  const bands = (i: number) => { const w = wall(i); for (const y of BAND_Y) if (y + 0.3 < w.top) slab(b, w.f, w.len / 2, y, w.len + 0.1, 0.3, 0.12, 'brick'); };

  // ---------- wall 6: dark brick SW face ----------
  {
    const w = wall(6), f = w.f;
    for (const [a, c] of [[0.9, 4.1], [5.6, 8.75], [10, 13.1], [14.8, 18.1], [19.1, 22.2], [25.9, 29.1]]) win(f, w.top, (a + c) / 2, 0.3, c - a, 2.9);
    for (const y of [5.7, 9.7, 13.6, 17.5, 21.5]) for (const t of [2.6, 7.2, 11.6, 15.9, 20.9, 25.3, 30.1]) win(f, w.top, t, y, 2.5, 2.8);
  }
  // ---------- wall 19: light brick NW face of the 26 m wing ----------
  {
    const w = wall(19), f = w.f;
    slab(b, f, 2.35, 0, 3.5, 3.4, 0.12, 'dark');
    for (const [a, c] of [[5.0, 6.2], [6.9, 8.4], [9.1, 10.6], [11.2, 12.5]]) win(f, w.top, (a + c) / 2, 0.3, c - a, 2.7);
    for (const y of [5.0, 8.0, 11.0, 14.0, 16.9, 19.8, 22.9]) for (const t of [1.3, 3.25, 5.5, 7.6, 9.8, 11.9]) {
      win(f, w.top, t, y, 1.5, 2.3);
      slab(b, f, t, y, 1.5, 0.9, 0.2, 'white');
    }
  }
  // ---------- wall 11: dark brick end of the SW wing with open galleries ----------
  {
    const w = wall(11), f = w.f;
    for (const y of [4.3, 7.3, 10.3, 13.3, 16.3, 19.4]) { slab(b, f, 2.7, y, 2.8, 2.3, 0.12, 'dark'); win(f, w.top, 10.2, y + 0.3, 1.7, 1.8); }
    slab(b, f, 2.7, 0.3, 2.8, 2.6, 0.12, 'dark');
  }
  // ---------- wall 33: tower NW face ----------
  {
    const w = wall(33), f = w.f;
    bands(33);
    const A: [number, number, boolean][] = [[1.7, 1.9, false], [3.5, 0.95, true], [6.25, 0.95, true], [8.9, 1.7, false], [12.8, 1.9, false], [15.3, 1.0, true], [18.6, 1.8, false]];
    const B: [number, number, boolean][] = [[2.5, 1.75, false], [5.8, 0.95, true], [8.4, 1.7, false], [12.25, 1.8, false], [14.9, 1.0, true], [18.05, 1.8, false], [19.9, 0.95, true]];
    for (let k = 0; k < 10; k++) {
      const y = 4.2 + 2.97 * k;
      for (const [t, ww, lv] of k % 2 === 0 ? A : B) {
        if (y >= 24.8 && t > 4.1 && t < 10.3) continue;   // terrace recess
        win(f, w.top, t, y, ww, 2.3, lv);
      }
    }
    slab(b, f, 7.2, 24.25, 6.2, 0.55, 2.0, 'brick');
    slab(b, f, 8.8, 25.3, 2.9, 5.0, 0.12, 'dark');
    slab(b, f, 7.2, 24.8, 6.2, 1.0, 0.05, 'glass', 1.95);
    for (const [a, c] of [[1.7, 3.4], [5.4, 6.5], [7.3, 9.1], [10.9, 16.2], [17.3, 18.8], [19.4, 20.3]]) win(f, w.top, (a + c) / 2, 0.3, c - a, 3.2);
    slab(b, f, 13.65, 3.55, 5.7, 0.6, 0.18, 'copper');
  }
  // ---------- wall 74: tower NE face ----------
  {
    const w = wall(74), f = w.f;
    bands(74);
    for (let k = 0; k < 9; k++) {
      const y = 4.55 + 3.03 * k;
      const cols: [number, number, boolean][] = [[5.1, 1.0, true], [7.2, 1.0, true], [10.45, 1.9, false], [13.5, 1.9, false], [16.8, 1.0, true], [18.8, 1.0, true]];
      if (k % 2 === 1) cols.push([1.8, 1.9, false], [22.3, 1.9, false]);
      for (const [t, ww, lv] of cols) {
        if ((k === 3 || k === 4) && t > 6.1 && t < 11.7) continue;   // terrace
        win(f, w.top, t, y, ww, 2.4, lv);
      }
    }
    slab(b, f, 8.9, 13.2, 5.6, 0.55, 2.0, 'brick');
    slab(b, f, 8.9, 15.0, 4.9, 4.2, 0.12, 'dark');
    slab(b, f, 8.9, 13.75, 5.6, 1.0, 0.05, 'glass', 1.95);
    slab(b, f, 2.75, 0.3, 1.3, 2.8, 0.14, 'red');
    for (const [a, c] of [[4.7, 5.7], [6.7, 7.7], [9.5, 11.4], [12.5, 14.4], [16.2, 17.2], [18.3, 19.3], [21.3, 23.2]]) win(f, w.top, (a + c) / 2, 0.3, c - a, 3.1);
  }
  // ---------- INFERRED faces: bands and the nearest observed grid ----------
  {
    for (const i of [59, 61, 34, 60]) {
      const w = wall(i);
      if (w.len < 5) continue;
      bands(i);
      const n = Math.max(1, Math.round(w.len / 4.6));
      for (let k = 0; k < 9; k++) for (let c = 0; c < n; c++) win(w.f, w.top, (c + 0.5) * w.len / n, 4.55 + 3.03 * k, 1.8, 2.4);
    }
    for (const i of [15, 12]) {
      const w = wall(i), n = Math.max(1, Math.round(w.len / 4.5));
      for (const y of [5.7, 9.7, 13.6, 17.5, 21.5]) for (let c = 0; c < n; c++) win(w.f, w.top, (c + 0.5) * w.len / n, y, 2.5, 2.8);
    }
  }
  void topOf;
  setSink(0);
}
