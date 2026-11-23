import assert from 'node:assert/strict';
import test from 'node:test';
import {circumradius, turretFacets, turretStack} from './cornerTurret';

test('an octagon set half into the wall exposes the three front facets (the canted oriel)', () => {
  const f = turretFacets({sides: 8, apothem: 1.05, centre: [3, -0.5]});
  assert.equal(f.length, 8);
  const exposed = f.filter(x => x.exposed).map(x => Math.round(x.angle * 180 / Math.PI)).sort((a, b) => a - b);
  assert.deepEqual(exposed, [-45, 0, 45]);
  // facet 0 faces straight out, its centre on the axis
  assert.ok(Math.abs(f[0].centre[0] - 3) < 1e-9 && Math.abs(f[0].centre[1] - 0.55) < 1e-9);
  // edge length of a regular octagon: 2 a tan(pi/8)
  assert.ok(Math.abs(f[0].width - 2 * 1.05 * Math.tan(Math.PI / 8)) < 1e-9);
});

test('a free-standing turret exposes every facet; normals are unit and symmetric about the front', () => {
  const f = turretFacets({sides: 6, apothem: 1, centre: [0, 2]});
  assert.ok(f.every(x => x.exposed));
  for (const x of f) assert.ok(Math.abs(Math.hypot(...x.normal) - 1) < 1e-12);
  const ang = f.map(x => x.angle);
  for (const a of ang) assert.ok(ang.some(b => Math.abs(a + b) < 1e-9 || Math.abs(Math.abs(a) - Math.PI) < 1e-9));
});

test('facing turns the polygon; minOut decides a facet flush with the wall', () => {
  const f = turretFacets({sides: 4, apothem: 1, centre: [0, 0], facing: Math.PI / 4});
  assert.equal(f.filter(x => x.exposed).length, 2);
  const g = turretFacets({sides: 4, apothem: 1, centre: [0, 0], minOut: 0.0});
  // facets at +-90 deg lie in the wall plane: exposed only with minOut 0
  assert.equal(g.filter(x => x.exposed).length, 3);
  assert.throws(() => turretFacets({sides: 2, apothem: 1, centre: [0, 0]}));
  assert.throws(() => turretFacets({sides: 8, apothem: 0, centre: [0, 0]}));
});

test('the stage stack must stand on itself and reports the finial tip', () => {
  const s = turretStack({corbel: [3.6, 4.5], body: [4.5, 12.6], drum: [12.6, 14.3], cone: {y: 14.3, rise: 2.1}, finial: 0.5});
  assert.deepEqual(s.cone, [14.3, 14.3 + 2.1]);
  assert.ok(Math.abs(s.top - 16.9) < 1e-9);
  assert.equal(turretStack({corbel: [1, 2], body: [2, 5], cone: {y: 5, rise: 1}}).drum, null);
  assert.throws(() => turretStack({corbel: [1, 2], body: [2.5, 5], cone: {y: 5, rise: 1}}));
  assert.throws(() => turretStack({corbel: [1, 2], body: [2, 5], drum: [4, 6], cone: {y: 6, rise: 1}}));
  assert.throws(() => turretStack({corbel: [1, 2], body: [2, 5], cone: {y: 4, rise: 1}}));
  assert.ok(Math.abs(circumradius(1, 8) - 1 / Math.cos(Math.PI / 8)) < 1e-12);
});
