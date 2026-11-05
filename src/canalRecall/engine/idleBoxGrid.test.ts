import assert from 'node:assert/strict';
import test from 'node:test';
import { BoxGrid, type Box } from './boxGrid';
import { IdleBoxGrid } from './idleBoxGrid';

type Item = { id: number; box: Box | null };
function items(n: number, seed: number): Item[] {
  let s = seed; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const out: Item[] = [];
  for (let i = 0; i < n; i++) {
    const x = 4.85 + rnd() * 0.05, y = 52.34 + rnd() * 0.03, w = rnd() < 0.01 ? 0.05 : rnd() * 0.002, h = rnd() * 0.0015;
    out.push({ id: i, box: rnd() < 0.02 ? null : [x, y, x + w, y + h] });
  }
  return out;
}
const boxOf = (t: Item) => t.box;

test('a deferred BoxGrid drained in steps answers as the one-task build', () => {
  const list = items(2000, 7);
  const whole = new BoxGrid(list, boxOf), stepped = new BoxGrid(list, boxOf, true);
  const steps = stepped.insertSteps(97);
  let n = 0; while (!steps.next().done) n++;
  assert.ok(n > 10, 'it yielded');
  let s = 99; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < 2000; i++) {
    const lng = 4.85 + rnd() * 0.05, lat = 52.34 + rnd() * 0.03;
    assert.deepEqual(stepped.at(lng, lat, list).map(t => t.id), whole.at(lng, lat, list).map(t => t.id));
  }
});

test('IdleBoxGrid: built only in idle slices; stale answers from the last list until the new grid is done', () => {
  const queue: Array<() => void> = [];
  const idle = (cb: () => void) => { queue.push(cb); };
  const a = items(1000, 1), b = items(1200, 2);
  const g = new IdleBoxGrid<Item>(boxOf, idle, false, 100);
  const probe = a.find(t => t.box)!.box!;
  assert.deepEqual(g.at(probe[0], probe[1], a), [], 'no grid yet: nothing, and no build in the query');
  assert.equal(g.stats.slices, 0);
  while (queue.length) queue.shift()!();
  assert.ok(g.isReady(a));
  assert.ok(g.stats.slices >= 10, 'several slices');
  const want = new BoxGrid(a, boxOf).at(probe[0], probe[1], a).map(t => t.id);
  assert.deepEqual(g.at(probe[0], probe[1], a).map(t => t.id), want);
  g.prewarm(b);
  assert.deepEqual(g.at(probe[0], probe[1], b).map(t => t.id), want, 'stale: the previous list answers');
  assert.equal(g.stats.staleAnswers, 1);
  while (queue.length) queue.shift()!();
  assert.ok(g.isReady(b));
  const pb = b.find(t => t.box)!.box!;
  assert.deepEqual(g.at(pb[0], pb[1], b).map(t => t.id), new BoxGrid(b, boxOf).at(pb[0], pb[1], b).map(t => t.id));
});

test('IdleBoxGrid: a newer list replaces one still building; sync mode builds at the query', () => {
  const queue: Array<() => void> = [];
  const g = new IdleBoxGrid<Item>(boxOf, cb => queue.push(cb), false, 100);
  const a = items(1000, 3), b = items(500, 4);
  g.prewarm(a); queue.shift()!();
  g.prewarm(b);
  while (queue.length) queue.shift()!();
  assert.ok(g.isReady(b) && !g.isReady(a));
  const s = new IdleBoxGrid<Item>(boxOf, () => { throw new Error('no idle work in sync mode'); }, true);
  const p = a.find(t => t.box)!.box!;
  assert.deepEqual(s.at(p[0], p[1], a).map(t => t.id), new BoxGrid(a, boxOf).at(p[0], p[1], a).map(t => t.id));
});
