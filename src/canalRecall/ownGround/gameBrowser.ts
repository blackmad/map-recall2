// Browser entry for the own ground in the game (`?ownGround=1`):
// public/canal-drive/js/own-ground-game.bundle.js, global CanalRecallOwnGround.
// vector-map.js loads it on demand. THREE comes from the shared frame.
export { OwnGround, type GroundHost, type OwnGroundOptions } from './gameGround.js';
export { GROUND_ORDER } from './sharedFrameGround.js';
export { WATER_Z, toLocal, fromLocal, GroundStore } from './groundStore.js';
export { footprintAxis, movableLeaves, pointInRing } from './decks.js';
export { separatePands, remapAttribute, groundVertices, liftPands } from './chunkBases.js';
export { basemapGroundPatches } from './basemapPalette.js';
export { overviewBasemapPatches } from '../overviewTransition/basemapOverview.js';
export { overviewTilesPlan, OVERVIEW_TILES_DIR, OVERVIEW_TILES_SOURCE, OVERVIEW_TILES_LAYER } from '../overviewTiles/tileset.js';
