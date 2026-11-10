import test from 'node:test';
import assert from 'node:assert/strict';
import {gridOverrides, handRunProblems, souterrainGround, type HandRun} from './handPlace.ts';

const types = [{id: 'cornice', crowns: {none: {gable: 'cornice'}, dormer: {gable: 'cornice'}}, grounds: {'door-left': {}, 'souterrain-left': {souterrain: true}}},
  {id: 'plain', crowns: {none: {}}, grounds: {'door-left': {}}}] as never[];
const members = ['0363100012000001', '0363100012000002', '0363100012000003'];
const run = (houses: HandRun['houses']): HandRun => ({id: 'f-h1', face: 'f', reason: 'strip', houses});
const house = (pand: string, extra: object = {}) => ({pand, type: 'cornice', storeys: 4, why: 'strip', ...extra});

test('hand run: consecutive members, known type, crown and ground, storeys and eaves in range', () => {
  assert.deepEqual(handRunProblems(run([house('000001'), house('000002', {crown: 'dormer', eavesM: 12.3})]), members, types), []);
  assert.match(handRunProblems(run([house('000001'), house('000003')]), members, types).join(), /not consecutive/);
  assert.match(handRunProblems(run([house('000009')]), members, types).join(), /not on f/);
  assert.match(handRunProblems(run([house('000001', {type: 'x'})]), members, types).join(), /unknown type x/);
  assert.match(handRunProblems(run([house('000001', {crown: 'bell'})]), members, types).join(), /crown bell not in cornice/);
  assert.match(handRunProblems(run([house('000001', {ground: 'shop'})]), members, types).join(), /ground shop not in cornice/);
  assert.match(handRunProblems(run([house('000001', {storeys: 0})]), members, types).join(), /storeys must be 1\.\.8/);
  assert.match(handRunProblems(run([house('000001', {eavesM: 40})]), members, types).join(), /eavesM must be 2\.\.30/);
  assert.match(handRunProblems(run([house('000001', {why: ''})]), members, types).join(), /why required/);
  assert.match(handRunProblems({...run([house('000001')]), reason: ''}, members, types).join(), /reason required/);
});

test('hand run: the storey grid pin matches storeys and eaves, and writes the souterrain with its stoop', () => {
  assert.deepEqual(handRunProblems(run([house('000001', {storeys: 3, eavesM: 12, grid: {storeysM: [4, 3.6, 3.2], souterrainM: 1.4}})]), members, types), []);
  assert.match(handRunProblems(run([house('000001', {storeys: 3, grid: {storeysM: [4, 3.6]}})]), members, types).join(), /one height per storey \(3\)/);
  assert.match(handRunProblems(run([house('000001', {storeys: 1, grid: {storeysM: [3], souterrainM: 5}})]), members, types).join(), /souterrainM must be 0\.8\.\.3/);
  assert.match(handRunProblems(run([house('000001', {storeys: 2, eavesM: 9, grid: {storeysM: [3, 3]}})]), members, types).join(), /grid sums to 6\.0 m/);
  assert.match(handRunProblems(run([house('000001', {storeys: 1, grid: {storeysM: [3]}, overrides: {storeyHeights: [1]}})]), members, types).join(), /both set the storey grid/);
  assert.match(handRunProblems(run([house('000001', {type: 'plain', storeys: 1, grid: {storeysM: [3], souterrainM: 1.5}})]), members, types).join(), /needs a souterrain ground in plain/);
  assert.match(handRunProblems(run([house('000001', {storeys: 1, ground: 'door-left', grid: {storeysM: [3], souterrainM: 1.5}})]), members, types).join(), /not the souterrain ground/);
  assert.deepEqual(gridOverrides({storeysM: [4, 3]}), {storeyHeights: [4, 3]});
  assert.deepEqual(gridOverrides({storeysM: [4, 3], souterrainM: 1.2}), {storeyHeights: [1.2, 4, 3]});
  assert.equal(souterrainGround(types[0]), 'souterrain-left');
  assert.equal(souterrainGround(types[1]), undefined);
});
