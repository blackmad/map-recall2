import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { joinDesignUnits, parseOrdekaart, unitFaces, type NamedStreet } from './join.ts';
import { REGRESSION_ROWS } from './regressionRows.ts';
import type { OrdekaartObject, UnitPand } from './types.ts';
import type { FrontEdge } from '../buurtGenerator/rows.ts';

const fixture = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures/regression-rows.json'), 'utf8')) as { pands: UnitPand[]; objects: OrdekaartObject[]; streets: NamedStreet[] };
const res = joinDesignUnits({ pands: fixture.pands, objects: fixture.objects, streets: fixture.streets });
const unitById = new Map(res.units.map(u => [u.id, u]));

for (const row of REGRESSION_ROWS) {
  test(`regression row ${row.name}: ${row.note}`, () => {
    row.units.forEach((expected, k) => {
      const ids = new Set(expected.map(p => res.unitOf.get(p)));
      assert.equal(ids.size, 1, `${row.name} unit ${k + 1}: members land in ${[...ids].join(', ')}`);
      const unit = unitById.get([...ids][0]!)!;
      assert.equal(unit.object?.key, row.objects[k], `${row.name} unit ${k + 1}: object`);
      assert.deepEqual([...unit.members].sort(), [...expected, ...row.found[k]].sort(), `${row.name} unit ${k + 1}: exactly the expected members`);
      assert.equal(unit.seed, unit.id, 'a multi-pand unit seeds on its unit id');
      const fronted = unit.faces.flatMap(f => f.slices.map(s => s.pandId));
      assert.ok(fronted.length >= expected.length - 1, `${row.name} unit ${k + 1}: members ordered along a front (${fronted.length}/${expected.length})`);
    });
    // Neighbouring units of one row stay apart.
    const all = new Set(row.units.map(u => res.unitOf.get(u[0])));
    assert.equal(all.size, row.units.length);
  });
}

test('a single-pand unit seeds on its pand id (byte-identical to today)', () => {
  const singles = res.units.filter(u => u.members.length === 1);
  assert.ok(singles.length > 0);
  for (const u of singles) { assert.equal(u.seed, u.members[0]); assert.equal(u.id, u.members[0]); }
});

test('deterministic: input order does not change the units', () => {
  const again = joinDesignUnits({ pands: [...fixture.pands].reverse(), objects: [...fixture.objects].reverse(), streets: [...fixture.streets].reverse() });
  assert.deepEqual(again.units.map(u => [u.id, u.members.join(), u.familyKey]), res.units.map(u => [u.id, u.members.join(), u.familyKey]));
});

test('parseOrdekaart reads both property casings and drops blank years', () => {
  const objs = parseOrdekaart('aup', { features: [
    { properties: { OBJECTNUMMER: 7, ORDE: '2', BOUWJAAR: '1968', ARCHITECT: 'X' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } },
    { properties: { Objectnummer: 8, Orde: 'Basis', Bouwjaar: 0, Architectnr: 0, Architect: '' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } },
  ] });
  assert.deepEqual(objs.map(o => [o.key, o.orde, o.year, o.architect, o.architectNr]), [['aup:7', '2', 1968, 'X', null], ['aup:8', 'Basis', null, null, null]]);
});

test('unitFaces orders slices left to right along the summed front direction', () => {
  const e = (ax: number, bx: number): FrontEdge => ({ street: 'S', a: { x: ax, y: 0 }, b: { x: bx, y: 0 }, aLngLat: [0, 0], bLngLat: [0, 0], lengthM: bx - ax, n: { x: 0, y: -1 }, streetM: 5, lineA: [0, 0], lineB: [0, 0], erkers: [] });
  const { faces, unfronted } = unitFaces(['b', 'a', 'c'], new Map([['a', e(10, 16)], ['b', e(16, 22)]]));
  assert.deepEqual(unfronted, ['c']);
  assert.deepEqual(faces[0].slices, [{ pandId: 'a', fromM: 0, toM: 6 }, { pandId: 'b', fromM: 6, toM: 12 }]);
  assert.equal(faces[0].lengthM, 12);
});
