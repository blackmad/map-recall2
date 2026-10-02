import assert from 'node:assert/strict';
import {
  BUILDING_LOOKS,
  BUILDING_LOOK_LABELS,
  PREFERENCES_STORAGE_KEY,
  nextBuildingLook,
  ZOOM_DEFAULT_VERSION,
  applyDifficulty,
  coercePreferences,
  defaultPreferences,
  parsePreferences,
  readPreferences,
  writePreferences,
  type CanalPreferences,
} from '../src/canalRecall/game/preferences.ts';

const zoom = { min: 0.2, max: 1.5, defaultZoom: 0.65 };

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
  // Sound is permanently disabled: even an explicit saved `true` must not enable it.
  assert.equal(parsePreferences(JSON.stringify({ sound: true }), zoom).sound, false);
  assert.equal(prefs.zoom, 0.65);
  assert.equal(prefs.cameraTilt, 0);
}

{
  const prefs = parsePreferences({ cameraTilt: 12 }, zoom);
  assert.equal(prefs.cameraTilt, 12);
  const clamped = parsePreferences({ cameraTilt: 99 }, zoom);
  assert.equal(clamped.cameraTilt, 36);
}

{
  const prefs = parsePreferences({ cameraBearing: 225 }, zoom);
  assert.equal(prefs.cameraBearing, -135);
  assert.equal(parsePreferences({ cameraBearing: Number.NaN }, zoom).cameraBearing, 0);
}

{
  const prefs = parsePreferences({ travelMode: 'transit' }, zoom);
  assert.equal(prefs.travelMode, 'transit', 'transit travel mode parses');
}

{
  const prefs = parsePreferences({ routePattern: 'here' }, zoom);
  assert.equal(prefs.routePattern, 'here');
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
  // Map style, Detailed 3D and Photoreal left settings on 2026-09-28; a
  // value saved before then must not lock a player into it.
  const retired = parsePreferences({ themeMode: '8bit', detailed3d: true, googleTiles: true }, zoom);
  assert.equal(retired.themeMode, 'clean');
  assert.equal(retired.detailed3d, false);
  assert.equal(retired.googleTiles, false);
}

{
  const migrated = parsePreferences({ zoom: 1.2 }, zoom);
  assert.equal(migrated.zoom, 0.65, 'a zoom saved without a version flag becomes the default');
  const halfZoom = parsePreferences({ zoom: 0.5, zoomDefaultVersion: 3 }, zoom);
  assert.equal(halfZoom.zoom, 0.65, 'v4 resets the 50% default, which framed the whole route, to 65%');
  const kept = parsePreferences({ zoom: 0.9, zoomDefaultVersion: ZOOM_DEFAULT_VERSION }, zoom);
  assert.equal(kept.zoom, 0.9, 'a zoom saved since v4 is kept');
  assert.equal(parsePreferences({ routePattern: 'study' }, zoom).routePattern, 'surprise', 'the retired study choice is not restored from a save');
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

// B cycles the building look in settings order and wraps; every look has a label.
{
  let look: string = BUILDING_LOOKS[0];
  const seen: string[] = [look];
  for (let i = 0; i < BUILDING_LOOKS.length; i++) { look = nextBuildingLook(look); seen.push(look); }
  assert.deepEqual(seen, [...BUILDING_LOOKS, BUILDING_LOOKS[0]], 'one full turn visits every look in order and returns to the start');
  assert.equal(nextBuildingLook('untextured'), 'photo', 'wraps from the last look');
  assert.equal(nextBuildingLook('nonsense'), 'photo', 'an unknown look starts again at the first');
  assert.equal(nextBuildingLook(undefined), 'photo');
  // The retired 'default' pattern look is not offered; a saved one reads as Photo, the new default.
  assert.ok(!(BUILDING_LOOKS as readonly string[]).includes('default'));
  assert.equal(parsePreferences({ buildingLook: 'default' }, zoom).buildingLook, 'photo');
  assert.equal(parsePreferences({}, zoom).buildingLook, 'photo');
  for (const look of BUILDING_LOOKS) assert.ok(BUILDING_LOOK_LABELS[look], `${look} has a label`);
}

console.log('canal preferences: checks passed');

// Sound is permanently disabled: nothing under src/ or the legacy runtime may construct an AudioContext.
{
  const { execSync } = await import('node:child_process');
  const hits = execSync(
    "grep -rlE 'AudioContext' src public/canal-drive/js/sound.js public/canal-drive/js/game.js public/canal-drive/js/game-route.js || true",
    { encoding: 'utf8' },
  ).trim();
  assert.equal(hits, '', `AudioContext must not appear: ${hits}`);
}
