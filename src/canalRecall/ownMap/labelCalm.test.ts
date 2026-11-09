import test from 'node:test';
import assert from 'node:assert/strict';
import { calmLabels, corridorDistance, CALM_POI_MAX } from './labelCalm';
import type { PlacedLabel } from './labels';

const poi = (id: string, x: number, y: number): PlacedLabel => ({ id, text: id, kind: 'poi', size: 11, x, y });
const street: PlacedLabel = { id: 's', text: 'Street', kind: 'street', size: 12, glyphs: [], anchors: [] };
const base = { width: 900, height: 600, depthOf: () => 50, isLandmark: () => false };

test('streets, water and hoods are never thinned; POIs in the top third go', () => {
  const out = calmLabels([street, poi('high', 450, 150), poi('low', 450, 400)], base);
  assert.deepEqual(out.map(l => l.id), ['s', 'low']);
});

test('at most six POIs, nearest the corridor first', () => {
  const list = Array.from({ length: 10 }, (_, i) => poi(`p${i}`, 100 + i * 80, 450));
  const out = calmLabels(list, base);
  assert.equal(out.length, CALM_POI_MAX);
  const best = list.map(l => corridorDistance(l.x!, l.y!, 900, 600)).sort((a, b) => a - b)[CALM_POI_MAX - 1];
  for (const l of out) assert.ok(corridorDistance(l.x!, l.y!, 900, 600) <= best + 1e-9);
});

test('shops beyond 150 m go, landmarks stay, unknown depth stays; order is preserved', () => {
  const depth = new Map([['near', 80], ['far', 240], ['mark', 400]]);
  const out = calmLabels([poi('mark', 450, 300), poi('far', 450, 350), poi('near', 450, 400), poi('nodepth', 300, 400)], {
    ...base, depthOf: l => depth.get(l.id) ?? null, isLandmark: l => l.id === 'mark',
  });
  assert.deepEqual(out.map(l => l.id), ['mark', 'near', 'nodepth']);
});

test('game points are exempt, and nothing is ever added', () => {
  const game = poi('game', 450, 50);
  const input = [game, poi('a', 450, 400)];
  const out = calmLabels(input, { ...base, isGamePoint: l => l.id === 'game' });
  assert.deepEqual(out, input);
  assert.ok(out.every(l => input.includes(l)));
});
