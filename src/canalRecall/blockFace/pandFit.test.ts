/**
 * Per-pand fit (pandFit.ts, canal-belt pilot 2026-11-10): the gable choice, the bays, the holds, and that a drafted type is a
 * valid house type.
 *   node --import tsx --test src/canalRecall/blockFace/pandFit.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {baysFor, draftPandType, gableFor, type PandFitInput} from './pandFit.ts';
import {typeProblems} from './houseType.ts';
import {columnAlignment, groundBandTop} from './typeDraft.ts';

const input = (o: Partial<PandFitInput> = {}): PandFitInput => ({
  pandId: '0363100012181580', address: 'Foeliedwarsstraat 62', face: 'foeliedwars-40-88', stripDate: '2023-01-13', widthM: 5.6, eavesM: 10.97, skylineEavesM: 10.7,
  crown: null, storey: {floorM: [3.15, 6.85, 10.55], sillM: [4, 7.7], headM: [5.9, 9.6], windowShare: [0.5, 0.5], headShare: [0.8, 0.8]},
  windowCols: 3, windowWidthM: 1.2, palette: {wall: '#7a4a3a', frame: '#ece9e0', stucco: false}, doorSide: 'left', groundAccent: 0.1, trading: false, registerGable: null, ...o,
});

test('gableFor: the register wins; a crown with no register gable is unknown (null); no crown is a cornice', () => {
  assert.equal(gableFor('neck', null, 6).gable, 'neck');
  assert.equal(gableFor('plain', {widthM: 2, riseM: 3}, 6).gable, 'cornice');
  assert.equal(gableFor(null, {widthM: 2.4, riseM: 2.2}, 6).gable, null);
  assert.equal(gableFor(null, null, 6).gable, 'cornice');
});

test('draftPandType: a skyline crown without a register gable is held; a stitch-doubled front is held', () => {
  assert.match(draftPandType(input({crown: {widthM: 3.2, riseM: 2.5}})).hold!, /crown kind unknown/);
  assert.match(draftPandType(input({alignment: -0.2})).hold!, /do not stack/);
  assert.equal(draftPandType(input({alignment: 0.25})).hold, null);
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

// Round 2 readers on a synthetic opening mask (row 0 at topM; cell 0.1 m; 1 = opening, 0 = wall).
const maskOf = (rows: number, cols: number, open: (v: number, i: number) => boolean, topM: number, cell = 0.1) => {
  const m = new Uint8Array(rows * cols);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) m[j * cols + i] = open(topM - (j + 0.5) * cell, i) ? 1 : 0;
  return m;
};
const isOpen = (v: number) => v === 1;

test('groundBandTop: a pui from 0.5 to 4.2 m reads its top; windows starting high read none', () => {
  const pui = (v: number, i: number) => (v > 0.5 && v < 4.2 && i > 5 && i < 55) || ([5, 8.2].some(s => v > s && v < s + 1.8) && i % 20 > 6 && i % 20 < 14);
  assert.ok(Math.abs(groundBandTop({mask: maskOf(110, 60, pui, 11), cols: 60, rows: 110, cell: 0.1, topM: 11, eavesM: 11, isOpen})! - 4.2) < 0.15);
  const upper = (v: number, i: number) => [5, 8.2].some(s => v > s && v < s + 1.8) && i % 20 > 6 && i % 20 < 14;
  assert.equal(groundBandTop({mask: maskOf(110, 60, upper, 11), cols: 60, rows: 110, cell: 0.1, topM: 11, eavesM: 11, isOpen}), null);
});

test('columnAlignment: stacked windows align; shifted rows do not', () => {
  const runs = [{sill: 5, head: 6.8}, {sill: 8.2, head: 10}];
  const stacked = maskOf(110, 60, (v, i) => runs.some(r => v > r.sill && v < r.head) && i % 20 > 6 && i % 20 < 14, 11);
  assert.ok(columnAlignment({mask: stacked, cols: 60, rows: 110, cell: 0.1, topM: 11, isOpen}, runs)! > 0.9);
  const shifted = maskOf(110, 60, (v, i) => (v > 5 && v < 6.8 && i % 20 > 6 && i % 20 < 14) || (v > 8.2 && v < 10 && (i % 20 < 4 || i % 20 > 16)), 11);
  assert.ok(columnAlignment({mask: shifted, cols: 60, rows: 110, cell: 0.1, topM: 11, isOpen}, runs)! < 0.1);
});
