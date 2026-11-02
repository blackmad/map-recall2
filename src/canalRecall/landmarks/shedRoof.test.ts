import assert from 'node:assert/strict';
import test from 'node:test';
import {shedRoof, type LocalPoint, type ShedTriangle} from './shedRoof';

const spec = {u0: 26.2, u1: 35.8, v0: -18.5, count: 10, pitch: 2.1, y: 4.68, rise: 1.47};
const sub = (a: LocalPoint, b: LocalPoint): LocalPoint => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: LocalPoint, b: LocalPoint): LocalPoint => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: LocalPoint, b: LocalPoint) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normal = (t: ShedTriangle) => cross(sub(t.points[1], t.points[0]), sub(t.points[2], t.points[0]));
// The local frame is [u, v, y]; area of a triangle projected on the u-v plan.
const planArea = (t: ShedTriangle) => Math.abs(normal(t)[2]) / 2;

test('six triangles per tooth: two slope, two glazing, two gables', () => {
  const tris = shedRoof(spec);
  assert.equal(tris.length, 60);
  for (const part of ['slope', 'glazing', 'gable'] as const) assert.equal(tris.filter(t => t.part === part).length, 20);
});

test('each declared outward direction agrees with the triangle plane (up for roof faces, along u for gables)', () => {
  for (const t of shedRoof(spec)) {
    const n = normal(t);
    assert.ok(Math.abs(dot(n, t.out)) > 1e-9, `${t.part} out direction lies in its plane`);
    if (t.part !== 'gable') assert.ok((dot(n, t.out) > 0 ? n[2] : -n[2]) > 0, `${t.part} faces up`);
  }
  for (const t of shedRoof(spec).filter(x => x.part === 'slope')) assert.ok(t.out[1] < 0, 'the slope turns away from the glazing');
  for (const t of shedRoof(spec).filter(x => x.part === 'glazing')) assert.ok(t.out[1] > 0, 'the glazing turns to the light');
});

test('slopes and glazing tile the plan exactly once; ridges at the given height and fraction', () => {
  const tris = shedRoof(spec);
  const area = tris.filter(t => t.part !== 'gable').reduce((s, t) => s + planArea(t), 0);
  assert.ok(Math.abs(area - (spec.u1 - spec.u0) * spec.count * spec.pitch) < 1e-6, `plan area ${area}`);
  const ys = tris.flatMap(t => t.points.map(p => p[2]));
  assert.equal(Math.min(...ys), spec.y);
  assert.ok(Math.abs(Math.max(...ys) - (spec.y + spec.rise)) < 1e-12);
  const ridgeVs = [...new Set(tris.flatMap(t => t.points.filter(p => p[2] > spec.y).map(p => +p[1].toFixed(6))))].sort((a, b) => a - b);
  assert.equal(ridgeVs.length, spec.count);
  assert.ok(Math.abs(ridgeVs[0] - (spec.v0 + spec.pitch * 0.67)) < 1e-6);
});

test('rejects degenerate specs', () => {
  assert.throws(() => shedRoof({...spec, count: 0}));
  assert.throws(() => shedRoof({...spec, u1: spec.u0}));
  assert.throws(() => shedRoof({...spec, ridgeAt: 1}));
});
