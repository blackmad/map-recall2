import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {eaveOffset, letters, ringFrame, slab, setSink, getSink, type Frame} from './nearbar-kit';
import {basin, solarField} from './pool-kit';
import {roofHeightAt} from './nearbar-kit';
import source from './sportplaza-mercator-footprints.json';

/**
 * SPORTPLAZA MERCATOR, Jan van Galenstraat / Postjesweg (BAG pand 0363100012092403, bouwjaar 2006): the sports bath on the site
 * of the Jan van Galenbad, wrapped in planted walls that run up into a green roof, with the old bath's outdoor lap pool in the
 * park behind it. Sources: BAG ring + 3DBAG LoD2.2 shell (CC0 / CC BY 4.0) via pool-site-prepare.ts; Gemeente Amsterdam
 * panoramas (CC BY 4.0) for the north and west fronts; PDOK luchtfoto (CC BY 4.0) and OSM a147998778 (ODbL) for the basin.
 * Per item in sportplaza-mercator-inventory.json.
 *  - The planted walls are the shell's walls in a dark moss green, the sloping green roof the shell's roof (w01-358, w11-343).
 *  - North front (ring edges 24, 23, 22; TMX7316010203-002064_pano_0000_002391 rectified at 50 px/m): a two-tier glazed
 *    ground floor (doors to 3.0 m, a dark transom, upper lights to 5.6 m), a dark fascia to 6.6 m, a steel canopy at 7.2 m over
 *    the entrance half, two strip windows in the planted wall at 8.2-9.4 m, and the SPORTPLAZA MERCATOR panel at the east end, beside the bay;
 *    the angled entrance bay (edge 23) is glass to the fascia, lettered ZWEMMEN (TMX7316010203-001700_pano_0003_000005).
 *  - West front (edges 45 and 49): glazed ground floor under the planted wall (2025_09_25_08_37_35_00235).
 *  - Outdoor lap pool (orthophoto): eight lanes, white coping, a pale deck about 3.5 m wide.
 */
type Src = {nativeRing: number[][]; surfaces: Surface[]; basins: {osm: string; ring: number[][]}[]};
export function buildSportplazaMercator(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as Src;
  const ring = src.nativeRing;
  addShell(b, src as never, {wall: 'green', roof: 'bronze'});
  const roofs = src.surfaces.filter(s => s.type === 'RoofSurface');
  const fr = (i: number) => ringFrame(ring, i, Math.max(-0.5, Math.min(1.5, eaveOffset(ring, roofs, i))));
  const sink0 = getSink();
  setSink(0.05, true);
  // glazing runs the whole north front: edges 25 and 26 (the west third, x -36..-27) carry it too (review 2026-11-15: the
  // photo's right third is glass under a low canopy, the model's was planted wall)
  glazedFront(b, fr(22), {y: 7.1, depth: 1.6, share: 0.75});
  glazedFront(b, fr(24), {y: 6.4, depth: 2.6, share: 0.7}); // the entrance canopy over the middle of the front (w01-358)
  for (const i of [25, 26]) glazedFront(b, fr(i), {y: 5.0, depth: 2.0, share: 1}); // the lower canopy over the west end
  // the two strip windows of the w01 crop stand 13.0 and 23.8 m from the front's west end (x = -27.35): both on edge 24
  {
    const {f, len} = fr(24);
    const tW = tOf(f, -27.35, -25.24) < len / 2 ? 0 : len, dir = tW === 0 ? 1 : -1;
    for (const [u, w] of [[13.0, 6.0], [23.8, 5.5]]) stripWindow(b, f, tW + dir * u, w);
  }
  // the angled entrance bay: glass to the fascia, ZWEMMEN in white over it
  {
    const {f, len} = fr(23);
    glassBand(b, f, len, 0.15, 5.6);
    slab(b, f, len / 2, 5.6, len, 1.0, 0.35, 'dark');
    letters(b, f, 'ZWEMMEN', len / 2, 4.55, 0.32, 0.11, 0.03, 'white');
  }
  // east end of the north front, beside the ZWEMMEN bay (TMX7316010203-002064_pano_0000_002391: the panel stands at the left of
  // the street view, i.e. the east end; first frames put it at the west end and were moved): SPORTPLAZA MERCATOR panel
  {
    const {f, len} = fr(24);
    const tE = tOf(f, -27.35, -25.24) < len / 2 ? len : 0, dir = tE === 0 ? 1 : -1;
    slab(b, f, tE + dir * 3.5, 2.9, 4.6, 1.6, 0.36, 'copper');
    letters(b, f, 'SPORTPLAZA', tE + dir * 3.5, 3.82, 0.4, 0.07, 0.03, 'white');
    letters(b, f, 'MERCATOR', tE + dir * 3.5, 3.12, 0.4, 0.07, 0.03, 'white');
  }
  for (const i of [45, 49]) { const {f, len} = fr(i); glassBand(b, f, len, 0.15, 4.2); slab(b, f, len / 2, 4.2, len, 0.7, 0.3, 'dark'); }
  setSink(sink0);

  basin(b, src.basins[0].ring, {deck: 3.5, lanes: 8, laneColour: 'sandstone'});

  // ---- solar-panel fields on the flat green roofs (PDOK luchtfoto 2025, gridded at 13.3 cm/px: five dark striped fields) ----
  const roofAt = (x: number, z: number) => roofHeightAt(src.surfaces, x, z);
  for (const [x0, x1, z0, z1] of SOLAR) solarField(b, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], roofAt, 'dark', {depth: 1.0, pitch: 1.35, tilt: 12, inset: 0.2});
}

