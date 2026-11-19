// Broken-ground detector (groundDetector.ts, feedback c57c04): the three sources become one list, worst first, one per place.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DETECTOR_WEIGHTS, auditTileHits, holeJunctionHits, railJoinHits, rankHits } from './groundDetector';

test('audit tiles, sunk junctions and rail joins rank on one scale; nearby hits fold into the worst', () => {
  const tally = (o: Partial<Record<'voidM2' | 'crackM2' | 'pokeSevereM2' | 'floatSevereM2' | 'thinM2', number>>) => ({ voidM2: 0, crackM2: 0, pokeSevereM2: 0, floatSevereM2: 0, thinM2: 0, ...o });
  const audit = auditTileHits([
    { cell: '0_1', tile: '1_1', x: 0, y: 0, tally: tally({ voidM2: 400, thinM2: 100 }) },
    { cell: '0_1', tile: '1_2', x: 30, y: 0, tally: tally({ crackM2: 10 }) },
    { cell: '0_1', tile: '1_3', x: 5000, y: 0, tally: tally({}) },
  ], (x, y) => [4.9 + x / 68000, 52.37 + y / 111000]);
  assert.equal(audit.length, 2, 'a clean tile is no hit');
  assert.equal(audit[0].kind, 'void');
  assert.equal(audit[0].score, 400 * DETECTOR_WEIGHTS.void + 100 * DETECTOR_WEIGHTS.thin);
  const holes = holeJunctionHits([{ id: 'BRU1', name: 'x', at: '4.95,52.36', after: 3 }, { id: 'BRU2', at: '4.96,52.36', after: 0 }]);
  assert.equal(holes.length, 1);
  const rails = railJoinHits([{ id: 'j1', cls: 'join', kind: 'tram', reasons: ['step 3 m'], score: 3, detail: { lngLat: '4.85,52.35' } }]);
  const ranked = rankHits([...audit, ...holes, ...rails]);
  assert.deepEqual(ranked.map(h => h.source), ['railJoin', 'audit', 'holeJunction'], 'worst first');
  assert.equal(ranked[1].also?.length, 1, 'the crack 30 m away folds into the void tile');
});
