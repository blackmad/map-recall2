// Texture-array layer choices shared by the gallery pages (pure, so node checks can import them).
import { BAY_LAYER_COUNT, FATIH_MASONRY_LAYER, bayLayer } from './bayLook.js';
import { CELL_LAYER_COUNT, cellLayer } from './facadeCells.js';
import { cellSetOf, type BuildingLook } from './threeBuildingFeatures.js';

/** Layer indices for landmark-kit triangles, as ThreeBuildings.kitLayers() picks them. */
export function kitLayersFor(look: BuildingLook): { plain: number; flat: number; slope: number; fatihMasonry?: number } {
  const cells = cellSetOf(look), roofBase = cells === 'procedural' ? CELL_LAYER_COUNT : BAY_LAYER_COUNT;
  const plain = look === 'untextured' ? roofBase + 3 : cells === 'procedural' ? cellLayer('canal', 'plain', 0) : bayLayer('canal', 0, 'plain');
  return { plain, flat: roofBase + 3, slope: roofBase + 1, fatihMasonry: look === 'photo' ? FATIH_MASONRY_LAYER : undefined };
}
