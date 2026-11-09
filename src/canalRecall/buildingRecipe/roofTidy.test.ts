/** Roof tidy (`roof.tidy`, roofTidy.ts): level merge, sliver fold, spike clamp, front protection, byte-identical when absent. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {roofMetrics, tidyRoof} from './roofTidy.ts';
import {validateLargeIntent} from './largeIntent.ts';
import {largeShellFacts} from './fitLarge.ts';
import type {BuildingFacts} from './facts.ts';

const g = 1;
const quad = (x0: number, y0: number, x1: number, y1: number, z: number | number[]) => {
  const zs = Array.isArray(z) ? z : [z, z, z, z];
  return [[x0, y0, g + zs[0]], [x1, y0, g + zs[1]], [x1, y1, g + zs[2]], [x0, y1, g + zs[3]]];
};
const plane = (id: number, ring: number[][], area: number) => ({surfaceId: `x:lod22:roof:${id}`, vertices: ring, ringsRD: [ring], slopeDeg: 0, areaM2: area});
/** Front on y=0; big roof 0..10 x 4..20 at 10 m; neighbour level 10.3 m; a 2 m² spike 3 m up; a 1 m² flat sliver 0.4 m off. */
function toy(): BuildingFacts {
  return {
    schemaVersion: 1, pandId: 'toy', source: {threeDBag: '', fetchedAt: '', streets: ''}, attributes: {b3_h_maaiveld: g}, bagFootprintRD: [], surveyFootprintPolygonsRD: [],
    roofsRD: [
      plane(1, quad(0, 0, 10, 2, 9), 20),                  // near the front: protected
      plane(2, quad(0, 8, 10, 20, 10), 120),
      plane(3, quad(10, 8, 20, 20, 10.3), 100),
      plane(4, quad(20, 8, 21, 10, 13), 2),                 // spike beside plane 3
      plane(5, quad(0, 20, 1, 21, 10.4), 1),                // flat sliver at 10.4
    ],
    heights: {groundNAP: g, roofMinM: 9, roofMaxM: 13, ridgeM: 13, dak50pM: 10, dak70pM: 10, storeys: null, builtYear: null},
    fronts: [{street: 'S', chainRD: [[0, 0, 0], [10, 0, 0]], topProfile: [], eavesM: 9, topM: 9, uncertainty: []}] as unknown as BuildingFacts['fronts'],
  } as unknown as BuildingFacts;
}
const z = (f: BuildingFacts, i: number) => f.roofsRD[i].vertices.map(v => +(v[2] - g).toFixed(3));

test('merges flat levels within 0.5 m, folds the sliver, clamps the spike, keeps the front plane', () => {
  const before = roofMetrics(toy());
  assert.ok(before.flatLevels >= 4); assert.equal(before.slivers, 2); assert.equal(before.spikes, 1);
  const {facts, report} = tidyRoof(toy());
  assert.deepEqual(z(facts, 0), [9, 9, 9, 9], 'plane near the front is authoritative');
  assert.equal(new Set(z(facts, 1)).size, 1); assert.equal(new Set(z(facts, 2)).size, 1);
  assert.equal(z(facts, 1)[0], z(facts, 2)[0], 'planes 2 and 3 share one level');
  assert.ok(Math.abs(z(facts, 1)[0] - 10.3) < 0.2, 'area-weighted mean of 10 and 10.3');
  assert.ok(Math.max(...z(facts, 3)) <= z(facts, 1)[0] + 1e-6, 'spike clamped to its neighbour');
  assert.equal(z(facts, 4)[0], z(facts, 1)[0], 'flat sliver folded into the neighbour level');
  assert.equal(report.clampedSpikes, 1); assert.equal(report.foldedSlivers, 1);
  assert.ok(report.after.spikes === 0 && report.after.flatLevels < before.flatLevels);
  assert.equal(facts.roofsRD[3].slopeDeg, 0, 'a clamped plane that went flat reports slope 0');
});

test('an already tidy roof is returned as is', () => {
  const f = toy(); f.roofsRD = [f.roofsRD[1]];
  assert.equal(tidyRoof(f).facts, f);
});

test('absent roof.tidy: largeShellFacts returns the input facts untouched', () => {
  const dir = 'scripts/building-recipes/houses/warmoesstraat-garage-165687';
  const intent = validateLargeIntent(JSON.parse(fs.readFileSync(`${dir}/intent.json`, 'utf8')));
  const f = JSON.parse(fs.readFileSync(`${dir}/facts.json`, 'utf8')) as BuildingFacts;
  assert.equal(largeShellFacts(intent, f).facts, f);
  const on = largeShellFacts({...intent, roof: {...(intent.roof ?? {material: 'bitumen'}), tidy: {evidence: 'user note #87'}}} as typeof intent, f);
  assert.ok(on.roofTidy && on.roofTidy.after.flatLevels <= on.roofTidy.before.flatLevels);
});

test('roof.tidy needs evidence', () => {
  const dir = 'scripts/building-recipes/houses/warmoesstraat-garage-165687';
  const raw = JSON.parse(fs.readFileSync(`${dir}/intent.json`, 'utf8'));
  assert.throws(() => validateLargeIntent({...raw, roof: {...(raw.roof ?? {material: 'bitumen'}), tidy: {}}}), /roof.tidy.evidence/);
});
