import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addStageMs, applyRunCost, censusCost, costFlags, normaliseModel, type CostRow} from './factoryCost.ts';

// A fixture queue in the factory's layout: four rows, two reviewed, one of them touched by an earlier run.
const fixture = (): {version: 1; items: CostRow[]} => ({
  version: 1,
  items: [
    {id: 'a', pand: '0363000000000001', status: 'reviewed-pass', verdict: {outcome: 'pass'}, model: 'opus', turns: 2, ms: {facts: 5000}},
    {id: 'b', pand: '0363000000000002', status: 'compiled', notes: ['compiled: 9000 tris']},
    {id: 'c', pand: '0363000000000003', status: 'reviewed-fix', verdict: {outcome: 'fix', note: 'glazing'}},
    {id: 'd', pand: '0363000000000004', status: 'queued'},
  ],
});

test('costFlags: --model and --turns, the model defaulting to CLAUDE_MODEL', () => {
  assert.deepEqual(costFlags(['node', 'x.ts', '--model=opus', '--turns=14'], {}), {model: 'opus', turns: 14});
  assert.deepEqual(costFlags(['node', 'x.ts'], {CLAUDE_MODEL: 'claude-haiku-5-5'}), {model: 'haiku'});
  assert.deepEqual(costFlags(['node', 'x.ts', '--model=sonnet'], {CLAUDE_MODEL: 'claude-haiku-5-5'}), {model: 'sonnet'});
  assert.deepEqual(costFlags(['node', 'x.ts'], {}), {});
  assert.throws(() => costFlags(['node', 'x.ts', '--turns=many'], {}), /non-negative/);
});

test('normaliseModel: any Haiku or Opus id maps to its family', () => {
  assert.equal(normaliseModel('claude-opus-4-1'), 'opus');
  assert.equal(normaliseModel('Claude-Haiku-5-5'), 'haiku');
  assert.equal(normaliseModel('gpt-x'), 'gpt-x');
});

test('applyRunCost: the run turns are split over the touched rows, the model is set, untouched rows are not', () => {
  const q = fixture();
  const before = q.items.map(r => JSON.stringify(r));
  const touched = [q.items[1], q.items[3]];
  applyRunCost(touched, {model: 'haiku', turns: 9});
  assert.equal(touched[0].turns, 4.5);
  assert.equal(touched[0].model, 'haiku');
  assert.equal(q.items[3].turns, 4.5);
  // rows no run touched serialise exactly as before
  assert.equal(JSON.stringify(q.items[0]), before[0]);
  assert.equal(JSON.stringify(q.items[2]), before[2]);
  // a second run accumulates into the row's turns
  applyRunCost([q.items[1]], {turns: 1});
  assert.equal(q.items[1].turns, 5.5);
  assert.equal(q.items[1].model, 'haiku');
});

test('applyRunCost with no flags leaves the queue text byte-identical', () => {
  const q = fixture();
  const text = JSON.stringify(q, null, 1) + '\n';
  applyRunCost(q.items, {});
  applyRunCost([], {model: 'opus', turns: 3});
  assert.equal(JSON.stringify(q, null, 1) + '\n', text);
});

test('addStageMs: per-stage wall time accumulates on the row only', () => {
  const r: CostRow = {id: 'x'};
  addStageMs(r, 'facts', 1200.4);
  addStageMs(r, 'facts', 300);
  addStageMs(r, 'install', 40);
  assert.deepEqual(r.ms, {facts: 1500.4, install: 40});
});

test('applyRunCost: wall time for a stage is split over the rows', () => {
  const rows: CostRow[] = [{id: 'p'}, {id: 'q'}];
  applyRunCost(rows, {stage: 'strip', ms: 1000});
  assert.deepEqual(rows.map(r => r.ms), [{strip: 500}, {strip: 500}]);
});

test('censusCost: turns per reviewed building counts only rows with a verdict and turns', () => {
  const q = fixture();
  applyRunCost([q.items[0], q.items[1], q.items[2]], {model: 'opus', turns: 6});
  const c = censusCost(q.items);
  assert.equal(c.reviewed, 2);
  assert.equal(c.reviewedWithTurns, 2);
  assert.equal(c.turnsReviewed, 2 + 2 + 2);
  assert.equal(c.turnsPerReviewed, 3);
  assert.equal(c.turnsAllRows, 6 + 2);
  assert.deepEqual(c.byModel.opus, {rows: 3, turns: 8});
  assert.deepEqual(c.byModel.haiku, undefined);
  assert.equal(c.msByStage.facts, 5000);
});

test('censusCost: no rows with turns yet is null, not zero', () => {
  const c = censusCost(fixture().items.map(({model, turns, ...r}) => r));
  assert.equal(c.turnsPerReviewed, null);
  assert.equal(c.reviewed, 2);
});
