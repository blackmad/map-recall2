import type {BuildingTools} from './cultural-builders';
import {basin, boxAt, prismRing, strip, type XZ} from './pool-kit';
import source from './brediusbad-footprints.json';

/**
 * BREDIUSBAD, Spaarndammerdijk (outdoor bath in the Brediuspark; no BAG pand: the bath is its basins). Sources: OSM
 * leisure=swimming_pool a148162370 (the rounded triangular basin) and a148165410 (the rectangular basin) (ODbL); PDOK luchtfoto
 * 2025 (Beeldmateriaal Nederland, CC BY 4.0) gridded in native metres (artifacts/pools/ortho/brediusbad*.jpg) for the deck, the
 * divider and the two small pavilions. Native frame: x east, z south, y up, origin at the OSM site centre
 * (pool-site-prepare.ts --main=none). Per item in brediusbad-inventory.json.
 *  - Two basins on one dark (rubber/asphalt) deck: a rounded triangle (north-east, under its winter cover on the 2025
 *    photo) and a rectangle (south-west), both with a pale blue coping.
 *  - A white divider runs across the deck between the basins.
 *  - A small pale kiosk at the north-west tip of the deck and a pale shelter at its south-east edge (heights inferred).
 */
type Src = {basins: {osm: string; ring: number[][]}[]};
/** The dark deck, traced on the gridded orthophoto. */
const DECK: XZ[] = [[5.6, -17.5], [55, -14.4], [60.5, -8], [57, 8.5], [38.5, 27.5], [22.5, 50.5], [-12.5, 25.6], [-4.5, 17], [0, 8], [-7, 3], [-2, -8]];

export function buildBrediusbad(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as Src;
  prismRing(b, DECK, 0, 0.1, 'dark');
  for (const id of ['a148162370', 'a148165410']) basin(b, src.basins.find(x => x.osm === id)!.ring, {});
  // the white divider across the deck (orthophoto: (-0.6, -1.9) to (38.8, 27.5)), a 1 m rail
  strip(b, [-0.6, -1.9], [38.8, 27.5], 0.2, 1.0, 'white');
  const a = Math.atan2(165, 215); // the rectangular basin's long axis
  boxAt(b, [33.8, 37.5], 7.0, 5.5, 0, 2.7, a, 'concrete'); // south-east shelter
  boxAt(b, [3.5, -14.2], 3.6, 4.2, 0, 2.6, a, 'concrete'); // north-west kiosk
}
