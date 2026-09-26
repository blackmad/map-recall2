import assert from 'node:assert/strict';
import { projectToSamplingPlane } from './build-building-source-comparison.ts';

const plane = { start: { x: 0, y: 0, z: 0 }, end: { x: 10, y: 0, z: 0 }, baseZ: 0, topZ: 10 };
const pose = { x: 5, y: -10, z: 5 }, image = { width: 1000, height: 1000 };
const onPlane = projectToSamplingPlane({ x: 2, y: 0, z: 8 }, pose, plane, image)!;
assert.ok(Math.abs(onPlane.x - 200) < 1e-8 && Math.abs(onPlane.y - 200) < 1e-8, 'known sampling-plane point retains its source pixel');
const offPlane = projectToSamplingPlane({ x: 2, y: 2, z: 8 }, pose, plane, image)!;
assert.notEqual(offPlane.x, onPlane.x, 'off-plane geometry retains camera parallax instead of being flattened');
assert.equal(projectToSamplingPlane({ x: 5, y: -20, z: 5 }, pose, plane, image), null, 'ray facing away from the sampling plane is rejected');
console.log('building source comparison projection passed');
