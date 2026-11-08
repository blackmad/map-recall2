import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyRideBoard,
  dailyRideDateKey,
  dailyRideLabel,
  dailyRidePair,
  dailyRideRouteId,
  formatRideTime,
  seededUnit,
} from './dailyRide';
import { CANAL_CITIES } from './cities';
import { createRideRecord, type RideRecord } from '../routeHistory';
import * as routeSelection from './routeSelection';

const pois = CANAL_CITIES.amsterdam.curatedPois.map(poi => ({ ...poi }));

test('the date key is Amsterdam’s calendar day', () => {
  // 23:30 UTC on 8 Nov is 00:30 on 9 Nov in Amsterdam (CET, UTC+1).
  assert.equal(dailyRideDateKey(Date.UTC(2026, 10, 8, 23, 30)), '2026-11-09');
  assert.equal(dailyRideDateKey(Date.UTC(2026, 10, 8, 22, 30)), '2026-11-08');
  // Summer time, UTC+2.
  assert.equal(dailyRideDateKey(Date.UTC(2026, 6, 1, 22, 30)), '2026-07-02');
});

test('the seeded unit is deterministic, in [0, 1) and differs by seed', () => {
  const a = seededUnit('x'), b = seededUnit('x'), c = seededUnit('y');
  const seqA = Array.from({ length: 20 }, a);
  assert.deepEqual(seqA, Array.from({ length: 20 }, b));
  assert.notDeepEqual(seqA, Array.from({ length: 20 }, c));
  assert.ok(seqA.every(u => u >= 0 && u < 1));
});

test('today’s pair is a pure function of the date and the candidate set, not its order', () => {
  const pair = dailyRidePair('2026-11-09', pois)!;
  assert.ok(pair);
  assert.notEqual(pair.from.id, pair.to.id);
  assert.equal(dailyRideRouteId('2026-11-09', [...pois].reverse()), pair.id);
  assert.equal(dailyRideRouteId('2026-11-09', pois), pair.id);
  assert.match(pair.id, /^2026-11-09:[a-z-]+>[a-z-]+$/);
  assert.ok(pair.km > 0.2 && pair.km < 8, `km ${pair.km}`);
  assert.equal(dailyRideLabel(pair), `${pair.from.name} → ${pair.to.name} · ${pair.km.toFixed(1)} km`);
  // Math.random plays no part.
  const random = Math.random;
  Math.random = () => 0.999;
  try { assert.equal(dailyRideRouteId('2026-11-09', pois), pair.id); } finally { Math.random = random; }
});

test('a month of days does not ride one pair every day', () => {
  const ids = new Set<string>();
  for (let day = 1; day <= 30; day++) {
    const pair = dailyRidePair(`2026-11-${String(day).padStart(2, '0')}`, pois)!;
    ids.add(`${pair.from.id}>${pair.to.id}`);
  }
  assert.ok(ids.size >= 12, `distinct pairs ${ids.size}`);
});

test('fewer than two candidates have no daily ride', () => {
  assert.equal(dailyRidePair('2026-11-09', pois.slice(0, 1)), null);
  assert.equal(dailyRidePair('2026-11-09', []), null);
});

test('routeSelection exports the same daily pair the ride launches', () => {
  assert.equal(routeSelection.dailyRideRouteId('2026-11-09', pois), dailyRideRouteId('2026-11-09', pois));
});

function ride(date: string, hourUtc: number, seconds: number, named: number, asked: number, pairFor = date): RideRecord {
  const pair = dailyRidePair(pairFor, pois)!;
  const startedAt = Date.parse(`${date}T${String(hourUtc).padStart(2, '0')}:00:00.000Z`);
  return createRideRecord({
    id: `ride-${date}-${hourUtc}-${seconds}`,
    startedAt,
    endedAt: startedAt + seconds * 1000,
    from: pair.from,
    to: pair.to,
    namedCount: named,
    askedCount: asked,
  });
}

test('the board keeps the fastest matching ride per day, newest first, and marks the best', () => {
  const history = [
    ride('2026-11-06', 10, 600, 3, 4),
    ride('2026-11-07', 10, 540, 4, 5),
    ride('2026-11-07', 14, 500, 2, 5),
    ride('2026-11-08', 9, 720, 0, 0),
    // Rode 6 Nov's pair on 8 Nov: not that day's ride.
    ride('2026-11-08', 15, 300, 5, 5, '2026-11-06'),
  ];
  const board = dailyRideBoard(history, pois);
  assert.deepEqual(board.map(d => [d.date, d.seconds, d.recall, d.best]), [
    ['2026-11-08', 720, null, false],
    ['2026-11-07', 500, 40, true],
    ['2026-11-06', 600, 75, false],
  ]);
});

test('ride times read as m:ss or h:mm:ss', () => {
  assert.equal(formatRideTime(65), '1:05');
  assert.equal(formatRideTime(3723), '1:02:03');
  assert.equal(formatRideTime(-4), '0:00');
});
