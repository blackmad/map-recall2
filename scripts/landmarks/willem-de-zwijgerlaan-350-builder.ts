import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {disc, setSink, slab} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import {rawWall} from './big-kit';
import source from './willem-de-zwijgerlaan-350-footprints.json';

/**
 * Willem de Zwijgerlaan 350 (BAG 0363100012107360; hotel / office / sport block in the Landlust re-cladding, "The Hyve", "G Hotel",
 * "Hotel Camp-Inn"): a 59 x 45 m, 15.7 m high block with courtyards. Faces, with evidence
 * (artifacts/landmark-lanes/willem-de-zwijgerlaan-350):
 *  - SOUTH-WEST (street, wall 2, 58.6 m; ref-sw rectified, 28 px/m, ground at the image bottom): white render, three floors of paired tall windows on a
 *    3.64 m pitch (six pairs, a 5.4 m Corten-framed glass atrium at t 20.8-26.2, nine pairs), two stone bands between floors, a stone cornice, and a
 *    Corten plinth 4.2 m high with shopfront glazing.
 *  - NORTH-EAST (canal, wall 96 frame; ref-ne rectified, 28 px/m, vertical scale set from the first-floor window row): two Corten-clad floors with pairs of tall
 *    windows on a 5.05 m pitch, a 2 m terrace with glass balustrade, a white setback storey with a ribbon of small windows, and an open white
 *    pergola frame (five columns, 9.6 m pitch, a beam at the top). 3DBAG fills the pergola with a solid wall and roof; the setback walls are
 *    kept as 3DBAG has them (solid to 15.6 m): the real white storey stops at ~13 m with open air under the pergola beam, which is NOT modelled (flagged in the research file).
 *  - NORTH-WEST (wall 81 frame) and SOUTH-EAST (wall 85): hidden behind a brick shop and a warehouse up to ~7 m; only the upper floors show. INFERRED:
 *    two upper floors on the south-west rhythm.
 * Not modelled: pergola diagonal braces, Corten panel joints, signage lettering, the roof terrace furniture.
 */
type W = ReturnType<typeof rawWall>;
const PITCH = 3.64;
const ROWS: [number, number][] = [[4.86, 7.29], [8.43, 10.86], [12.1, 14.5]];

