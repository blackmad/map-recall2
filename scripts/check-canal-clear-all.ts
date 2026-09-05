/**
 * Clear-all helpers wipe prefs / exploration / bests without touching auth.
 */
import assert from 'node:assert/strict';
import {
  clearBestTimes,
  clearExploration,
  clearHomeGeocodeCache,
  emptyExploration,
  EXPLORATION_STORAGE_KEY,
  HOME_GEOCODE_CACHE_KEY,
  LEADERBOARD_STORAGE_KEY,
  readBestTimes,
  readExploration,
  recordBestTime,
  saveExploration,
} from '../src/canalRecall/game/progressStore.ts';
import {
  clearPreferences,
  defaultPreferences,
  PREFERENCES_STORAGE_KEY,
  readPreferences,
  writePreferences,
} from '../src/canalRecall/game/preferences.ts';

const memory = new Map<string, string>();
const store = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
  removeItem: (key: string) => { memory.delete(key); },
};

const zoom = { min: 0.2, max: 1.5, defaultZoom: 0.5 };

writePreferences(store, { ...defaultPreferences(zoom), cityId: 'utrecht', homeAddress: 'Domplein 1' });
saveExploration(store, {
  ...emptyExploration(),
  learnedStreets: ['Nieuwegracht'],
  totalRoutes: 2,
});
recordBestTime(store, 'route-a', { time: 120, date: '2026-09-05', distance: 1.2 });
store.setItem(HOME_GEOCODE_CACHE_KEY, JSON.stringify({ Domplein: [5.12, 52.09] }));

assert.equal(readPreferences(store, zoom).cityId, 'utrecht');
assert.equal(readExploration(store).learnedStreets.length, 1);
assert.ok(readBestTimes(store)['route-a']);

const clearedPrefs = clearPreferences(store, zoom);
assert.equal(clearedPrefs.cityId, defaultPreferences(zoom).cityId);
assert.equal(store.getItem(PREFERENCES_STORAGE_KEY), null);
assert.equal(readPreferences(store, zoom).homeAddress, '');

clearExploration(store);
assert.equal(store.getItem(EXPLORATION_STORAGE_KEY), null);
assert.deepEqual(readExploration(store), emptyExploration());

clearBestTimes(store);
assert.equal(store.getItem(LEADERBOARD_STORAGE_KEY), null);

clearHomeGeocodeCache(store);
assert.equal(store.getItem(HOME_GEOCODE_CACHE_KEY), null);

console.log('Canal clear-all helpers OK: 4 checks.');
