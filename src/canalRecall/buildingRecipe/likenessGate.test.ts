import {test} from 'node:test';
import assert from 'node:assert/strict';
import {likenessGate, parseAllowInferred, RULE_FITTED_LIMITATION, streetFacing, type GateGroup} from './likenessGate.ts';

const G = (group: number, verdict: GateGroup['verdict'], extra: Partial<GateGroup> = {}): GateGroup => ({group, system: 'brick-bay-grid', verdict, reasons: verdict === 'PASS' ? [] : ['x'], ...extra});

test('street-facing: named streets win; else every non-blank group', () => {
  assert.deepEqual(streetFacing([G(0, 'PASS'), G(1, 'PASS', {system: 'blank'}), G(2, 'PASS')]), [0, 2]);
  assert.deepEqual(streetFacing([G(0, 'PASS'), G(1, 'PASS', {street: 'Wibautstraat'})]), [1]);
});

test('likenessGate: FAIL, NO EVIDENCE and NO PHOTO on a street-facing group refuse; allowed with a note they pass as inferred', () => {
  const groups = [G(0, 'PASS'), G(1, 'WARN'), G(2, 'NO PHOTO'), G(3, 'FAIL'), G(4, 'FAIL', {system: 'blank'})];
  const r = likenessGate(groups);
  assert.equal(r.ok, false);
  assert.deepEqual(r.refused.map(s => s.split(' ')[0]), ['walls[2]', 'walls[3]'], 'the blank group is not street-facing');
  const ok = likenessGate(groups, parseAllowInferred('2:glazed gable, no crop, hand count from the 2024 panorama;3:dark brick read as glass by the measurement'));
  assert.equal(ok.ok, true);
  assert.equal(ok.reviewState, 'large-recipe-likeness-inferred');
  assert.equal(ok.limitations.length, 3, ok.limitations.join(' | '));
  assert.ok(ok.limitations.some(l => l.startsWith('walls[1] likeness WARN')));
  assert.equal(likenessGate([G(0, 'PASS'), G(1, 'WARN')]).reviewState, 'large-recipe-likeness-pass');
  assert.equal(likenessGate([G(0, 'PASS')], parseAllowInferred('7:some long note here')).ok, false, 'unknown group');
});

test('likenessGate: no crops keeps the legacy state; an allowance without a note is an error', () => {
  assert.deepEqual(likenessGate(null), {ok: true, reviewState: 'large-recipe-gates-pass', refused: [], limitations: [RULE_FITTED_LIMITATION]});
  assert.throws(() => parseAllowInferred('2'), /needs <group>:<note>/);
  assert.throws(() => parseAllowInferred('2:ok'), /needs <group>:<note>/);
});
