import assert from 'node:assert/strict';
import { worldToEquirectangularPixel, AMSTERDAM_WORLD_ALIGNED } from './rectify.ts';
import { panoAnchorFits, correspondenceEvidence, type AnchorLike, type TaskLike } from './anchorRegistration.ts';

const width = 8000, height = 4000;
const pose = { x: 120000, y: 487000, z: 3, headingDeg: 0, pitchDeg: 0, rollDeg: 0 };
const worlds: { x: number; y: number; z: number }[] = [
  { x: 120005, y: 487015, z: 8 },
  { x: 120009, y: 487016, z: 8 },
  { x: 120013, y: 487017, z: 8 },
  { x: 120017, y: 487018, z: 8 },
];
const task: TaskLike = {
  panos: [{
    panoramaId: 'test-pano', width, height, pose,
    markers: worlds.map((_, index) => ({ id: `test-pano#${index}`, standoffM: 15 })),
  }],
};
const anchors: AnchorLike[] = worlds.map((world, index) => {
  const [u, v] = worldToEquirectangularPixel(world, pose, { width, height }, AMSTERDAM_WORLD_ALIGNED);
  return { panoramaId: 'test-pano', markerId: `test-pano#${index}`, world, pixel: [u + 3, v - 2], status: 'corrected' };
});

const four = panoAnchorFits(anchors, task);
assert.equal(four.length, 1);
assert.equal(four[0].anchors, 4);
assert.ok(four[0].medianM < 0.25, `median should be small, got ${four[0].medianM}`);
assert.equal(four[0].qualifies, true);
const evidence = correspondenceEvidence(four[0]);
assert.ok(evidence && evidence.independentAnchors === 4);
assert.ok(evidence!.residualM.p95 <= 0.5);

// Two anchors cannot qualify: a one-parameter boresight would be exactly determined.
const two = panoAnchorFits(anchors.slice(0, 2), task);
assert.equal(two[0].qualifies, false);
assert.equal(correspondenceEvidence(two[0]), null);

// A large residual does not qualify.
const noisy = anchors.map((a) => ({ ...a, pixel: [a.pixel[0] + 200, a.pixel[1]] as [number, number] }));
assert.equal(panoAnchorFits(noisy, task)[0].qualifies, false);

// Skipped markers are ignored.
assert.equal(panoAnchorFits([...anchors.slice(0, 3), { ...anchors[3], status: 'skipped' }], task)[0].anchors, 3);

console.log('anchor registration: fit, metres conversion, qualification and evidence passed.');
