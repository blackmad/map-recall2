import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {wallsOf, type Wall} from './worship-walls';
import {frameOf, getSink, leanSlab, letters, sashWindows, setSink, slab, type Frame} from './nearbar-kit';
import {profiledRibs, type RibOpening} from '../../src/canalRecall/landmarks/profiledCladding';
import source from './toekomstmuziek-footprints.json';

/**
 * Toekomstmuziek, Danzigerbocht 29 (BAG pand 0363100012110275, bouwjaar 1994; OSM venue n2738399729, building
 * w268508568 + roof part w848772807): a music venue and cultural hub ("art, music, street food, craft beer & wine",
 * toekomstmuziek.com) in a small Houthavens business unit. Massing is the 3DBAG LoD2.2 shell in native east/south
 * metres (toekomstmuziek-footprints.json): a two-storey office block of pale grey brick at the front (6.7 m) and a
 * single-storey hall of profiled steel sheet behind it (6.2 m).
 *
 * Evidence (toekomstmuziek-inventory.json), Gemeente Amsterdam panoramas CC BY 4.0:
 *  - front (SW, wall #14): rectified 2025_10_02_11_11_01_00035 (2025-10-02) and the leaf-off TMX7316010203-002026_pano_0000_002221
 *    (2021-02-24): six square windows upstairs in three pairs, the outer two in black frames and the inner four in
 *    yellow; two black-framed windows downstairs at the NW end; a glazed entrance with a yellow door frame under a
 *    white box canopy that carries the TOEKOMSTMUZIEK sign (white box, yellow centre panel, black capitals; the
 *    canopy showed only "29" in 2021). Positions measured off the 50 px/m rectified crop to about 0.1 m.
 *  - SE end of the block (wall #2) and the hall's SE side (#3): TMX7316010203-002026_pano_0000_002217 (2021) and
 *    2025_10_02_11_11_01_00042 (2025): three upstairs windows (black, yellow, black), profiled sheet over a brick plinth.
 *  - NW end of the block (#7) and the hall's NW side (#11): TMX7316010203-002026_pano_0000_002225 (2021), oblique,
 *    behind a fence: two windows upstairs, one down; an orange roller door in the hall about 3 m from its NE end.
 *  - roofs: PDOK luchtfoto 2025 (CC BY 4.0): four rooflights in a dark strip along the hall's axis.
 *  - NE end of the hall (#13) has no photo and is inferred plain cladding.
 */
