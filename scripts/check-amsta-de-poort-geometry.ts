/** Survey-calibrated roof hierarchy and a real open courtyard, rather than one maximum-height extrusion. */
import assert from 'node:assert/strict';
import * as T from 'three';
import survey from './landmarks/amsta-de-poort-footprints.json';
import { buildAmstaDePoort } from './landmarks/amsta-de-poort-builder.ts';
const triangles: number[][][] = [];
const colours: string[] = [];
const add = (geometry: T.BufferGeometry, _colour: string, x = 0, y = 0, z = 0, a = 0) => {
  geometry.rotateY(a); geometry.translate(x, y, z);
  const g = geometry.index ? geometry.toNonIndexed() : geometry, p = g.getAttribute('position');
  for (let i = 0; i < p.count; i += 3) { triangles.push([0, 1, 2].map(j => [p.getX(i + j), p.getY(i + j), p.getZ(i + j)])); colours.push(_colour); }
};
const box = (x: number, y: number, z: number, w: number, h: number, d: number, c: string, a = 0) => add(new T.BoxGeometry(w, h, d), c, x, y + h / 2, z, a);
buildAmstaDePoort('amsta-de-poort', 1, 1, { add, box, sign() {} } as any);
const above = (x: number, z: number) => triangles.filter(t => {
  if (Math.max(...t.map(p => p[1])) - Math.min(...t.map(p => p[1])) > .001) return false;
  const cross = (a: number[], b: number[]) => (b[0] - a[0]) * (z - a[2]) - (b[2] - a[2]) * (x - a[0]);
  const d = t.map((p, i) => cross(p, t[(i + 1) % 3]));
  const area = (t[1][0] - t[0][0]) * (t[2][2] - t[0][2]) - (t[1][2] - t[0][2]) * (t[2][0] - t[0][0]);
  return Math.abs(area) > 1e-8 && (d.every(v => v >= -1e-8) || d.every(v => v <= 1e-8));
}).map(t => t[0][1]);
assert.equal(above(0, -10).length, 0, 'actual open court west of the low rear wing has no roof or ground slab');
for (const [x, z, expected] of [[0, 21.5, 23.685], [0, 18, 27.785], [20, -18, 14.135]]) {
  assert.ok(Math.abs(Math.max(...above(x, z)) - expected) < .06, `roof hierarchy at ${x},${z} matches the surveyed ${expected}m level`);
}
const maximum = Math.max(...triangles.flatMap(t => t.map(p => p[1])));
assert.ok(maximum > 31.65 && maximum < 31.9, 'small service structure owns the maximum height');
for (let i = 0; i < triangles.length; i++) {
  const t = triangles[i], up = (t[1][2] - t[0][2]) * (t[2][0] - t[0][0]) - (t[1][0] - t[0][0]) * (t[2][2] - t[0][2]);
  if (colours[i] !== 'frame' || up <= 1e-8 || Math.max(...t.map(p => p[1])) - Math.min(...t.map(p => p[1])) > .001) continue;
  assert.ok(!survey.roofZones.some(zone => Math.abs(zone.topMetres - t[0][1]) < .015), 'explicit slate roof has no duplicate upward body cap');
}
assert.ok(triangles.length < 38000);
console.log('De Poort geometry passed: open courtyard, distinct14.1/23.65/27.75m roofs, small31.7m service maximum and original-mesh budget.');
