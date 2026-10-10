import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {setSink} from './nearbar-kit';
import {rawWall} from './big-kit';
import {quad, ribbon} from './big-facade';
import source from './hva-wibautstraat-3-footprints.json';

/**
 * Hogeschool van Amsterdam, Wibautstraat 3 (BAG pand 0363100012241500, 2015; 27,905 m2 education): the HvA's new building on the site of the
 * demolished Wibauthuis, a stepped red-brown brick block (podium 29.4 m, shoulders 38.7 and 40.2 m, towers 49.5 and 55.7 m on the
 * north-west) with a glazed, louvred two-storey base. The architect is not identified in the sources found (BAG names none), so the
 * building is ordinary: no landmark card. Massing is the 3DBAG LoD2.2 shell (native east/south metres from the BAG centroid).
 * Rhythm read from rectified municipal panoramas (artifacts/landmark-lanes/hva-wibautstraat-3, t runs along the viewer's right as in
 * big-kit rawWall; 20 px/m):
 *  - west front on Wibautstraat, wall 132 (48 m, ref-west.jpg, 2020-2022): above a canopy at 6 m and a glazed two-storey base a 3.2 m
 *    glass band (y 9.3-12.5) in brick piers on a 5.8 m pitch, then ribbon windows of 2.4 m height on a 3.5 m storey pitch starting at
 *    sill 14.5 m, interrupted by brick piers (ribbons t 0.5-15.7, 16.2-32, 35.8-46.2); the lowest part of the front, wall 235 (6 m), is a
 *    glazed shop front in piers;
 *  - east side walls 17, 129, 187 (ref-east-*.jpg, 2016): continuous glazed louvred base to 12.4 m under four ribbon storeys;
 *  - south walls 107 and 138, north walls 51 and 46: the same brick grid with glazed, louvred ground floor (ref-south.jpg, ref-north.jpg).
 * INFERRED: every wall without a photograph (inner volumes, the shoulders above 32 m which no panorama reaches, the west walls 115
 * and 116 above their photographed storeys): the same 3.5 m storey pitch with ribbons split by brick piers every 10-11 m.
 * Not modelled: the sunshade louvre depth, entrance canopies' structure, signage (UNIVERSITY STORE, "U" logos), roof plant.
 */
const surfaces = (source as {surfaces: {type: string; rings: number[][][]}[]}).surfaces;
const S0 = 14.5, P = 3.5, H = 2.4;

export function buildHvaWibautstraat3(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'red', roof: 'concrete'});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  setSink(0.3);
  const rows = (w: ReturnType<typeof rawWall>, t0: number, t1: number, mullion = 2.1) => {
    for (let y = S0; y + H <= w.top; y += P) if (y >= w.base + 0.6) ribbon(b, w, t0, t1, y, H, {mullion, frame: 'frame', glass: 'glass'});
  };
  const piers = (w: ReturnType<typeof rawWall>, from: number, to: number) => {
    const L = to - from, n = Math.max(1, Math.ceil(L / 11)), pier = 1.0, seg = (L - pier * (n - 1)) / n;
    return Array.from({length: n}, (_, k) => [from + k * (seg + pier), from + k * (seg + pier) + seg] as [number, number]);
  };
  const special = new Set([132, 235]);
  // ---------- west front ----------
  {
    const w = rawWall(source as never, 132);
    for (const [a, c] of [[0.5, 15.7], [16.2, 32.0], [35.8, 46.2]]) rows(w, a, c);
    ribbon(b, w, 32.15, 32.75, 14.5, 2.4, {frame: 'frame'});
    for (let t = 0.4; t + 4.6 <= w.len; t += 5.8) ribbon(b, w, t, t + 4.6, 9.3, 3.2, {mullion: 2.3, frame: 'frame', glass: 'glass'});
    const low = rawWall(source as never, 235);
    for (let t = 0.6; t + 4.6 <= low.len; t += 5.8) ribbon(b, low, t, t + 4.6, 0.6, 4.6, {mullion: 2.3, frame: 'dark', glass: 'glass'});
  }
  // ---------- everything else ----------
  surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface' || special.has(i)) return;
    const w = rawWall(source as never, i);
    if (!(w.len >= 2.5) || !Number.isFinite(w.f.n[0]) || w.top - w.base < 3) return;
    const segs = piers(w, 0.6, w.len - 0.6);
    if (w.base < 0.5) {
      const gh = Math.min(w.top - 1.4, 11.0);
      for (const [a, c] of segs) {
        ribbon(b, w, a, c, 0.8, gh, {mullion: 1.9, frame: 'frame', glass: 'glass'});
        if (gh > 9) { quad(b, w.f, (a + c) / 2, 5.6, c - a, 0.5, 'dark', 0.045); quad(b, w.f, (a + c) / 2, 9.7, c - a, 0.6, 'dark', 0.045); }
      }
    }
    if (w.top > 16.5) for (const [a, c] of segs) rows(w, a, c);
  });
  setSink(0);
}
