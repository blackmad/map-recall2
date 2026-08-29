import assert from 'node:assert/strict';
import { buildingColorExpression, buildingOpacity } from '../src/canalRecall/buildingStyle';

const clean = JSON.stringify(buildingColorExpression('clean'));
assert.match(clean, /colour/);
assert.match(clean, /material/);
assert.match(clean, /#43888b/);
assert.match(clean, /#bd8161/);
assert.match(clean, /render_height/);
assert.match(clean, /#DED9D0/);
assert.match(clean, /#AAA095/);
assert.doesNotMatch(clean, /null/);
assert.equal(buildingColorExpression('cyberpunk'), '#25114D');
assert.equal(buildingOpacity('cyberpunk'), 0.98);
assert.equal(buildingOpacity('clean'), 0.9);
process.stdout.write('Canal Recall building-style checks passed.\n');
