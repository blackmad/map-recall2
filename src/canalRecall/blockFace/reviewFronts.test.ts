import assert from 'node:assert/strict';
import test from 'node:test';
import type {Decision} from './autoPlace.ts';
import {applyFrontPins, frontPinProblems, type FrontPin} from './reviewFronts.ts';

const placed = (pandId: string, ground?: unknown): Decision => ({kind: 'placed', pandId, typeId: 't', score: 1, notes: [], house: {pandId, slug: 's', address: 'a', type: {type: 't', ...(ground ? {ground} : {})}}} as unknown as Decision);

test('front pins: ground merges over an auto shopfront, overrides add, other types and pands stay', () => {
  const pins: FrontPin[] = [
    {pandId: '0363100012000001', type: 't', ground: {shopfront: {colour: '#e6e1d2', residentialDoor: {colour: '#e6e1d2'}}}, reason: 'r'},
    {pandId: '0363100012000002', type: 't', ground: {doorBay: 0, doorArch: {span: 1.1, apex: 2.8}}, overrides: {axisHeads: null}, reason: 'r'},
    {pandId: '0363100012000003', type: 'other', ground: {doorBay: 2}, reason: 'r'}];
  assert.deepEqual(frontPinProblems(pins, [{id: 't'}, {id: 'other'}]), []);
  const ds = [placed('0363100012000001', {shopfront: {colour: '#3a3a3a', fascia: true, name: 'X', residentialDoor: {side: 'left', colour: '#2a2a2a'}}}), placed('0363100012000002'), placed('0363100012000003'), placed('0363100012000004')];
  assert.equal(applyFrontPins(ds, pins).length, 2);
  const g1 = (ds[0] as any).house.type.ground.shopfront;
  assert.equal(g1.colour, '#e6e1d2'); assert.equal(g1.name, 'X'); assert.equal(g1.fascia, true); assert.deepEqual(g1.residentialDoor, {side: 'left', colour: '#e6e1d2'}, 'the measured door side stays, the colour changes');
  assert.deepEqual((ds[1] as any).house.type.ground, {doorBay: 0, doorArch: {span: 1.1, apex: 2.8}});
  assert.equal((ds[1] as any).house.type.overrides.axisHeads, null);
  assert.equal((ds[2] as any).house.type.ground, undefined);
  assert.equal((ds[3] as any).house.type.ground, undefined);
});

test('front pins: problems are reported, never applied silently', () => {
  const bad = frontPinProblems([{pandId: 'x', type: 'nope', reason: '', ground: {gable: 1}, overrides: {doorBay: 1}} as unknown as FrontPin], [{id: 't'}]);
  assert.ok(bad.length >= 5, bad.join('; '));
});
