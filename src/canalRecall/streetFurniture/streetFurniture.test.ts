// Street furniture (lane #170): models, placement and extract helpers.
//   node --import tsx --test src/canalRecall/streetFurniture/streetFurniture.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { DIMENSIONS, FURNITURE_MODELS, FURNITURE_MODEL_IDS, FURNITURE_TRI_CAP, isSlot, lampHeight, linearOf, SLOT } from './models.ts';
import { HOOPS_PER_RACK, containerYaw, instancesOf } from './placement.ts';
import { BGT_KIND, containerSubtype, lampStyle, polygonTest, tileKeyOf } from './extract.ts';
import { StreetIndex } from './streetIndex.ts';
import type { FurnitureRecord } from './extract.ts';

/** Triangle counts per model: a change here is a deliberate geometry change (update with the reason). */
// container 114 -> 150 (2026-11-07: full width, corner strips, door, pictogram, crosses); 52 -> 114 (#212): the hexagonal hood, the recess between cheeks with the rest drum (glass: round hole 104,
// paper: slot and flap 102), lip, top sticker, two-disc mushroom.
const TRIANGLES: Record<string, number> = { container: 150, 'container-glas': 140, 'container-papier': 133, 'lamp-lantern': 74, 'lamp-pole': 92, bin: 56, 'bike-rack': 40, abri: 86, 'ad-column': 90 };

test('every model stays within the per-kind triangle cap and its recorded count', () => {
  for (const id of FURNITURE_MODEL_IDS) {
    const m = FURNITURE_MODELS[id]();
    assert.ok(m.triangles <= FURNITURE_TRI_CAP, `${id}: ${m.triangles}`);
    assert.equal(m.triangles, TRIANGLES[id], `${id} triangles`);
    assert.equal(m.positions.length, m.triangles * 9);
    assert.equal(m.colours.length, m.positions.length);
    assert.ok([...m.positions].every(Number.isFinite), id);
  }
});

test('measured heights: container column 1.19 m plus the 0.35 m lift mushroom on its plate, lantern 4.09 m, hooked pole 7.6 m, abri 2.47 m, column ~4.7 m', () => {
  const near = (a: number, b: number, tol = 0.02) => Math.abs(a - b) <= tol;
  for (const id of ['container', 'container-glas', 'container-papier'] as const) assert.ok(near(FURNITURE_MODELS[id]().heightM, DIMENSIONS.container.plateH + DIMENSIONS.container.colH + DIMENSIONS.container.handleH), id);
  assert.ok(near(FURNITURE_MODELS['lamp-lantern']().heightM, 4.09));
  assert.ok(near(FURNITURE_MODELS['lamp-pole']().heightM, 7.6));
  assert.ok(near(FURNITURE_MODELS.abri().heightM, 2.47));
  assert.ok(near(FURNITURE_MODELS['ad-column']().heightM, 4.7, 0.1));
});

test('slot faces (instance colour) exist exactly where the ride paints one: the container fraction band and lift shaft, the poster drum, the abri panel', () => {
  const slots = (id: keyof typeof FURNITURE_MODELS) => { const c = FURNITURE_MODELS[id]().colours; let n = 0; for (let i = 0; i < c.length; i += 3) if (isSlot(c[i], c[i + 1], c[i + 2])) n++; return n / 3; };
  for (const id of ['container', 'container-glas', 'container-papier'] as const) assert.equal(slots(id), 14, `${id}: fraction band (2) and the lift shaft (12)`);
  assert.equal(slots('ad-column'), 20);
  assert.equal(slots('abri'), 2);
  for (const id of ['lamp-lantern', 'lamp-pole', 'bin', 'bike-rack'] as const) assert.equal(slots(id), 0, id);
  assert.deepEqual(linearOf(SLOT), [1, 0, 1]);
});

const rec = (o: Partial<FurnitureRecord>): FurnitureRecord => ({ id: 'x', kind: 'container', subtype: 'rest', lng: 4.9, lat: 52.37, ...o });

