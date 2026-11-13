import test from 'node:test';
import assert from 'node:assert/strict';
import { readFields, withTemplate, fieldsDraw, specFieldsEnabled, BAND_M } from './routeAFields.ts';
import { STRUCTURE_FIELDS, type TemplatePick } from './streetTemplate.ts';
import type { HouseSpec } from './spec.ts';

const vj = (confidence = 0.7) => ({ source: 'vision-judge', confidence, ref: 'd1', at: null });
const spec = (front: Record<string, unknown>, prov: Record<string, ReturnType<typeof vj>>, facts?: Record<string, unknown>): HouseSpec =>
  ({ schemaVersion: 1, pandId: '0363100012171218', design: { fronts: [front as never] }, provenance: prov as HouseSpec['provenance'], ...(facts ? { facts } : {}) } as HouseSpec);

test('passing classes only, at D1 confidence >= 0.5', () => {
  const f = readFields(spec({ bands: 'speklagen', windowHead: { kind: 'segmental' }, gable: 'cornice' }, { 'fronts/0/bands': vj(), 'fronts/0/windowHead': vj(), 'fronts/0/gable': vj() }))!;
  assert.deepEqual({ bands: f.bands, head: f.head, crown: f.crown }, { bands: 'speklagen', head: 'segmental', crown: 'cornice' });
  assert.equal(readFields(spec({ bands: 'storey' }, { 'fronts/0/bands': vj(0.35) })), null, 'under the bar');
  assert.equal(readFields(spec({ bands: 'courses' }, { 'fronts/0/bands': vj() })), null, 'courses: no generic quad (kit gap)');
  assert.equal(readFields(spec({ windowHead: { kind: 'segmental', storeys: [1] } }, { 'fronts/0/windowHead': vj() })), null, 'per-row heads are held');
});

test('a curved crown takes the register\'s curved kind, else neck', () => {
  assert.equal(readFields(spec({ gable: 'bell' }, { 'fronts/0/gable': vj() }))!.crown, 'neck');
  assert.equal(readFields(spec({ gable: 'neck' }, { 'fronts/0/gable': vj() }, { historicGable: 'bell' }))!.crown, 'bell');
  assert.equal(readFields(spec({ gable: 'bell' }, { 'fronts/0/gable': vj() }, { historicGable: 'step' }))!.crown, 'neck');
});

const pick = (f: Record<string, unknown>): TemplatePick => ({ pandId: '0363100012168000', street: 'X', distM: 20, sameStreet: true, pool: 3, src: 'streetlevel-measured', fields: f });

test('the template fills dressings the reading left open, never structure, and never over a reading', () => {
  const t = withTemplate(readFields(spec({ bands: 'storey' }, { 'fronts/0/bands': vj() })), pick({ 'fronts/0/bands': 'speklagen', 'fronts/0/windowSurround': 'eared-keystone' }))!;
  assert.equal(t.bands, 'storey'); assert.equal(t.src.bands, 'vision-judge');
  assert.equal(t.pale, true); assert.equal(t.src.pale, 'template:0363100012168000');
  assert.equal(withTemplate(null, pick({ 'fronts/0/windowSurround': 'sill' }))!.pale, false);
  assert.equal(withTemplate(null, pick({})), null);
  for (const path of STRUCTURE_FIELDS) assert.equal(withTemplate(null, pick({ [path]: 'x' })), null, path);
});

test('draw: band-line components at the band height, stone wider than speklagen; heads as the arch trait', () => {
  assert.deepEqual(fieldsDraw({ bands: 'both', src: {} }), { force: ['floor-cornices', 'string-courses'], bandM: BAND_M.stone });
  assert.deepEqual(fieldsDraw({ bands: 'speklagen', src: {} }), { force: ['floor-cornices'], bandM: BAND_M.speklagen });
  assert.ok(BAND_M.stone > BAND_M.speklagen);
  assert.deepEqual(fieldsDraw({ head: 'flat', src: {} }), { force: [], arch: false });
  assert.deepEqual(fieldsDraw(undefined), { force: [] });
});

test('flag: default on, ?specFields=0 / SPEC_FIELDS=0 off', () => {
  assert.equal(specFieldsEnabled(null, null), true);
  assert.equal(specFieldsEnabled('?specFields=0', null), false);
  assert.equal(specFieldsEnabled(null, '0'), false);
});
