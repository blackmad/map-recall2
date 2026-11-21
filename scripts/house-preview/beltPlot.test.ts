/**
 * Belt review render wiring (2026-11-21): house preview stamps a description's plot (beltReview/plotRead.ts) as a one-plot
 * design unit, and the describer's crown words reach the roof planner. Kept out of src/ (preview.ts is not in the typed
 * program).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { beltPlotFacts } from '../../src/canalRecall/beltReview/plotRead.ts';
import { overridePatch } from './preview.ts';

const H2 = {
  fields: { storeys: 3, bays: 3, crown: 'cornice', cornice: 'frieze', roofStorey: 'dormers', dormers: { count: 1, kind: 'plain' }, door: { bay: 3 }, eavesM: 12.75 },
  read: { wallHex: '#4e4a4c', dormerStyle: 'arched', roofMaterial: 'red-tile', whiteHeads: 'none', stringCourses: true, speklagen: 'none', ornaments: [], kitCannotSay: [] },
};

test('house preview stamps the plot; the describer\'s raised-neck and point crowns reach the planner', () => {
  const plot = beltPlotFacts(H2.fields, H2.read, { widthM: 8 })!;
  const o = overridePatch({ source: 't', pandId: '0363100100091828', design: { fronts: [{ storeys: 3, cornice: 'frieze', roofStorey: 'dormers', doorBay: 3 }], palette: {}, plot } as never });
  assert.equal((o.patch.designUnit as { solo?: boolean }).solo, true);
  assert.ok(!o.notApplied.some(n => /plot|cornice|roofStorey|doorBay/.test(n)), o.notApplied.join('; '));
  assert.equal(overridePatch({ source: 't', design: { fronts: [{ gable: 'raised-neck' }] } }).patch.monumentGable, 'raisedNeck');
  assert.equal(overridePatch({ source: 't', design: { fronts: [{ gable: 'point' }] } }).patch.monumentGable, 'plain');
  // Without a plot the patch has no stamp (byte-identical for every other spec).
  assert.equal(overridePatch({ source: 't', design: { fronts: [{ storeys: 3 }] } }).patch.designUnit, undefined);
});
