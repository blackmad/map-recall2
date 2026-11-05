import test from 'node:test';
import assert from 'node:assert/strict';
import {bathtubShell, roundedRect, tubNormal, type BathtubSpec} from './bathtubShell';

const spec: BathtubSpec = {
  bottom: {u0: -44, u1: 44, v0: -10, v1: 4, radius: 3},
  rim: {u0: -46, u1: 46, v0: -12, v1: 7, radius: 6},
  top: 17,
  bottomAt: u => (u < -12 ? 4.4 : 4.4 + (u + 12) * (6.1 / 56)),
  breaks: [-12],
};

test('rounded rectangle rings stay inside their rectangle and close', () => {
  const r = roundedRect({u0: 0, u1: 10, v0: 0, v1: 4, radius: 1}, 4);
  assert.equal(r.length, 20);
  for (const [u, v] of r) { assert.ok(u >= -1e-9 && u <= 10 + 1e-9); assert.ok(v >= -1e-9 && v <= 4 + 1e-9); }
});

test('the hull winds outward and the bottom faces down', () => {
  const t = bathtubShell(spec);
  assert.ok(t.sides.length > 0 && t.bottom.length > 0);
  for (const tri of t.bottom) assert.ok(tubNormal(tri)[2] < 0, 'bottom faces down');
  // side faces near the rim on the +v side point to +v, on the -u end to -u
  const centroid = (tri: typeof t.sides[0]) => tri.reduce((s, p) => [s[0] + p[0] / 3, s[1] + p[1] / 3, s[2] + p[2] / 3], [0, 0, 0]);
  for (const tri of t.sides) {
    const c = centroid(tri), n = tubNormal(tri);
    if (c[2] > 12 && Math.abs(c[0]) < 30 && c[1] > 5) assert.ok(n[1] > 0.5, 'north side points north');
    if (c[2] > 12 && c[0] < -45.5 && Math.abs(c[1]) < 2) assert.ok(n[0] < -0.5, 'west end points west');
  }
});

test('the bottom follows a piecewise bottom height, and the sides reach the rim', () => {
  const t = bathtubShell(spec);
  for (const tri of t.bottom) for (const [u, , y] of tri) assert.ok(Math.abs(y - spec.bottomAt(Math.max(-44, Math.min(44, u)))) < 1e-9);
  const tops = t.sides.flatMap(tri => tri.map(p => p[2])).filter(y => Math.abs(y - 17) < 1e-9);
  assert.ok(tops.length > 0);
  assert.equal(t.rimRing.length, 22);   // 4 corners x 5 points + the break station on each long side
  for (const [u, v] of t.rimRing) assert.ok(u >= -46 - 1e-9 && u <= 46 + 1e-9 && v >= -12 - 1e-9 && v <= 7 + 1e-9);
});

test('rejects a bottom above the rim and a rim that does not contain the bottom', () => {
  assert.throws(() => bathtubShell({...spec, bottomAt: () => 18}));
  assert.throws(() => bathtubShell({...spec, rim: {...spec.rim, u1: 40}}));
});

test('the hull and bottom are closed except at the rim (no T-junction at a bottom break)', () => {
  const t = bathtubShell(spec);
  const key = (p: number[]) => p.map(x => x.toFixed(6)).join(',');
  const edges = new Map<string, number>();
  for (const tri of [...t.sides, ...t.bottom]) for (let i = 0; i < 3; i++) {
    const a = key(tri[i]), b = key(tri[(i + 1) % 3]), k = a < b ? `${a}|${b}` : `${b}|${a}`;
    edges.set(k, (edges.get(k) ?? 0) + 1);
  }
  const open = [...edges].filter(([, n]) => n === 1).map(([k]) => k.split('|').map(s => Number(s.split(',')[2])));
  assert.ok(open.length > 0);
  for (const ys of open) for (const y of ys) assert.ok(Math.abs(y - 17) < 1e-6, `open edge below the rim at y=${y}`);
});
