import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {setSink, slab} from './nearbar-kit';
import {rawWall, topOf, type RawWall} from './big-kit';
import source from './shell-technology-centre-footprints.json';

/**
 * Shell Technology Centre Amsterdam (STCA), Grasweg 31, Amsterdam-Noord (completed 2009). BAG pand 0363100012202175: one 65,321 m2
 * industriefunctie verblijfsobject over six storeys, 22,444 m2 footprint, roof 24-30 m (office wings), 11-13 m (east plinth and arcs),
 * 5 m (low boxes in the north). Massing is the 3DBAG LoD2.2 shell (native east/south metres from the footprint vertex mean).
 * Read from the municipal panoramas of 2025-06-30 (from the south-south-east) and 2021-12-23 (from the east, at the entrance):
 *  - walls are dark purple-brown brick with a long horizontal emphasis; the Shell pecten sits on the brick of the entrance block;
 *  - office wings: six storeys, window ribbons on a 4.7 m storey pitch broken by brick piers every 3.6 m (paired windows in the
 *    2025 view), a plain brick top storey with louvre panels;
 *  - large glazed atria are framed in brick (curved south-east block, entrance link) - only the one seen from the south-south-east is
 *    placed, as a full-height glass field in the middle of its facade.
 * INFERRED: every wall not seen in those two panoramas (the whole north half, the west and the courtyard faces) uses the same window
 * module; the campus stands behind fences and only two public panoramas look at it. Not modelled: the pecten emblem, roof plant,
 * masts, the sculpture and planting at the entrance.
 */
const surfaces = (source as {surfaces: {type: string; rings: number[][][]}[]}).surfaces;
const P = 4.7;
const ATRIUM = 1330; // 3DBAG wall of the curved south block that carries the glazed atrium (ray-cast from the 2025-06-30 panorama)

export function buildShellTechnologyCentre(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'brick', roof: 'concrete'});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  setSink(0.3);
  surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface') return;
    const w: RawWall = rawWall(source as never, i), f = w.f, L = w.len;
    if (L < 2.4) return;
    const mid = topOf(w, L / 2), top = Number.isFinite(mid) ? Math.min(mid, w.top) : w.top;
    const y0 = Math.max(w.base, 0), h = top - y0;
    if (h < 3.5) return;
    if (i === ATRIUM) {
      // brick-framed glazed atrium of the curved south block (2025-06-30 panorama): glass field with mullions and transoms
      const g0 = 2.4, gw = L - 2 * g0, gt = top - 4.2;
      slab(b, f, L / 2, 0.4, gw, gt - 0.4, 0.14, 'glass');
      const nm = Math.max(2, Math.round(gw / 1.7));
      for (let c = 0; c <= nm; c++) slab(b, f, g0 + c * gw / nm, 0.4, 0.1, gt - 0.4, 0.22, 'frame');
      for (let y = 3.6; y < gt; y += 3.4) slab(b, f, L / 2, y, gw, 0.1, 0.22, 'frame');
      slab(b, f, L / 2, gt, gw, 0.4, 0.3, 'dark');
      return;
    }
    const lowBox = top < 6.5;
    const yb = y0 < 2 ? 1.0 : y0 + 0.9;
    const n = Math.max(1, Math.floor((top - 0.9 - yb) / P) + (lowBox ? 0 : 0));
    for (let k = 0; k < n; k++) {
      const y = yb + k * P;
      if (y + 1.6 > top - 0.5) break;
      if (lowBox) { slab(b, f, L / 2, y + 0.5, L - 1.2, 1.2, 0.08, 'glass'); continue; }
      slab(b, f, L / 2, y + 1.3, L - 1.4, 1.55, 0.1, 'glass');
    }
    if (!lowBox && L > 4) {
      const cols = Math.max(1, Math.round((L - 1.4) / 3.6));
      for (let c = 0; c <= cols; c++) slab(b, f, 0.7 + c * (L - 1.4) / cols, y0, 0.28, h - 0.4, 0.12, 'frame');
    }
  });
  setSink(0);
}
