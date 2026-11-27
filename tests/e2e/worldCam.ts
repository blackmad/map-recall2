// The world view's camera, for specs and scripts that read the view inside `page.evaluate`. The own engine is the only
// world view since MapLibre was deleted (2026-11-27): `vectorMap.map` is undefined and the engine's CameraMap
// (`vectorMap.cameraMap`) answers jumpTo / stop / setMaxPitch / triggerRepaint / getPixelRatio / once('render'). Read
// camera values through `vectorMap.camera` (WorldCamera: center, zoom, pitch, bearing, bounds, project, unproject,
// whenIdle) and pixels through `vectorMap.frameCanvas()` / `captureFrame()`. The `vm.map ?? vm.cameraMap` idiom below
// still reads right; specs may drop the `vm.map` half as they are touched.

// Inside page.evaluate(() => { … }) copy this line (page functions must be self-contained):
//   const vm = (window as any).canalRecallGame.vectorMap; const map = vm.map ?? vm.cameraMap;
export function oracleCameraSource(): string {
  return `(() => { const vm = window.canalRecallGame.vectorMap; return vm.map ?? vm.cameraMap; })()`;
}
