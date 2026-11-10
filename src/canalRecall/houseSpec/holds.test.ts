// The release state of every spec hold, pinned (judgement ruling 2026-11-10). A merge that flips a hold fails here; a
// deliberate flip edits this test in the same commit. Caught after H9 r1's `SPEC_WALLS_HELD = false` rode a merge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SPEC_BAYS_HELD, SPEC_DESIGN_HELD, SPEC_STOOPS_HELD, SPEC_WALLS_HELD } from './decorate.ts';

test('spec holds: the released and held state of each field', () => {
  // flipped only by the H9 un-hold commit after the frame read
  assert.equal(SPEC_WALLS_HELD, true);
  // released by H1c (#350) 2026-11-10; flipped only by a rollback commit
  assert.equal(SPEC_BAYS_HELD, false);
  // released by K-stoep (#360) 2026-11-10; flipped only by a rollback commit
  assert.equal(SPEC_STOOPS_HELD, false);
  // storeys released with H9/H11; look and shop flipped only by the H11 un-hold commit after the frame read
  assert.deepEqual(SPEC_DESIGN_HELD, { storeys: false, look: true, shop: true });
});
