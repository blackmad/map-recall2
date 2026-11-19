// Lane retail-pass-20261119: round 1 (`?shopPass=1`: full-size salon stations, seed keys that vary) and round 2
// (`?shopInteriors=1`: rooms behind the glass at real depth).
import test from 'node:test';
import assert from 'node:assert/strict';
import { plantFull, PROP_COST, stylingStation } from './props.js';
import { insideProps, outsideProps, SHOP_PROPS, SHOP_PROPS_PASS, shopPropsFor } from './layout.js';
import { intoRoom, roomTris, ROOM, INTERIOR_TEMPLATES } from './interiors.js';
import { retailFrontTris, retailWindowBays } from '../retailFront.js';

const g = globalThis as { __canalRecallShopPass?: boolean; __canalRecallShopInteriors?: boolean };
const withFlags = <T>(pass: boolean, fn: () => T): T => {
  g.__canalRecallShopPass = pass;
  try { return fn(); } finally { delete g.__canalRecallShopPass; }
};

test('retail pass: a styling station costs what PROP_COST states and is salon-sized: a 0.8 m mirror, a 0.6 m chair, lit lamp and glass', () => {
  const t = stylingStation('#1b1b1b');
  assert.equal(t.length, PROP_COST.stylingStation);
  const xs = (pred: (z: number, y: number) => boolean) => t.filter(tri => tri.p.every(p => pred(p[2], p[1]))).flatMap(tri => tri.p.map(p => p[0]));
  const mirror = xs((z, y) => y < -0.7 && z >= 0.8), chair = xs((z, y) => y > -0.35 && z > 0.4 && z < 0.6);
  assert.ok(Math.max(...mirror) - Math.min(...mirror) >= 0.75, 'mirror at least 0.75 m wide');
  assert.ok(Math.max(...chair) - Math.min(...chair) >= 0.58, 'chair seat at least 0.58 m wide');
  assert.ok(Math.max(...t.flatMap(tri => tri.p.map(p => p[2]))) <= 2.2, 'fits under a 2.4 m window head');
  assert.ok(t.filter(tri => tri.lit).length >= 4, 'the mirror glass and its lamp are lit');
});

test('retail pass: shopPass off keeps every template as it was; on, a salon draws styling stations', () => {
  withFlags(false, () => { for (const t of Object.keys(SHOP_PROPS)) assert.equal(shopPropsFor(t), SHOP_PROPS[t]); });
  withFlags(true, () => {
    assert.equal(shopPropsFor('hairdresser'), SHOP_PROPS_PASS.hairdresser);
    assert.equal(shopPropsFor('florist'), SHOP_PROPS.florist);
    const items = insideProps(shopPropsFor('hairdresser')!, 0.2, 3.6, 'pand-1', 0);
    assert.ok(items.filter(i => i.tris.length === PROP_COST.stylingStation).length >= 2, 'two or more stations on 3.4 m');
  });
});

test('retail pass: seed keys vary in the middle, so neighbouring props differ (plants, chairs, crates)', () => {
  // Florist plants behind one bay: the old `c${i}` keys gave every plant the same bloom; now several colours.
  // Flag off the old keys stand (groundFloor template-golden.json byte-identical); the new ones under shopPass.
  const hexes = new Set<string>();
  withFlags(true, () => { for (const bay of [0, 1, 2]) for (const { tris } of insideProps(SHOP_PROPS.florist, 0, 4, 'pand-7', bay)) hexes.add(tris[tris.length - 1].hex); });
  assert.ok(hexes.size >= 4, `florist plants: ${hexes.size} top colours`);
  const chairs = new Set<string>();
  withFlags(true, () => { for (const pand of ['a', 'b', 'c', 'd', 'e', 'f']) for (const { tris } of insideProps(shopPropsFor('hairdresser')!, 0, 4, `pand-${pand}`, 0)) if (tris.length === PROP_COST.stylingStation) chairs.add(tris[36].hex); });
  assert.ok(chairs.size >= 2, `salon chairs: ${chairs.size} colours over six salons`);
  const crates = withFlags(true, () => outsideProps(SHOP_PROPS.greengrocer, [[0.2, 4]], 'pand-3')).filter(t => t.p.every(p => p[2] > 0.9)).map(t => t.hex);
  assert.ok(new Set(crates).size >= 6, 'a crate row runs through the produce');
});

