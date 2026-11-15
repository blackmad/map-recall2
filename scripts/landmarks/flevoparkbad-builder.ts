import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {basin, boxAt, inRing, offsetRing, post, prismRing, strip, type XZ} from './pool-kit';
import source from './flevoparkbad-footprints.json';

/**
 * FLEVOPARKBAD, Zeeburgerdijk / Flevopark (outdoor bath of 1967; BAG main pand 0363100012186770 and twelve pavilions). The basins
 * are the landmark. Sources: BAG rings + 3DBAG LoD2.2 shells (CC0 / CC BY 4.0) via pool-site-prepare.ts; OSM leisure=swimming_pool
 * a148160422 (the L-shaped bath) and a148167872 (Peuterbad) (ODbL); PDOK luchtfoto 2025 (Beeldmateriaal Nederland, CC BY 4.0)
 * for the decks, the lane lines, the diving board, the toddler pool's paved round and the changing-room wings, gridded in native
 * metres (artifacts/pools/ortho/flevoparkbad*.jpg). Per item in flevoparkbad-inventory.json.
 *  - The L-shaped bath: a deep 50 m lap basin (east leg, x -10..25, z 30..80) with lane lines at x 3..21, and the shallow
 *    basin (south leg) with a light-blue canopy on posts in it (orthophoto x -62..-53, z 88..97). One basin ring from OSM.
 *  - Decks: the paved deck round the L (orthophoto: 4-6 m) and the paved round of the Peuterbad.
 *  - The diving board at the deep basin's south end (light blue, x 0, z 75..83).
 *  - The 1967 changing-room wings along the north and west of the site: low brick blocks under a field of small square pyramid
 *    roof-lights (the orthophoto's signature texture). BAG has only fragments of them (0363100012109701, ...124231, ...186769,
 *    ...186768, ...186772, ...186771, ...186783, ...186779), so the outline is traced from the orthophoto and those panden are
 *    drawn as part of the wing, not as separate shells.
 *  - The other pavilions (main/staff building ...186770, ...186773, ...186782, ...186774, ...113073) on their 3DBAG shells.
 */
type Pand = {id: string; nativeRing: number[][]; surfaces: Surface[]; groundOffset: number};
type Src = {nativeRing: number[][]; surfaces: Surface[]; pands: Pand[]; basins: {osm: string; ring: number[][]}[]};

/** Changing-room wings, traced on the gridded orthophoto (native x east, z south). */
const WINGS: XZ[] = [[-83, 18], [-66, 18], [-66, 14], [-24, 10], [-23, 17], [-50, 20.5], [-63, 25], [-63, 56], [-82.5, 56]];
const WING_PANDS = new Set(['0363100012109701', '0363100012124231', '0363100012186769', '0363100012186768', '0363100012186772', '0363100012186771', '0363100012186783', '0363100012186779']);
const WALL_TOP = 3.0, PYR = 0.9, CELL = 4.6;

export function buildFlevoparkbad(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as Src;
  // ---- pavilions on their 3DBAG shells ----
  addShell(b, src as never, {wall: 'brick', roof: 'slate'});
  for (const p of src.pands) {
    if (WING_PANDS.has(p.id)) continue;
    addShell(b, {surfaces: p.surfaces} as never, {wall: 'brick', roof: 'slate'});
    // the pavilions' 3DBAG ground stands 0.2-0.6 m above the staff building's: a brick plinth carries each shell to the site ground
    if (p.groundOffset > 0.05) prismRing(b, offsetRing(p.nativeRing, 0.05), 0, p.groundOffset + 0.02, 'brick'); // 5 cm proud: a plinth step, no face shared with the shell
  }

  // ---- changing-room wings: low brick block, a field of square pyramid roof-lights ----
  prismRing(b, WINGS, 0, WALL_TOP, 'brick');
  // the flat-roofed middle strip of the west wing (BAG ...186769-...186771) has no pyramids on the orthophoto
  const flat = (x: number, z: number) => x > -73 && z > 26 && z < 49;
  for (let x = -83; x < -22; x += CELL) for (let z = 10; z < 56; z += CELL) {
    const cs: XZ[] = [[x, z], [x + CELL, z], [x + CELL, z + CELL], [x, z + CELL]];
    if (!cs.every(c => inRing(WINGS, c[0], c[1])) || flat(x + CELL / 2, z + CELL / 2)) continue;
    pyramid(b, [x + CELL / 2, z + CELL / 2], CELL - 0.3, WALL_TOP - 0.05, PYR, 'slate');
  }

  // ---- the L-shaped bath and its deck ----
  const L = src.basins.find(x => x.osm === 'a148160422')!.ring;
  basin(b, L, {deck: 4.5});
  // lane lines of the deep leg (orthophoto: eight lanes, lines at x 3..21, z 44..77)
  for (let x = 3; x <= 21; x += 3) strip(b, [x, 44], [x, 77], 0.25, 0.28, 'dark');
  // the diving board at the deep leg's south end: a light-blue board on a stand, reaching 6 m over the water
  boxAt(b, [0.4, 82.4], 1.6, 1.6, 0, 1.0, 0, 'copper');
  boxAt(b, [0.4, 78.6], 0.7, 7.4, 1.0, 0.18, 0, 'copper');
  // the light-blue canopy in the shallow leg, on four posts
  for (const [x, z] of [[-61, 89], [-54, 89], [-61, 96], [-54, 96]] as XZ[]) post(b, [x, z], 0, 2.4, 0.1, 'frame');
  pyramid(b, [-57.5, 92.5], 8.2, 2.4, 1.0, 'copper');

  // ---- Peuterbad: round toddler pool on its paved round, a fountain post in the middle ----
  const P = src.basins.find(x => x.osm === 'a148167872')!.ring;
  prismRing(b, offsetRing(P, 6.5), 0, 0.1, 'concrete');
  basin(b, P, {});
  const pc = P.reduce((s, q) => [s[0] + q[0] / P.length, s[1] + q[1] / P.length], [0, 0]) as XZ;
  post(b, pc, 0, 1.4, 0.18, 'frame');
}

/** A closed square pyramid (base side s at y0, apex h higher), axis-aligned. */
function pyramid(b: BuildingTools, c: XZ, s: number, y0: number, h: number, colour: string) {
  const g = new T.ConeGeometry(s / Math.SQRT2, h, 4, 1, false).rotateY(Math.PI / 4).translate(c[0], y0 + h / 2, c[1]);
  b.add(g, colour as never);
}
