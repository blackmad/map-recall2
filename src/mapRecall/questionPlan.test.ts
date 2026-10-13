import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StreetFeature } from '../types';
import type { ReviewState } from '../spacedRepetition';
import { getFeatureKey } from '../utils/featureIdentity';
import { isAdjacent, planChain } from './questionPlan';

const NOW = Date.UTC(2026, 9, 13, 12);
// ~111 m per 0.001° of latitude.
const f = (name: string, lat: number, lon: number, over: Partial<StreetFeature> = {}): StreetFeature => ({
  id: name, name, type: 'street', cityId: 'amsterdam', center: [lat, lon], difficulty: 'medium', clues: [], distractors: [], funFact: '', ...over,
} as StreetFeature);

const due = (feature: StreetFeature): ReviewState => ({
  featureKey: getFeatureKey(feature), mode: 'pinpoint', dueAt: NOW - 1000, intervalDays: 1, ease: 2.3, repetitions: 1, lapses: 0,
  lastReviewedAt: NOW - 86_400_000, lastEventId: 'e', schedulerVersion: 1,
  featureSnapshot: { name: feature.name, type: feature.type, cityId: feature.cityId, center: feature.center },
});

test('isAdjacent: same neighbourhood, containment, or within 700 m', () => {
  assert.equal(isAdjacent(f('A', 52.37, 4.9), f('B', 52.375, 4.9)), true); // ~556 m
  assert.equal(isAdjacent(f('A', 52.37, 4.9), f('B', 52.38, 4.9)), false); // ~1.1 km
  assert.equal(isAdjacent(f('A', 52.37, 4.9, { neighborhood: 'Jordaan' }), f('B', 52.39, 4.9, { neighborhood: 'Jordaan' })), true);
  const area = f('Pijp', 52.35, 4.89, { type: 'neighborhood', areaGeometry: [[[[52.34, 4.88], [52.34, 4.92], [52.36, 4.92], [52.36, 4.88], [52.34, 4.88]]]] });
  assert.equal(isAdjacent(area, f('Inside', 52.355, 4.915)), true);
  // A long street is adjacent when its line passes close, even with a far centre.
  const long = f('Long', 52.37, 4.95, { path: [[52.37, 4.9], [52.37, 5.0]] });
  assert.equal(isAdjacent(long, f('Near line', 52.373, 4.91)), true);
});

test('planChain walks to the nearest next question and keeps the first', () => {
  const a = f('A', 52.37, 4.90);
  const far = f('Far', 52.40, 4.95);
  const b = f('B', 52.371, 4.90);
  const c = f('C', 52.372, 4.90);
  const order = planChain([a, far, c, b], { now: NOW }).map(({ name }) => name);
  assert.deepEqual(order, ['A', 'B', 'C', 'Far']);
});

test('due reviews still come before new places', () => {
  const dueFar = f('DueFar', 52.40, 4.95);
  const first = f('First', 52.37, 4.90);
  const near = f('Near', 52.3705, 4.90);
  const states = [due(first), due(dueFar)];
  const order = planChain([first, near, dueFar], { states, mode: 'pinpoint', now: NOW }).map(({ name }) => name);
  assert.deepEqual(order, ['First', 'DueFar', 'Near']);
});

test('unseen waters keep their syllabus order', () => {
  const start = f('Start', 52.37, 4.90);
  const amstel = f('Amstel', 52.40, 4.95, { type: 'water' });
  const minor = f('Minor', 52.3702, 4.90, { type: 'canal' });
  const order = planChain([start, amstel, minor], { now: NOW }).map(({ name }) => name);
  assert.deepEqual(order, ['Start', 'Amstel', 'Minor']);
});

test('no more than three in a row share a neighbourhood', () => {
  const hood = (name: string, lat: number) => f(name, lat, 4.9, { neighborhood: 'Jordaan' });
  const list = [hood('J1', 52.370), hood('J2', 52.3701), hood('J3', 52.3702), hood('J4', 52.3703), f('Other', 52.3720, 4.9, { neighborhood: 'Spuikwartier' })];
  const order = planChain(list, { now: NOW }).map(({ name }) => name);
  assert.deepEqual(order, ['J1', 'J2', 'J3', 'Other', 'J4']);
});

test('planChain keeps the same set', () => {
  const list = Array.from({ length: 12 }, (_, index) => f(`F${index}`, 52.35 + (index * 7 % 11) * 0.003, 4.88 + (index * 5 % 7) * 0.004));
  const order = planChain(list, { now: NOW });
  assert.equal(order.length, list.length);
  assert.deepEqual(new Set(order.map(({ name }) => name)), new Set(list.map(({ name }) => name)));
});
