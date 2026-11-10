/**
 * Per-pand fit (pandFit.ts, canal-belt pilot 2026-11-10): the gable choice, the bays, the holds, and that a drafted type is a
 * valid house type.
 *   node --import tsx --test src/canalRecall/blockFace/pandFit.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {baysFor, draftPandType, gableFor, type PandFitInput} from './pandFit.ts';
import {typeProblems} from './houseType.ts';

const input = (o: Partial<PandFitInput> = {}): PandFitInput => ({
  pandId: '0363100012181580', address: 'Foeliedwarsstraat 62', face: 'foeliedwars-40-88', stripDate: '2023-01-13', widthM: 5.6, eavesM: 10.97, skylineEavesM: 10.7,
  crown: null, storey: {floorM: [3.15, 6.85, 10.55], sillM: [4, 7.7], headM: [5.9, 9.6], windowShare: [0.5, 0.5], headShare: [0.8, 0.8]},
  windowCols: 3, windowWidthM: 1.2, palette: {wall: '#7a4a3a', frame: '#ece9e0', stucco: false}, doorSide: 'left', groundAccent: 0.1, trading: false, registerGable: null, ...o,
});

test('gableFor: the register wins; a tall narrow skyline crown is a bell; else a cornice', () => {
  assert.equal(gableFor('neck', null, 6).gable, 'neck');
  assert.equal(gableFor('plain', {widthM: 2, riseM: 3}, 6).gable, 'cornice');
  assert.equal(gableFor(null, {widthM: 2.4, riseM: 2.2}, 6).gable, 'bell');
  assert.equal(gableFor(null, {widthM: 5.8, riseM: 2.2}, 6).gable, 'cornice');
  assert.equal(gableFor(null, {widthM: 2, riseM: 1}, 6).gable, 'cornice');
});

test('baysFor: photo columns when plausible, else by width', () => {
  assert.deepEqual(baysFor(3, 5.6).bays, 3);
  assert.deepEqual(baysFor(9, 5.6).bays, 3);
  assert.deepEqual(baysFor(null, 4).bays, 2);
  assert.deepEqual(baysFor(null, 8).bays, 4);
});

test('draftPandType: a readable front drafts a valid type with evidence and the full rhythm', () => {
  const d = draftPandType(input());
  assert.equal(d.hold, null);
  assert.deepEqual(typeProblems(d.type!), []);
  assert.equal((d.type as any).body.storeys, 3);
  assert.equal((d.type as any).grounds.main.doorBay, 0);
  assert.equal(d.crownFromPhoto, false);
});

test('draftPandType: a white or trading ground is a pui with the door on the read side', () => {
  const d = draftPandType(input({groundAccent: 0.5, doorSide: 'right'}));
  const g = (d.type as any).grounds.main;
  assert.equal(g.groundFront.kind, 'pui');
  assert.deepEqual(g.groundFront.bays, ['window', 'window', 'door']);
});

test('draftPandType: holds on width, unread rows, implausible storeys and a tall blank top', () => {
  assert.match(draftPandType(input({widthM: 12})).hold!, /frontage/);
  assert.match(draftPandType(input({storey: null})).hold!, /unread/);
  assert.match(draftPandType(input({storey: {floorM: [3.15, 8, 10.55], sillM: [4, 8.5], headM: [6, 9.6], windowShare: [], headShare: []}})).hold!, /upper storey/);
  assert.match(draftPandType(input({storey: {floorM: [6.3, 9, 10.55], sillM: [7, 9.4], headM: [8.5, 10], windowShare: [], headShare: []}})).hold!, /ground storey/);
  assert.match(draftPandType(input({skylineEavesM: 15})).hold!, /blank front/);
});

test('draftPandType: a register bell asks for the crown from the photo', () => {
  const d = draftPandType(input({registerGable: 'bell', crown: {widthM: 2.4, riseM: 2.6}}));
  assert.equal(d.crownFromPhoto, true);
  assert.equal((d.type as any).crowns.main.gable, 'bell');
  assert.deepEqual(typeProblems(d.type!), []);
});
