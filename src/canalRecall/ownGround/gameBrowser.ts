// Browser entry for the own ground in the game (`?ownGround=1`):
// public/canal-drive/js/own-ground-game.bundle.js, global CanalRecallOwnGround.
// vector-map.js loads it on demand. THREE comes from the shared frame.
export { OwnGround, type GroundHost, type OwnGroundOptions } from './gameGround.js';
export { GROUND_ORDER } from './sharedFrameGround.js';
export { WATER_Z, toLocal, fromLocal } from './groundStore.js';
export { separatePands, remapAttribute, groundVertices, liftPands } from './chunkBases.js';
