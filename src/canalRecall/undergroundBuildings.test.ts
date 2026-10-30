import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUndergroundOsm, isUndergroundPand, type UndergroundIndex } from './undergroundBuildings';

// Tags as mapped in OSM on 2026-10-30 (the user's Weesperstraat/Wibautstraat reports).
const weesperplein = { building: 'yes', layer: '-1', level: '-1', location: 'underground', railway: 'station', 'ref:bag': '0363100012186191' };
const vazDiasHall = { 'building:part': 'yes', layer: '-1', level: '-1', location: 'underground', public_transport: 'station' }; // w268999073
const amstelTowerGarage = { 'building:part': 'yes', 'building:levels': '30', layer: '-1', parking: 'underground', 'ref:bag': '0363100012246480' };

test('metro stations, car parks and tunnel shells are underground', () => {
  assert.ok(isUndergroundOsm(weesperplein));
  assert.ok(isUndergroundOsm(vazDiasHall));
  assert.ok(isUndergroundOsm(amstelTowerGarage));
  assert.ok(isUndergroundOsm({ building: 'yes', layer: '-2', level: '-2;-1' }));
});

test('a bare negative layer, or an explicit surface location, is not', () => {
  assert.ok(!isUndergroundOsm({ building: 'apartments', 'building:levels': '1', layer: '-1', name: 'De Spreeuwen' }));
  assert.ok(!isUndergroundOsm({ building: 'yes', layer: '-1', name: 'Oku Office' }));
  assert.ok(!isUndergroundOsm({ building: 'yes', layer: '-1', location: 'surface', parking: 'underground', name: 'P6 - Uitgaansdriehoek' }));
  assert.ok(!isUndergroundOsm({ building: 'yes' }));
});

const index: UndergroundIndex = {
  osm: new Set(['w278085626', 'w268998785', 'w1302928107']),
  refBag: new Set(['0363100012102589', '0363100012246480', '0363100012241802']),
};

test('a low pand tied only to underground ways is dropped (Wibautstraat hall)', () => {
  assert.ok(isUndergroundPand({ id: 'NL.IMBAG.Pand.0363100012102589', heightM: 3.22, matchedOsm: ['w278085626'] }, index));
  assert.ok(isUndergroundPand({ id: 'NL.IMBAG.Pand.0363100012102589', heightM: 3.22, matchedOsm: [] }, index));
});

test('the tower over a garage and houses over a shared garage keep their pand', () => {
  assert.ok(!isUndergroundPand({ id: 'NL.IMBAG.Pand.0363100012246480', heightM: 90, matchedOsm: ['w1302928107'] }, index));
  assert.ok(!isUndergroundPand({ id: 'NL.IMBAG.Pand.0363100012241802', heightM: 5.46, matchedOsm: ['w275074231', 'w278085626'] }, index));
  assert.ok(!isUndergroundPand({ id: 'NL.IMBAG.Pand.0363100000000001', heightM: 3, matchedOsm: [] }, index));
});
