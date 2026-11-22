import assert from 'node:assert/strict';
import test from 'node:test';
import {risesAtBothEnds} from './hand-block-kit';

test('a stepped wall rises at both ends; a 3DBAG triangle rising from one end does not', () => {
  // Valkenburgerstraat-style step: flat foot 0..10 m, tops at 6 m (left) and 9 m (right)
  assert.equal(risesAtBothEnds([[0, 0], [10, 0], [10, 9], [0, 6]], 0, 10, 0), true);
  // a sloped top over a flat foot, both ends vertical
  assert.equal(risesAtBothEnds([[0, 0], [10, 0], [10, 20.5], [0, 6.1]], 0, 10, 0), true);
  // Westerdok 4 wall 163: foot 9.931 / 9.954 m, apex 20.776 m over the right end only
  assert.equal(risesAtBothEnds([[31.53, 9.931], [31.53, 20.776], [0, 9.954]], 0, 31.53, 9.931), false);
  // a top vertex 4 cm in from the end still counts as that end
  assert.equal(risesAtBothEnds([[0, 0], [10, 0], [9.96, 8], [0.04, 8]], 0, 10, 0), true);
});