export function buildWillemDeZwijgerlaan350(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const NE_UPPER = new Set([89, 95, 44, 18, 29, 4]);   // setback storey walls (kept from 3DBAG)
  addShell(b, source as never, {wall: 'white', roof: 'slate'});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  setSink(0.3);
  const wall = (i: number) => rawWall(source as never, i);

  const win = (f: Frame, t: number, y: number, w: number, h: number, o: {cols?: number; sill?: boolean; out?: number} = {}) => {
    const out = o.out ?? 0;
    slab(b, f, t, y, w + 0.1, h + 0.1, 0.07, 'frame', out);
    slab(b, f, t, y + 0.05, w - 0.1, h - 0.0, 0.1, 'glass', out);
    for (let k = 1; k < (o.cols ?? 2); k++) slab(b, f, t - w / 2 + w * k / (o.cols ?? 2), y, 0.04, h, 0.13, 'frame', out);
    slab(b, f, t, y + h * 0.72, w, 0.04, 0.13, 'frame', out);
  };
  const shopGlass = (f: Frame, t0: number, t1: number, y0: number, y1: number) => {
    const w = t1 - t0, n = Math.max(1, Math.round(w / 1.5));
    slab(b, f, (t0 + t1) / 2, y0, w, y1 - y0, 0.1, 'glass');
    for (let k = 0; k <= n; k++) slab(b, f, t0 + w * k / n, y0, 0.07, y1 - y0, 0.16, 'frame');
    slab(b, f, (t0 + t1) / 2, y1 - 0.06, w + 0.1, 0.1, 0.16, 'frame');
    slab(b, f, (t0 + t1) / 2, y0 - 0.02, w + 0.1, 0.1, 0.16, 'frame');
  };

  // ================= SOUTH-WEST street face (wall 2) =================
  {
    const w = wall(2), f = w.f, px = (p: number) => p / 28;
    slab(b, f, w.len / 2, 0, w.len, 4.25, 0.03, 'ochre');                       // Corten plinth
    for (const y of [4.3, 7.9, 11.4]) slab(b, f, w.len / 2, y, w.len, 0.32, 0.14, 'concrete');   // stone bands between floors
    slab(b, f, w.len / 2, 15.2, w.len, 0.5, 0.26, 'concrete');                  // cornice
    const pairs = [20, 122, 224, 325, 428, 530, 788, 890, 992, 1094, 1196, 1298, 1400, 1502, 1604];
    for (const c of pairs) for (const [y0, y1] of ROWS) for (const s of [-1, 1]) {
      const t = px(c) + s * 0.72;
      if (t < 0.6 || t > w.len - 0.6) continue;
      win(f, t, y0, 0.95, y1 - y0);
    }
    for (const [a, c] of [[55, 180], [205, 275], [300, 345], [445, 540], [795, 885], [940, 1030], [1090, 1180], [1240, 1380], [1400, 1480], [1550, 1642]]) shopGlass(f, px(a), Math.min(px(c), w.len - 0.2), 0.4, 3.7);
    // Corten-framed atrium, t 20.8-26.2
    const t0 = px(583), t1 = px(733), yT = 12.8;
    slab(b, f, (t0 + t1) / 2, 0, t1 - t0, yT, 0.12, 'glass', 0.05);
    for (let u = t0 + 0.55; u < t1 - 0.3; u += 0.62) slab(b, f, u, 0, 0.05, yT, 0.2, 'frame', 0.05);
    for (let y = 0.9; y < yT; y += 0.9) slab(b, f, (t0 + t1) / 2, y, t1 - t0, 0.05, 0.2, 'frame', 0.05);
    for (const t of [t0 + 0.35, t1 - 0.35]) slab(b, f, t, 0, 0.7, yT + 0.1, 0.5, 'ochre');
    slab(b, f, (t0 + t1) / 2, yT, t1 - t0, 0.5, 0.5, 'ochre');
    disc(b, f, px(560), 2.7, 0.62, 0.1, 'gold', 0.1); disc(b, f, px(1062), 2.7, 0.62, 0.1, 'gold', 0.1);
  }

  // ================= NORTH-EAST canal face (frame of wall 96) =================
  {
    const w = wall(96), f = w.f, px = (p: number) => p / 28 - 10;
    const LO = -14.4, HI = 44.2;                                    // t extent of the NE plane in this frame
    const yN = (py: number) => 4.86 + (340 - py) / 28;
    slab(b, f, (LO + HI) / 2, 0, HI - LO, 8.8, 0.03, 'ochre');       // Corten wall, two floors
    slab(b, f, (LO + HI) / 2, 8.8, HI - LO, 0.3, 0.3, 'concrete');   // terrace edge slab
    slab(b, f, (LO + HI) / 2, 9.1, HI - LO, 0.1, 0.08, 'glass', 0.1);  // glass balustrade
    for (let k = -1; k <= 8; k++) {
      const c = px(129 + 141.5 * k);
      for (const s of [-1, 1]) {
        const t = c + s * 0.95;
        if (t < LO + 0.7 || t > HI - 0.7) continue;
        win(f, t, 5.0, 1.25, 2.45, {cols: 2});
        slab(b, f, t, 5.0, 1.3, 0.85, 0.14, 'glass');                 // glass balustrade of the French window
        win(f, t, 2.1, 1.25, 2.1, {cols: 2});
      }
    }
    // ribbon windows of the white storey: on the full-height 3DBAG walls 96/121 where they exist, else on the 2 m setback walls
    const pick = (tNE: number) => {
      const p: [number, number] = [f.origin[0] + f.tangent[0] * tNE, f.origin[1] + f.tangent[1] * tNE];
      if ((tNE > 0.4 && tNE < 23.2) || (tNE > 33.0 && tNE < 43.6)) return {f, t: tNE, out: 0};   // full-height 3DBAG walls 96 / 121 on the NE plane
      for (const i of NE_UPPER) { const q = wall(i); const tw = (p[0] - q.f.origin[0]) * q.f.tangent[0] + (p[1] - q.f.origin[1]) * q.f.tangent[1]; if (tw > 0.4 && tw < q.len - 0.4) return {f: q.f, t: tw, out: 0}; }
      return null;
    };
    for (let k = -1; k <= 8; k++) for (const s of [-1, 1]) { const c = px(129 + 141.5 * k) + s * 0.8, hit = pick(c); if (hit) win(hit.f, hit.t, 9.9, 0.7, 1.6, {cols: 1}); }
    // pergola: five columns and the beam
    for (const c of [px(85), px(355), px(622), px(893), px(1163)]) if (c > LO && c < HI) slab(b, f, c, 8.8, 0.45, 6.0, 0.45, 'white', 0.0);
    slab(b, f, (LO + HI) / 2, 14.7, HI - LO, 0.9, 0.5, 'white', 0.0);
  }

  // ================= NORTH-WEST and SOUTH-EAST ends: upper floors only, inferred =================
  for (const [idx, len] of [[81, 44.8], [85, 44.8]] as [number, number][]) {
    const w = wall(idx), f = w.f;
    for (let c = 2.0; c < len - 1.6; c += PITCH) for (const [y0, y1] of ROWS.slice(1)) for (const s of [-1, 1]) win(f, c + s * 0.72, y0, 0.95, y1 - y0);
    slab(b, f, len / 2, 15.2, len, 0.5, 0.26, 'concrete');
    for (const y of [7.9, 11.4]) slab(b, f, len / 2, y, len, 0.32, 0.14, 'concrete');
  }
  setSink(0);
}
