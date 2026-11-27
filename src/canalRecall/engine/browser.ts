// window.CanalRecallEngine: the engine bundle (`npm run build:canal-engine`).
// game.js builds its world view from it (OwnWorldView, the only one since MapLibre was deleted 2026-11-27).
export { OwnWorldView, MercatorCoordinate, UNIMPLEMENTED } from './ownWorldView';
export { ownWorldViewOrNull } from './ownWorldViewOrNull';
export { nullWorldView } from './nullWorldView';
export { FrameHost, StepClock } from './frameHost';
export { CameraMap, EngineCamera } from './cameraMap';
export { hasWorldCamera } from './worldViewApi';
export { withLabelPand } from './labelPand';
export { worldCameraOf, boundsContain, onViewChange } from './worldCameraOf';
export { RiderCoverTracker } from './riderCover';
export { clearCamera, sightlineBlocker, blockingFeature, featureBox, CLEARANCE_MAX_DROP } from './cameraClearance';
export { GameCameraSolver } from './gameCamera';
