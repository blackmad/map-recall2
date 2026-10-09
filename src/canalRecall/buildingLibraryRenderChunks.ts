/** Fine rendering partitions preserve canonical ownership and full geometry. */
import { BUILDING_TILE_ZOOM } from './buildingTileSource';
import { compileAppearanceTiles, type AppearanceBuilding } from './cityAppearanceTiles';

export function planBuildingRenderChunks<G>(buildings: AppearanceBuilding<G>[], renderZoom = 18) {
  if (!Number.isInteger(renderZoom) || renderZoom < BUILDING_TILE_ZOOM || renderZoom > 20) {
    throw new Error('Render zoom must be an integer between canonical zoom and 20');
  }
  const canonical = compileAppearanceTiles<G, never>(buildings, [], { zoom: BUILDING_TILE_ZOOM, halo: 0 });
  const canonicalOwnerTiles = new Map<string, string>();
  for (const tile of canonical.tiles) for (const owner of tile.owners) canonicalOwnerTiles.set(owner.id, tile.key);
  const rendering = renderZoom === BUILDING_TILE_ZOOM ? canonical
    : compileAppearanceTiles<G, never>(buildings, [], { zoom: renderZoom, halo: 0 });
  // These are whole-owner render partitions. Coverage bounds come from exported
  // geometry; nominal grid bounds must never clip a crossing owner.
  return { canonicalZoom: BUILDING_TILE_ZOOM, renderZoom, canonicalOwnerTiles,
    canonicalTileCount: canonical.tiles.filter(tile => tile.owners.length > 0).length,
    ...rendering, tiles: rendering.tiles.filter(tile => tile.owners.length > 0) };
}
