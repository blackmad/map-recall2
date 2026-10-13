import type {BuildingTools} from './cultural-builders';
import {setSink} from './nearbar-kit';
import {rawWall, topOf, type RawWall} from './big-kit';
import {beginFacade, addShellTess, quad, ribbon, windowGrid, claimOpening} from './big-facade';
import source from './jodenbreestraat-11-footprints.json';

/**
 * Jodenbreestraat 11 / Valkenburgerstraat 236 (BAG pand 0363100012185418, 1996; 29,437 m2 shops, offices, 7 bouwlagen): the long
 * red-brick Waterlooplein block between Valkenburgerstraat (south-west), the Zwanenburgwal canal (north-east) and the side street
 * on its north-west end. Ordinary building, no landmark card. Massing is the 3DBAG LoD2.2 shell (native east/south metres from
 * the BAG centroid; wall indices as in big-plan.mjs). Rhythm read from rectified municipal panoramas
 * (artifacts/landmark-lanes/jodenbreestraat-11/rect*.jpg, t along the viewer's right, 20 px/m); rectified heights carry a pano
 * ground error of 0.5-2 m, so every wall is anchored on a structural line (wall top, cornice) rather than the image bottom:
 *  - Valkenburgerstraat front, walls 205, 33, 258 (24.3-24.7 m each; ref-sw-*.jpg): 5.4 m colonnaded shop floor (slim columns every
 *    2.1 m before dark glazing) under a stone cornice, then four brick storeys of window groups: three bays of three 1.25 x 2.2 m
 *    windows (column pitch 1.95 m, bay pitch 7.35 m, sills 6.0 + n 3.25 m) between darker brick pilasters, a plain brick attic
 *    to 20.3 m and a dark overhanging roof band to the wall top;
 *  - north-west end, wall 310 (31.8 m, ref-nw.jpg): dark stone base with six big shop windows, a stone cornice and four storeys of
 *    1.25 x 1.85 m windows at 3.65 m pitch in groups of 3 / 4 / 4 / 2 (column pitch 1.95 m);
 *  - south-east end, five 5.2 m chords of the rounded corner (walls 54, 148, 166, 96, 92; ref-se.jpg): a glazed shop floor and four
 *    bands of three-light horizontal windows between grey spandrel bands;
 *  - canal side, walls 183, 147, 153, 159, 250, 31, 111 (ref-ne.jpg): darker brown brick, 1.1 x 1.75 m windows at 3.15 m pitch in
 *    groups of 3 / 4 / 3 (183) or 3 | glazed stair slot | 3 (147, 153, 159), a tall ground row above the quay wall, a glazed
 *    lantern strip under the roof band.
 * INFERRED (no photograph reaches them): the courtyard walls and the small notch walls between the long fronts; the three canal wings
 * 153 (hidden behind a low connector in the photos) copy 147's pattern. Not modelled: the rounded-corner entrance canopy, signage,
 * the glazed roof lantern's structure, balconies on the inner wings.
 */
const surfaces = (source as {surfaces: {type: string; rings: number[][][]}[]}).surfaces;
type W = RawWall;
const wall = (i: number) => rawWall(source as never, i);

