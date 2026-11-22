import assert from 'node:assert/strict';
import {test} from 'node:test';
import {outlineArea, tympanumArch} from './tympanumArch';

const close = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b} (tol ${tol})`);

test('round arch: semicircular tympanum on the window head, voussoirs fill the ring', () => {
  const a = tympanumArch({width: 1.4, head: 10, ring: 0.3, voussoirs: 9, segments: 48});
  close(a.circle.radius, 0.7);
  close(a.circle.centre[1], 10);
  // the field is a half disc of radius 0.7 (polygon area converges from below)
  const area = outlineArea(a.tympanum);
  assert.ok(area > 0, 'tympanum outline is counter-clockwise');
  close(area, (Math.PI * 0.7 * 0.7) / 2, 0.005);
  assert.ok(a.tympanum.every(p => p[1] >= 10 - 1e-9 && p[1] <= 10.7 + 1e-9), 'field lies between the head and the crown');
  assert.equal(a.voussoirs.length, 9);
  // ring area: half annulus between r 0.7 and 1.0 (voussoirs are chords, so slightly less)
  const ring = a.voussoirs.reduce((s, v) => s + outlineArea(v.outline), 0);
  close(ring, (Math.PI * (1.0 * 1.0 - 0.7 * 0.7)) / 2, 0.06);
  assert.ok(a.voussoirs.every(v => outlineArea(v.outline) > 0), 'every voussoir is counter-clockwise');
  close(a.top, 11.0);
});

test('keystone is centred, alternating courses count out from it, and it may stand proud', () => {
  const a = tympanumArch({width: 1.2, head: 5, ring: 0.25, voussoirs: 7, keystone: {scale: 1.6, proud: 0.12}});
  const keys = a.voussoirs.filter(v => v.key);
  assert.equal(keys.length, 1);
  const k = keys[0], xs = k.outline.map(p => p[0]);
  close(Math.min(...xs), -Math.max(...xs));
  assert.equal(k.course, 0);
  assert.deepEqual(a.voussoirs.map(v => v.course), [1, 0, 1, 0, 1, 0, 1]);
  close(a.top, 5 + 0.6 + 0.25 + 0.12);
  // wider than its neighbours
  const width = (o: [number, number][]) => Math.max(...o.map(p => p[0])) - Math.min(...o.map(p => p[0]));
  assert.ok(width(k.outline) > width(a.voussoirs[2].outline));
});

test('symmetric about the window axis', () => {
  const a = tympanumArch({width: 1.6, head: 0, ring: 0.3, voussoirs: 11, impost: {width: 0.15, height: 0.2}});
  const n = a.voussoirs.length;
  for (let i = 0; i < n; i++) {
    const l = a.voussoirs[i].outline, r = a.voussoirs[n - 1 - i].outline;
    close(Math.min(...l.map(p => p[0])), -Math.max(...r.map(p => p[0])));
  }
  assert.equal(a.imposts.length, 2);
  assert.ok(a.imposts.every(p => outlineArea(p) > 0), 'imposts wind counter-clockwise');
  close(Math.max(...a.imposts[1].map(p => p[0])), 0.8 + 0.3 + 0.15);
  close(Math.min(...a.imposts[0].map(p => p[0])), -(0.8 + 0.3 + 0.15));
});

test('segmental arch: the field rises only `rise` above the head', () => {
  const a = tympanumArch({width: 2, head: 3, shape: 'segmental', rise: 0.35, ring: 0.2, voussoirs: 9, boss: {radius: 0.1}});
  const top = Math.max(...a.tympanum.map(p => p[1]));
  assert.ok(top <= 3.35 + 1e-9 && top > 3.3);
  // first and last voussoirs start on the springing points
  close(a.voussoirs[0].outline[0][0], -1);
  close(a.voussoirs[0].outline[0][1], 3);
  close(a.voussoirs[8].outline[1][0], 1);
  assert.ok(a.boss);
  close(a.boss!.centre[1], 3 + 0.175);
});

test('rejects impossible inputs', () => {
  assert.throws(() => tympanumArch({width: 1, head: 0, ring: 0.2, voussoirs: 4}), /odd/);
  assert.throws(() => tympanumArch({width: 1, head: 0, ring: 0, voussoirs: 5}), /positive/);
  assert.throws(() => tympanumArch({width: 1, head: 0, ring: 0.2, voussoirs: 5, shape: 'segmental', rise: 0.8}), /rise/);
  assert.throws(() => tympanumArch({width: 1, head: 0, ring: 0.2, voussoirs: 5, boss: {radius: 0.4}}), /boss/);
});
