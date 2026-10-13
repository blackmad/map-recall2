import type {BuildingTools} from './cultural-builders';
import source from './dokwerker-source.json';
import {placeFigure, letterBoxes} from './figure-kit';

/**
 * De Dokwerker (Mari Andriessen, 1952; J.D. Meijerplein). Hand pass from the figure kit: the stocky docker standing with his feet planted
 * well apart, arms hanging a little out from the body with open hands, the head thrown back and the chin up, a flat cap, a loose work shirt
 * over baggy trousers (Anefo photograph 931-3422, CC0). The pedestal is a rough dark block with a lighter slab under the boots and the year
 * 1941 on the front. Heights from the UvA thesis record (statue 2.60 m, pedestal 1.60 x 1.15 x 1.10 m). Original geometry; no photographic pixels.
 */
export function buildDokwerker(_w: number, _d: number, b: BuildingTools) {
  const stone = source.pedestalMetres;
  b.box(0, 0, 0, stone.width, stone.height, stone.depth, 'stone');
  b.box(0, stone.height, 0, 1.12, .075, 1.04, 'dark');
  // The year on the pedestal's front face (raised stroke figures, 4 cm).
  for (const g of letterBoxes('1941', 0.34, 0.8, 0.04)) b.add(g, 'dark', 0, stone.height * 0.4, stone.depth / 2);
  const floor = stone.height + .075;
  placeFigure(b, {
    height: 2.5, stout: 1.55, chest: 1.3, skirt: {len: 0.3, flare: 1.55}, hat: 'cap',
    legs: {l: {pitch: 0.03, roll: 0.13}, r: {pitch: 0.03, roll: 0.13}},
    arms: {l: {pitch: 0.12, roll: 0.42, bend: 0.3}, r: {pitch: 0.12, roll: 0.42, bend: 0.3}},
    head: {pitch: -0.5}, lean: -0.05,
  }, {x: 0, y: floor, z: 0}, 'bronze');
}
