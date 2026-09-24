import assert from 'node:assert/strict';
import { worldToEquirectangularPixel, type CameraModel, type CameraPose } from './rectify.ts';
import { refineBoresight, type WallEdge } from './wallEdgeAlign.ts';

const pose: CameraPose = { x: 0, y: 0, z: 3, headingDeg: 0, pitchDeg: 0, rollDeg: 0 };
const base: CameraModel = { id: 'test-world-aligned', usesOrientation: false, yaw: 'centre' };
const width = 3600, height = 1800;

const walls: WallEdge[] = [
  { start: { x: -8, y: 15 }, end: { x: -3, y: 15 }, baseZ: 0, topZ: 12 },
  { start: { x: 3, y: 15 }, end: { x: 8, y: 15 }, baseZ: 0, topZ: 12 },
];

const truth: CameraModel = { ...base, boresightYawDeg: 2, boresightPitchDeg: 0.3 };

const data = new Uint8Array(width * height).fill(15);
const drawLine = (a: [number, number], b: [number, number]) => {
  const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(a[0] + (b[0] - a[0]) * i / steps);
    const y = Math.round(a[1] + (b[1] - a[1]) * i / steps);
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    data[y * width + x] = 240;
  }
};
for (const wall of walls) {
  for (const point of [wall.start, wall.end]) {
    const b = worldToEquirectangularPixel({ x: point.x, y: point.y, z: wall.baseZ }, pose, { width, height }, truth);
    const t = worldToEquirectangularPixel({ x: point.x, y: point.y, z: wall.topZ }, pose, { width, height }, truth);
    drawLine(b, t);
  }
}

const estimate = refineBoresight({ data, width, height }, pose, walls, base, { yawRangeDeg: 6, pitchRangeDeg: 1, coarseStepDeg: 0.2, fineStepDeg: 0.05 });
assert.ok(estimate.walls >= 1, 'no walls scored');
assert.ok(Math.abs(estimate.yawDeg - 2) <= 0.4, `recovered yaw ${estimate.yawDeg}, expected ~2`);
assert.ok(Math.abs(estimate.pitchDeg - 0.3) <= 0.35, `recovered pitch ${estimate.pitchDeg}, expected ~0.3`);

console.log(`wall edge align: recovered yaw ${estimate.yawDeg}°, pitch ${estimate.pitchDeg}° from a synthetic boresight.`);
