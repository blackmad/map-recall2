import assert from 'node:assert/strict';
import { photoSilhouette } from './photoSilhouette.ts';

// 20 m x 10 m at 10 px/m: a brick wall 6 m tall with a 2 m wide, 9 m tall tower
// in the middle, a 0.2 m lamp post reaching 9.5 m at x = 3 m, white sky above.
const ppm = 10, width = 200, height = 100;
const data = new Uint8ClampedArray(width * height * 4);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const upM = (height - y) / ppm, alongM = x / ppm;
  const top = alongM >= 9 && alongM < 11 ? 9 : 6;
  const post = alongM >= 3 && alongM < 3.2 && upM < 9.5;
  const i = (y * width + x) * 4;
  const rgb = upM <= top ? [150, 70, 50] : post ? [40, 40, 40] : [245, 247, 250];
  data.set([...rgb, 255], i);
}

const result = photoSilhouette({ width, height, data }, ppm);
const at = (m: number) => result.topsM[Math.round(m / result.sampleM)];
assert.ok(Math.abs(at(5) - 6) < 0.3, `wall top ${at(5)}`);
assert.ok(Math.abs(at(10) - 9) < 0.3, `tower top ${at(10)}`);
assert.ok(Math.abs(at(3.1) - 6) < 0.3, `lamp post rejected, got ${at(3.1)}`);
assert.equal(result.wallColour, '#964632');
console.log('photoSilhouette ok');
