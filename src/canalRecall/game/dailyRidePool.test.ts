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
  dailyRouteKm,
  dailyRideLabel,
  dailyRidePair,
  type DailyPoolPoi,
  type DailyRidePair,
} from './dailyRide';
import { DAILY_RIDE_PAIRS, DAILY_RIDE_POOL } from './dailyRidePool';
import { CANAL_CITIES } from './cities';
import { loadSnapGraph } from '../../../scripts/daily-ride/snapGraph.ts';
import { buurtFinishBlurb } from './finishBlurb';
import { buildRouteShare } from '../shareRoute';
import { buildLandingModel } from '../landing/landingModel';
import { landingCardsHtml } from '../landing/landingView';
import { landingFixtureStorage, LANDING_FIXTURE_NOW } from '../landing/landingFixtures';

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
    assert.equal(pair.km, dailyRouteKm(pair.from.id, pair.to.id), `${pair.id} km is the bundled route length`);
    assert.equal(pair.routed, true);
    for (const end of ends(pair)) assert.ok(byId.get(end.id), `${end.id} is in the pool`);
    assert.ok(byId.get(pair.from.id)!.startOk, `${pair.id} starts at a place that may not start`);
    assert.ok(byId.get(pair.to.id)!.finishOk, `${pair.id} ends at a place that may not end`);
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

test('the card names buurten and the route length without "about": "Jordaan → Oosterparkbuurt · 3.1 km"', () => {
  const pair = dailyPoolPair(DAILY_POOL_CUTOVER)!;
  assert.match(pair.id, new RegExp(`^${DAILY_POOL_CUTOVER}:(buurt|tour)-[a-z0-9-]+>(buurt|tour)-[a-z0-9-]+$`));
  assert.equal(dailyRideLabel(pair), `${pair.from.name} → ${pair.to.name} · ${pair.km.toFixed(1)} km`);
  assert.doesNotMatch(dailyRideLabel(pair), /about/);
});

test('every pool place is a ride end on the routing graph: unnamed, clear of named streets, routable; no card name is a quiz name', async () => {
  const directory = path.resolve('public/data/extracts/amsterdam');
  const bridges = new Set((JSON.parse(await readFile(path.join(directory, 'bridges.json'), 'utf8')) as Array<{ name?: string }>).flatMap(b => (b.name ? [b.name.toLowerCase()] : [])));
  const graph = await loadSnapGraph(directory, bridges);
  const names = new Set<string>();
  for (const file of ['water.json', 'bridges.json']) {
    for (const item of JSON.parse(await readFile(path.join(directory, file), 'utf8')) as Array<{ name?: string }>) if (item.name) names.add(item.name.toLowerCase());
  }
  for (const feature of graph.features as Array<{ name?: string }>) if (feature.name) names.add(feature.name.toLowerCase());
  const failures = DAILY_RIDE_POOL.flatMap((place) => {
    const why = place.startOk ? graph.whyNotSnap([place.lat, place.lng]) : place.finishOk ? graph.whyNotFinish([place.lat, place.lng]) : 'neither a start nor a finish';
    const named = names.has(place.name.toLowerCase()) ? `card name "${place.name}" is a quiz name` : '';
    return [why, named].filter(Boolean).map(reason => `${place.id}: ${reason}`);
  });
  assert.deepEqual(failures, []);
  assert.ok(DAILY_RIDE_POOL.length >= 50, `pool ${DAILY_RIDE_POOL.length}`);
});

test('a finish on a named way never prints that way: card, landing, arrival blurb, share, route id (#279 ruling)', async () => {
  const directory = path.resolve('public/data/extracts/amsterdam');
  const graph = await loadSnapGraph(directory);
  const finishOnNamed = DAILY_RIDE_POOL.filter(place => place.finishOk && graph.namesAt([place.lat, place.lng]).length > 0);
  assert.ok(finishOnNamed.length > 0, 'the pool has finishes on named ways');
  for (const place of DAILY_RIDE_POOL) {
    if (!place.startOk) continue;
    assert.deepEqual(graph.namesAt([place.lat, place.lng]), [], `start ${place.id} is on a named way`);
  }
  const start = DAILY_RIDE_POOL.find(place => place.startOk)!;
  const base = buildLandingModel(landingFixtureStorage('returning'), LANDING_FIXTURE_NOW);
  for (const place of finishOnNamed) {
    const wayNames = graph.namesAt([place.lat, place.lng]);
    const to = { ...place, buurtPlace: true as const };
    const from = { ...start, buurtPlace: true as const };
    const pair: DailyRidePair = { date: DAILY_POOL_CUTOVER, id: `${DAILY_POOL_CUTOVER}:${from.id}>${to.id}`, from, to, km: dailyRideKm(from, to) };
    const html = landingCardsHtml({ ...base, daily: { ...base.daily, pair } }, { ride: './' });
    const blurb = buurtFinishBlurb(to, [{ name: place.name, wikipediaExtract: '' }]);
    const share = buildRouteShare({
      origin: 'https://rideamsterdam.nl', pathname: '/ride', travelMode: 'car',
      race: { centre: { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 }, start: { lat: from.lat, lng: from.lng }, finish: { lat: to.lat, lng: to.lng } },
      from, to,
    });
    const exposed = [pair.id, dailyRideLabel(pair), html, blurb?.name ?? '', JSON.stringify(share), to.name].join('\n').toLowerCase();
    for (const way of wayNames) {
      assert.ok(!exposed.includes(way.toLowerCase()), `finish ${place.id} prints its way "${way}"`);
    }
    assert.equal(blurb?.name, place.name, 'the arrival card is titled by the buurt');
  }
  console.log(`# ${finishOnNamed.length} finishes on named ways, none printed`);
});

test('every bundled pair has a route length within the bounds, between different buurten, rideable one way', async () => {
  assert.equal(DAILY_RIDE_PAIRS.length % 6, 0);
  const lengths = JSON.parse(await readFile(path.resolve('scripts/daily-ride/route-lengths.json'), 'utf8')) as Record<string, number>;
  const key = (p: { id: string; lat: number; lng: number }) => `${p.id}@${p.lat},${p.lng}`;
  let pairs = 0;
  for (let k = 0; k < DAILY_RIDE_PAIRS.length; k += 6, pairs++) {
    const a = DAILY_RIDE_POOL[parseInt(DAILY_RIDE_PAIRS.slice(k, k + 2), 36)]!;
    const b = DAILY_RIDE_POOL[parseInt(DAILY_RIDE_PAIRS.slice(k + 2, k + 4), 36)]!;
    const km = parseInt(DAILY_RIDE_PAIRS.slice(k + 4, k + 6), 36) / 10;
    assert.ok(km >= DAILY_RIDE_MIN_KM && km <= DAILY_RIDE_MAX_KM, `${a.id}–${b.id} ${km} km`);
    assert.notEqual(a.buurt, b.buurt);
    assert.ok((a.startOk && b.finishOk) || (b.startOk && a.finishOk), `${a.id}–${b.id} is rideable`);
    const metres = lengths[[key(a), key(b)].sort().join('>')];
    assert.ok(metres !== undefined, `${a.id}–${b.id} has a cached length`);
    assert.equal(km, Math.round(metres! / 100) / 10);
    assert.equal(dailyRouteKm(b.id, a.id), km);
  }
  assert.ok(pairs > 1000, `bundled pairs ${pairs}`);
});
