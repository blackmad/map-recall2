/**
 * Core footprint (buildingRecipe/coreFootprint.ts, `footprint: "core"`, Blend Haarlemmerweg 518A-776): shallow outward
 * steps of a BAG top-view outline retracted onto the core; plain outlines and notches come back unchanged.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {coreRing, type P2} from './coreFootprint.ts';
import {validateLargeIntent} from './largeIntent.ts';
import {fitLarge} from './fitLarge.ts';
import type {BuildingFacts} from './facts.ts';

const area = (r: P2[]) => Math.abs(r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0)) / 2;

test('a plain rectangle comes back unchanged, in both windings and closed', () => {
  const rect: P2[] = [[0, 0], [30, 0], [30, 20], [0, 20]];
  assert.deepEqual(coreRing(rect).ring, rect);
  assert.equal(coreRing(rect).report.steps, 0);
  const cw = rect.slice().reverse();
  assert.deepEqual(coreRing(cw).ring, cw);
  const closed = [...rect, rect[0]];
  assert.deepEqual(coreRing(closed).ring, closed);
});

test('a shallow bump (1.8 m) is retracted onto the facade behind it; a deep wing (6 m) is kept', () => {
  const bump: P2[] = [[0, 0], [10, 0], [10, -1.8], [16, -1.8], [16, 0], [30, 0], [30, 20], [0, 20]];
  const r = coreRing(bump);
  assert.equal(r.ring.length, 4);
  assert.equal(r.report.steps, 1);
  assert.ok(Math.abs(r.report.removedM2 - 10.8) < 1e-6, `removed ${r.report.removedM2}`);
  const wing: P2[] = [[0, 0], [10, 0], [10, -6], [16, -6], [16, 0], [30, 0], [30, 20], [0, 20]];
  assert.equal(coreRing(wing).ring.length, 8);
});

test('a deep notch (4 m) is kept; a shallow one (1.5 m) reads as two bumps and its flanks retract to its floor', () => {
  const deep: P2[] = [[0, 0], [10, 0], [10, 4], [16, 4], [16, 0], [30, 0], [30, 20], [0, 20]];
  const r = coreRing(deep);
  assert.ok(Math.abs(area(r.ring) - area(deep)) < 1e-6, 'area unchanged');
  assert.equal(r.report.steps, 0);
  const shallow: P2[] = [[0, 0], [10, 0], [10, 1.5], [16, 1.5], [16, 0], [30, 0], [30, 20], [0, 20]];
  const s = coreRing(shallow);
  assert.equal(s.ring.length, 4);
  assert.ok(Math.abs(area(s.ring) - 30 * 18.5) < 1e-6, `area ${area(s.ring)}`);
});

test('an L step (one short neighbour) shifts the corner segment in', () => {
  const l: P2[] = [[0, 0], [20, 0], [20, 1.2], [30, 1.2], [30, 20], [0, 20]];
  const r = coreRing(l);
  assert.ok(r.report.steps >= 1);
  assert.ok(area(r.ring) < area(l) && area(r.ring) >= 30 * 18.8 - 1e-6, `area ${area(r.ring)}`);
});

test('Blend: the BAG outline retracts to a four-corner core about 33 x 24 m', () => {
  const H = 'scripts/building-recipes/houses/haarlemmerweg-518';
  const facts: BuildingFacts = JSON.parse(fs.readFileSync(`${H}/facts.json`, 'utf8'));
  const intent = validateLargeIntent(JSON.parse(fs.readFileSync(`${H}/intent.json`, 'utf8')));
  const {report} = fitLarge(intent, facts);
  const shell = report.shellRepair!;
  assert.equal(shell.mode.footprint, 'core');
  const core = shell.core!;
  assert.equal(core.steps, 11);
  assert.ok(Math.abs(core.removedM2 - 117.18) < 0.05, `removed ${core.removedM2}`);
  assert.deepEqual(core.coreWalls.length, 4, 'one wall per side of the core');
  assert.equal(core.mainRoofM, 42);
});
