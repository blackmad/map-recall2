import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUTE_HISTORY_CAP, ROUTE_HISTORY_KEY, appendRide, createRideRecord, dayStreak, loadRouteHistory,
  mergeHistories, raceHashFromShareUrl, rideAgainHref, rideMinutes, rideModeFor, saveRouteHistory,
  summarizeRides, toCloudDoc, type RideRecord,
} from './routeHistory.ts';

const memory = () => {
  const map = new Map<string, string>();
  return { map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); } };
};

const share = 'http://x/ride#race=52.3737,4.8816,52.3728,4.8737,52.3757,4.8898';

const ride = (id: string, endedAt: number, extra: Partial<Parameters<typeof createRideRecord>[0]> = {}): RideRecord => createRideRecord({
  id, endedAt, startedAt: endedAt - 300_000, travelMode: 'car', cityId: 'amsterdam',
  from: { id: 'a', name: 'Westerkerk', lat: 52.3747, lng: 4.8838 },
  to: { id: 'poi-9', name: 'Anne Frank House', lat: 52.3752, lng: 4.8840 },
  namedCount: 3, askedCount: 4, points: 120, streetsLearned: ['Prinsengracht', 'prinsengracht', 'Bloemgracht'],
  shareUrl: share, ...extra,
});

test('a finished ride becomes a bounded, typed record', () => {
  const r = ride('r1', 1_700_000_000_000);
  assert.equal(r.mode, 'bike', 'street mode is cycling in the presentation');
  assert.deepEqual(r.start, { name: 'Westerkerk', lngLat: [4.8838, 52.3747] });
  assert.deepEqual(r.finish, { name: 'Anne Frank House', landmarkId: 'poi-9', lngLat: [4.884, 52.3752] });
  assert.deepEqual(r.streetsLearned, ['Prinsengracht', 'Bloemgracht'], 'deduplicated case-insensitively');
  assert.equal(r.raceHash, '#race=52.3737,4.8816,52.3728,4.8737,52.3757,4.8898');
  assert.equal(rideMinutes(r), 5);
  const odd = createRideRecord({ endedAt: 10, startedAt: 99, namedCount: 9, askedCount: 2, from: null, to: { name: '' } });
  assert.equal(odd.startedAt, 10, 'start never after end');
  assert.equal(odd.namedCount, 2, 'cannot name more than were asked');
  assert.equal(odd.start.name, 'Start');
  assert.equal(odd.finish.landmarkId, null);
  assert.match(odd.id, /^ride-/);
  assert.equal(rideModeFor('boat'), 'boat');
  assert.equal(rideModeFor('transit'), 'transit');
});

test('history is newest first, deduplicated, capped and survives broken storage', () => {
  const store = memory();
  for (let i = 0; i < ROUTE_HISTORY_CAP + 5; i++) appendRide(store, ride(`r${i}`, 1_000 + i));
  const list = loadRouteHistory(store);
  assert.equal(list.length, ROUTE_HISTORY_CAP);
  assert.equal(list[0].id, `r${ROUTE_HISTORY_CAP + 4}`);
  appendRide(store, ride('r10', 9_999_999));
  assert.equal(loadRouteHistory(store).filter(r => r.id === 'r10').length, 1);
  store.map.set(ROUTE_HISTORY_KEY, '{nope');
  assert.deepEqual(loadRouteHistory(store), []);
  store.map.set(ROUTE_HISTORY_KEY, JSON.stringify([{ id: 'x' }, ride('ok', 5)]));
  assert.deepEqual(loadRouteHistory(store).map(r => r.id), ['ok'], 'malformed entries dropped');
  const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.deepEqual(loadRouteHistory(throwing), []);
  assert.equal(saveRouteHistory(throwing, [ride('a', 1)]), false);
  assert.doesNotThrow(() => appendRide(throwing, ride('a', 1)));
  assert.deepEqual(loadRouteHistory(null), []);
});

test('cloud merge uploads only what the cloud is missing', () => {
  const local = [ride('a', 3), ride('b', 2)];
  const cloud = [toCloudDoc(ride('b', 2)), toCloudDoc(ride('c', 1)), { junk: true }];
  const { merged, upload } = mergeHistories(local, cloud);
  assert.deepEqual(merged.map(r => r.id), ['a', 'b', 'c']);
  assert.deepEqual(upload.map(r => r.id), ['a']);
  assert.equal(Object.values(toCloudDoc(ride('d', 1))).includes(undefined), false);
});

test('ride again reuses the share-link hash and the travel param the ride reads', () => {
  assert.equal(rideAgainHref(ride('a', 1), '/ride'), '/ride?travel=car#race=52.3737,4.8816,52.3728,4.8737,52.3757,4.8898');
  assert.equal(rideAgainHref(ride('a', 1, { travelMode: 'boat' }), '/canal-drive/'), '/canal-drive/?travel=boat#race=52.3737,4.8816,52.3728,4.8737,52.3757,4.8898');
  assert.equal(rideAgainHref(ride('a', 1, { shareUrl: null }), '/ride'), null);
  assert.equal(raceHashFromShareUrl('http://x/#race=1,2,3'), '', 'incomplete hash rejected');
  assert.equal(raceHashFromShareUrl('http://x/#race=1,2,3,4,5,javascript:1'), '');
});

test('day streak counts back from today, or from yesterday before today’s ride', () => {
  const now = new Date(2026, 9, 17, 15).getTime();
  const day = (offset: number) => new Date(2026, 9, 17 - offset, 10).getTime();
  assert.equal(dayStreak([], now), 0);
  assert.equal(dayStreak([day(0), day(1), day(2), day(4)], now), 3);
  assert.equal(dayStreak([day(1), day(2)], now), 2, 'yesterday still counts');
  assert.equal(dayStreak([day(2)], now), 0);
  assert.equal(dayStreak([day(0), day(0)], now), 1);
});

test('summary totals rides and distinct names', () => {
  const s = summarizeRides([ride('a', 2), ride('b', 1, { streetsLearned: ['Bloemgracht', 'Leidsegracht'] })]);
  assert.deepEqual(s, { rides: 2, named: 6, asked: 8, namesOnRides: 3 });
});
