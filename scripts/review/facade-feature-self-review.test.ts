import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reviewUpperFloorDoors } from './facade-feature-self-review.js';

const features: any[] = [
  { id: 'upper-left', kind: 'window', row: 2, bounds: [0, 10, 20, 50] },
  { id: 'upper-door-unknown', kind: 'door', row: 2, bounds: [30, 10, 50, 55] },
  { id: 'upper-right', kind: 'window', row: 2, bounds: [60, 10, 80, 50] },
  { id: 'upper-panelled', kind: 'door', row: 3, bounds: [30, 70, 50, 115], doorStyle: 'panelled' },
  { id: 'upper-neighbour', kind: 'window', row: 3, bounds: [60, 70, 80, 110] },
  { id: 'upper-glazed', kind: 'door', row: 4, bounds: [30, 130, 50, 175], doorStyle: 'glazed', doorGlazingRatio: .88 },
  { id: 'upper-glazed-neighbour', kind: 'window', row: 4, bounds: [60, 130, 80, 170] },
  { id: 'ground-door', kind: 'door', row: 5, bounds: [30, 190, 50, 250], doorStyle: 'panelled' },
];
assert.deepEqual(reviewUpperFloorDoors(features).map(flag => flag.featureId), ['upper-door-unknown', 'upper-panelled']);
assert.equal(reviewUpperFloorDoors([{ id: 'isolated', kind: 'door', row: 1, bounds: [0, 0, 10, 20] } as any]).length, 0, 'door position alone never causes blanket glazing');
const cases = JSON.parse(fs.readFileSync('public/data/facade-repair-preview/cases.json', 'utf8'));
const flags = (caseId: string) => {
  const features=structuredClone(cases.cases.find((item: any) => item.caseId === caseId).shapeFeatures.full.features);
  for(const feature of features)if(feature.kind==='door'){delete feature.doorStyle;delete feature.doorGlazingRatio;delete feature.doorFurniture;}
  return reviewUpperFloorDoors(features).map(flag => flag.featureId);
};
assert.deepEqual(flags('case-30'), ['full:door_1', 'full:door_2', 'full:door_3'], 'case30 three balcony-row doors require review before correction');
assert.deepEqual(flags('case-20'), ['full:door-1', 'full:door-2'], 'case20 is queued conservatively without automatic conversion');
assert.deepEqual(flags('case-21'), ['full:door_r1_b2'], 'case21 uncertain bright opening remains a review flag, not inferred glazing');
console.log('Upper-floor door self-review: aligned solid defaults flagged; explicit glazing and ground entrance preserved.');
