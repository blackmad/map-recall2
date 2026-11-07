import assert from 'node:assert/strict';
import test from 'node:test';
import { BaseRefreshSlicer, lngLatDistanceM, orderByDistance } from './baseRefreshBudget';

/** A fake clock that each unit of work advances by `cost[key]` ms (a key may be cut and resumed). */
function harness(costs: Record<string, number>) {
  let t = 0;
  const left = { ...costs };
  const calls: string[] = [];
  const slicer = new BaseRefreshSlicer<string>(() => t);
  const work = (key: string, deadline: number) => {
    calls.push(key);
    while (left[key] > 0) { if (t >= deadline) return false; t += 1; left[key]--; }
    return true;
  };
  return { slicer, work, calls, left };
}

test('nearest first, ties in input order', () => {
  assert.deepEqual(orderByDistance([{ key: 'c', distance: 300 }, { key: 'a', distance: 10 }, { key: 'b', distance: 10 }, { key: 'nan', distance: NaN }, { key: 'd', distance: 0 }]), ['d', 'a', 'b', 'c', 'nan']);
});

test('N chunks over budget B: deterministic order, every chunk once, done after ceil(total / B) runs', () => {
  const h = harness({ a: 3, b: 3, c: 3, d: 3 });
  h.slicer.start([{ key: 'd', distance: 40 }, { key: 'b', distance: 20 }, { key: 'a', distance: 10 }, { key: 'c', distance: 30 }]);
  const runs: boolean[] = [];
  while (h.slicer.active) runs.push(h.slicer.run(4, h.work));
  assert.deepEqual(runs, [false, false, true]);
  assert.deepEqual(Object.values(h.left), [0, 0, 0, 0]);
  // b is cut at the first deadline (1 of 3 done) and resumed first in run 2; c likewise into run 3.
  assert.deepEqual(h.calls, ['a', 'b', 'b', 'c', 'c', 'd']);
});

test('resumes where it stopped', () => {
  const h = harness({ near: 10, far: 1 });
  h.slicer.start([{ key: 'far', distance: 2 }, { key: 'near', distance: 1 }]);
  assert.equal(h.slicer.run(4, h.work), false);
  assert.equal(h.slicer.next, 'near');
  assert.equal(h.left.near, 6);
  assert.equal(h.slicer.run(4, h.work), false);
  assert.equal(h.slicer.run(4, h.work), true); // near finishes with 2 ms spent, far fits the rest of the budget
  assert.equal(h.left.far, 0);
  assert.equal(h.slicer.remaining, 0);
});

test('a revision bump restarts from the nearest', () => {
  const h = harness({ a: 2, b: 2, c: 2 });
  h.slicer.start([{ key: 'a', distance: 1 }, { key: 'b', distance: 2 }, { key: 'c', distance: 3 }]);
  h.slicer.run(3, h.work); // a done, b cut
  assert.equal(h.slicer.next, 'b');
  h.left.a = 2; // new relief: a has pands to lift again
  h.slicer.start([{ key: 'c', distance: 3 }, { key: 'b', distance: 2 }, { key: 'a', distance: 1 }]);
  assert.equal(h.slicer.next, 'a');
  while (h.slicer.active) h.slicer.run(3, h.work);
  assert.deepEqual(h.calls, ['a', 'b', 'a', 'b', 'c']);
});

test('a run always makes progress, even with the budget already spent', () => {
  const h = harness({ a: 1, b: 1 });
  h.slicer.start([{ key: 'a', distance: 0 }, { key: 'b', distance: 1 }]);
  assert.equal(h.slicer.run(0, (k, d) => h.work(k, d + 1)), false);
  assert.equal(h.slicer.next, 'b');
  assert.equal(h.slicer.run(0, h.work), false); // b cut at a zero deadline before any work: still next
  h.slicer.cancel();
  assert.equal(h.slicer.active, false);
  assert.equal(h.slicer.run(4, h.work), true);
});

test('lngLatDistanceM: a degree of latitude is ~111 km, longitude shrinks with cos(lat)', () => {
  assert.equal(Math.round(lngLatDistanceM([4.9, 52], [4.9, 53])), 111320);
  assert.ok(Math.abs(lngLatDistanceM([4.9, 52.37], [4.91, 52.37]) - 679.8) < 1);
});
