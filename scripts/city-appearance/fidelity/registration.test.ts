import assert from 'node:assert/strict';
import { prepareRegistration, validateGroundContact } from './registration.js';

const input: any = { tier: 'ground', cropSha256: 'a'.repeat(64), actualDimensions: { width: 1000, height: 500 }, declaredDimensions: { width: 1000, height: 500 },
  cropMarginsPx: { left: 0, top: 0, right: 0, bottom: 0 }, surfaceIndex: 3, wallDirection: [1, 0],
  plane: { pixelEdges: [100, 50, 900, 450], wallAlongM: [2, 10], napAtTopBottomM: [5, 1], surfaceBaseNapM: 1 },
  alignment: { wallIdentity: 'verified', boundaryEvidence: true, rooflineEvidence: true, cameraHeightResolved: true, orientationVerified: true, uncertaintyM: .1 } };
const registered = prepareRegistration(input);
assert.equal(registered.status, 'registered');
assert.deepEqual(registered.imageToWall, [.01, 0, 1, 0, -.01, 4.5, 0, 0, 1], 'pixel edges preserve both signed wall axis and NAP conversion');
assert.equal(prepareRegistration({ ...input, actualDimensions: { width: 999, height: 500 } }).status, 'ambiguous');
assert.equal(prepareRegistration({ ...input, alignment: { ...input.alignment, uncertaintyM: .151 } }).status, 'ambiguous');
assert.equal(prepareRegistration({ ...input, alignment: { ...input.alignment, cameraHeightResolved: false } }).status, 'ambiguous');
assert.equal(prepareRegistration({ ...input, alignment: { ...input.alignment, orientationVerified: false } }).status, 'ambiguous');
assert.deepEqual(validateGroundContact({ kind: 'pavement-base', tier: 'ground', registration: registered, gapM: .05, sourceSha256: input.cropSha256, captureDate: '2025-01-01', thresholdHeightM: .2 }), { accepted: true });
assert.equal(validateGroundContact({ kind: 'pavement-base', tier: 'ground', registration: registered, gapM: .06, sourceSha256: input.cropSha256, captureDate: '2025-01-01' }).accepted, false);
assert.equal(validateGroundContact({ kind: 'pavement-base', tier: 'ground', registration: registered, gapM: .06, sourceSha256: input.cropSha256, captureDate: '2025-01-01', baseCorrectionM: .06, correctionEvidence: { sourceSha256: input.cropSha256, captureDate: '2025-01-01', reason: 'visible raised plinth' } }).accepted, true);
assert.equal(validateGroundContact({ kind: 'pavement-base', tier: 'ground', registration: registered, gapM: .06, sourceSha256: input.cropSha256, captureDate: '2025-01-01', baseCorrectionM: .06, correctionEvidence: { sourceSha256: input.cropSha256, captureDate: '2024-01-01', reason: 'mixed capture dates' } }).accepted, false, 'a correction from another date cannot explain this contact');
assert.equal(validateGroundContact({ kind: 'pavement-base', tier: 'ground', registration: registered, gapM: .06, sourceSha256: input.cropSha256, captureDate: '2025-01-01', baseCorrectionM: .06, correctionEvidence: { sourceSha256: 'b'.repeat(64), captureDate: '2025-01-01', reason: 'another crop' } }).accepted, false, 'a correction must be tied to the measured crop');
assert.equal(validateGroundContact({ kind: 'pavement-base', tier: 'full', registration: registered, gapM: 0, sourceSha256: input.cropSha256, captureDate: '2025-01-01' }).accepted, false);
console.log('Facade registration preparation: dimensions, pixel edges, signed wall direction, NAP conversion, abstention and pavement contact passed.');
