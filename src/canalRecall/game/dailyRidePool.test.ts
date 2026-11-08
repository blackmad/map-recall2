// Today's ride from the buurt pool (#279): a year from the cutover keeps every
// rule, and every place in the pool is a valid ride end on the graph the game
// routes on (rebuilt here from the extract, as scripts/daily-ride/snapGraph.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  clearDailyRideCache,
  DAILY_POOL_CUTOVER,
  DAILY_RIDE_MAX_KM,
  DAILY_RIDE_MIN_KM,
  DAILY_RIDE_NO_REPEAT_DAYS,
  dailyPoolPair,
  dailyRideKm,
  dailyRideLabel,
  dailyRidePair,
  type DailyPoolPoi,
  type DailyRidePair,
} from './dailyRide';
import { DAILY_RIDE_POOL } from './dailyRidePool';
import { CANAL_CITIES } from './cities';
import { loadSnapGraph } from '../../../scripts/daily-ride/snapGraph.ts';

const DAYS = 365;
const dates = Array.from({ length: DAYS }, (_, i) => {
  const at = new Date(`${DAILY_POOL_CUTOVER}T12:00:00.000Z`);
  at.setUTCDate(at.getUTCDate() + i);
  return at.toISOString().slice(0, 10);
});
const curated = CANAL_CITIES.amsterdam.curatedPois.map(poi => ({ ...poi }));
const ends = (pair: DailyRidePair) => [pair.from as DailyPoolPoi, pair.to as DailyPoolPoi];
const pairKey = (pair: DailyRidePair) => [pair.from.id, pair.to.id].sort().join('|');

test(`${DAYS} days from the cutover keep the rules`, () => {
  clearDailyRideCache();
  const year = dates.map(date => dailyPoolPair(date)!);
  const byId = new Map(DAILY_RIDE_POOL.map(place => [place.id, place]));
  year.forEach((pair, i) => {
    assert.ok(pair, `${dates[i]} has a pair`);
    assert.ok(pair.km >= DAILY_RIDE_MIN_KM && pair.km <= DAILY_RIDE_MAX_KM, `${pair.id} is ${pair.km} km`);
    assert.equal(pair.km, dailyRideKm(pair.from, pair.to));
    for (const end of ends(pair)) assert.ok(byId.get(end.id), `${end.id} is in the pool`);
    for (let back = 1; back < DAILY_RIDE_NO_REPEAT_DAYS && i - back >= 0; back++) {
      const prior = year[i - back]!;
      assert.notEqual(pairKey(pair), pairKey(prior), `${pair.id} repeats ${prior.id}`);
      const priorBuurten = new Set(ends(prior).map(end => end.buurt));
      for (const end of ends(pair)) assert.ok(!priorBuurten.has(end.buurt), `${pair.id}: ${end.buurt} also in ${prior.id}`);
    }
    assert.notEqual(ends(pair)[0]!.buurt, ends(pair)[1]!.buurt);
  });
  const distinct = new Set(year.map(pairKey));
  assert.ok(distinct.size >= 200, `distinct pairs over a year: ${distinct.size}`);
  console.log(`# ${distinct.size} distinct pairs in ${DAYS} days; ${new Set(year.flatMap(p => ends(p).map(e => e.buurt))).size} buurten used`);
});

test('the year is the same on a cold machine with the pool listed backwards, days asked newest first', () => {
  clearDailyRideCache();
  const forward = dates.map(date => dailyPoolPair(date)!.id);
  clearDailyRideCache();
  const reversed = [...DAILY_RIDE_POOL].reverse();
  const backward = [...dates].reverse().map(date => dailyPoolPair(date, reversed)!.id).reverse();
  assert.deepEqual(backward, forward);
});

test('from the cutover the ride hook (curated candidates) and the pool draw agree; before it the landmark draw stands', () => {
  for (const date of dates.slice(0, 20)) assert.equal(dailyRidePair(date, curated)!.id, dailyPoolPair(date)!.id);
  const before = dailyRidePair('2026-11-09', curated)!;
  assert.ok(curated.some(poi => poi.id === before.from.id), 'pre-cutover days keep the curated landmarks');
  assert.equal(dailyPoolPair('2026-11-09'), null);
});

test('the card names buurten: "Jordaan → Oosterparkbuurt · about 3.1 km"', () => {
  const pair = dailyPoolPair(DAILY_POOL_CUTOVER)!;
  assert.match(pair.id, new RegExp(`^${DAILY_POOL_CUTOVER}:(buurt|tour)-[a-z0-9-]+>(buurt|tour)-[a-z0-9-]+$`));
  assert.equal(dailyRideLabel(pair), `${pair.from.name} → ${pair.to.name} · about ${pair.km.toFixed(1)} km`);
});

test('every pool place is a ride end on the routing graph: unnamed, clear of named streets, routable; no card name is a quiz name', async () => {
  const directory = path.resolve('public/data/extracts/amsterdam');
  const graph = await loadSnapGraph(directory);
  const names = new Set<string>();
  for (const file of ['water.json', 'bridges.json']) {
    for (const item of JSON.parse(await readFile(path.join(directory, file), 'utf8')) as Array<{ name?: string }>) if (item.name) names.add(item.name.toLowerCase());
  }
  for (const feature of graph.features as Array<{ name?: string }>) if (feature.name) names.add(feature.name.toLowerCase());
  const failures = DAILY_RIDE_POOL.flatMap((place) => {
    const why = graph.whyNotSnap([place.lat, place.lng]);
    const named = names.has(place.name.toLowerCase()) ? `card name "${place.name}" is a quiz name` : '';
    return [why, named].filter(Boolean).map(reason => `${place.id}: ${reason}`);
  });
  assert.deepEqual(failures, []);
  assert.ok(DAILY_RIDE_POOL.length >= 50, `pool ${DAILY_RIDE_POOL.length}`);
});
