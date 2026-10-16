/**
 * Roof identity guard (scripts/block-face/roof-golden.json, recorded on main 2026-10-16 before the front-roof rules):
 * every pand whose roof class is still `survey` or `recipe` must be compiled from byte-identical facts (roofsRD, heights,
 * measuredEavesM); pands the rules reclassify (front, row) are listed, not failed. Resolved house intents of every face
 * hash the same unless the face opts into a roof field.
 *   node --import tsx --test src/canalRecall/blockFace/roofGolden.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {compareRoofGolden, readRoofGolden, roofHashes} from '../../../scripts/block-face/roof-golden.ts';

test('roof golden: survey/recipe pands compile from the recorded facts; reclassified pands are listed', () => {
  const golden = readRoofGolden(), now = roofHashes();
  const {violations, reclassed, intentsChanged} = compareRoofGolden(golden, now);
  for (const r of reclassed) console.log(`  reclassed: ${r}`);
  assert.deepEqual(violations, []);
  assert.deepEqual(intentsChanged, []);
  const errors = Object.entries(now.intents).filter(([, v]) => v.startsWith('error:'));
  assert.deepEqual(errors, []);
});
