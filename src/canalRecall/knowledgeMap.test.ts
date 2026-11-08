import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  bandCounts,
  buildKnowledgeMapModel,
  buurtAt,
  buurtAtPixel,
  buurtBand,
  buurtMastery,
  drawKnowledgeMap,
  fitMap,
  geometryFromExtract,
  projectLatLng,
  unprojectPixel,
  type KnowledgeMapItem,
} from './knowledgeMap.ts';
import { buildKnowledgeReview } from './knowledgeReview.ts';

const square = (name: string, kind: string, lat: number, lng: number, size: number) => ({
  name, kind,
  geometry: [[[[lat, lng], [lat, lng + size], [lat + size, lng + size], [lat + size, lng], [lat, lng]]]],
});

const toy = geometryFromExtract([
  { name: 'Amsterdam', kind: 'municipality', geometry: [[[[52, 4], [52, 5], [53, 5], [53, 4]]]] },
  square('Centrum', 'suburb', 52.36, 4.88, 0.04),
  square('Jordaan', 'quarter', 52.37, 4.88, 0.01),
  square('Westerstraat', 'neighbourhood', 52.375, 4.88, 0.004),
  square('De Pijp', 'quarter', 52.35, 4.89, 0.01),
], [{ path: [[52.365, 4.87], [52.365, 4.93]] }]);

const item = (key: string, center: [number, number], mastery: number, status: KnowledgeMapItem['status']): KnowledgeMapItem =>
  ({ key, center, mastery, status });

test('geometry keeps ranked buurts only, coarsest first, with water lines', () => {
  assert.deepEqual(toy.buurts.map(b => b.name), ['Centrum', 'De Pijp', 'Jordaan', 'Westerstraat']);
  assert.equal(toy.water.length, 1);
  // Framed on quarters and finer, not the whole suburb.
  assert.ok(toy.frame.minLat >= 52.35 && toy.frame.maxLat <= 52.38 + 1e-9);
});

test('a point goes to the finest buurt containing it, as the ride passport decides', () => {
  assert.equal(buurtAt(toy, [52.376, 4.881])?.name, 'Westerstraat');
  assert.equal(buurtAt(toy, [52.371, 4.889])?.name, 'Jordaan');
  assert.equal(buurtAt(toy, [52.395, 4.915])?.name, 'Centrum');
  assert.equal(buurtAt(toy, [52.0, 4.0]), null);
  assert.equal(buurtAt(toy, null), null);
});

test('buurt mastery: sum of mastery over max(tracked, 4); any name lifts out of fog', () => {
  const mastery = buurtMastery(toy, [
    item('a', [52.371, 4.889], 1, 'mastered'),
    item('b', [52.372, 4.889], 1, 'mastered'),
    item('c', [52.373, 4.889], 1, 'mastered'),
    item('d', [52.374, 4.889], 1, 'mastered'),
    item('e', [52.355, 4.895], 1, 'mastered'),
    item('f', [52.356, 4.895], 0.1, 'due'),
    item('g', [10, 10], 1, 'known'),
    { key: 'h', status: 'known', mastery: 1 },
  ]);
  const jordaan = mastery.get('Jordaan')!;
  assert.equal(jordaan.tracked, 4);
  assert.equal(jordaan.score, 1);
  assert.equal(jordaan.band, 'mastered');
  const pijp = mastery.get('De Pijp')!;
  assert.equal(pijp.tracked, 2);
  assert.equal(pijp.due, 1);
  assert.ok(Math.abs(pijp.score - 1.1 / 4) < 1e-9);
  assert.equal(pijp.band, 'learning');
  assert.equal(mastery.has('Centrum'), false);
  assert.deepEqual(bandCounts(mastery), { learning: 1, known: 0, mastered: 1 });
  assert.equal(buurtBand(0, 0), 'fog');
  assert.equal(buurtBand(0.01, 1), 'learning');
  assert.equal(buurtBand(0.5, 3), 'known');
});

test('knowledge items carry their place centre into the map', () => {
  const now = Date.UTC(2026, 10, 9);
  const review = buildKnowledgeReview([{
    featureKey: 'x', mode: 'guess_name', dueAt: now + 86_400_000, intervalDays: 4, ease: 2.3, repetitions: 3, lapses: 0,
    lastReviewedAt: now - 1000, lastEventId: 'e', schedulerVersion: 1,
    featureSnapshot: { name: 'Westerstraat', type: 'street', cityId: 'amsterdam', center: [52.376, 4.881] },
  } as never], [], now);
  assert.deepEqual(review.items[0].center, [52.376, 4.881]);
  const model = buildKnowledgeMapModel(toy, review.items);
  assert.equal(model.mastery.get('Westerstraat')?.tracked, 1);
});

test('projection round-trips and tap-to-filter finds the buurt under a pixel', () => {
  const p = fitMap(toy.frame, 320, 240);
  const [x, y] = projectLatLng(p, [52.371, 4.889]);
  const back = unprojectPixel(p, x, y);
  assert.ok(Math.abs(back[0] - 52.371) < 1e-9 && Math.abs(back[1] - 4.889) < 1e-9);
  const model = buildKnowledgeMapModel(toy, []);
  assert.equal(buurtAtPixel(model, p, x, y), 'Jordaan');
});

test('drawing issues fills for every buurt and draws no text', () => {
  const calls: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return (..._args: unknown[]) => { calls.push(prop); };
    },
    set(target, prop: string, value) { target[prop] = value; return true; },
  });
  const model = buildKnowledgeMapModel(toy, [item('a', [52.371, 4.889], 1, 'due')]);
  drawKnowledgeMap(ctx as never, model, { width: 320, height: 240, selected: 'Jordaan' });
  assert.ok(calls.filter(c => c === 'fill').length >= toy.buurts.length + 1);
  assert.equal(calls.includes('fillText'), false);
  assert.equal(calls.includes('strokeText'), false);
});

test('the real Amsterdam extract: famous points land in their buurt', () => {
  const base = new URL('../../public/data/extracts/amsterdam/', import.meta.url);
  const geometry = geometryFromExtract(
    JSON.parse(readFileSync(new URL('boundaries.json', base), 'utf8')),
    JSON.parse(readFileSync(new URL('water.json', base), 'utf8')),
  );
  assert.ok(geometry.buurts.length >= 80);
  assert.equal(buurtAt(geometry, [52.3545, 4.8925])?.name, 'Oude Pijp');
  assert.equal(buurtAt(geometry, [52.3745, 4.884])?.name, 'Grachtengordel');
});