export function buildToekomstmuziek(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const sink0 = getSink();
  setSink(0.05, true);
  // Hall walls (top 6.23) take the cladding colour; the office block (6.7) and its parapet step are brick.
  const hallWall = new Set([3, 11, 13]);
  addShell(b, source as never, {wall: 'brick', roof: 'slate', skip: (_s, i) => hallWall.has(i)});
  addShell(b, source as never, {wall: 'concrete', roof: 'slate', skip: (s, i) => s.type === 'RoofSurface' || !hallWall.has(i)});
  b.mark?.('shell');
  const walls = new Map(wallsOf(source as never).map(w => [w.index, w]));
  const wall = (i: number) => walls.get(i)!;

  /** Square modern window: frame, glass pane, sill-less (the brick runs to the frame). */
  const win = (f: Frame, t: number, y: number, frame: 'gold' | 'dark', w = 1.2, h = 1.2) =>
    sashWindows(b, f, [t], {y, w, h, cols: 1, rows: 1, frame, glass: 'glass'});
  /** Dark plinth courses and the metal coping on a brick wall of the block. */
  const brickTrim = (w: Wall, top: number) => {
    const f = frameOf(w);
    slab(b, f, w.length / 2, 0, w.length, 0.3, 0.06, 'greyBrick');
    slab(b, f, w.length / 2, top - 0.1, w.length + 0.04, 0.2, 0.08, 'concrete');
  };
  /** Profiled steel sheet: vertical ribs above a plinth, stopped at openings. */
  const cladding = (w: Wall, y0: number, y1: number, openings: RibOpening[] = []) => {
    const f = frameOf(w);
    for (const r of profiledRibs({length: w.length, y0, y1, pitch: 0.4, rib: 0.1, openings})) leanSlab(b, f, (r.t0 + r.t1) / 2, r.y0, r.t1 - r.t0, r.y1 - r.y0, 0.06, 'concrete');
  };

  // ---- Front (SW, #14), t from the NW end ----
  {
    const w = wall(14), f = frameOf(w);
    brickTrim(w, 6.74);
    win(f, 1.2, 3.95, 'dark'); win(f, 3.05, 3.95, 'gold');
    win(f, 7.36, 3.95, 'gold'); win(f, 9.25, 3.95, 'gold');
    win(f, 11.95, 3.95, 'gold'); win(f, 13.8, 3.95, 'dark');
    win(f, 1.2, 0.85, 'dark'); win(f, 3.05, 0.85, 'dark');
    // Glazed entrance: dark frame, two side lights and the yellow-framed door.
    slab(b, f, 8.3, 0, 3.1, 2.1, 0.11, 'dark');
    slab(b, f, 8.3, 0.05, 2.95, 2.0, 0.15, 'glass');
    slab(b, f, 8.3, 0, 0.98, 2.08, 0.2, 'gold');
    slab(b, f, 8.3, 0.06, 0.8, 1.98, 0.25, 'glass');
    // Box canopy with the venue sign on its face.
    slab(b, f, 8.36, 2.1, 3.9, 0.5, 0.6, 'white');
    slab(b, f, 8.36, 2.14, 2.1, 0.42, 0.65, 'gold');
    letters(b, f, 'TOEKOMSTMUZIEK', 8.36, 2.17, 0.65, 0.042, 0.03, 'dark', 0.045);
  }
  // ---- SE end of the block (#2), t from the front corner ----
  {
    const w = wall(2), f = frameOf(w);
    brickTrim(w, 6.74);
    win(f, 1.4, 3.95, 'dark'); win(f, 3.15, 3.95, 'gold'); win(f, 4.85, 3.95, 'dark', 1.0);
  }
  // ---- NW end of the block (#7), t from the hall end ----
  {
    const w = wall(7), f = frameOf(w);
    brickTrim(w, 6.7);
    win(f, 1.3, 3.95, 'gold'); win(f, 4.3, 3.95, 'dark'); win(f, 4.3, 0.85, 'dark');
  }
  // Parapet step of the block above the hall roof (#16).
  slab(b, frameOf(wall(16)), wall(16).length / 2, 6.6, wall(16).length + 0.04, 0.24, 0.08, 'concrete');

  // ---- Hall: brick plinth, profiled sheet, eaves trim ----
  for (const i of [3, 11, 13]) {
    const w = wall(i), f = frameOf(w);
    slab(b, f, w.length / 2, 0, w.length, 0.6, 0.06, 'stone');
    slab(b, f, w.length / 2, 6.0, w.length, 0.3, 0.1, 'frame');
  }
  // SE side: the 27-C annex (another pand) stands against it from t = 7 m, so the ribs stop above its roof there.
  cladding(wall(3), 0.6, 6.05, [{t0: 7, t1: 22.1, y0: 0, y1: 3.4}]);
  // NW side: orange roller door about 3 m from the NE end.
  {
    const w = wall(11), f = frameOf(w);
    slab(b, f, 3.2, 0, 3.2, 4.15, 0.16, 'dark');
    slab(b, f, 3.2, 0, 3.0, 4.0, 0.21, 'red');
    for (let y = 0.4; y < 4.0; y += 0.4) slab(b, f, 3.2, y, 3.0, 0.04, 0.27, 'red');
    cladding(w, 0.6, 6.05, [{t0: 1.6, t1: 4.8, y0: 0, y1: 4.15}]);
  }
  cladding(wall(13), 0.6, 6.05);

  // ---- Hall rooflights (luchtfoto): four panels in a dark strip along the hall axis ----
  {
    const ax = wall(3).tangent, n = wall(3).n, c = [5.7, -2.85];
    const at = (u: number) => [c[0] + ax[0] * u, c[1] + ax[1] * u];
    const ang = Math.atan2(n[0], n[1]);
    const [x0, z0] = at(0);
    b.box(x0, 6.0, z0, 12.0, 0.5, 1.7, 'dark', ang);
    for (const u of [-4.5, -1.5, 1.5, 4.5]) { const [x, z] = at(u); b.box(x, 6.4, z, 1.6, 0.22, 1.2, 'frame', ang); }
  }
  setSink(sink0);
}
