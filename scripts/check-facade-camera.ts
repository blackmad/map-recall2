import assert from 'node:assert/strict';
import { worldToEquirectangularPixel, type CameraPose } from '../src/canalRecall/facade/rectify.ts';

const image = { width: 8000, height: 4000 };
const pose: CameraPose = { x: 0, y: 0, z: 2, headingDeg: 0, pitchDeg: 0, rollDeg: 0 };
const close = (actual: number, expected: number, label: string, tolerance = 1e-6) =>
  assert.equal(Math.abs(actual - expected) <= tolerance, true, `${label}: ${actual} ≠ ${expected}`);

let pixel = worldToEquirectangularPixel({ x: 0, y: 10, z: 2 }, pose, image);
close(pixel[0], 4000, 'north is the centred heading'); close(pixel[1], 2000, 'level is the equator');
pixel = worldToEquirectangularPixel({ x: 10, y: 0, z: 2 }, pose, image);
close(pixel[0], 6000, 'east is a quarter-turn right');
pixel = worldToEquirectangularPixel({ x: -10, y: 0, z: 2 }, pose, image);
close(pixel[0], 2000, 'west is a quarter-turn left');
pixel = worldToEquirectangularPixel({ x: 0, y: -10, z: 2 }, pose, image);
close(pixel[0], 0, 'south wraps at the panorama seam');
pixel = worldToEquirectangularPixel({ x: 0, y: 10, z: 12 }, pose, image);
close(pixel[0], 4000, 'vertical motion preserves azimuth'); close(pixel[1], 1000, '45 degrees up is one quarter image height');

pixel = worldToEquirectangularPixel({ x: 10, y: 0, z: 2 }, { ...pose, headingDeg: 90 }, image);
close(pixel[0], 4000, 'heading rotates east to the centre'); close(pixel[1], 2000, 'heading keeps a level point level');
pixel = worldToEquirectangularPixel({ x: 0, y: 10, z: 2 }, { ...pose, pitchDeg: 10 }, image);
assert.equal(pixel[1] > 2000, true, 'positive camera pitch puts a level world point below image centre');
pixel = worldToEquirectangularPixel({ x: 10, y: 0, z: 2 }, { ...pose, rollDeg: 90 }, image);
close(pixel[1], 0, 'a 90-degree roll rotates the camera-right direction to zenith', 1e-5);

pixel = worldToEquirectangularPixel({ x: 0, y: 10, z: 2 }, pose, image, 'edge');
close(pixel[0], 0, 'edge convention places heading at the seam');

console.log('Façade camera: cardinal directions, seam, elevation, heading, pitch and roll passed.');
