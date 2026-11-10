import test from 'node:test';
import assert from 'node:assert/strict';
import {handRunProblems, type HandRun} from './handPlace.ts';

const types = [{id: 'cornice', crowns: {none: {gable: 'cornice'}, dormer: {gable: 'cornice'}}, grounds: {'door-left': {}}}] as never[];
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
