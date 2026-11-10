// Named regression (#316 step 0): the Nieuwmarkt row by the Waag (RCE 3849–3856, user shot 2026-11-09). Every pand
// the register names a gable for draws a planned roof with that crown, not a flat lid and a parapet. Nieuwmarkt 14
// (bell top, 9-vertex corner plan) was flat until roofMesh planBuildingRoof roofed a register gable's fitted box.
// Nieuwmarkt 18 (0363100012182858) stays flat: its pand is a 28 x 18 m L (front house plus rear), box coverage 0.41.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gameChain, loadTile } from '../world/pipeline.ts';
import { roofPlanForFeature } from '../../src/canalRecall/roofMesh.ts';

const ROW: Record<string, string> = {
  '0363100012171851': 'step', // 6
  '0363100012171854': 'bell', // 8
  '0363100012182849': 'cornice', // 10 and 12 (one pand)
  '0363100012182848': 'bell', // 14
  '0363100012182847': 'neck', // 16
  '0363100012182857': 'step', // 20-22
};

test('Nieuwmarkt 6–22: register gables reach the roof planner', async () => {
  const rows = await loadTile('8414/5384', gameChain()).then(async a => a.concat(await loadTile('8415/5384', gameChain())));
  for (const [pand, gable] of Object.entries(ROW)) {
    const row = rows.find(r => String(r.raw.properties.id) === `NL.IMBAG.Pand.${pand}`);
    assert.ok(row, `${pand} in the tiles`);
    const plan = roofPlanForFeature(row!.styled as any);
    assert.equal(plan?.kind, 'gable', `${pand} roof kind`);
    assert.equal(plan?.gable, gable, `${pand} crown`);
  }
});
