import assert from 'node:assert/strict';
import { GROUND_FLOOR_M, planWall } from '../src/canalRecall/wallBays';

const house = planWall(5.6, 14, 0, 'a');
assert.equal(house.bays, 1);
assert.ok(Math.abs(house.bayWidthM * house.bays - 5.6) < 1e-9, 'bays fill the wall exactly');
assert.equal(house.storeys, 3);
assert.ok(Math.abs(house.groundHeightM + house.storeys * house.storeyHeightM - 14) < 1e-9, 'storeys fill the height exactly');
assert.equal(house.doorBays.length, 1, 'a single house has one door');

const terrace = planWall(31, 15, 0, 'b');
assert.equal(terrace.bays, 6);
assert.ok(terrace.doorBays.length >= 2 && terrace.doorBays.every(bay => bay >= 0 && bay < terrace.bays), 'a terrace has several doors, all inside it');
assert.ok(terrace.bayWidthM > 4.5 && terrace.bayWidthM < 6, 'bay width stays close to the target');

assert.equal(planWall(2.5, 14, 0, 'c').plain, true, 'a return wall is plain');
assert.equal(planWall(10, 2.5, 0, 'd').plain, true, 'a shed is plain');
assert.deepEqual(planWall(8, 12, 0, 'same'), planWall(8, 12, 0, 'same'), 'deterministic');
assert.ok(planWall(8, 12, 3, 'e').groundHeightM <= GROUND_FLOOR_M, 'a raised part uses its own rise');
console.log('wall bay checks passed');