/** Two-tier glazed ground floor, dark fascia, an optional steel canopy (`y` its underside, `depth` its reach, `share` of the edge). */
function glazedFront(b: BuildingTools, {f, len}: {f: Frame; len: number}, canopy: {y: number; depth: number; share: number} | null) {
  glassBand(b, f, len, 0.15, 3.0);
  slab(b, f, len / 2, 3.0, len - 0.6, 0.4, 0.3, 'dark'); // transom
  glassBand(b, f, len, 3.4, 5.6);
  slab(b, f, len / 2, 5.6, len, 1.0, 0.35, 'dark'); // fascia
  if (canopy) {
    const {y, depth, share} = canopy;
    slab(b, f, len / 2, y, len * share, 0.22, depth, 'dark');
    if (y > 5.7) for (const t of [len * 0.2, len * 0.5, len * 0.8]) slab(b, f, t, y - 0.5, 0.12, 0.5, depth - 0.2, 'frame');
    else for (const t of [0.4, len - 0.4]) slab(b, f, t, y - 0.4, 0.12, 0.4, depth - 0.2, 'frame');
  }
}
/** A strip window in the planted wall at 8.2-9.4 m: dark steel frame round the glass. The planted wall leans back above the
 * fascia, so both slabs reach 1.2 m into it and stay on the wall. */
function stripWindow(b: BuildingTools, f: Frame, t: number, w: number) {
  slab(b, f, t, 8.2, w, 1.2, 1.42, 'frame', -1.2);
  slab(b, f, t, 8.32, w - 0.3, 0.96, 1.48, 'glass', -1.2);
}
/** A glass band from y0 to y1 with mullions every 1.8 m. */
function glassBand(b: BuildingTools, f: Frame, len: number, y0: number, y1: number) {
  slab(b, f, len / 2, y0, len - 0.6, y1 - y0, 0.18, 'glass');
  const n = Math.max(1, Math.round(len / 1.8));
  for (let k = 1; k < n; k++) slab(b, f, (k * len) / n, y0, 0.08, y1 - y0, 0.24, 'frame');
}
/** Solar fields traced on the orthophoto, native [x0, x1, z0, z1]. */
const SOLAR: [number, number, number, number][] = [[-37.4, -30.2, -23.6, -13.9], [-25.4, -9.3, -24.2, -19.0], [-9.3, 8.0, -19.6, -13.6], [-4.6, 8.0, -13.6, -7.7], [13.6, 29.9, -25.8, -14.0], [32.5, 42.2, -22.9, -13.9]];
const tOf = (f: Frame, x: number, z: number) => (x - f.origin[0]) * f.tangent[0] + (z - f.origin[1]) * f.tangent[1];
