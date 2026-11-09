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
  frameToAspect,
  knownFrame,
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

// ---- #297: the frame fits every buurt with a known name ----

const wide = geometryFromExtract([
  square('Jordaan', 'quarter', 52.37, 4.88, 0.01),
  square('De Pijp', 'quarter', 52.35, 4.89, 0.01),
  square('Buiksloterham', 'neighbourhood', 52.405, 4.91, 0.01),
  square('Geuzenveld', 'neighbourhood', 52.38, 4.80, 0.01),
  square('IJburg Zuid', 'neighbourhood', 52.355, 5.00, 0.01),
  square('Bijlmer', 'neighbourhood', 52.31, 4.97, 0.01),
]);
const inside = (frame: ReturnType<typeof knownFrame>, bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number }) =>
  bbox.minLat >= frame.minLat && bbox.maxLat <= frame.maxLat && bbox.minLng >= frame.minLng && bbox.maxLng <= frame.maxLng;

test('knownFrame: nothing known keeps the default frame; known outer buurts grow it', () => {
  const none = buurtMastery(wide, []);
  assert.deepEqual(knownFrame(wide, none), wide.frame);
  const outer = buurtMastery(wide, [
    item('a', [52.41, 4.915], 0.6, 'known'),
    item('b', [52.36, 5.005], 0.5, 'learning'),
    item('c', [52.385, 4.805], 0.4, 'learning'),
  ]);
  const frame = knownFrame(wide, outer);
  for (const name of ['Buiksloterham', 'IJburg Zuid', 'Geuzenveld']) {
    assert.ok(inside(frame, wide.buurts.find(b => b.name === name)!.bbox), `${name} inside`);
  }
  assert.ok(inside(frame, wide.frame), 'the default frame stays inside');
  assert.ok(frame.maxLng - frame.minLng > wide.frame.maxLng - wide.frame.minLng);
  // A buurt nobody has a name in is not forced in.
  assert.ok(!inside(frame, wide.buurts.find(b => b.name === 'Bijlmer')!.bbox));
});

test('knownFrame: a centre-only seed is the default frame (the beginner map is never a dot)', () => {
  const centre = buurtMastery(wide, [item('a', [52.375, 4.885], 0.6, 'known'), item('b', [52.355, 4.895], 0.6, 'known')]);
  assert.ok(inside(knownFrame(wide, centre), wide.frame));
  const km = (knownFrame(wide, centre).maxLat - knownFrame(wide, centre).minLat) * 111.32;
  assert.ok(km > 1, 'spans more than a kilometre');
});

test('frameToAspect: the widened frame has the panel aspect, keeps its centre and contains the input', () => {
  const frame = knownFrame(wide, buurtMastery(wide, [item('a', [52.41, 4.915], 0.6, 'known'), item('b', [52.36, 5.005], 0.5, 'learning')]));
  for (const [w, h] of [[760, 420], [350, 420], [350, 220]] as const) {
    const fitted = frameToAspect(frame, w, h);
    assert.ok(inside(fitted, { minLat: frame.minLat + 1e-9, maxLat: frame.maxLat - 1e-9, minLng: frame.minLng + 1e-9, maxLng: frame.maxLng - 1e-9 }));
    const lngFactor = Math.cos((((fitted.minLat + fitted.maxLat) / 2) * Math.PI) / 180);
    const aspect = ((fitted.maxLng - fitted.minLng) * lngFactor) / (fitted.maxLat - fitted.minLat);
    assert.ok(Math.abs(aspect - w / h) < 1e-6, `${w}x${h}`);
    assert.ok(Math.abs((fitted.minLat + fitted.maxLat) / 2 - (frame.minLat + frame.maxLat) / 2) < 1e-9);
  }
});

test('drawKnowledgeMap: every known buurt lands inside the canvas on desktop and phone panels', () => {
  const model = buildKnowledgeMapModel(wide, [
    item('a', [52.41, 4.915], 0.6, 'known'), item('b', [52.36, 5.005], 0.5, 'learning'), item('c', [52.385, 4.805], 0.4, 'learning'),
    item('d', [52.375, 4.885], 0.8, 'mastered'),
  ]);
  const noop = () => {};
  const ctx = { save: noop, restore: noop, beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, fill: noop, stroke: noop, arc: noop, fillRect: noop, setLineDash: noop,
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineJoin: 'round', lineCap: 'round', globalAlpha: 1 } as unknown as Parameters<typeof drawKnowledgeMap>[0];
  for (const [w, h] of [[760, 420], [350, 260]] as const) {
    const p = drawKnowledgeMap(ctx, model, { width: w, height: h });
    for (const entry of model.mastery.values()) {
      const box = wide.buurts.find(b => b.name === entry.name)!.bbox;
      for (const corner of [[box.minLat, box.minLng], [box.maxLat, box.maxLng]] as const) {
        const [x, y] = projectLatLng(p, corner);
        assert.ok(x >= 0 && x <= w && y >= 0 && y <= h, `${entry.name} ${w}x${h}: ${x.toFixed(0)},${y.toFixed(0)}`);
      }
    }
  }
});
