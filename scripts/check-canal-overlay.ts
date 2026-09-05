import assert from 'node:assert/strict';
import { defaultPreferences, patchLivePreferences } from '../src/canalRecall/game/preferences.ts';
import { createOverlayStore } from '../src/canalRecall/overlay/store.ts';

const zoom = { min: 0.2, max: 1.5, defaultZoom: 0.5 };

{
  const easy = patchLivePreferences(defaultPreferences(zoom), { difficulty: 'easy' }, zoom);
  assert.equal(easy.difficulty, 'easy');
  assert.equal(easy.line, true);
  const custom = patchLivePreferences(easy, { line: false }, zoom);
  assert.equal(custom.difficulty, 'custom');
  assert.equal(custom.line, false);
}

{
  const store = createOverlayStore(defaultPreferences(zoom));
  store.patchPrefs({ travelMode: 'car', routePattern: 'home', homeAddress: 'Da Costakade' }, zoom);
  assert.equal(store.getState().prefs.travelMode, 'car');
  assert.equal(store.getState().prefs.homeAddress, 'Da Costakade');
  store.patchPrefs({ travelMode: 'transit' }, zoom);
  assert.equal(store.getState().prefs.travelMode, 'transit');
  store.setSetupOpen(false);
  store.setSettingsOpen(true);
  assert.equal(store.getState().setupOpen, false);
  assert.equal(store.getState().settingsOpen, true);
  store.setAccount({ visible: true, label: 'Ada', buttonLabel: 'Sign out' });
  assert.equal(store.getState().account.visible, true);
  assert.equal(store.getState().account.label, 'Ada');
}

console.log('canal overlay store: checks passed');
