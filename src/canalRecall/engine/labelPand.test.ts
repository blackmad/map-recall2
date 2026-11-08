import { test } from 'node:test';
import assert from 'node:assert/strict';
import { factsIdOf, footprintDistanceM, pandUnderLabel, withLabelPand } from './labelPand';

// The gurdwara label (#258, Schakelstraat 21): its node sits inside its hall.
const P: [number, number] = [4.849011, 52.390768];
const square = (lng: number, lat: number, d = 0.0002) => ({ type: 'Polygon', coordinates: [[[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]]] });
const hall = { id: 'NL.IMBAG.Pand.0363100012345678', height: 9, footprint: square(P[0], P[1]), featureTarget: { source: 'osm-building-appearance', id: 'NL.IMBAG.Pand.0363100012345678' } };
const inFront = { id: 'NL.IMBAG.Pand.0363100099999999', height: 14, footprint: square(P[0] + 0.001, P[1]) };

test('a label at P resolves to the pand whose footprint holds P, not the building picked in front of it', () => {
  assert.equal(footprintDistanceM(hall.footprint, P), 0);
  assert(footprintDistanceM(inFront.footprint, P) > 50);
  const pand = pandUnderLabel(P, [inFront, null, hall]);
  assert.equal(pand?.id, hall.id);
  assert.equal(pand?.height, 9);
  assert.deepEqual(pand?.featureTarget, hall.featureTarget);
});

test('a node a few metres off its wall still finds the wall; a far pick, an id-less pick or no pick finds none', () => {
  const offWall: [number, number] = [P[0], P[1] + 0.0002 + 3 / 111320];
  assert.equal(pandUnderLabel(offWall, [hall])?.id, hall.id);
  assert.equal(pandUnderLabel(offWall, [inFront]), null);
  assert.equal(pandUnderLabel(P, [{ ...hall, id: undefined }]), null);
  assert.equal(pandUnderLabel(P, [{ ...hall, footprint: null }]), null);
  assert.equal(pandUnderLabel(P, []), null);
});

test('a courtyard hole is not the building', () => {
  const ring = square(P[0], P[1], 0.001).coordinates[0], hole = square(P[0], P[1], 0.0003).coordinates[0];
  const block = { id: 'block', footprint: { type: 'Polygon', coordinates: [ring, hole] } };
  assert(footprintDistanceM(block.footprint, P) > 15);
  assert.equal(pandUnderLabel(P, [block]), null);
});

test('the label hit keeps its own name and point, and its facts id becomes the pand', () => {
  const label = { id: 'own:gurdwara', landmarkId: 'own:gurdwara', name: 'Shri Guru Nanak Gurdwara Sahib', lngLat: P, poi: true as const, featureTarget: null };
  const hit = withLabelPand(label, [hall]);
  assert.equal(hit.name, label.name);
  assert.deepEqual(hit.lngLat, P);
  assert.equal(factsIdOf(hit), hall.id);
  assert.equal(withLabelPand(label, [inFront]), label, 'unchanged when no pick is the label\'s building');
  assert.equal(factsIdOf(label), 'own:gurdwara');
  assert.equal(factsIdOf({ id: 'P1', pand: { id: 'P2' } }), 'P1', 'a building tap is keyed on itself');
});
