/**
 * Stacked offset blocks (blockBuilding/stackedBlocks.ts, Blend Haarlemmerweg 518A-776): per-storey rows of B (block
 * stepping out of the core wall), R (recessed balcony) and . (core). Opt-in: a wall without `stackedBlocks` compiles
 * byte-identically.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateLargeIntent} from './largeIntent.ts';
import {compileBuilding} from './compile.ts';
import type {BuildingFacts} from './facts.ts';
import {STACKED_BLOCKS, blockBoxes, blockDepthM, cellRuns, fitStackedBlocks, stackedBlocksProblems} from '../blockBuilding/stackedBlocks.ts';
import {meshHashOf} from '../../../scripts/building-recipes/mesh-hash.ts';

const HOUSES = 'scripts/building-recipes/houses', BLEND = 'haarlemmerweg-518';
const raw = (id: string) => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/intent.json`, 'utf8'));
const facts = (id: string): BuildingFacts => JSON.parse(fs.readFileSync(`${HOUSES}/${id}/facts.json`, 'utf8'));
const slots = {wall: 'w', frame: 'f', glass: 'g', rail: 'r'};

test('stackedBlocks schema: storeys in range, one B/R/. cell per bay, fractions in range, no unknown fields', () => {
  assert.deepEqual(stackedBlocksProblems({rows: {1: 'BR.', 12: '..B'}, deep: 0.47, window: {w: 0.62, h: 0.7, sill: 0.12}, panes: 4}, 'sb', 3, 13), []);
  assert.ok(stackedBlocksProblems({rows: {13: 'BBB'}}, 'sb', 3, 13).some(p => /rows\.13/.test(p)), 'past the top storey');
  assert.ok(stackedBlocksProblems({rows: {2: 'BB'}}, 'sb', 3, 13).some(p => /2 cells for 3 bays/.test(p)));
  assert.ok(stackedBlocksProblems({rows: {2: 'BXB'}}, 'sb', 3, 13).some(p => /one of B/.test(p)));
  assert.ok(stackedBlocksProblems({rows: {}}, 'sb', 3, 13).some(p => /at least one/.test(p)));
  assert.ok(stackedBlocksProblems({rows: {2: 'BBB'}, deep: 0.9}, 'sb', 3, 13).some(p => /deep/.test(p)));
  assert.ok(stackedBlocksProblems({rows: {2: 'BBB'}, deepM: 1.5}, 'sb', 3, 13).some(p => /unknown field/.test(p)));
  assert.ok(stackedBlocksProblems({rows: {2: 'BBB'}, window: {w: 0.6, h: 0.8, sill: 0.2}}, 'sb', 3, 13).some(p => /h \+ sill/.test(p)));
  assert.ok(stackedBlocksProblems({rows: {2: 'BBB'}, panes: 3}, 'sb', 3, 13).some(p => /panes/.test(p)));
});

test('fit, runs and boxes: defaults applied, runs per storey, spans merged up the storeys where they repeat', () => {
  const f = fitStackedBlocks({rows: {'3': 'BB..', '1': 'BB.B', '2': 'BB.R'}}, slots);
  assert.deepEqual(Object.keys(f.rows), ['1', '2', '3']);
  assert.equal(f.deep, STACKED_BLOCKS.deep); assert.equal(f.panes, 4); assert.deepEqual(f.window, STACKED_BLOCKS.window);
  assert.deepEqual(cellRuns('BB.RRB', 'B'), [[0, 2], [5, 6]]);
  assert.deepEqual(cellRuns('BB.RRB', 'R'), [[3, 5]]);
  assert.deepEqual(blockBoxes(f), [{b0: 0, b1: 2, s0: 1, s1: 4}, {b0: 3, b1: 4, s0: 1, s1: 2}]);
});

test('block depth: deep x the median storey height, clamped to 0.6..2.5 m', () => {
  assert.ok(Math.abs(blockDepthM([0, 3.2, 6.4, 9.6], 0.47) - 1.504) < 1e-9);
  assert.equal(blockDepthM([0, 3.2, 6.4], 0.15), STACKED_BLOCKS.minDeepM);
  assert.equal(blockDepthM([0, 6, 12], 0.8), STACKED_BLOCKS.maxDeepM);
});

test('Blend: blocks and balconies are drawn; without stackedBlocks none are counted and the mesh changes', () => {
  const intent = validateLargeIntent(raw(BLEND)), f = facts(BLEND);
  const a = compileBuilding(intent, f);
  assert.ok((a.components.stackedBlocks ?? 0) >= 50, `blocks ${a.components.stackedBlocks}`);
  assert.ok((a.components.stackedBalconies ?? 0) >= 70, `balconies ${a.components.stackedBalconies}`);
  const stripped = raw(BLEND);
  for (const w of stripped.walls) delete w.stackedBlocks;
  const b = compileBuilding(validateLargeIntent(stripped), f);
  assert.equal(b.components.stackedBlocks, undefined);
  assert.notEqual(meshHashOf(a.group), meshHashOf(b.group));
});
