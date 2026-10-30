import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPassageRoad, multiPolygonAreaM2, PASSAGE_CLEARANCE_M, passageClearanceM, passagePieces, passageWidthM, roadStrip } from './buildingPassages';

// A 40 x 40 m block with a street through its middle, west to east (Jan van Zutphenstraat shape).
const d = 40 / 111_320, kx = Math.cos((52.35 * Math.PI) / 180);
const block: [number, number][][][] = [[[[4.8, 52.35], [4.8 + d / kx, 52.35], [4.8 + d / kx, 52.35 + d], [4.8, 52.35 + d], [4.8, 52.35]]]];
const street: [number, number][] = [[4.8 - d / kx, 52.35 + d / 2], [4.8 + 2 * d / kx, 52.35 + d / 2]];

test('passage tags: a building passage or a covered way, not a tunnel', () => {
  assert.ok(isPassageRoad({ highway: 'residential', tunnel: 'building_passage' }));
  assert.ok(isPassageRoad({ highway: 'service', covered: 'yes' }));
  assert.ok(!isPassageRoad({ highway: 'trunk', tunnel: 'yes', layer: '-1' }), 'IJ-tunnel: the ground layer cuts it');
  assert.equal(passageWidthM({ highway: 'service' }), 3.5);
  assert.equal(passageWidthM({ highway: 'residential', width: '8' }), 8);
  assert.equal(passageClearanceM({ highway: 'residential' }), PASSAGE_CLEARANCE_M.car);
  assert.equal(passageClearanceM({ highway: 'cycleway' }), PASSAGE_CLEARANCE_M.other);
});

test('a street through a tower: two ground halves and a deck over the street', () => {
  const strip = roadStrip(street, 6);
  const pieces = passagePieces(block, 37, [{ strip, clearanceM: 4.5 }]);
  const ground = pieces.filter(p => !p.deck), deck = pieces.filter(p => p.deck);
  assert.equal(ground.length, 2);
  assert.equal(deck.length, 1);
  assert.equal(deck[0].minHeight, 4.5);
  const area = (ps: typeof pieces) => ps.reduce((a, p) => a + multiPolygonAreaM2([p.polygon]), 0);
  assert.ok(Math.abs(area(deck) - 240) < 5, `deck ${area(deck)} m2`);
  assert.ok(Math.abs(area(ground) + area(deck) - 1600) < 5, 'the parts add up to the outline');
});

test('a building too low to bridge the strip leaves it open', () => {
  const pieces = passagePieces(block, 5, [{ strip: roadStrip(street, 6), clearanceM: 4.5 }]);
  assert.deepEqual(pieces.map(p => p.deck), [false, false]);
});

test('no strip, no change', () => {
  assert.deepEqual(passagePieces(block, 12, []), [{ polygon: block[0], minHeight: 0, deck: false }]);
});
