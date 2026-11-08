import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAP_ENTER, CAP_KEEP, cappedSize, landmarkTexCapFlag, nearestPixelsPerMetre, texelDensity, wantsCap } from './landmarkTexCap';

test('the flag: only the listed sides, off by default, a window global wins', () => {
  assert.equal(landmarkTexCapFlag('', {}), null);
  assert.equal(landmarkTexCapFlag('?landmarkTexCap=1024', {}), 1024);
  assert.equal(landmarkTexCapFlag('?landmarkTexCap=512', {}), 512);
  assert.equal(landmarkTexCapFlag('?landmarkTexCap=700', {}), null);
  assert.equal(landmarkTexCapFlag('?landmarkTexCap=0', {}), null);
  assert.equal(landmarkTexCapFlag('?landmarkTexCap=512', { __canalRecallLandmarkTexCap: 1024 }), 1024);
});

test('cappedSize halves in power-of-two steps until the longer side fits', () => {
  assert.equal(cappedSize(1024, 1024, 1024), null);
  assert.deepEqual(cappedSize(2048, 1792, 1024), { width: 1024, height: 896, factor: 2 });
  assert.deepEqual(cappedSize(2048, 256, 512), { width: 512, height: 64, factor: 4 });
  assert.deepEqual(cappedSize(1024, 512, 512), { width: 512, height: 256, factor: 2 });
  assert.equal(cappedSize(0, 10, 512), null);
});

test('texelDensity: texels per metre of a quad, the sparse percentile, point UVs and slivers ignored', () => {
  // A 10 x 10 m wall mapped to the whole of a 2048² image: 204.8 texels per metre.
  const quad = [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0];
  const uv = [0, 0, 1, 0, 1, 1, 0, 1];
  const index = [0, 1, 2, 0, 2, 3];
  assert.ok(Math.abs(texelDensity(quad, uv, index, 2048, 2048)! - 204.8) < 1e-9);
  // Non-indexed, the same two triangles.
  const flat = [0, 1, 2, 0, 2, 3].flatMap(i => quad.slice(i * 3, i * 3 + 3)), flatUv = [0, 1, 2, 0, 2, 3].flatMap(i => uv.slice(i * 2, i * 2 + 2));
  assert.ok(Math.abs(texelDensity(flat, flatUv, null, 2048, 2048)! - 204.8) < 1e-9);
  // A second wall 40 x 40 m on the same quarter of the image (sparser: 25.6 texels/m) holds most of the area: the 5 %
  // sparsest area is on it.
  const both = [...quad, 0, 0, 1, 40, 0, 1, 40, 40, 1, 0, 40, 1];
  const bothUv = [...uv, 0, 0, 0.5, 0, 0.5, 0.5, 0, 0.5];
  const bothIndex = [...index, 4, 5, 6, 4, 6, 7];
  assert.ok(Math.abs(texelDensity(both, bothUv, bothIndex, 2048, 2048)! - 25.6) < 1e-9);
  // A flat-colour face (all UVs on one texel) does not count; with nothing else there is no density.
  assert.equal(texelDensity(quad, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], index, 2048, 2048), null);
});

// A pinhole looking down -z from the origin: clip = P * V with V the identity; P with f = 1 / tan(fov / 2).
function perspective(f: number, aspect: number, near = 1, far = 1e5): number[] {
  const nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}

test('nearestPixelsPerMetre: frontal scale at the nearest point, 0 behind the eye, Infinity at the eye', () => {
  const f = 1 / Math.tan(0.6435011087932844 / 2), H = 1964, W = 3024, clip = perspective(f, W / H);
  // A point 1000 m ahead: frontal device px per metre = f * H / 2 / 1000; the estimate is an upper bound within sqrt(3/2).
  const frontal = f * H / 2 / 1000;
  const est = nearestPixelsPerMetre(clip, [0, 0, -1000], 0, W, H);
  assert.ok(est >= frontal - 1e-9 && est <= frontal * Math.sqrt(1.5) + 1e-9, `${est} vs ${frontal}`);
  // 100 m of radius brings the nearest point to 900 m.
  assert.ok(Math.abs(nearestPixelsPerMetre(clip, [0, 0, -1000], 100, W, H) - est * 1000 / 900) < 1e-9);
  assert.equal(nearestPixelsPerMetre(clip, [0, 0, 500], 100, W, H), 0);
  assert.equal(nearestPixelsPerMetre(clip, [0, 0, -50], 100, W, H), Infinity);
});

test('wantsCap: on when the capped image stays at least factor x CAP_ENTER texels a pixel, off below factor x CAP_KEEP', () => {
  const base = { density: 100, factor: 2 };
  assert.equal(wantsCap({ ...base, pixelsPerMetre: 100 / (2 * CAP_ENTER) + 1, capped: false }), false);
  assert.equal(wantsCap({ ...base, pixelsPerMetre: 100 / (2 * CAP_ENTER) - 1, capped: false }), true);
  // In between: stays as it is.
  const between = 100 / (2 * (CAP_ENTER + CAP_KEEP) / 2);
  assert.equal(wantsCap({ ...base, pixelsPerMetre: between, capped: true }), true);
  assert.equal(wantsCap({ ...base, pixelsPerMetre: between, capped: false }), false);
  assert.equal(wantsCap({ ...base, pixelsPerMetre: 100 / (2 * CAP_KEEP) + 1, capped: true }), false);
  assert.equal(wantsCap({ ...base, pixelsPerMetre: 0, capped: false }), true); // behind the eye
  assert.equal(wantsCap({ ...base, pixelsPerMetre: Infinity, capped: true }), false); // at the eye
  assert.equal(wantsCap({ density: 100, factor: 1, pixelsPerMetre: 0, capped: false }), false);
});
