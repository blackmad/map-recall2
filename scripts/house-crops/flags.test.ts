import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THRESHOLDS, usability, penalty, voidShare, occluderShare, spanPixels, cutSpan, groupFaces, sameFace, segmentHitsRings, rayBlocked, type CropFlags } from './flags.ts';
import { heightCover, edgeDensity, seamStep } from './measure.ts';

const ok: CropFlags = { foliage: 0.05, foliagePlain: 0.05, wbApplied: false, washedOut: 0.1, missing: 0.1, voidShare: 0.1, occluderShare: 0.05, obliquity: 20, cameraDistance: 14, rayBlocked: false, wallWidthM: 6, heightCover: 1, edgeDensity: 0.2, seamStep: 5, strip: false };

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

test('H4b caps: ray, width, height cover, blank wall', () => {
  assert.deepEqual(usability({ ...ok, rayBlocked: true }).reasons, ['blocked']);
  assert.deepEqual(usability({ ...ok, wallWidthM: 3.4 }).reasons, ['narrow']);
  assert.ok(usability({ ...ok, wallWidthM: 3.5 }).usable);
  assert.deepEqual(usability({ ...ok, heightCover: 0.84 }).reasons, ['short']);
  assert.deepEqual(usability({ ...ok, edgeDensity: 0.03 }).reasons, ['blank']);
  assert.ok(usability({ ...ok, seamStep: 99, strip: true }).usable, 'seamStep is recorded, not a gate (no separation on the labels)');
});

const sq = (x: number, y: number, s = 10) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }, { x, y }];
test('a camera ray through a neighbouring footprint is blocked, a clear one is not', () => {
  const others = [sq(0, 10)];
  assert.ok(segmentHitsRings({ x: 5, y: 30 }, { x: 5, y: 0 }, others));
  assert.ok(!segmentHitsRings({ x: 25, y: 30 }, { x: 25, y: 0 }, others));
  assert.ok(!segmentHitsRings({ x: 5, y: 30 }, { x: 5, y: 22 }, others), 'stops before the footprint');
  // wall centre at (5, 10) facing north (0,1): camera at (5, 25) is clear of a footprint to the south; (5, -5) behind it is not tested here
  assert.ok(!rayBlocked({ x: 5, y: 25 }, { x: 5, y: 10 }, [0, 1], [sq(0, -10)]));
  assert.ok(rayBlocked({ x: 5, y: 25 }, { x: 5, y: 10 }, [0, 1], [sq(3, 14, 4)]));
});

test('heightCover counts valid rows up from the ground', () => {
  const w = 20, h = 100, a = new Uint8Array(w * h).fill(255);
  assert.equal(heightCover(a, w, h), 1);
  a.fill(0, 0, w * 30); // top 30 rows invalid
  assert.equal(heightCover(a, w, h), 0.7);
});

test('edgeDensity: a flat wall is ~0, a textured one is high', () => {
  const w = 80, h = 80, alpha = new Uint8Array(w * h).fill(255), flat = new Uint8ClampedArray(w * h * 4).fill(150), tex = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) { const v = ((p % w) + ((p / w) | 0)) % 2 === 0 ? 60 : 200; tex[p * 4] = tex[p * 4 + 1] = tex[p * 4 + 2] = v; }
  assert.ok(edgeDensity(flat, alpha, w, h) < 0.01);
  assert.ok(edgeDensity(tex, alpha, w, h) > 0.5);
});

test('seamStep: a luma jump across the whole height is a seam, local windows are not', () => {
  const w = 100, h = 100, alpha = new Uint8Array(w * h).fill(255), img = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) { const x = p % w, v = x < 50 ? 100 : 170; img[p * 4] = img[p * 4 + 1] = img[p * 4 + 2] = v; }
  assert.ok(seamStep(img, alpha, w, h) > 60);
  const win = new Uint8ClampedArray(w * h * 4).fill(120);
  for (let y = 30; y < 40; y++) for (let x = 40; x < 50; x++) { const i = (y * w + x) * 4; win[i] = win[i + 1] = win[i + 2] = 30; }
  assert.ok(seamStep(win, alpha, w, h) < 20);
});

import { clippedShare } from './measure.ts';
import { diskGate, hardPass, judgedGood, DISK_FLOOR_BYTES } from './flags.ts';
import { judgeSize, parseAnswers, quality } from './judge.ts';
import { auc, chooseThreshold, stats, type Row } from './evaluate-judge.ts';

test('washed-out is highlight clipping, not brightness: a white wall at 235 passes, a blown wall fails', () => {
  const px = (v: number) => { const d = new Uint8ClampedArray(40 * 40 * 4); for (let i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } return d; };
  assert.equal(clippedShare(px(235), null, 40, 40), 0);
  assert.equal(clippedShare(px(255), null, 40, 40), 1);
  assert.ok(usability({ ...ok, washedOut: 0.26 }).reasons.includes('washed-out') && usability({ ...ok, washedOut: 0.2 }).usable);
});
test('oblique cap is 55 degrees; 35 is only the straight-view tier', () => {
  assert.ok(usability({ ...ok, obliquity: 54 }).usable && !usability({ ...ok, obliquity: 56 }).usable);
  assert.equal(THRESHOLDS.straightDeg, 35);
});
test('hard flags are geometry facts; foliage, washed-out and occluder are judged by Jev', () => {
  assert.ok(hardPass(['foliage', 'washed-out', 'occluder']));
  assert.ok(!hardPass(['blocked']) && !hardPass(['blank', 'foliage']) && !hardPass(['narrow']) && !hardPass(['oblique']));
  assert.ok(judgedGood([], 0.4, 0.35) && !judgedGood([], 0.3, 0.35) && !judgedGood(['blocked'], 0.9, 0.35) && !judgedGood([], undefined, 0.1));
});
test('judge image sizing respects the 280 px side rule', () => {
  assert.deepEqual(judgeSize(295, 776), { width: 300, height: 789 });
  assert.equal(judgeSize(100, 1000), null);
  assert.deepEqual(judgeSize(600, 400), { width: 600, height: 400 });
});
test('judge response parsing fails closed and the quality discounts occlusion', () => {
  assert.throws(() => parseAnswers({ answers: { full_front: { noul: 0.9 } } }));
  const p = parseAnswers({ answers: { full_front: { noul: 0.8 }, occluded: { noul: 0.5 }, close_up: { noul: 0.1 } }, usage: { input_tokens: 1000, output_tokens: 100 } });
  assert.equal(p.tokens, 1100); assert.equal(quality(p), 0.4);
});
test('disk rule: a run that would leave under 15 GB free is refused', () => {
  const GB = 1024 ** 3;
  assert.ok(diskGate(23 * GB, 1000).ok);
  assert.ok(!diskGate(16 * GB, 1000).ok);
  assert.ok(!diskGate(13 * GB, 0).ok);
  assert.equal(DISK_FLOOR_BYTES, 15 * GB);
});
test('threshold choice and AUC on a toy set', () => {
  const rows: Row[] = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4].map((score, i) => ({ id: String(i), label: i < 4 ? 'good' : 'bad', good: i < 4, score, hard: true, usable: true }));
  assert.equal(auc(rows), 1);
  assert.equal(chooseThreshold(rows, true, 0.9, 3), 0.6);
  assert.equal(stats(rows, r => r.score >= 0.6).precision, 1);
});
