import assert from 'node:assert/strict';
import test from 'node:test';
import { planRoof, roofPlanForFeature, type Rect } from './roofMesh.js';

// Nassaukade 171 (note ba8499fa): a narrow deep 1902 terraced house whose seeded roof was a half-hip,
// drawing a bare brick trapezoid above its cornice between crowned neighbours.
const NASSAUKADE_171 = {
  type: 'Feature' as const,
  properties: { id: 'NL.IMBAG.Pand.0363100012153093', height: 15.18, minHeight: 0, constructionYear: 1902, facadeStyle: 'c19', roofPlanned: true },
  geometry: { type: 'Polygon', coordinates: [[[4.874524, 52.370404], [4.874514, 52.370402], [4.874253, 52.370359], [4.874277, 52.370301], [4.874549, 52.370346], [4.874524, 52.370404]]] },
};

test('Nassaukade 171: a narrow terraced plot gets a gable crown, not a half-hip', () => {
  const plan = roofPlanForFeature(NASSAUKADE_171 as any);
  assert.ok(plan, 'still roofed');
  assert.equal(plan!.kind, 'gable');
});

test('no unmapped deep narrow plot plans a half-hip; mapped, shallow-row and free-standing half-hips stay', () => {
  const narrow: Rect = { cx: 0, cy: 0, ux: 1, uy: 0, len: 18, wid: 6.6, coverage: 1, maxDev: 0 };
  const villa: Rect = { cx: 0, cy: 0, ux: 1, uy: 0, len: 11, wid: 9.5, coverage: 1, maxDev: 0 };
  const row: Rect = { cx: 0, cy: 0, ux: 1, uy: 0, len: 11.6, wid: 7.2, coverage: 1, maxDev: 0 };
  let villaHalfHips = 0, rowHalfHips = 0;
  for (let i = 0; i < 600; i++) {
    assert.notEqual(planRoof(`n${i}`, 'c19', 15, 0, narrow, undefined, 1902)?.kind, 'halfHipped', `n${i}`);
    assert.equal(planRoof(`n${i}`, 'c19', 15, 0, narrow, 'half-hipped', 1902)?.kind, 'halfHipped', 'a mapped half-hip is honoured');
    if (planRoof(`r${i}`, 'c19', 14, 0, row, undefined, 1880)?.kind === 'halfHipped') rowHalfHips++;
    if (planRoof(`v${i}`, 'c19', 12, 0, villa, undefined, 1902)?.kind === 'halfHipped') villaHalfHips++;
  }
  assert.ok(rowHalfHips > 10, `a shallow row along its street still draws half-hips (${rowHalfHips})`);
  assert.ok(villaHalfHips > 60, `a villa still draws half-hips (${villaHalfHips})`);
});
