import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centrelineInsideM, isUndergroundOsm, isUndergroundPand, isVoidOverRoad, type UndergroundIndex } from './undergroundBuildings';

// Tags as mapped in OSM on 2026-10-30 (the user's Weesperstraat/Wibautstraat reports).
const weesperplein = { building: 'yes', layer: '-1', level: '-1', location: 'underground', railway: 'station', 'ref:bag': '0363100012186191' };
const vazDiasHall = { 'building:part': 'yes', layer: '-1', level: '-1', location: 'underground', public_transport: 'station' }; // w268999073
const amstelTowerGarage = { 'building:part': 'yes', 'building:levels': '30', layer: '-1', parking: 'underground', 'ref:bag': '0363100012246480' };

test('metro stations, car parks and tunnel shells are underground', () => {
  assert.ok(isUndergroundOsm(weesperplein));
  assert.ok(isUndergroundOsm(vazDiasHall));
  assert.ok(isUndergroundOsm(amstelTowerGarage));
  assert.ok(isUndergroundOsm({ building: 'yes', layer: '-2', level: '-2;-1' }));
  assert.ok(isUndergroundOsm({ amenity: 'parking', building: 'yes', layer: '-1', parking: 'multi-storey', name: 'Albert Cuypgarage' }));
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

test('a pand across a road with roofs over little of it is a void; a tower or building site is not', () => {
  assert.ok(isVoidOverRoad({ roofCover: 0.124, roadInsideM: 521, year: 2018 })); // Albert Cuypgarage
  assert.ok(!isVoidOverRoad({ roofCover: 0.75, roadInsideM: 60, year: 2013 }));
  assert.ok(!isVoidOverRoad({ roofCover: 0.02, roadInsideM: 60, year: 2024 }));
  assert.ok(!isVoidOverRoad({ roofCover: 0.05, roadInsideM: 5, year: 1981 }));
  assert.ok(!isVoidOverRoad({ roofCover: null, roadInsideM: 500, year: 1981 }));
});

test('centreline metres inside a footprint', () => {
  const square = [[[4.9, 52.36], [4.901, 52.36], [4.901, 52.3606], [4.9, 52.3606], [4.9, 52.36]]] as const;
  const across = centrelineInsideM([square], [[[4.899, 52.3603], [4.902, 52.3603]]]);
  assert.ok(Math.abs(across - 68) < 2, `${across}`);
  assert.equal(centrelineInsideM([square], [[[4.899, 52.362], [4.902, 52.362]]]), 0);
  // A road 2 m inside the south edge (along the wall) counts only without an inset.
  const along: [[number, number], [number, number]] = [[4.899, 52.360018], [4.902, 52.360018]];
  assert.ok(centrelineInsideM([square], [along]) > 60);
  assert.equal(centrelineInsideM([square], [along], 3), 0);
  assert.ok(Math.abs(centrelineInsideM([square], [[[4.899, 52.3603], [4.902, 52.3603]]], 3) - 62) < 2);
});
