import assert from 'node:assert/strict';
import test from 'node:test';
import {loopsOf, offsetLoop, trayStack, type Rect, type TrayPlan} from './trayStack';

const area = (rs: Rect[]) => rs.reduce((s, r) => s + (r.a1 - r.a0) * (r.b1 - r.b0), 0);
const len = (r: {p: [number, number]; q: [number, number]}) => Math.hypot(r.q[0] - r.p[0], r.q[1] - r.p[1]);
const levels = [0, 1, 2].map(k => ({name: `L${k}`, y0: 3 * k, glassTop: 3 * k + 2.4, y1: 3 * k + 3}));
const box: Rect = {a0: 0, a1: 20, b0: 0, b1: 10};

test('a plain box: four outline walls per storey, one band loop, a roof only on top', () => {
  const s = trayStack({outer: [box], holes: [], levels, recesses: []}, {columnPitch: 4, columnInset: 0.5});
  for (const st of s) {
    assert.equal(st.walls.length, 4);
    assert.ok(st.walls.every(w => w.kind === 'outline'));
    assert.equal(st.walls.reduce((t, w) => t + len(w), 0), 60);
    assert.equal(st.bandLoops.length, 1);
    assert.equal(st.columns.length, 0);
    assert.equal(st.floors.length + st.soffits.length, 0);
  }
  assert.deepEqual(s.map(st => area(st.roofs)), [0, 0, 200]);
});

test('outward normals point away from the solid: n = [-t_b, t_a]', () => {
  const [st] = trayStack({outer: [box], holes: [], levels, recesses: []}, {columnPitch: 4, columnInset: 0.5});
  for (const w of st.walls) {
    const l = len(w), t = [(w.q[0] - w.p[0]) / l, (w.q[1] - w.p[1]) / l];
    assert.deepEqual(w.n, [-t[1] + 0, t[0] + 0]);
    const mid = [(w.p[0] + w.q[0]) / 2 + w.n[0], (w.p[1] + w.q[1]) / 2 + w.n[1]];
    assert.ok(mid[0] < 0 || mid[0] > 20 || mid[1] < 0 || mid[1] > 10, `normal of ${JSON.stringify(w)} points inside`);
  }
});

test('a loggia on one storey: set-back back wall, two returns, floor, soffit and columns on the slab edge', () => {
  const plan: TrayPlan = {outer: [box], holes: [], levels, recesses: [{rect: {a0: 4, a1: 16, b0: 0, b1: 3}, levels: [1]}]};
  const s = trayStack(plan, {columnPitch: 4, columnInset: 0.5});
  const st = s[1], inner = st.walls.filter(w => w.kind === 'inner');
  assert.equal(inner.reduce((t, w) => t + len(w), 0), 12 + 3 + 3);
  assert.equal(area(st.floors), 36);
  assert.equal(area(st.soffits), 36);
  // pitch 4 between a 4.4 and 15.6: a = 8 and 12, inset 0.5 behind the b = 0 edge
  assert.deepEqual(st.columns.map(c => c.at), [[8, 0.5], [12, 0.5]]);
  assert.ok(st.columns.every(c => c.y0 === 3 && c.y1 === 5.4));
  // storeys without the loggia are untouched; the slab above it is whole, so one band loop each
  assert.equal(s[0].walls.length, 4);
  assert.ok(s.every(x => x.bandLoops.length === 1));
});

test('an open recess through two storeys drops the slab between them; columns run up through the slab zone', () => {
  const plan: TrayPlan = {outer: [box], holes: [], levels, recesses: [{rect: {a0: 0, a1: 6, b0: 0, b1: 3}, levels: [0, 1], open: true}]};
  const s = trayStack(plan, {columnPitch: 4, columnInset: 0.5});
  assert.equal(area(s[0].soffits), 0);
  assert.equal(area(s[1].floors), 0);
  assert.equal(area(s[1].soffits), 18);
  // the corner column at the recessed outline corner (0.5, 0.5) and one on the pitch at a = 4
  const at = s[0].columns.map(c => c.at).sort((p, q) => p[0] - q[0]);
  assert.deepEqual(at, [[0.5, 0.5], [4, 0.5]]);
  assert.ok(s[0].columns.every(c => c.y1 === 3));
  assert.ok(s[1].columns.every(c => c.y1 === 5.4));
  // storey 0's slab loop now steps round the void
  assert.equal(s[0].bandLoops.length, 1);
  assert.equal(s[0].bandLoops[0].length, 6);
});

test('a courtyard hole on the upper storeys: inner outline walls, a deck roof on the podium, two band loops', () => {
  const plan: TrayPlan = {outer: [box], holes: [{rect: {a0: 5, a1: 15, b0: 3, b1: 7}, levels: [1, 2]}], levels, recesses: []};
  const s = trayStack(plan, {columnPitch: 4, columnInset: 0.5});
  assert.equal(area(s[0].roofs), 40);
  assert.equal(s[1].walls.length, 8);
  assert.ok(s[1].walls.every(w => w.kind === 'outline'));
  assert.equal(s[1].bandLoops.length, 2);
  assert.equal(area(s[2].roofs), 160);
});

test('loops close, and offsetting a loop moves every edge by d along its outward normal', () => {
  const loops = loopsOf([
    {p: [1, 0], q: [0, 0], n: [0, -1]}, {p: [0, 0], q: [0, 1], n: [-1, 0]}, {p: [0, 1], q: [1, 1], n: [0, 1]}, {p: [1, 1], q: [1, 0], n: [1, 0]},
  ]);
  assert.equal(loops.length, 1);
  const off = offsetLoop(loops[0], 0.1).map(p => p.map(v => Math.round(v * 1e9) / 1e9));
  const xs = off.map(p => p[0]), ys = off.map(p => p[1]);
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [-0.1, 1.1, -0.1, 1.1]);
});

test('explicit column positions replace the pitch inside their recess only', () => {
  const plan: TrayPlan = {outer: [box], holes: [], levels, recesses: [
    {rect: {a0: 2, a1: 9, b0: 0, b1: 3}, levels: [1], columns: [2.5, 5, 8.5]},
    {rect: {a0: 11, a1: 19, b0: 0, b1: 3}, levels: [1]},
  ]};
  const at = trayStack(plan, {columnPitch: 4, columnInset: 0.5})[1].columns.map(c => c.at[0]).sort((x, y) => x - y);
  assert.deepEqual(at, [2.5, 5, 8.5, 12, 16]);
});
