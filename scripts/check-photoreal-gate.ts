import assert from 'node:assert';
import {
  ACTIVATION_ZOOM,
  RELEASE_ZOOM,
  shouldShowPhotoreal,
} from '../src/canalRecall/building/photorealGate.ts';

const cases: Array<[string, Parameters<typeof shouldShowPhotoreal>[0], boolean]> = [
  ['off stays off however far out', { enabled: false, cameraZoom: 0.2, active: false }, false],
  ['off retires an active mesh', { enabled: false, cameraZoom: 0.2, active: true }, false],

  ['default play zoom never activates', { enabled: true, cameraZoom: 0.5, active: false }, false],
  ['default play zoom retires an active mesh', { enabled: true, cameraZoom: 0.5, active: true }, false],
  ['street zoom stays off', { enabled: true, cameraZoom: 1.2, active: false }, false],

  ['exactly at the activation zoom activates', { enabled: true, cameraZoom: ACTIVATION_ZOOM, active: false }, true],
  ['just above it (more street) does not', { enabled: true, cameraZoom: ACTIVATION_ZOOM + 0.01, active: false }, false],
  ['overview zoom activates', { enabled: true, cameraZoom: 0.2, active: false }, true],

  // The hysteresis band: inside it, the answer depends on which way we came.
  ['inside the band, stay on once on', { enabled: true, cameraZoom: 0.35, active: true }, true],
  ['inside the band, stay off once off', { enabled: true, cameraZoom: 0.35, active: false }, false],
  ['exactly at the release zoom stays on', { enabled: true, cameraZoom: RELEASE_ZOOM, active: true }, true],
  ['above the release zoom drops out', { enabled: true, cameraZoom: RELEASE_ZOOM + 0.01, active: true }, false],

  ['an unsynced camera holds an active mesh', { enabled: true, cameraZoom: null, active: true }, true],
  ['an unsynced camera does not start one', { enabled: true, cameraZoom: null, active: false }, false],
  ['NaN is treated as unsynced', { enabled: true, cameraZoom: NaN, active: true }, true],
];

for (const [name, input, expected] of cases) {
  assert.strictEqual(shouldShowPhotoreal(input), expected, name);
}

assert.ok(ACTIVATION_ZOOM < RELEASE_ZOOM, 'activation must sit below release or the band inverts');
assert.ok(ACTIVATION_ZOOM < 0.5, 'default play zoom 0.50 must stay on 3DBAG');

// Zooming out then in across the band must switch exactly once each way.
let active = false;
const flips: number[] = [];
for (const zoom of [1.5, 0.5, 0.39, 0.33, 0.32, 0.2, 0.32, 0.38, 0.39, 0.5]) {
  const next = shouldShowPhotoreal({ enabled: true, cameraZoom: zoom, active });
  if (next !== active) flips.push(zoom);
  active = next;
}
assert.deepStrictEqual(flips, [0.32, 0.39], `expected one flip out and one in, got ${flips.join(', ')}`);

console.log(`photoreal gate: ${cases.length} cases + zoom-out/in sweep passed`);
