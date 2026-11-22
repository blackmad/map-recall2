/**
 * `continuity.wallExposure` (Van Baerlestraat 2026-11-22): a face whose strip is a cast capture says its palette is the
 * exposure reference, so scripts/look/build-chunk-wall-exposure.ts writes stripOverDrawn 1 instead of re-lifting the
 * palette to the strip. Absent: the strip reading, unchanged.
 *   node --import tsx --test src/canalRecall/blockFace/wallExposure.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {faceStripOverDrawn, validateBlockFace} from './intent.ts';

const dir = 'scripts/block-face/faces/baerle-14-18';
const face = JSON.parse(fs.readFileSync(`${dir}/intent.json`, 'utf8')), order = JSON.parse(fs.readFileSync(`${dir}/discovery.json`, 'utf8')).members;
const withExposure = (we: unknown) => ({...face, continuity: {...face.continuity, wallExposure: we}});

test('absent: the strip reading passes through (null too)', () => {
  const f = validateBlockFace(face, order);
  assert.equal(faceStripOverDrawn(f, 1.735), 1.735);
  assert.equal(faceStripOverDrawn(f, null), null);
});

test('reference palette: stripOverDrawn is 1 whatever the strip read', () => {
  const f = validateBlockFace(withExposure({reference: 'palette', evidence: '2023-01-10 and 2025-07-30 captures'}), order);
  assert.equal(faceStripOverDrawn(f, 1.735), 1);
  assert.equal(faceStripOverDrawn(f, null), 1);
});

test('validation: only reference "palette" with evidence', () => {
  assert.throws(() => validateBlockFace(withExposure({reference: 'palette'}), order), /wallExposure/);
  assert.throws(() => validateBlockFace(withExposure({reference: 'strip', evidence: 'x'}), order), /wallExposure/);
  assert.throws(() => validateBlockFace(withExposure({reference: 'palette', evidence: 'x', gain: 2}), order), /wallExposure/);
});
