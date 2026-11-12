import test from 'node:test';
import assert from 'node:assert/strict';
import {applyShopfrontPins, shopfrontPinProblems, type ShopfrontPin} from './reviewShopfront.ts';
import type {Decision} from './autoPlace.ts';

const shop = (pandId: string): Decision => ({kind: 'placed', pandId, typeId: 't', score: 1, notes: [],
  house: {pandId, type: {type: 't', ground: {shopfront: {colour: '#3a3a3a', fascia: true, entrance: 'centre', evidence: 'auto-place'}}}} as never});
const pin: ShopfrontPin = {pandId: '0363100012176172', colour: '#e3dccb', entrance: 'right', reason: 'cream shop, door right'};

test('Haarlemmerdijk 6: the pin paints the shop cream and moves the door; other pands untouched', () => {
  const ds = [shop('0363100012176172'), shop('0363100012176174')], before = JSON.stringify(ds[1]);
  assert.deepEqual(applyShopfrontPins(ds, [pin]), ['0363100012176172']);
  const sf = ((ds[0] as any).house.type.ground.shopfront);
  assert.equal(sf.colour, '#e3dccb'); assert.equal(sf.entrance, 'right'); assert.match(sf.evidence, /reviewer pin: cream shop/);
  assert.equal(JSON.stringify(ds[1]), before);
});

test('no pins: byte-identical; a pand without a shop ground is left alone', () => {
  const ds = [shop('0363100012176172')], before = JSON.stringify(ds);
  assert.deepEqual(applyShopfrontPins(ds, []), []);
  assert.equal(JSON.stringify(ds), before);
  const home: Decision = {kind: 'placed', pandId: pin.pandId, typeId: 't', score: 1, notes: [], house: {pandId: pin.pandId, type: {type: 't', ground: 'door-left'}} as never};
  assert.deepEqual(applyShopfrontPins([home], [pin]), []);
});

test('problems: pand id, #rrggbb, entrance, reason, one pin per pand', () => {
  assert.deepEqual(shopfrontPinProblems([pin]), []);
  assert.match(shopfrontPinProblems([{...pin, pandId: '176172'}])[0], /16-digit/);
  assert.match(shopfrontPinProblems([{...pin, colour: 'cream'}])[0], /#rrggbb/);
  assert.match(shopfrontPinProblems([{...pin, entrance: 'middle' as never}])[0], /entrance/);
  assert.match(shopfrontPinProblems([{...pin, reason: ''}])[0], /reason/);
  assert.match(shopfrontPinProblems([pin, pin])[0], /pinned twice/);
});
