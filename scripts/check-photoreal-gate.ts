import assert from 'node:assert';
import {
  ACTIVATION_METERS,
  RELEASE_METERS,
  shouldShowPhotoreal,
} from '../src/canalRecall/building/photorealGate.ts';

const cases: Array<[string, Parameters<typeof shouldShowPhotoreal>[0], boolean]> = [
  ['off stays off however high', { enabled: false, altitudeMeters: 400, active: false }, false],
  ['off retires an active mesh', { enabled: false, altitudeMeters: 400, active: true }, false],

  ['cycling height never activates', { enabled: true, altitudeMeters: 1.7, active: false }, false],
  ['cycling height retires an active mesh', { enabled: true, altitudeMeters: 1.7, active: true }, false],
  ['the measured smear at 10 m stays off', { enabled: true, altitudeMeters: 10, active: false }, false],

  ['exactly at the activation height activates', { enabled: true, altitudeMeters: ACTIVATION_METERS, active: false }, true],
  ['just below it does not', { enabled: true, altitudeMeters: ACTIVATION_METERS - 0.01, active: false }, false],
  ['overview height activates', { enabled: true, altitudeMeters: 150, active: false }, true],

  // The hysteresis band: inside it, the answer depends on which way we came.
  ['inside the band, stay on once on', { enabled: true, altitudeMeters: 23, active: true }, true],
  ['inside the band, stay off once off', { enabled: true, altitudeMeters: 23, active: false }, false],
  ['exactly at the release height stays on', { enabled: true, altitudeMeters: RELEASE_METERS, active: true }, true],
  ['below the release height drops out', { enabled: true, altitudeMeters: RELEASE_METERS - 0.01, active: true }, false],

  ['an unreadable camera holds an active mesh', { enabled: true, altitudeMeters: null, active: true }, true],
  ['an unreadable camera does not start one', { enabled: true, altitudeMeters: null, active: false }, false],
  ['NaN is treated as unreadable', { enabled: true, altitudeMeters: NaN, active: true }, true],
];

for (const [name, input, expected] of cases) {
  assert.strictEqual(shouldShowPhotoreal(input), expected, name);
}

assert.ok(RELEASE_METERS < ACTIVATION_METERS, 'release must sit below activation or the band inverts');

// A climb and descent across the band must switch exactly once each way.
let active = false;
const flips: number[] = [];
for (const altitude of [1.7, 10, 20, 23, 24.9, 25, 60, 150, 60, 25, 23, 22, 21.9, 10, 1.7]) {
  const next = shouldShowPhotoreal({ enabled: true, altitudeMeters: altitude, active });
  if (next !== active) flips.push(altitude);
  active = next;
}
assert.deepStrictEqual(flips, [25, 21.9], `expected one flip up and one down, got ${flips.join(', ')}`);

console.log(`photoreal gate: ${cases.length} cases + climb/descent sweep passed`);
