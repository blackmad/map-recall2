// Lane 1 step c: measured crown profiles are symmetric, never go back, reach the record's top, and stand over the saddle
// they sit on. Named regressions: Haarlemmerdijk 20 (167818, neck 1.55 m, rise 2.7 m on a 3.77 m front), 143 (169539,
// bell 4.5 m foot, 2.3 m cap, rise 2.2 m), Haarlemmerstraat 54 (171144, neck 3.2/2.2 m with a hoist door).
import test from 'node:test';
import assert from 'node:assert/strict';
import { rowCrownProfile, rowCrownRoofRise, type RowCrown } from './crownProfile.ts';

const cases: Array<[string, RowCrown, number]> = [
  ['167818 neck', { shape: 'neck', riseM: 2.7, neckW: 1.55, attic: 1 }, 3.77],
  ['169539 bell', { shape: 'bell', riseM: 2.2, footW: 4.5, neckW: 2.3, attic: 1 }, 5.1],
  ['171144 neck', { shape: 'neck', riseM: 1.65, footW: 3.2, neckW: 2.2, hoist: true }, 4.6],
  ['point', { shape: 'point', riseM: 2.5 }, 6],
  ['step', { shape: 'step', riseM: 3.2, neckW: 1.2 }, 6],
];
for (const [name, c, W] of cases) test(`crown profile: ${name}`, () => {
  const R = rowCrownRoofRise(c, W), prof = rowCrownProfile(c, W, R);
  assert.ok(R > 0.5 && R <= c.riseM + 1e-9, `roof rise ${R}`);
  assert.deepEqual(prof[0], [-W / 2, 0]); assert.deepEqual(prof.at(-1), [W / 2, 0]);
  for (let i = 1; i < prof.length; i++) assert.ok(prof[i][0] >= prof[i - 1][0] - 1e-9, `goes back at ${i}`);
  for (const [x, y] of prof) {
    assert.ok(y >= R * (1 - Math.abs(x) / (W / 2)) - 1e-6, `under the saddle at ${x}`);
    assert.ok(prof.some(([x2, y2]) => Math.abs(x2 + x) < 1e-6 && Math.abs(y2 - y) < 1e-6), `not symmetric at ${x},${y}`);
  }
  assert.ok(Math.abs(Math.max(...prof.map(p => p[1])) - c.riseM) < 0.05, 'top is the record\'s');
});
