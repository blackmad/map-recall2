import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {eaveOffset, getSink, ledgeStrip, letters, ringFrame, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import {basin, inRing, offsetRing, solarField} from './pool-kit';
import source from './sloterparkbad-footprints.json';

/**
 * SLOTERPARKBAD, President Allendelaan 3 (BAG pand 0363100012084387, bouwjaar 2001): the swimming and sports centre on the
 * Sloterplas, a long red-brick hall along the car park with a zinc-clad west wing, and the outdoor basin on the lake side.
 * Sources: BAG ring + 3DBAG LoD2.2 shell (CC0 / CC BY 4.0) via pool-site-prepare.ts; Gemeente Amsterdam panoramas (CC BY 4.0)
 * for the north-west fronts; PDOK luchtfoto (Beeldmateriaal Nederland, CC BY 4.0) for the roofs, the solar field and the basin;
 * OSM a488807746 (ODbL) for the basin outline. Per item in sloterparkbad-inventory.json.
 *  - North-west front of the hall (w01-309, TMX7316010203-002508_pano_0004_000065; ring edges 65-77): red brick, two rows of
 *    small square windows (about 0.8 m, at 5.2 and 8.6 m, every 3.3 m), a glazed ground floor, and the signature: the long
 *    walkway on posts in front of it, a ramp rising from the north-east end to a 3.8 m deck, perforated light-grey balustrade
 *    panels, with a steel stair climbing from the deck to a door at 8.6 m.
 *  - The zinc west wing (w02-309 edge 6, w09-309 the curved corner, w12-219 edge 8): grey zinc in horizontal courses, two
 *    orange bands of window panels lettered BASIC FIT (the gym's fit-out), strip windows on the south-west end.
 *  - Roofs (orthophoto): the long hall's light roof (3DBAG shell, its glass peak over the lake end), a solar field on the west
 *    wing.
 *  - Outdoor (orthophoto, OSM): the 25 m basin with six lanes on its paved deck.
 */
type Src = {nativeRing: number[][]; surfaces: Surface[]; basins: {osm: string; ring: number[][]}[]};
export function buildSloterparkbad(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as Src;
  const ring = src.nativeRing;
  // zinc west wing (wall centroid west of x -18), red brick hall east of it
  const cx = (s: Surface) => { const r = s.rings[0]; return r.reduce((a, v) => a + v[0], 0) / r.length; };
  addShell(b, src as never, {wall: 'brick', roof: 'concrete', wallFor: s => (cx(s) < -18 ? 'greyBrick' : 'brick')});
  const roofs = src.surfaces.filter(s => s.type === 'RoofSurface');
  const fr = (i: number) => ringFrame(ring, i, Math.max(-0.5, Math.min(1.5, eaveOffset(ring, roofs, i))));

  const sink0 = getSink();
  setSink(0.05, true);
  // ---- the hall's north-west front: windows, glazed ground floor, walkway ----
  // edges left to right facing the front (north-east to south-west); the ramp runs up edge 67, the deck is level after it
  // the walkway runs the whole chain of front edges (65, then 67-78 with the short jogs between them); its height follows the
  // distance along the chain: the ramp from 1.2 m at the north-east end to the 3.8 m deck 40 m on
  const CHAIN = [65, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78];
  const deckAt = (s: number) => 1.2 + Math.min(1, s / 40) * 2.6;
  let s0 = 0;
  for (const i of CHAIN) {
    const {f, len} = fr(i);
    if (len >= 1.5) groundGlass(b, f, len);
    if (len >= 5) {
      const n = Math.floor((len - 1) / 3.3);
      for (let k = 0; k < n; k++) { const t = (len - (n - 1) * 3.3) / 2 + k * 3.3; for (const y of [5.2, 8.6]) square(b, f, t, y); }
    }
    if (len >= 0.4) walkway(b, f, len, [deckAt(s0), deckAt(s0 + len)]);
    s0 += len;
  }
  {
    // the steel stair from the deck up to the door at 8.6 m, 15-31 m along edge 67 (w01: x 600-980 of the rectified strip)
    const {f} = fr(67);
    stair(b, f, 15, 31, 3.8, 8.4);
  }

  // ---- the zinc wing: courses, BASIC FIT bands (w02-309 edge 6, w09-309 edges 0 and 2), strip windows (w12-219 edge 8) ----
  for (const i of [6, 0, 2]) {
    const {f, len} = fr(i);
    for (let y = 0.6; y < 7; y += 0.75) ledgeStrip(b, f, len / 2, y, len - 0.2, 0.06, 0.06, 'greyBrick');
    for (const y of [1.0, 6.2]) orangeBand(b, f, len, y, i === 6);
  }
  {
    const {f, len} = fr(8);
    for (const y of [1.4, 5.0]) { slab(b, f, len / 2, y, len * 0.6, 1.0, 0.1, 'frame'); slab(b, f, len / 2, y + 0.08, len * 0.6 - 0.16, 0.84, 0.14, 'glass'); }
  }
  // the lake end of the hall (edge 45, inferred: no panorama; the orthophoto shows glass at its peak): a glazed ground floor
  { const {f, len} = fr(45); groundGlass(b, f, len); }
  setSink(sink0);

  // ---- solar field on the west wing (orthophoto: rows parallel to the wing, its whole flat roof) ----
  const roofAt = (x: number, z: number) => roofHeightAt(src.surfaces, x, z);
  const wing = [[-45.4, -3.6], [-30.8, 5.7], [-65.2, 48.1], [-79.8, 38.8]];
  solarField(b, wing, (x, z) => (inRing(offsetRing(ring, -1.2), x, z) ? roofAt(x, z) : null), 'dark', {depth: 1.0, pitch: 1.4, tilt: 10, inset: 0.8, angleDeg: -51.4});

  // ---- the outdoor basin on its deck ----
  basin(b, src.basins[0].ring, {deck: 4, lanes: 6});
}

/** Ground-floor glazing to 3.4 m with mullions every 1.8 m and a dark head band. */
function groundGlass(b: BuildingTools, f: Frame, len: number) {
  slab(b, f, len / 2, 0.15, len - 0.4, 3.25, 0.14, 'glass');
  const n = Math.max(1, Math.round(len / 1.8));
  for (let k = 1; k < n; k++) slab(b, f, (k * len) / n, 0.15, 0.08, 3.25, 0.2, 'frame');
  slab(b, f, len / 2, 3.4, len, 0.3, 0.18, 'dark');
}
/** A small square window: light frame, dark glass, 0.8 m. */
function square(b: BuildingTools, f: Frame, t: number, y: number) {
  slab(b, f, t, y, 0.86, 0.86, 0.08, 'frame');
  slab(b, f, t, y + 0.06, 0.74, 0.74, 0.12, 'glass');
}
/**
 * The walkway in front of the hall (in 'sandstone', the light-grey steel: not 'frame', which the openings gate reads as a
 * window frame that must stand on its wall): a deck 2.4 m deep standing 3.2 m out from the wall, rising from y0 to y1 along the edge
 * (laid in 3 m steps, which read as the ramp), a perforated light-grey balustrade 1.1 m high on its outer edge, posts every 6 m.
 */
function walkway(b: BuildingTools, f: Frame, len: number, [y0, y1]: [number, number]) {
  const n = Math.max(1, Math.round(len / 3)), step = len / n;
  if (len < 3) { // a short jog: one deck piece and its rail, no post
    slab(b, f, len / 2, (y0 + y1) / 2 - 0.3, len + 0.4, 0.3, 2.4, 'concrete', 3.2);
    slab(b, f, len / 2, (y0 + y1) / 2, len, 1.1, 0.06, 'sandstone', 5.55);
    return;
  }
  for (let k = 0; k < n; k++) {
    const y = y0 + ((y1 - y0) * (k + 0.5)) / n, t = (k + 0.5) * step;
    slab(b, f, t, y - 0.3, step + 0.02, 0.3, 2.4, 'concrete', 3.2);
    slab(b, f, t, y, step - 0.08, 1.1, 0.06, 'sandstone', 5.55); // balustrade panel
    slab(b, f, t, y, step - 0.08, 1.1, 0.06, 'sandstone', 3.2); // the inner rail panel
  }
  for (let t = 1; t < len; t += 6) {
    const y = y0 + ((y1 - y0) * t) / len;
    slab(b, f, t, 0, 0.3, y - 0.3, 0.3, 'sandstone', 4.3);
  }
}
/** A straight steel stair from (t0, y0) to (t1, y1) between the deck and the wall: treads, two stringers' worth of panels, a landing. */
function stair(b: BuildingTools, f: Frame, t0: number, t1: number, y0: number, y1: number) {
  const n = 14, run = (t1 - 2.5 - t0) / n, rise = (y1 - y0) / n;
  for (let k = 0; k < n; k++) {
    slab(b, f, t0 + (k + 0.5) * run, y0 + k * rise, run + 0.02, rise + 0.02, 1.4, 'sandstone');
    slab(b, f, t0 + (k + 0.5) * run, y0 + (k + 1) * rise, run - 0.04, 1.0, 0.05, 'sandstone', 1.4); // balustrade panel
  }
  slab(b, f, t0 - 0.75, y0 - 0.3, 1.5, 0.3, 3.3, 'sandstone'); // the foot platform, from the wall to the deck
  slab(b, f, t1 - 1.25, y1 - 0.3, 2.5, 0.3, 1.5, 'sandstone'); // landing at the door
  slab(b, f, t1 - 1.25, y1, 2.5, 1.0, 0.05, 'sandstone', 1.5);
  slab(b, f, t1 - 1.0, y1, 1.0, 2.2, 0.1, 'dark'); // the door
}
/** An orange band of window panels with BASIC FIT in white on the longest wall, centred. */
function orangeBand(b: BuildingTools, f: Frame, len: number, y: number, lettered: boolean) {
  const n = Math.max(1, Math.floor((len - 2) / 2.4));
  for (let k = 0; k < n; k++) slab(b, f, (len - n * 2.4) / 2 + (k + 0.5) * 2.4, y, 2.2, 1.1, 0.12, 'gold');
  if (lettered) for (const t of [len * 0.25, len * 0.75]) letters(b, f, 'BASIC FIT', t, y + 0.2, 0.12, 0.1, 0.03, 'white');
}