test('containers lie along their row and turn the insert away from the street', () => {
  // Street to the north (facing 0), row east-west (heading 90): the insert (+y) faces south, yaw = -180 deg.
  const yaw = containerYaw(rec({ heading: 90, facing: 0 }));
  assert.ok(Math.abs(Math.cos(yaw) - -1) < 1e-9, `yaw ${yaw}`);
  // No row: the front is the bearing away from the street.
  assert.ok(Math.abs(containerYaw(rec({ facing: 90 })) - -270 * Math.PI / 180) < 1e-9);
  const [i] = instancesOf(rec({ subtype: 'glas' }));
  assert.equal(i.model, 'container-glas'); assert.equal(i.slotHex, '#d6b44e');
  assert.equal(instancesOf(rec({ subtype: 'papier' }))[0].model, 'container-papier');
  for (const subtype of ['rest', 'gft', 'textiel', 'unknown']) assert.equal(instancesOf(rec({ subtype }))[0].model, 'container', subtype);
});

test('lamps: lanterns keep their measured height; poles scale by road class', () => {
  assert.equal(instancesOf(rec({ kind: 'lamp', subtype: 'lantern', road: 'primary' }))[0].scale, 1);
  assert.equal(instancesOf(rec({ kind: 'lamp', subtype: 'pole', road: 'residential' }))[0].scale, 1);
  assert.ok(instancesOf(rec({ kind: 'lamp', subtype: 'pole', road: 'primary' }))[0].scale > 1.3);
  assert.ok(lampHeight('cycleway') < lampHeight('residential'));
  assert.equal(lampStyle(true, 'residential'), 'lantern');
  assert.equal(lampStyle(true, 'primary'), 'pole');
  assert.equal(lampStyle(false, 'residential'), 'pole');
});

test('a rack point draws a row of hoops along the kerb, 0.9 m apart', () => {
  const hoops = instancesOf(rec({ kind: 'bike-rack', subtype: 'fietsenrek', facing: 0 }));
  assert.equal(hoops.length, HOOPS_PER_RACK);
  // facing north: the row runs east-west, so latitude is constant and longitudes step 0.9 m.
  assert.ok(hoops.every(h => Math.abs(h.lat - 52.37) < 1e-9));
  const dx = (hoops[1].lng - hoops[0].lng) * 111320 * Math.cos(52.37 * Math.PI / 180);
  assert.ok(Math.abs(Math.abs(dx) - 0.9) < 1e-6, `${dx}`);
});

test('extract helpers: tiles, subtypes, BGT kinds, polygons', () => {
  assert.equal(tileKeyOf(4.884, 52.374), '15/16828/10768');
  assert.equal(containerSubtype('Glas'), 'glas');
  assert.equal(containerSubtype(null), 'unknown');
  assert.equal(BGT_KIND.straatmeubilair.kunstobject, undefined, 'sculptures stay bespoke landmarks');
  assert.equal(BGT_KIND.bak['afval apart plaats'], undefined, 'container sites duplicate the register');
  const inside = polygonTest([[[[52, 4], [52, 5], [53, 5], [53, 4]]]]);
  assert.ok(inside(4.5, 52.5)); assert.ok(!inside(5.5, 52.5));
});

test('street index: nearest centreline, its axis and the bearing toward it', () => {
  const idx = new StreetIndex([{ highway: 'residential', path: [[52.37, 4.899], [52.37, 4.901]] }]);
  const s = idx.nearest(4.9, 52.3701, 30)!;
  assert.ok(s && Math.abs(s.distanceM - 11.05) < 0.1, `${s?.distanceM}`);
  assert.ok(Math.abs(s.axisDeg - 90) < 1e-6);
  assert.ok(Math.abs(s.towardDeg - 180) < 1e-6);
  assert.equal(idx.nearest(4.9, 52.371, 30), null);
});
