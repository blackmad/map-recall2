import assert from 'node:assert/strict';
import {
  LEGACY_ZOOM_DEFAULT,
  PREFERENCES_STORAGE_KEY,
  ZOOM_DEFAULT_VERSION,
  applyDifficulty,
  coercePreferences,
  defaultPreferences,
  parsePreferences,
  readPreferences,
  writePreferences,
  type CanalPreferences,
} from '../src/canalRecall/game/preferences.ts';

const zoom = { min: 0.2, max: 1.5, defaultZoom: 0.5 };

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    data,
  };
};

{
  const prefs = parsePreferences(null, zoom);
  assert.equal(prefs.difficulty, 'medium');
  assert.equal(prefs.answerMode, 'multiple');
  assert.equal(prefs.line, false);
  assert.equal(prefs.arrow, true);
  assert.equal(prefs.gamey, true);
  assert.equal(prefs.sound, false);
  assert.equal(prefs.zoom, 0.5);
}

{
  const prefs = parsePreferences({ travelMode: 'transit' }, zoom);
  assert.equal(prefs.travelMode, 'transit', 'transit travel mode parses');
}

{
  const prefs = parsePreferences({ difficulty: 'nope', travelMode: 'hovercraft' }, zoom);
  assert.equal(prefs.difficulty, 'medium', 'unknown difficulty falls back');
  assert.equal(prefs.travelMode, 'boat', 'unknown travel mode falls back');
}

{
  const prefs = parsePreferences({ difficulty: 'easy' }, zoom);
  assert.equal(prefs.line, true, 'easy turns the route line on');
  assert.equal(prefs.answerMode, 'multiple');
}

{
  const prefs = parsePreferences({
    difficulty: 'medium', answerMode: 'typing', line: true,
  }, zoom);
  assert.equal(prefs.answerMode, 'typing', 'saved answer mode overlays the preset');
  assert.equal(prefs.line, true, 'saved assist overlays the preset');
}

{
  const prefs = parsePreferences({
    difficulty: 'custom', answerMode: 'typing', line: true, arrow: false, minimap: false,
  }, zoom);
  assert.equal(prefs.difficulty, 'custom');
  assert.equal(prefs.answerMode, 'typing');
  assert.equal(prefs.line, true);
  assert.equal(prefs.minimap, false);
}

{
  const migrated = parsePreferences({ zoom: LEGACY_ZOOM_DEFAULT }, zoom);
  assert.equal(migrated.zoom, 0.5, 'legacy 0.65 without a version flag becomes 0.50');
  const kept = parsePreferences({ zoom: LEGACY_ZOOM_DEFAULT, zoomDefaultVersion: 2 }, zoom);
  assert.equal(kept.zoom, LEGACY_ZOOM_DEFAULT, 'an explicit post-migration 0.65 is kept');
}

{
  const prefs = parsePreferences({ bikeSkin: 'pink' }, zoom);
  assert.equal(prefs.bikeSkin, 'pink');
  const mama = parsePreferences({ bikeSkin: 'mama', bikeBabySeat: true }, zoom);
  assert.equal(mama.bikeSkin, 'mama');
  assert.equal(mama.bikeBabySeat, true);
  const bad = parsePreferences({ bikeSkin: 'unicycle' }, zoom);
  assert.equal(bad.bikeSkin, 'omafiets', 'unknown bike skin falls back');
  assert.equal(prefs.bikeBabySeat, false);
  const withSeat = parsePreferences({ bikeBabySeat: true }, zoom);
  assert.equal(withSeat.bikeBabySeat, true);
}


{
  const store = memory();
  assert.deepEqual(readPreferences(store, zoom), defaultPreferences(zoom));
  const next: CanalPreferences = {
    ...defaultPreferences(zoom),
    difficulty: 'hard',
    answerMode: 'typing',
    line: false,
    arrow: true,
    minimap: false,
    homeAddress: 'Prinsengracht 263',
  };
  writePreferences(store, next);
  assert.ok(store.data.has(PREFERENCES_STORAGE_KEY));
  const roundTrip = readPreferences(store, zoom);
  assert.equal(roundTrip.difficulty, 'hard');
  assert.equal(roundTrip.homeAddress, 'Prinsengracht 263');
  assert.equal(roundTrip.zoomDefaultVersion, ZOOM_DEFAULT_VERSION);
}

{
  const store = memory();
  store.setItem(PREFERENCES_STORAGE_KEY, '{not json');
  assert.deepEqual(readPreferences(store, zoom), defaultPreferences(zoom));
}

{
  const easy = applyDifficulty(defaultPreferences(zoom), 'expert');
  assert.equal(easy.difficulty, 'expert');
  assert.equal(easy.answerMode, 'typing');
  assert.equal(easy.minimap, false);
  const custom = applyDifficulty(easy, 'custom');
  assert.equal(custom.difficulty, 'custom');
  assert.equal(custom.answerMode, 'typing', 'custom keeps the previous assist choices');
}

{
  const live = coercePreferences({
    difficulty: 'medium', answerMode: 'typing', line: true, arrow: false, minimap: false,
  }, zoom);
  assert.equal(live.difficulty, 'medium');
  assert.equal(live.answerMode, 'typing');
  assert.equal(live.line, true);
  assert.equal(live.arrow, false);
}

{
  assert.equal(defaultPreferences(zoom).cityId, 'amsterdam');
  assert.equal(parsePreferences({ cityId: 'utrecht' }, zoom).cityId, 'utrecht');
  assert.equal(parsePreferences({ cityId: 'den-haag' }, zoom).cityId, 'den-haag');
  assert.equal(parsePreferences({ cityId: 'paris' }, zoom).cityId, 'amsterdam');
  assert.equal(parsePreferences({}, zoom).cityId, 'amsterdam');
}

console.log('canal preferences: checks passed');
