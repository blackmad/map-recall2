// planRoof known misses (lane H5h round 5, #351): real fronts where the roof planner reads rooftop plant or a setback as
// the crown. Pinned as `todo` for a later planRoof lane: the assertions run and report, but do not fail the suite yet.
// Footprints and properties are the live chain's (building-tiles 8414/5384, register gable held as historicGable by the
// round-4 gate); the photo readings are the hand set's (data/house-line/hand-set-v1*.json).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roofPlanForFeature } from '../roofMesh.ts';

const feature = (id: string, props: Record<string, unknown>, ring: number[][]) => ({ type: 'Feature' as const, properties: { id: `NL.IMBAG.Pand.${id}`, minHeight: 0, roofPlanned: true, ...props }, geometry: { type: 'Polygon' as const, coordinates: [ring] } });

// Prinsengracht-side 173134 (BAG 1762, register bell): the photo shows a flat modern front with a glass rooftop structure;
// the planner plans a hipped roof over it (3DBAG's ridge is the glass box).
const f173134 = feature('0363100012173134', { height: 11.69, facadeStyle: 'canal', facade: 'canal-priorBrickBrown', constructionYear: 1762 },
  [[4.881489, 52.375395], [4.88137, 52.375367], [4.881415, 52.375292], [4.881458, 52.375302], [4.881467, 52.375287], [4.881543, 52.375304], [4.881489, 52.375395]]);
// 174187 (BAG 1737, register neck): the photo shows a cornice front; the planner plans a mansard whose steep face is on
// the street side (the rooftop setback read as the crown).
const f174187 = feature('0363100012174187', { height: 15.8, facadeStyle: 'canal', facade: 'canal-priorBrickRed', constructionYear: 1737 },
  [[4.879183, 52.374208], [4.879059, 52.374183], [4.879133, 52.374055], [4.879205, 52.37407], [4.879202, 52.374075], [4.87926, 52.374088], [4.879183, 52.374208]]);

// 174911 (BAG 1750, register point): the photo shows a cornice front; 3DBAG's crown is 0.4 m above the eaves (a lean-to
// face beside a flat deck), so the round-4 gate holds the register's point gable, but the planner's own saddle still puts
// a plain triangle on the street front.
const f174911 = feature('0363100012174911', { height: 12.55, facadeStyle: 'canal', facade: 'canal-priorPlaster', constructionYear: 1750 },
  [[4.878305, 52.374856], [4.878281, 52.374851], [4.878269, 52.374872], [4.878236, 52.374866], [4.878295, 52.374767], [4.87835, 52.374779], [4.878305, 52.374856]]);

test('planRoof today (pins the misses so a fix shows up as a change)', () => {
  assert.equal(roofPlanForFeature(f173134)?.kind, 'hipped');
  assert.equal(roofPlanForFeature(f174187)?.kind, 'mansard');
  assert.equal(roofPlanForFeature(f174911)?.kind, 'pitched');
});

test('174911: a cornice front over a 0.4 m 3DBAG crown plans no street-facing saddle', { todo: 'planRoof plans a pitched saddle where 3DBAG shows a flat top and a lean-to' }, () => {
  const plan = roofPlanForFeature(f174911);
  assert.ok(!plan || plan.kind === 'parapet' || (plan.kind === 'gable' && plan.gable === 'cornice'), `planned ${plan?.kind}/${plan?.gable}`);
});

test('173134: a flat modern front with a glass rooftop structure plans flat or a parapet, not hipped', { todo: 'planRoof reads rooftop plant (a glass box) as a hipped crown' }, () => {
  const plan = roofPlanForFeature(f173134);
  assert.ok(!plan || plan.kind === 'parapet', `planned ${plan?.kind}`);
});

test('174187: a cornice front plans a cornice crown, not a street-side mansard', { todo: 'planRoof reads a rooftop setback as a mansard on the street side' }, () => {
  const plan = roofPlanForFeature(f174187);
  assert.ok(plan && plan.kind === 'gable' && plan.gable === 'cornice', `planned ${plan?.kind}/${plan?.gable}`);
});
