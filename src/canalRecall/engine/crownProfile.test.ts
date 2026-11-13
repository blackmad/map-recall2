import test from 'node:test';
import assert from 'node:assert/strict';
import { gableProfile, type GableShape } from '../roofMesh.ts';
import { CROWN_PROFILE_GLSL, CROWN_SEGMENTS, crownCodes, crownProfile, crownProfileY, type CrownShape } from './crownProfile.ts';

const shape = (p: Partial<CrownShape>): CrownShape => ({ kind: 'neck', rise: 5, neck: 0, capRise: 0, steps: 0, shoulder: null, cap: null, half: null, ...p });
/** Area under a profile over -half..half (trapezoids). */
const area = (pts: readonly (readonly [number, number])[]) => pts.slice(1).reduce((a, p, i) => a + (p[0] - pts[i][0]) * (p[1] + pts[i][1]) / 2, 0);
const stripArea = (c: CrownShape, W: number) => { const ys = crownProfile(c); return ys.slice(1).reduce((a, y, i) => a + (W / CROWN_SEGMENTS) * (y + ys[i]) / 2, 0); };

test('S7 crown profiles: the planner gable shapes, in its proportions (area within 15 %, same top)', () => {
  const W = 6, R = 3;
  const cases: [GableShape, CrownShape['kind'], number][] = [['step', 'step', R * 1.18 + 0.55], ['neck', 'neck', R * 1.45 + 0.7], ['bell', 'bell', R * 1.3 + 0.6], ['plain', 'point', R]];
  for (const [planner, kind, top] of cases) {
    const p = gableProfile(planner, W, R), c = shape({ kind, rise: top });
    const maxP = Math.max(...p.map(q => q[1])), maxC = Math.max(...crownProfile(c));
    assert.ok(Math.abs(maxP - maxC) < 0.15, `${kind} top ${maxC} vs planner ${maxP}`);
    const a = area(p), b = stripArea(c, W);
    assert.ok(Math.abs(b - a) / a < 0.15, `${kind} area ${b.toFixed(2)} vs planner ${a.toFixed(2)}`);
  }
});

test('S7 crown profiles: symmetric, feet at the eaves (a shouldered crown at its shoulder); a half crown rises to one end', () => {
  for (const kind of ['step', 'neck', 'raised-neck', 'bell', 'point', 'spout', 'shouldered'] as const) {
    const ys = crownProfile(shape({ kind }));
    for (let i = 0; i <= CROWN_SEGMENTS; i++) assert.ok(Math.abs(ys[i] - ys[CROWN_SEGMENTS - i]) < 1e-9, `${kind} symmetric at ${i}`);
    assert.ok(Math.max(...ys) >= 5 - 1e-9 && ys[0] <= 5 * (kind === 'shouldered' ? 0.45 : 0.31) + 1e-9, `${kind}: top ${Math.max(...ys)}, foot ${ys[0]}`);
  }
  const left = crownProfile(shape({ kind: 'point', half: 'left' })), right = crownProfile(shape({ kind: 'point', half: 'right' }));
  assert.ok(left[0] < 1e-9 && Math.abs(left[CROWN_SEGMENTS] - 5) < 1e-9, 'left half rises to the right end');
  assert.ok(right[CROWN_SEGMENTS] < 1e-9 && Math.abs(right[0] - 5) < 1e-9, 'right half rises to the left end');
  assert.deepEqual(crownProfile(shape({ kind: 'flat' })), new Array(CROWN_SEGMENTS + 1).fill(0));
});

test('S7 crown profiles: caps sit on the neck; a step gable has `steps` treads a side', () => {
  const plain = crownProfileY(shape({ kind: 'neck' }), 0.5);
  assert.equal(crownProfileY(shape({ kind: 'neck', cap: 'rounded', capRise: 0.8 }), 0.5), plain + 0.8);
  assert.equal(crownProfileY(shape({ kind: 'neck', cap: 'flat', capRise: 0.8 }), 0.5), plain);
  for (const steps of [2, 3, 5]) {
    const levels = new Set(crownProfile(shape({ kind: 'step', steps, rise: 6 })).map(y => y.toFixed(6)));
    assert.equal(levels.size, steps + 1, `${steps} treads a side plus the top`);
  }
  assert.deepEqual(crownCodes(shape({ kind: 'neck', shoulder: 'ogee', cap: 'pediment', half: 'right' })), [1, 2, 3, 2]);
});

test('S7 crown GLSL: a copy of every constant and shape branch, and no GLSL ES 3.00 reserved word', () => {
  for (const name of ['crownProfileY', 'crownShoulderCurve', 'crownCapCurve', '0.42', '0.45', '0.3', '0.18', '0.12', '0.6']) assert.ok(CROWN_PROFILE_GLSL.includes(name), name);
  const reserved = ['patch', 'sample', 'input', 'output', 'filter', 'common', 'half', 'fixed', 'cast', 'buffer', 'shared', 'precise', 'active', 'class', 'union'];
  const src = CROWN_PROFILE_GLSL.replace(/\/\/[^\n]*/g, '');
  assert.deepEqual(reserved.filter(w => new RegExp(`\\b${w}\\b`).test(src)), []);
});
