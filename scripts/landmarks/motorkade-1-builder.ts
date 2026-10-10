import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {setSink, slab} from './nearbar-kit';
import {rawWall, topOf} from './big-kit';
import source from './motorkade-1-footprints.json';

/**
 * Motorkade 1 (Holiday Inn Express Amsterdam - North Riverside): two gold-anodised hotel towers (2020, 45.5 m) on a 7 m podium with a
 * deep colonnade, on the north bank of the IJ. The 3DBAG LoD2.2 shell supplies the plan (the curved faces are four or five facets in
 * LoD2.2). Counted from the 2025-09-04 municipal panoramas (artifacts/landmark-lanes/motorkade-1):
 *  - towers: 12 identical floors of 3.2 m above the podium, each a 1.75 m glass ribbon over a 1.45 m gold spandrel, glass panes ~2.4 m wide
 *    between thin gold mullions (ref-up-e.jpg, ref-e/ref-s/ref-w views);
 *  - south podium (48.6 m): 11 square gold columns, ten bays; the first seven are curtain glazing with a transom at 3 m, two panes a bay;
 *    the last three have gold louvred panels below 3 m with a pair of glass doors at bay 6 (ref-s-...-b195-d15.jpg);
 *  - north podium: the same colonnade continues round the north-west corner (ref-n-...-b255-d38.jpg), modelled the same (inferred bay count).
 * Simplified: the glass line of the real colonnade is set back 1-3 m behind the columns; it is drawn flush on the 3DBAG podium wall.
 * The crown of vertical gold fins on the north tower roof is not modelled.
 */
const FLOOR = 3.2, GLASS = 1.75, SPANDREL_TO_GLASS = 0.7, PODIUM_TOP = 7.1, PANE = 2.45;

export function buildMotorkade1(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'gold', roof: 'slate'});
  b.mark?.('shell');
  if (process.env.SHELL_ONLY) return;
  setSink(0.3);
  const walls = source.surfaces.map((s, i) => (s.type === 'WallSurface' ? i : -1)).filter(i => i >= 0).map(i => rawWall(source as never, i));
  const area = (w: ReturnType<typeof rawWall>) => { let a = 0; for (let i = 0; i < w.poly.length; i++) { const p = w.poly[i], q = w.poly[(i + 1) % w.poly.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };

  // ---- tower ribbons ----
  for (const w of walls) {
    if (w.top < 20 || w.len < 3 || area(w) < 40) continue;
    const n = Math.max(1, Math.round(w.len / PANE)), pitch = w.len / n, f = w.f;
    for (let k = 0; ; k++) {
      const yb = PODIUM_TOP + 0.1 + k * FLOOR, gy = yb + SPANDREL_TO_GLASS;
      if (gy + GLASS > w.top - 0.15) break;
      // contiguous runs of modules whose wall reaches above this ribbon
      const ok: boolean[] = [];
      for (let m = 0; m < n; m++) {
        const t = (m + 0.5) * pitch;
        ok.push(Math.min(topOf(w, t - pitch / 2 + 0.05), topOf(w, t + pitch / 2 - 0.05)) > gy + GLASS + 0.05 && gy >= w.base + 0.2);
      }
      for (let m = 0; m < n; m++) {
        if (!ok[m] || (m > 0 && ok[m - 1])) continue;
        let e = m; while (e + 1 < n && ok[e + 1]) e++;
        const t0 = m * pitch, t1 = (e + 1) * pitch, c = (t0 + t1) / 2;
        slab(b, f, c, gy, t1 - t0 - 0.1, GLASS, 0.1, 'glass');
        slab(b, f, c, gy - 0.06, t1 - t0, 0.07, 0.14, 'frame');
        slab(b, f, c, gy + GLASS - 0.01, t1 - t0, 0.07, 0.14, 'frame');
        for (let q = m + 1; q <= e; q++) slab(b, f, q * pitch, gy, 0.07, GLASS, 0.14, 'frame');
      }
    }
  }

  // ---- podium colonnades ----
  const colonnade = (index: number, bays: number, louvreFrom: number, doorBay: number) => {
    const w = walls.find(q => q.index === index)!, f = w.f, pitch = w.len / bays, h = 6.1;
    for (let k = 0; k <= bays; k++) slab(b, f, Math.min(Math.max(k * pitch, 0.4), w.len - 0.4), 0, 0.8, h, 0.55, 'gold');
    for (let k = 0; k < bays; k++) {
      const c = (k + 0.5) * pitch, gw = pitch - 0.9;
      if (k >= louvreFrom) {
        slab(b, f, c, 0.05, gw, 3.0, 0.09, 'gold');
        for (let y = 0.3; y < 2.95; y += 0.22) slab(b, f, c, y, gw, 0.03, 0.14, 'frame');
        slab(b, f, c, 3.05, gw, 0.08, 0.14, 'frame');
        slab(b, f, c, 3.1, gw, h - 3.2, 0.08, 'glass');
        slab(b, f, c, 3.1 + (h - 3.2) / 2, gw, 0.06, 0.12, 'frame');
        continue;
      }
      slab(b, f, c, 0.2, gw, h - 0.3, 0.08, 'glass');
      slab(b, f, c, 3.0, gw, 0.07, 0.12, 'frame');
      slab(b, f, c, 0.2, gw, 0.06, 0.12, 'frame');
      slab(b, f, c, 0.2, 0.06, h - 0.3, 0.12, 'frame');
      for (const s of [-1, 1]) slab(b, f, c + s * gw / 2, 0.2, 0.07, h - 0.3, 0.12, 'frame');
      if (k === doorBay) { slab(b, f, c, 0.1, 2.2, 2.4, 0.12, 'frame'); slab(b, f, c, 0.15, 2.1, 2.3, 0.14, 'glass'); slab(b, f, c, 0.15, 0.06, 2.3, 0.16, 'frame'); }
    }
  };
  colonnade(6, 10, 7, 6);
  colonnade(80, 9, 99, -1);
  colonnade(172, 3, 99, -1);   // west ends of the towers run to the ground: the colonnade turns the corner (ref-w views)
  colonnade(2, 2, 99, -1);
  colonnade(43, 3, 99, -1);
  colonnade(84, 4, 0, -1);    // east end: gold louvred panels and doors (ref-e-...-b167-d31.jpg)
  colonnade(157, 3, 0, -1);
  setSink(0);
}