test('retail pass round 2: a room is a closed shallow box with lamps, its props inside it', () => {
  const room = roomTris('hairdresser', 0.2, 3.4, 0, 2.4, 's');
  const lamps = Math.max(1, Math.round(3.2 / ROOM.lampPitchM));
  assert.equal(room.length, 12 + 2 * lamps);
  for (const t of room) for (const [x, y, z] of t.p) assert.ok(x >= 0.2 - 1e-9 && x <= 3.4 + 1e-9 && y <= 1e-9 && y >= -ROOM.depthM - 1e-9 && z >= -1e-9 && z <= 2.4 + 1e-9);
  assert.ok(room.some(t => t.lit), 'lamps are lit');
  for (const t of INTERIOR_TEMPLATES) for (const { tris, depth } of insideProps(SHOP_PROPS_PASS[t] ?? SHOP_PROPS[t], 0.2, 3.4, 'p', 0)) {
    for (const [, y, z] of intoRoom(tris, depth, 1.0).flatMap(tri => tri.p)) assert.ok(y >= -ROOM.depthM + ROOM.backClearM - 1e-6 && y <= 0.35 && z >= 1.0 - 0.05, `${t}: prop inside the room (y ${y}, z ${z})`);
  }
});

test('retail pass round 2: rooms replace the relief only in the bays the mesher cut; budgets per 6 m front', () => {
  const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: 1 };
  const bays = retailWindowBays({ template: 'hairdresser', seed: 'x' }, 0.3, 6.3);
  assert.equal(bays.length, 2);
  withFlags(true, () => {
    const flat = retailFrontTris({ template: 'hairdresser', word: 'KAPSALON', seed: 'x' }, e, 0.3, 6.3, 0, 3.6);
    const rooms = retailFrontTris({ template: 'hairdresser', word: 'KAPSALON', seed: 'x', rooms: [0, 1] }, e, 0.3, 6.3, 0, 3.6);
    const deepest = (ts: typeof flat) => Math.min(...ts.flatMap(t => t.p.map(p => p[1])));
    assert.ok(deepest(flat) > -0.6, 'flag off: nothing deeper than the door recess');
    assert.ok(deepest(rooms) <= -ROOM.depthM + 1e-6, 'rooms: the back wall at the room depth');
    assert.ok(flat.length <= 420, `salon, shopPass: ${flat.length} tris`);
    assert.ok(rooms.length <= 480, `salon, rooms: ${rooms.length} tris`);
  });
});

test('retail pass round 3: the fuller plant crown costs what PROP_COST states and stands taller than the pot', () => {
  assert.ok(plantFull('#3d6b35').length <= PROP_COST.plantFull);
  assert.ok(plantFull('#3d6b35', '#a0522d', true, '#e85a8c').length <= PROP_COST.plantFullTall);
  const top = Math.max(...plantFull('#3d6b35').flatMap(t => t.p.map(p => p[2])));
  assert.ok(top > 0.45 && top < 0.7, `crown top ${top}`);
});

test('retail pass round 3: rooms on salons only under ?shopInteriors=1, on every interior type under =all', async () => {
  const { roomTemplate } = await import('./interiors.js');
  const gg = globalThis as { __canalRecallShopInteriorsAll?: boolean };
  gg.__canalRecallShopInteriorsAll = false;
  try {
    assert.ok(roomTemplate('hairdresser') && !roomTemplate('florist') && !roomTemplate('bike'));
    gg.__canalRecallShopInteriorsAll = true;
    assert.ok(roomTemplate('florist') && roomTemplate('bike') && roomTemplate('greengrocer') && !roomTemplate('bakery'));
  } finally { delete gg.__canalRecallShopInteriorsAll; }
});
