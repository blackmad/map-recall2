import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { meshBuildingFor, ORIGIN, type Feature } from './threeBuildingFeatures.js';
import { ROOF_OUTLINE_HANG_M, roofTrianglesForOutline, roofTrianglesForOutlineUncut } from './roofMesh.js';
import { footprintHangM } from './roofOverhang.js';

// Lane S3 (#315, user 2026-11-09 at Kalverstraat/Spui: "still seeing some roofs overhang"): detail-tier roofs stand
// no more than ROOF_OUTLINE_HANG_M past their pand footprint. Fixtures are the real styled pands the measurement named
// (scripts/roofs/measure-roof-overhang.ts), each with the hang it had before.

const kx = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180);
const fixtures: Array<Feature & { note: string }> = JSON.parse(readFileSync(new URL('../../scripts/fixtures/roof-overhang-pands.json', import.meta.url), 'utf8')).features;
const roofOf = (f: Feature) => {
  const b = meshBuildingFor(f, 'photo');
  assert.ok(b?.roof, `${f.properties.id} keeps a planned roof`);
  const outer = b.polygons[0][0];
  return { outer, cut: roofTrianglesForOutline(outer, ORIGIN, b.roof.plan, b.heightM, b.roof.dims, kx), uncut: roofTrianglesForOutlineUncut(outer, ORIGIN, b.roof.plan, b.heightM, b.roof.dims, kx), plan: b.roof.plan };
};

test('the named pands stand on their walls (each hung 1.9–6.8 m over the street before)', () => {
  assert.equal(fixtures.length, 7);
  for (const f of fixtures) {
    const { outer, cut, uncut } = roofOf(f);
    assert.ok(footprintHangM(outer, uncut, ORIGIN, kx) > 1, `${f.note}: the uncut plan still reproduces the hang`);
    const hang = footprintHangM(outer, cut, ORIGIN, kx);
    assert.ok(hang <= ROOF_OUTLINE_HANG_M + 0.1, `${f.note}: ${hang.toFixed(2)} m past the walls`);
    assert.ok(cut.filter(t => t.part === 'slope').length > 0, `${f.note}: still roofed`);
  }
});

test('a turret drum that cannot stand over its corner is left off', () => {
  const wedge = fixtures.find(f => String(f.properties.id).endsWith('12169704'))!;
  assert.equal(roofOf(wedge).plan.turret, undefined);
});

test('a roof within the eave allowance is byte-identical to its plan drawn uncut', () => {
  const ll = (x: number, y: number): [number, number] => [ORIGIN.lng + x / kx, ORIGIN.lat + y / 110540];
  for (const [i, style] of (['canal', 'c19', 'school'] as const).entries()) {
    const f: Feature = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[ll(0, 0), ll(8 + i, 0), ll(8 + i, 14), ll(0, 14), ll(0, 0)]] },
      properties: { id: `bag:rect${i}`, height: 15, minHeight: 0, facade: 'canal-priorBrickRed', facadeStyle: style, constructionYear: 1700 + i * 100, roofPlanned: true } };
    const b = meshBuildingFor(f, 'photo');
    if (!b?.roof || b.roof.plan.clipToOutline) continue;
    const { outer, cut, uncut } = roofOf(f);
    assert.ok(footprintHangM(outer, uncut, ORIGIN, kx) <= ROOF_OUTLINE_HANG_M);
    assert.deepEqual(cut, uncut);
  }
});
