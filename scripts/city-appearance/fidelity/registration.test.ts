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

// Street-level correspondence: metric flags missing, but independent anchors
// with a bounded residual promote to a distinct status, not to 'registered'.
const street = { ...input, alignment: { ...input.alignment, cameraHeightResolved: false, rooflineEvidence: false, uncertaintyM: NaN } };
const correspondence = { identityVerified: true, wallVerified: true, residualM: { median: .2, p95: .4 }, independentAnchors: 4 };
const verified = prepareRegistration({ ...street, correspondence });
assert.equal(verified.status, 'correspondence-verified');
assert.deepEqual(verified.residualM, { median: .2, p95: .4 });
assert.equal(prepareRegistration({ ...street, correspondence: { ...correspondence, residualM: { median: .3, p95: .4 } } }).status, 'ambiguous', 'residual above 0.25 m does not verify');
assert.equal(prepareRegistration({ ...street, correspondence: { ...correspondence, residualM: { median: .2, p95: .6 } } }).status, 'ambiguous', 'p95 above 0.50 m does not verify');
assert.equal(prepareRegistration({ ...street, correspondence: { ...correspondence, independentAnchors: 2 } }).status, 'ambiguous', 'fewer than 3 anchors does not verify');
assert.equal(prepareRegistration({ ...street, correspondence: { ...correspondence, identityVerified: false } }).status, 'ambiguous', 'unverified identity never verifies');
assert.equal(prepareRegistration(input).status, 'registered', 'a metric-registered source still takes precedence');
assert.deepEqual(validateGroundContact({ kind: 'pavement-base', tier: 'ground', registration: registered, gapM: .05, sourceSha256: input.cropSha256, captureDate: '2025-01-01', thresholdHeightM: .2 }), { accepted: true });
assert.equal(validateGroundContact({ kind: 'pavement-base', tier: 'ground', registration: registered, gapM: .06, sourceSha256: input.cropSha256, captureDate: '2025-01-01' }).accepted, false);
assert.equal(validateGroundContact({ kind: 'pavement-base', tier: 'ground', registration: registered, gapM: .06, sourceSha256: input.cropSha256, captureDate: '2025-01-01', baseCorrectionM: .06, correctionEvidence: { sourceSha256: input.cropSha256, captureDate: '2025-01-01', reason: 'visible raised plinth' } }).accepted, true);
assert.equal(validateGroundContact({ kind: 'pavement-base', tier: 'ground', registration: registered, gapM: .06, sourceSha256: input.cropSha256, captureDate: '2025-01-01', baseCorrectionM: .06, correctionEvidence: { sourceSha256: input.cropSha256, captureDate: '2024-01-01', reason: 'mixed capture dates' } }).accepted, false, 'a correction from another date cannot explain this contact');
assert.equal(validateGroundContact({ kind: 'pavement-base', tier: 'ground', registration: registered, gapM: .06, sourceSha256: input.cropSha256, captureDate: '2025-01-01', baseCorrectionM: .06, correctionEvidence: { sourceSha256: 'b'.repeat(64), captureDate: '2025-01-01', reason: 'another crop' } }).accepted, false, 'a correction must be tied to the measured crop');
assert.equal(validateGroundContact({ kind: 'pavement-base', tier: 'full', registration: registered, gapM: 0, sourceSha256: input.cropSha256, captureDate: '2025-01-01' }).accepted, false);
console.log('Facade registration preparation: dimensions, pixel edges, signed wall direction, NAP conversion, abstention and pavement contact passed.');
