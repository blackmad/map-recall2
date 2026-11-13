import assert from 'node:assert/strict';
import test from 'node:test';
import {lancetArc, pointedDormer, type Quad} from './pointedDormer';

const opts = {t: 5, width: 2, y0: 15.2, ySpring: 16.4, yApex: 17.8, front: 0.3, depth: 1.6};
const area = (q: Quad) => {
  const [a, b, c, d] = q.pts, x = (u: number[], v: number[]) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const s = (u: number[], v: number[]) => u.map((e, i) => e - v[i]);
  const n1 = x(s(b, a), s(c, a)), n2 = x(s(c, a), s(d, a));
  return (Math.hypot(...n1) + Math.hypot(...n2)) / 2;
};

test('lancet arc is symmetric, springs at the sides and peaks at the apex', () => {
  const arc = lancetArc(5, 1, 16.4, 17.8, 6);
  assert.equal(arc.length, 13);
  assert.deepEqual(arc[6], [5, 17.8]);
  assert.ok(Math.abs(arc[0][0] - 4) < 1e-9 && Math.abs(arc[0][1] - 16.4) < 1e-9);
  for (let i = 0; i < arc.length; i++) {
    const j = arc.length - 1 - i;
    assert.ok(Math.abs(arc[i][0] - 5 - (5 - arc[j][0])) < 1e-9, 'mirror in t');
    assert.ok(Math.abs(arc[i][1] - arc[j][1]) < 1e-9, 'mirror in y');
  }
  for (let i = 1; i <= 6; i++) assert.ok(arc[i][1] > arc[i - 1][1], 'rises to the apex');
});

test('a round head (rise = half-width) is a semicircle', () => {
  const arc = lancetArc(0, 1, 0, 1, 8);
  for (const [t, y] of arc) assert.ok(Math.abs(Math.hypot(t, y) - 1) < 1e-9);
});

test('a rise below the half-width is refused (that would be a segmental arch, not a lancet)', () => {
  assert.throws(() => lancetArc(0, 1, 0, 0.8));
});

test('frame faces out, reveals face into the opening, roof faces out and up', () => {
  const d = pointedDormer(opts);
  for (const q of d.frame) { assert.ok(q.normal[2] > 0.999, 'frame +o'); assert.ok(q.pts.every(p => p[2] === 0.3)); }
  for (const q of d.reveal) {
    const c = q.pts.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]);
    const toAxis = [opts.t - c[0], (opts.ySpring) - c[1]];
    // every reveal normal points towards the inside of the opening (towards the centre line or up from the sill)
    assert.ok(q.normal[0] * toAxis[0] + q.normal[1] * Math.max(0, toAxis[1]) > -1e-9 || q.normal[1] > 0.99);
    assert.ok(Math.abs(q.normal[2]) < 1e-9);
  }
  for (const q of d.roof) {
    const c = q.pts.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]);
    assert.ok(q.normal[0] * (c[0] - opts.t) + q.normal[1] * (c[1] - opts.ySpring) > 0, 'roof faces away from the axis');
    assert.ok(q.pts.some(p => p[2] === 0.3) && q.pts.some(p => Math.abs(p[2] - (0.3 - 1.6)) < 1e-9));
  }
  for (const q of [...d.frame, ...d.reveal, ...d.roof]) assert.ok(area(q) > 1e-6, 'no degenerate quads');
});

test('window sits behind the front, inside the outline, apex lowered by the frame', () => {
  const d = pointedDormer({...opts, frame: 0.2, recess: 0.1});
  assert.ok(d.window.every(p => Math.abs(p[2] - 0.2) < 1e-9));
  const top = Math.max(...d.window.map(p => p[1]));
  assert.ok(Math.abs(top - (opts.yApex - 0.2)) < 1e-9);
  assert.ok(d.window.every(p => p[0] > opts.t - 1 && p[0] < opts.t + 1 && p[1] > opts.y0));
  assert.deepEqual(d.outline[0], [4, 15.2]);
  assert.deepEqual(d.outline.at(-1), [6, 15.2]);
});

test('bad options throw', () => {
  assert.throws(() => pointedDormer({...opts, ySpring: 15}));
  assert.throws(() => pointedDormer({...opts, frame: 1.2}));
  assert.throws(() => pointedDormer({...opts, depth: 0}));
});
