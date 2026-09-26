import assert from 'node:assert/strict';
import { worldToEquirectangularPixel, type CameraModel, type CameraPose } from './rectify.ts';
import {
  crossValidateBoresight,
  fitBoresight,
  splitAnchors,
  type FitAnchor,
} from './boresightFit.ts';

const image = { width: 3600, height: 1800 };
const pose: CameraPose = { x: 0, y: 0, z: 3, headingDeg: 0, pitchDeg: 0, rollDeg: 0 };

const worldPoints = [
  { x: -8, y: 16, z: 0 },
  { x: -4, y: 14, z: 3 },
  { x: -1, y: 18, z: 6 },
  { x: 2, y: 15, z: 9 },
  { x: 5, y: 13, z: 1 },
  { x: 7, y: 17, z: 11 },
  { x: -6, y: 20, z: 5 },
  { x: 3, y: 12, z: 2 },
];

const TRUTH_YAW = 2;
const TRUTH_PITCH = 0.3;
const truth: CameraModel = { id: 'truth', usesOrientation: false, yaw: 'centre', boresightYawDeg: TRUTH_YAW, boresightPitchDeg: TRUTH_PITCH };

const cleanAnchors: FitAnchor[] = worldPoints.map((world) => ({
  world,
  pixel: worldToEquirectangularPixel(world, pose, image, truth),
}));

// 1. A known boresight is recovered from its own projections.
const fit = fitBoresight(cleanAnchors, pose, image);
assert.ok(fit, 'expected a fit for non-empty anchors');
assert.ok(Math.abs(fit.yawDeg - TRUTH_YAW) <= 0.3, `recovered yaw ${fit.yawDeg}, expected ~${TRUTH_YAW}`);
assert.ok(Math.abs(fit.pitchDeg - TRUTH_PITCH) <= 0.3, `recovered pitch ${fit.pitchDeg}, expected ~${TRUTH_PITCH}`);
assert.equal(fit.anchors, cleanAnchors.length);
assert.ok(fit.rmsPx < 1, `expected sub-pixel residual, got ${fit.rmsPx}`);

// Empty anchors cannot be fit honestly.
assert.equal(fitBoresight([], pose, image), null, 'empty anchors must return null');

// 2. splitAnchors is deterministic and keeps both sets populated for 4+ anchors.
const first = splitAnchors(cleanAnchors);
const second = splitAnchors(cleanAnchors);
assert.deepEqual(first, second, 'split must be deterministic');
assert.ok(first.calibration.length > 0, 'calibration empty for 8 anchors');
assert.ok(first.validation.length > 0, 'validation empty for 8 anchors');
assert.equal(first.calibration.length + first.validation.length, cleanAnchors.length, 'split lost an anchor');

const sortedPixels = [...cleanAnchors]
  .sort((a, b) => a.pixel[0] - b.pixel[0] || a.pixel[1] - b.pixel[1])
  .map((a) => a.pixel[0]);
const calibrationU = first.calibration.map((a) => a.pixel[0]).sort((a, b) => a - b);
const validationU = first.validation.map((a) => a.pixel[0]).sort((a, b) => a - b);
assert.ok(validationU.length >= 2 && validationU[0] <= sortedPixels[sortedPixels.length - 1], 'validation does not span the facade');
assert.ok(calibrationU.length >= 2, 'calibration too small to span');

// A single anchor leaves calibration non-empty and validation empty.
const single = splitAnchors([cleanAnchors[0]]);
assert.equal(single.calibration.length, 1, 'single anchor must stay in calibration');
assert.equal(single.validation.length, 0, 'single anchor cannot be validated');

// 3. Cross-validation measures on held-out anchors, not on the fitted ones.
const noisePx = 0.6;
const noisyAnchors: FitAnchor[] = cleanAnchors.map((anchor, index) => ({
  world: anchor.world,
  pixel: [anchor.pixel[0] + (index % 2 === 0 ? noisePx : -noisePx), anchor.pixel[1]],
}));
const cross = crossValidateBoresight(noisyAnchors, pose, image);
assert.ok(cross, 'expected a cross-validated fit');
assert.ok(cross.validationCount > 0, 'no validation anchors scored');
assert.ok(cross.validationRmsPx > 0, 'validation residual must not be trivially zero');
assert.ok(cross.validationRmsPx > 0.2, `validation rms ${cross.validationRmsPx} suspiciously below the ${noisePx}px noise`);
assert.ok(cross.validationRmsPx < 1.5, `validation rms ${cross.validationRmsPx} far above the ${noisePx}px noise`);
assert.ok(Math.abs(cross.fit.yawDeg - TRUTH_YAW) <= 0.3, `cross-validated yaw ${cross.fit.yawDeg}, expected ~${TRUTH_YAW}`);
assert.ok(Math.abs(cross.validationRmsPx - noisePx) < 0.5, `validation rms ${cross.validationRmsPx} not close to injected noise ${noisePx}`);

// 4. Two anchors: the documented rule is a split with one calibration and one
// validation anchor, so a usable (single-anchor) fit is returned.
const twoAnchors = cleanAnchors.slice(0, 2);
const twoSplit = splitAnchors(twoAnchors, { validationFraction: 0.25 });
assert.equal(twoSplit.calibration.length, 1, 'two anchors should leave one for calibration');
assert.equal(twoSplit.validation.length, 1, 'two anchors should leave one for validation');
const twoCross = crossValidateBoresight(twoAnchors, pose, image, { validationFraction: 0.25 });
assert.ok(twoCross, 'two splittable anchors should return a fit, not null');
assert.equal(twoCross.validationCount, 1);
assert.ok(Number.isFinite(twoCross.validationRmsPx) && twoCross.validationRmsPx >= 0, 'validation rms must be a finite number');

console.log(
  `boresight fit: recovered yaw ${fit.yawDeg}°, pitch ${fit.pitchDeg}° (rms ${fit.rmsPx}px); ` +
    `cross-validated ${cross.fit.yawDeg}°/${cross.fit.pitchDeg}° with validation rms ${cross.validationRmsPx}px ` +
    `(median ${cross.validationMedianPx}px over ${cross.validationCount} held-out anchors).`,
);
