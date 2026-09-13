import assert from 'node:assert/strict';
// The renderer only reads THREE when a mesh is constructed; provide its global
// registration shell so this focused UV/geometry helper can be imported in Node.
(globalThis as any).window={CanalRecallThree:{}};
const {observedSignAspectRatio}=await import('../../src/canalRecall/studyFacadesBrowser.ts');
const uv=[0,0,1,0,1,1, 0,0,1,1,0,1];
// A north/south fascia has no world-X span. Its UV U axis runs in world Y.
const northSouth=[0,0,0, 0,6,0, 0,6,1, 0,0,0, 0,6,1, 0,0,1];
assert.ok(Math.abs(observedSignAspectRatio(northSouth,uv)-6)<1e-9,'UV basis retains the six-to-one north/south sign proportion');
const eastWest=[0,0,0, 6,0,0, 6,0,1, 0,0,0, 6,0,1, 0,0,1];
assert.ok(Math.abs(observedSignAspectRatio(eastWest,uv)-6)<1e-9,'orientation does not affect sign canvas aspect');
console.log('Observed sign canvas aspect follows UV-to-geometry dimensions in either façade direction.');
