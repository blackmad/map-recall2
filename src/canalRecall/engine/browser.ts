// window.CanalRecallEngine: the engine bundle (`npm run build:canal-engine`).
// game.js picks the world view: `?engine=own` → OwnWorldView, else VectorBasemap.
// The lifted, MapLibre-free modules are exported for vector-map.js too.
export { OwnWorldView, MercatorCoordinate, UNIMPLEMENTED } from './ownWorldView';
export { FrameHost, StepClock } from './frameHost';
export { CameraMap, EngineCamera } from './cameraMap';
export { engineFlag, hasWorldCamera } from './worldViewApi';
export { RiderCoverTracker } from './riderCover';
export { clearCamera, sightlineBlocker, blockingFeature, featureBox, CLEARANCE_MAX_DROP } from './cameraClearance';
export { GameCameraSolver } from './gameCamera';
