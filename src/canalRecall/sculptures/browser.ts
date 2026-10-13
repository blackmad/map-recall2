// Browser entry for sculptures in the game (`?sculptures=1`):
// public/canal-drive/sculptures/sculptures.bundle.js, global CanalRecallSculptures.
// vector-map.js loads it on demand; THREE comes from the shared frame.
// Built by `node scripts/sculptures/build-bundle.mjs`.
export { Sculptures, mountSculptures, landmarkHost, sculptureMercatorFromLocal, eyeDistanceM } from './sculptureLayer.js';
export { decodeSplats, encodeSplats } from './splatFormat.js';
export { createSplatObject } from './splatMesh.js';
export { SculptureLod } from './lod.js';
