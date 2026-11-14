// realLook round 2 tree crowns (trees/crownGeometry.ts): same triangles as today's icosahedron lobes, irregular outline.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CROWN_SHAPE, crownLobe, crownRadius, icosphere } from './crownGeometry.ts';

test('same triangle count as the icosahedron lobes it replaces (20 far, 80 near): 1.0x of today', () => {
  assert.equal(icosphere(0).length, 20); assert.equal(icosphere(1).length, 80);
  for (const v of [0, 1, 2]) { assert.equal(crownLobe(0, v).triangles, 20); assert.equal(crownLobe(1, v).triangles, 80); assert.equal(crownLobe(1, v).positions.length, 80 * 9); }
});

test('deterministic per variant; variants differ', () => {
  assert.deepEqual(crownLobe(1, 1).positions, crownLobe(1, 1).positions);
  assert.notDeepEqual(crownLobe(1, 0).positions, crownLobe(1, 1).positions);
});

test('an irregular rounded mass: lobes and notches in the outline, a flatter underside, bounded', () => {
  for (const v of [0, 1, 2]) {
    const m = crownLobe(1, v), rs: number[] = [];
    for (let i = 0; i < m.positions.length; i += 3) rs.push(Math.hypot(m.positions[i], m.positions[i + 1], m.positions[i + 2]));
    const min = Math.min(...rs), max = Math.max(...rs);
    assert.ok(min >= CROWN_SHAPE.minR - 1e-6 && max <= CROWN_SHAPE.maxR + 1e-6, `bounded ${min} ${max}`);
    assert.ok(max - min > 0.25, `variant ${v}: radius spread ${(max - min).toFixed(2)} (a ball has 0)`);
    // The silhouette from the side (azimuth sweep at the equator) has bulges and notches.
    const ring = Array.from({ length: 72 }, (_, i) => crownRadius([Math.cos(i * Math.PI / 36), Math.sin(i * Math.PI / 36), 0.1], v));
    let turns = 0; for (let i = 0; i < 72; i++) { const a = ring[(i + 71) % 72], b = ring[i], c = ring[(i + 1) % 72]; if ((b > a && b > c) || (b < a && b < c)) turns++; }
    assert.ok(turns >= 4, `variant ${v}: ${turns} extrema around the outline`);
    assert.ok(crownRadius([0, 0, -1], v) < crownRadius([0, 0, 1], v), 'underside flatter than the top');
    for (let i = 0; i < m.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(m.normals[i], m.normals[i + 1], m.normals[i + 2]) - 1) < 1e-4);
  }
});
