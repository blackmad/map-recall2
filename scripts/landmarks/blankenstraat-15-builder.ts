import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {setSink, slab} from './nearbar-kit';
import {rawWall} from './big-kit';
import source from './blankenstraat-15-footprints.json';

/**
 * Blankenstraat 15-37 (BAG 0363100012238656, 2011; Amsterdam-Oost, 3,295 m2 perimeter-less housing slab 137 x 24 m, brick, 14.2 m eaves
 * under a slate mansard to 17.3 m with pyramid dormers; shops below, "Het Zwarte Fietsenplan" on the ground floor). The NW street face is
 * a strict module of 4.8 m: either a W module (four tall windows, 0.8 x 2.3 m at 1.07 m pitch) or an L module (four open loggia
 * compartments with a rail), three storeys (sills 4.3, 7.35, 10.4 m) over shopfronts. Rhythm read from three rectified municipal
 * panoramas (artifacts/landmark-lanes/blankenstraat-15, 20 px/m, frame of wall 387, t from -16 to 121.5 m):
 *  - ref-nw-a.jpg (t -16..30), ref-nw-b.jpg (t 28..76), ref-nw-c.jpg (t 74..121.5), all 2025-06-19.
 *  - Module centres t = -12.3 + 4.8 k, k = 0..27. L modules at k = 5, 6, 10, 17, 21, 22; taller 16 m corner towers (loggias below, four windows on top)
 *    at k = 1 and 26; every other module is W. The first module has five windows (read from ref-nw-a.jpg).
 *  - SE wall 445 (29 m, ref-se1.jpg, 2024-12, 19 deg oblique, cut by a neighbour on the right): the same W module, six modules.
 * INFERRED: NE and SW end walls, every sawtooth wall of the SE side other than 445, the courtyard-side dormer walls (these are 3DBAG's own).
 * Not modelled: shopfront detail (each module gets one glazed bay and one door at the same positions), signage, the canopy at the NE end,
 * the rails between window pairs.
 */
const WW = 0.8, WH = 2.3, WP = 1.07;
const SILLS = [4.3, 7.35, 10.4];
const MOD = 4.8, T0 = -12.3, NMOD = 28;
const LOGGIA = new Set([5, 6, 10, 17, 21, 22]);
const TOWER = new Set([1, 26]);

export function buildBlankenstraat15(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'brick', roof: 'slate'});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  setSink(0.3);
  const wall = (i: number) => rawWall(source as never, i);
  type F = ReturnType<typeof wall>['f'];
  const win = (f: F, top: number, t: number, y: number, w: number, h: number, glass = 'glass') => {
    h = Math.min(h, top - 0.3 - y);
    if (h < 0.5) return;
    slab(b, f, t, y - 0.05, w + 0.1, h + 0.1, 0.08, 'frame');
    slab(b, f, t, y, w, h, 0.12, glass);
  };
  const wModule = (f: F, top: number, c: number, sills: number[], n = 4) => {
    for (const y of sills) for (let k = 0; k < n; k++) win(f, top, c + (k - (n - 1) / 2) * WP, y, WW, WH);
  };
  const lModule = (f: F, top: number, c: number, sills: number[]) => {
    for (const y of sills) for (let k = 0; k < 4; k++) {
      const t = c + (k - 1.5) * WP;
      if (y + WH > top - 0.3) continue;
      slab(b, f, t, y, WW + 0.1, WH, 0.1, 'dark');
      slab(b, f, t, y + 0.9, WW + 0.1, 0.05, 0.2, 'concrete');
    }
  };
  const shop = (f: F, top: number, c: number) => {
    win(f, top, c - 1.1, 0.5, 2.3, 2.8);
    win(f, top, c + 1.3, 0.5, 1.0, 2.5, 'dark');
  };
  // NW street face, frame of wall 387.
  { const w = wall(387), f = w.f;
    for (let k = 0; k < NMOD; k++) {
      const c = T0 + MOD * k;
      if (TOWER.has(k)) { lModule(f, 16.1, c, SILLS); for (let j = 0; j < 4; j++) win(f, 16.1, c + (j - 1.5) * WP, 13.5, WW, 2.3); }
      else if (LOGGIA.has(k)) lModule(f, w.top, c, SILLS);
      else wModule(f, w.top, c, SILLS, k === 0 ? 5 : 4);
      shop(f, w.top, c);
    } }
  // SE wall 445: six W modules.
  { const w = wall(445), f = w.f, n = Math.round(w.len / MOD);
    for (let k = 0; k < n; k++) { const c = (k + 0.5) * w.len / n; wModule(w.f, w.top, c, SILLS); shop(f, w.top, c); } }
  // ---------- INFERRED walls: the same W module spread over the wall ----------
  source.surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface' || i === 387 || i === 445) return;
    const w = wall(i);
    if (w.len < 4.5 || w.top - w.base < 8 || w.base > 4) return;
    // The collinear NW street-face pieces are covered by the wall-387 frame above.
    if ([338, 339, 376, 3].includes(i)) return;
    const n = Math.max(1, Math.round(w.len / MOD));
    for (let k = 0; k < n; k++) {
      const c = (k + 0.5) * w.len / n;
      wModule(w.f, w.top, c, SILLS.filter(y => y + 2.6 < w.top), n < 2 ? 2 : 4);
      if (w.base < 0.5) shop(w.f, w.top, c);
    }
  });
  setSink(0);
}