export function buildJodenbreestraat11(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShellTess(b, source as never, {wall: 'brick', roof: 'slate'});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  beginFacade(source as never);
  setSink(0.3);
  const single = (w: W, t: number, y: number, ww: number, h: number, frame = 'frame', glass = 'glass') => windowGrid(b, w, {t0: t, pitch: 1, n: 1, w: ww, h, sills: [y], frame, glass});
  const cols = (w: W, ts: number[], sills: number[], ww: number, h: number) => { for (const t of ts) single(w, t, 0, ww, h); void sills; };
  const rows = (w: W, ts: number[], sills: number[], ww: number, h: number) => { for (const t of ts) windowGrid(b, w, {t0: t, pitch: 1, n: 1, w: ww, h, sills}); };
  void cols;
  // flat band across a wall (spandrel, cornice, roof band), skipped under the wall top
  const band = (w: W, t0: number, t1: number, y0: number, y1: number, colour: string, out = 0.03) => {
    if (y1 <= y0 + 0.05 || t1 <= t0 + 0.05) return;
    const top = Math.min(topOf(w, t0 + 0.05), topOf(w, t1 - 0.05), topOf(w, (t0 + t1) / 2));
    const hi = Math.min(y1, Number.isFinite(top) ? top : w.top);
    if (hi <= y0 + 0.05) return;
    quad(b, w.f, (t0 + t1) / 2, y0, t1 - t0, hi - y0, colour, out);
  };
  const roofBand = (w: W, from: number) => band(w, 0.05, w.len - 0.05, from, w.top, 'slate', 0.05);

  const done = new Set<number>();
  // ---------- Valkenburgerstraat (south-west) ----------
  for (const i of [205, 33, 258]) {
    done.add(i);
    const w = wall(i), L = w.len, mid = L / 2;
    const ts = [-9.3, -7.35, -5.4, -1.95, 0, 1.95, 5.4, 7.35, 9.3].map(o => mid + o);
    rows(w, ts, [6.0, 9.25, 12.5, 15.75], 1.25, 2.2);
    for (const s of [-1, 0, 1]) if (s !== 0) band(w, mid + s * 3.7 - 0.4, mid + s * 3.7 + 0.4, 5.9, 20.3, 'red', 0.025);
    band(w, 0.05, 0.9, 5.9, 20.3, 'red', 0.025); band(w, L - 0.9, L - 0.05, 5.9, 20.3, 'red', 0.025);
    band(w, 0.05, L - 0.05, 20.0, 20.3, 'concrete', 0.04);
    roofBand(w, 20.3);
    // colonnaded shop floor
    band(w, 0.05, L - 0.05, 0.4, 5.0, 'dark', 0.03);
    for (let t = 0.9; t < L - 0.5; t += 2.1) band(w, t - 0.15, t + 0.15, 0.0, 5.3, 'concrete', 0.07);
    band(w, 0.05, L - 0.05, 5.3, 5.95, 'white', 0.06);
  }
  // ---------- north-west end ----------
  {
    const w = wall(310), L = w.len;
    done.add(310);
    const ts = [1.75, 3.75, 5.65, 9.25, 11.25, 13.15, 15.15, 18.75, 20.7, 22.6, 24.5, 28.0, 29.85];
    rows(w, ts, [6.85, 10.5, 14.15, 17.8], 1.25, 1.85);
    band(w, 0.05, L - 0.05, 0.0, 5.7, 'stone', 0.03);
    for (const [a, c] of [[0.3, 6.5], [8.75, 12.0], [12.65, 15.75], [18.25, 21.35], [22.0, 25.0], [27.4, 30.5]]) ribbon(b, w, a, c, 1.0, 4.5, {mullion: 1.6, frame: 'frame', glass: 'dark'});
    band(w, 0.05, L - 0.05, 5.7, 6.4, 'white', 0.05);
    band(w, 0.05, L - 0.05, 20.0, 20.4, 'concrete', 0.04);
    roofBand(w, 20.4);
  }
  // ---------- south-east rounded corner (five chords) ----------
  for (const i of [54, 148, 166, 96, 92]) {
    const w = wall(i), L = w.len;
    done.add(i);
    for (const y of [6.0, 9.3, 12.4, 15.7]) {
      band(w, 0.05, L - 0.05, y - 0.7, y, 'concrete', 0.03);
      ribbon(b, w, 0.45, L - 0.45, y, 2.2, {mullion: 1.45, frame: 'frame', glass: 'glass'});
    }
    band(w, 0.05, L - 0.05, 0.0, 1.0, 'stone', 0.03);
    ribbon(b, w, 0.45, L - 0.45, 1.0, 4.4, {mullion: 1.45, frame: 'frame', glass: 'dark'});
    band(w, 0.05, L - 0.05, 5.4, 5.95, 'white', 0.05);
    band(w, 0.05, L - 0.05, 20.0, 20.3, 'concrete', 0.04);
    roofBand(w, 20.3);
  }
  // ---------- canal side ----------
  const canalRows = (w: W, ts: number[]) => {
    rows(w, ts, [6.7, 9.85, 13.0, 16.1], 1.1, 1.75);
    rows(w, ts, [1.9], 1.1, 2.9);
    band(w, 0.05, w.len - 0.05, 18.0, 18.2, 'concrete', 0.04);
    if (w.top > 21) { band(w, 0.05, w.len - 0.05, 20.2, 22.3, 'slate', 0.05); ribbon(b, w, 0.4, w.len - 0.4, 20.6, 1.2, {mullion: 1.2, frame: 'frame', glass: 'glass'}); }
    else band(w, 0.05, w.len - 0.05, Math.max(18.2, w.top - 1.4), w.top, 'slate', 0.05);
  };
  {
    const w = wall(183); done.add(183);
    canalRows(w, [2.6, 4.35, 6.05, 9.0, 10.75, 12.45, 14.15, 17.05, 18.8, 20.5]);
  }
  for (const [i, ts, slot] of [[147, [2.7, 4.4, 6.2, 9.9, 11.6], 8.0], [153, [1.35, 3.1, 4.85, 8.45, 10.2, 11.95], 6.65], [159, [1.0, 2.8, 4.55, 8.3, 10.1, 11.9], 6.45]] as [number, number[], number][]) {
    const w = wall(i); done.add(i);
    rows(w, ts, [6.8, 10.0, 13.2, 16.4], 1.1, 1.75);
    rows(w, ts, [1.9], 1.1, 2.9);
    if (claimOpening(w, slot - 0.7, slot + 0.7, 6.4, 18.0, 0.1)) {
      quad(b, w.f, slot, 6.3, 1.6, 11.8, 'frame', 0.02);
      quad(b, w.f, slot, 6.4, 1.4, 11.6, 'glass', 0.04);
    }
    band(w, 0.05, w.len - 0.05, 18.0, 18.2, 'concrete', 0.04);
    band(w, 0.05, w.len - 0.05, Math.max(18.2, w.top - 1.0), w.top, 'slate', 0.05);
  }
  for (const i of [250, 31, 111]) {
    const w = wall(i); done.add(i);
    const ts = i === 250 ? [1.55, 3.3, 6.3, 8.05, 9.8] : w.len > 8 ? [1.7, 3.45, 5.2, 6.95] : [1.8, 3.6];
    canalRows(w, ts);
  }
  // ---------- everything else (courtyards, notches): inferred ----------
  surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface' || done.has(i)) return;
    const w = rawWall(source as never, i);
    if (!(w.len >= 6) || !Number.isFinite(w.f.n[0]) || w.top - w.base < 8) return;
    const n = Math.max(1, Math.floor((w.len - 1.2) / 2.0));
    const t0 = (w.len - (n - 1) * 2.0) / 2;
    for (let k = 0; k < n; k++) windowGrid(b, w, {t0: t0 + k * 2.0, pitch: 1, n: 1, w: 1.2, h: 1.9, sills: w.top > 21 ? [6.2, 9.45, 12.7, 15.95] : [1.9, 5.1, 8.3, 11.5, 14.7]});
  });
  setSink(0);
}
