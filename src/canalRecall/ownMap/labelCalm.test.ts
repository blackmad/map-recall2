import test from 'node:test';
import assert from 'node:assert/strict';
import { calmLabels, corridorDistance, CALM_POI_MAX } from './labelCalm';
import type { PlacedLabel } from './labels';
import { cameraFrame, project, unproject } from './mapCamera';

const poi = (id: string, x: number, y: number): PlacedLabel => ({ id, text: id, kind: 'poi', size: 11, x, y });
const street: PlacedLabel = { id: 's', text: 'Street', kind: 'street', size: 12, glyphs: [], anchors: [] };
const base = { width: 900, height: 600, distanceOf: () => 50, isLandmark: () => false };

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
    ...base, distanceOf: l => depth.get(l.id) ?? null, isLandmark: l => l.id === 'mark',
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

test('realistic chase camera (zoom 17.5, pitch 60, eye ~350 m out): ground distance keeps the near shops, eye depth would keep none', () => {
  const f = cameraFrame({ center: [0, 0], zoom: 17.5, bearing: 0, pitch: 60, fovDeg: 36.87 } as never, { width: 1440, height: 900 }, 52.37);
  const labels: PlacedLabel[] = [];
  const ground = new Map<string, [number, number]>();
  for (let i = 0; i < 20; i++) {
    const x = 100 + (i * 67) % 1240, y = 60 + (i * 41) % 800;
    const g = unproject(f, x, y, 0)!;
    labels.push(poi(`p${i}`, x, y)); ground.set(`p${i}`, [g[0], g[1]]);
  }
  const eyeDepth = (l: PlacedLabel) => { const g = ground.get(l.id)!; return project(f, g).depth; };
  const groundDist = (l: PlacedLabel) => { const g = ground.get(l.id)!; return Math.hypot(g[0] - f.target[0], g[1] - f.target[1]); };
  assert.ok(labels.every(l => eyeDepth(l) > 150), 'every point is deeper than 150 m from the eye');
  assert.equal(calmLabels(labels, { ...base, width: 1440, height: 900, distanceOf: eyeDepth }).length, 0);
  const out = calmLabels(labels, { ...base, width: 1440, height: 900, distanceOf: groundDist });
  assert.ok(out.length > 0 && out.length <= CALM_POI_MAX, `kept ${out.length}`);
  assert.ok(out.every(l => l.y! >= 300 && groundDist(l) <= 150));
});
