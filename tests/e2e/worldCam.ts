// The camera both engines answer, for specs and scripts that read the view inside `page.evaluate`.
// Under the default engine `vectorMap.map` is the MapLibre map; under `?engine=own` it is undefined and the engine's
// CameraMap (`vectorMap.cameraMap`) answers the same jumpTo / stop / setMaxPitch / triggerRepaint / getPixelRatio /
// once('render') calls. Read camera values through `vectorMap.camera` (WorldCamera: center, zoom, pitch, bearing,
// bounds, project, unproject, whenIdle) and pixels through `vectorMap.frameCanvas()` / `captureFrame()`.
// Delete with the default path at P5 (engine-programme-20261030.md).
// The own engine is the default since the Amsterdam flip (#129): `ENGINE=maplibre` runs the MapLibre lane (the specs
// that `test.skip(OWN, …)`) until P5 deletes it; `ENGINE=own` (or nothing) is the own engine.
export const OWN = process.env.ENGINE !== 'maplibre';

// Inside page.evaluate(() => { … }) copy this line (page functions must be self-contained):
//   const vm = (window as any).canalRecallGame.vectorMap; const map = vm.map ?? vm.cameraMap;
export function oracleCameraSource(): string {
  return `(() => { const vm = window.canalRecallGame.vectorMap; return vm.map ?? vm.cameraMap; })()`;
}
