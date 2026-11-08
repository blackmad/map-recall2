import assert from 'node:assert/strict';
import test from 'node:test';
import { unionMs, WorkerTrace } from './workerTrace';

test('unionMs merges overlapping spans', () => {
  assert.equal(unionMs([[0, 10], [5, 15], [20, 25]]), 20);
  assert.equal(unionMs([]), 0);
});

test('ahead splits a wait into init, other cells (input / build), far blocks and idle', () => {
  const t = new WorkerTrace(0);
  t.readyAt = 100;
  t.job({ kind: 'cell', key: 'a', start: 100, inputEnd: 300, end: 400 });
  t.job({ kind: 'far', key: 'f', start: 400, inputEnd: 450, end: 500 });
  t.job({ kind: 'cell', key: 'b', start: 520, inputEnd: 600, end: 700 });
  assert.deepEqual(t.ahead(50, 700), { cells: 2, cellInputMs: 280, cellBuildMs: 200, far: 1, farMs: 100, initMs: 50, idleMs: 20 });
  assert.deepEqual(t.ahead(700, 700), { cells: 0, cellInputMs: 0, cellBuildMs: 0, far: 0, farMs: 0, initMs: 0, idleMs: 0 });
});

test('fetchSplit counts the files a job started, its network wall time and gunzip', () => {
  const t = new WorkerTrace(0);
  t.fetch({ path: 'x', start: 10, fetched: 50, end: 55, bytes: 2048, stallMs: 30 });
  t.fetch({ path: 'y', start: 20, fetched: 80, end: 82, bytes: 1024, stallMs: 0 });
  t.fetch({ path: 'z', start: 200, fetched: 210, end: 211, bytes: 1024, stallMs: 0 });
  assert.deepEqual(t.fetchSplit(0, 100), { files: 2, kB: 3, netMs: 70, stallMaxMs: 30, gunzipMs: 7, byDir: { x: [1, 2], y: [1, 1] }, paths: ['x', 'y'] });
});
