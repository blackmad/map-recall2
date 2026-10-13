import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StreetFeature } from '../types';
import {
  type DailyRecord, EMPTY_DAILY, amsterdamDay, completeDaily, currentStreak, daysBetween, doneToday, formatDay, readDaily, selectDailyFive, writeDaily,
} from './dailyFive';

test('the day is Amsterdam’s calendar day', () => {
  // 23:30 UTC on 12 Oct is 01:30 on 13 Oct in Amsterdam (CEST).
  assert.equal(amsterdamDay(Date.UTC(2026, 9, 12, 23, 30)), '2026-10-13');
  assert.equal(amsterdamDay(Date.UTC(2026, 9, 12, 21, 30)), '2026-10-12');
  assert.equal(formatDay('2026-10-13'), 'Tue 13 Oct');
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
});

test('consecutive days grow the streak', () => {
  let record = completeDaily(EMPTY_DAILY, '2026-10-10');
  record = completeDaily(record, '2026-10-11');
  record = completeDaily(record, '2026-10-12');
  assert.deepEqual(record, { lastDay: '2026-10-12', streak: 3, best: 3 });
  assert.equal(currentStreak(record, '2026-10-13'), 3, 'alive the next day before playing');
  assert.equal(doneToday(record, '2026-10-12'), true);
});

test('a gap restarts the streak and keeps the best', () => {
  let record: DailyRecord = { lastDay: '2026-10-05', streak: 4, best: 4 };
  assert.equal(currentStreak(record, '2026-10-08'), 0);
  record = completeDaily(record, '2026-10-08');
  assert.deepEqual(record, { lastDay: '2026-10-08', streak: 1, best: 4 });
});

test('the same day twice counts once', () => {
  const once = completeDaily(EMPTY_DAILY, '2026-10-13');
  assert.equal(completeDaily(once, '2026-10-13'), once);
  assert.equal(once.streak, 1);
});

test('storage round-trips and ignores junk', () => {
  const store = new Map<string, string>();
  const adapter = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) };
  assert.deepEqual(readDaily(adapter), EMPTY_DAILY);
  writeDaily(adapter, { lastDay: '2026-10-13', streak: 2, best: 5 });
  assert.deepEqual(readDaily(adapter), { lastDay: '2026-10-13', streak: 2, best: 5 });
  store.set('mapRecall.daily.v1', '{"lastDay":"yesterday","streak":"x"}');
  assert.deepEqual(readDaily(adapter), EMPTY_DAILY);
  assert.deepEqual(readDaily(null), EMPTY_DAILY);
});

const feature = (index: number, type: StreetFeature['type'], metresNorth: number): StreetFeature => ({
  id: `f${index}`, name: `F${index}`, type, cityId: 'amsterdam', center: [52.37 + metresNorth / 111_320, 4.9], difficulty: 'medium', clues: [], distractors: [], funFact: '', prominenceScore: index,
} as StreetFeature);

test('today’s five: stable for the day, near the origin, mixed', () => {
  const types: StreetFeature['type'][] = ['street', 'canal', 'bridge', 'square', 'park'];
  const features = Array.from({ length: 60 }, (_, index) => feature(index, types[index % types.length], index < 40 ? index * 30 : 9000 + index));
  const today = selectDailyFive(features, [52.37, 4.9], '2026-10-13');
  assert.equal(today.length, 5);
  assert.deepEqual(selectDailyFive(features, [52.37, 4.9], '2026-10-13'), today);
  assert.notDeepEqual(selectDailyFive(features, [52.37, 4.9], '2026-10-14').map(({ id }) => id), today.map(({ id }) => id));
  for (const item of today) assert.ok(item.center[0] < 52.37 + 1500 / 111_320, `${item.name} is within the first ring`);
  const counts = new Map<string, number>();
  for (const item of today) counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
  assert.ok(Math.max(...counts.values()) <= 2);
});
