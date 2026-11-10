import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THRESHOLDS, usability, penalty, voidShare, occluderShare, spanPixels, cutSpan, groupFaces, sameFace, type CropFlags } from './flags.ts';

const ok: CropFlags = { foliage: 0.05, washedOut: 0.1, missing: 0.1, voidShare: 0.1, occluderShare: 0.05, obliquity: 20, cameraDistance: 14 };

test('a clean crop is usable', () => assert.deepEqual(usability(ok), { usable: true, reasons: [] }));
test('thresholds are inclusive at the cap and exclusive above it', () => {
  assert.ok(usability({ ...ok, voidShare: THRESHOLDS.voidShare }).usable);
  assert.deepEqual(usability({ ...ok, voidShare: 0.36 }).reasons, ['void']);
  assert.ok(usability({ ...ok, foliage: THRESHOLDS.foliage }).usable);
  assert.deepEqual(usability({ ...ok, foliage: 0.31 }).reasons, ['foliage']);
  assert.deepEqual(usability({ ...ok, washedOut: 0.51 }).reasons, ['washed-out']);
  assert.deepEqual(usability({ ...ok, occluderShare: 0.36 }).reasons, ['occluder']);
  assert.deepEqual(usability({ ...ok, obliquity: 56 }).reasons, ['oblique']);
  assert.ok(usability({ ...ok, cameraDistance: 5 }).usable && usability({ ...ok, cameraDistance: 35 }).usable);
  assert.deepEqual(usability({ ...ok, cameraDistance: 36 }).reasons, ['distance']);
  assert.deepEqual(usability({ ...ok, cameraDistance: 4.9 }).reasons, ['distance']);
});
test('reasons keep a fixed order and list every broken cap', () => assert.deepEqual(usability({ ...ok, foliage: 0.9, voidShare: 0.9, occluderShare: 0.9 }).reasons, ['void', 'foliage', 'occluder']));
test('penalty is 0 inside the caps and grows with the excess', () => {
  assert.equal(penalty(ok), 0);
  assert.ok(penalty({ ...ok, foliage: 0.6 }) > penalty({ ...ok, foliage: 0.4 }));
});

test('voidShare counts invalid pixels in the body band only', () => {
  const w = 40, h = 100, alpha = new Uint8Array(w * h).fill(255);
  for (let y = 0; y < 10; y++) alpha.fill(0, y * w, (y + 1) * w); // top margin, outside the band
  assert.equal(voidShare(alpha, w, h), 0);
  for (let y = 10; y < 50; y++) alpha.fill(0, y * w, (y + 1) * w); // half of the 10..90 band
  assert.ok(Math.abs(voidShare(alpha, w, h) - 0.5) < 0.02);
});

test('occluderShare finds a dark blob in the lower third and ignores scattered dark specks', () => {
  const w = 200, h = 150, rgba = new Uint8ClampedArray(w * h * 4).fill(200), alpha = new Uint8Array(w * h).fill(255);
  assert.equal(occluderShare(rgba, alpha, w, h), 0);
  // a 100 x 30 px dark block at the bottom = a van
  for (let y = 115; y < 145; y++) for (let x = 40; x < 140; x++) { const i = (y * w + x) * 4; rgba[i] = rgba[i + 1] = rgba[i + 2] = 20; }
  const blob = occluderShare(rgba, alpha, w, h);
  assert.ok(blob > 0.25 && blob < 0.4, `blob ${blob}`);
  // isolated specks do not connect
  const speck = new Uint8ClampedArray(w * h * 4).fill(200);
  for (let y = 102; y < 148; y += 8) for (let x = 2; x < w; x += 8) { const i = (y * w + x) * 4; speck[i] = speck[i + 1] = speck[i + 2] = 10; }
  assert.ok(occluderShare(speck, alpha, w, h) < 0.05);
  // invalid pixels do not count as dark
  assert.equal(occluderShare(new Uint8ClampedArray(w * h * 4), new Uint8Array(w * h), w, h), 0);
});

test('spanPixels matches the intake strip mapping', () => {
  assert.deepEqual(spanPixels(3.0, 8.5, 1.0, 40), [80, 300]);
  assert.deepEqual(spanPixels(0, 0.0125, 0, 40), [0, 1]); // rounds, never negative width
});

test('cutSpan returns exactly the span columns and pads outside the strip with alpha 0', () => {
  const W = 10, H = 2, strip = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; strip[i] = x * 10; strip[i + 1] = y; strip[i + 3] = 255; }
  const cut = cutSpan(strip, W, H, [3, 6]);
  assert.equal(cut.width, 3); assert.equal(cut.height, 2);
  assert.deepEqual([cut.data[0], cut.data[4], cut.data[8]], [30, 40, 50]);
  assert.equal(cut.data[(1 * 3 + 2) * 4 + 1], 1);
  const edge = cutSpan(strip, W, H, [-2, 2]);
  assert.equal(edge.width, 4); assert.equal(edge.data[3], 0); assert.equal(edge.data[2 * 4 + 3], 255);
  assert.equal(cutSpan(strip, W, H, [5, 5]).width, 0);
});

// A street running east: houses on the north side face south, so the outward normal is (0,-1); ccw rings give a -> b with normal (dy,-dx)/len.
const wall = (id: string, x0: number, x1: number, y = 0): { id: string; a: { x: number; y: number }; b: { x: number; y: number }; nx: number; ny: number } => ({ id, a: { x: x0, y }, b: { x: x1, y }, nx: 0, ny: -1 });
test('walls on one line and touching are one face, ordered along it', () => {
  const faces = groupFaces([wall('c', 10, 16), wall('a', 0, 5), wall('b', 5, 10.5)]);
  assert.equal(faces.length, 1);
  assert.deepEqual(faces[0].map(w => w.id), ['a', 'b', 'c']);
});
test('a cross street gap, a setback and the far side of the street split faces', () => {
  const faces = groupFaces([wall('a', 0, 5), wall('b', 9, 14), wall('s', 5, 9, 3), { ...wall('far', 0, 5, 20), ny: 1 }]);
  assert.equal(faces.length, 4);
  assert.ok(!sameFace(wall('a', 0, 5), wall('b', 9, 14)));
  assert.ok(sameFace(wall('a', 0, 5), wall('b', 6, 14)));
});
