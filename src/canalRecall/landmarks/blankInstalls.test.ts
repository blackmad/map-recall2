import test from 'node:test';
import assert from 'node:assert/strict';
import { BLANK_INSTALLS, BLANK_INSTALL_MAX_GLASS_SHARE, bareFrontsEnabled, installDraws } from './blankInstalls';
import { ORDINARY_BUILDINGS } from './ordinaryModels';

// Lane R5-D (#264): the user's three flat blocks of 2026-11-08 are blank installs that yield to the generic facade.
const USER_SPOTS = ['ordinary-0363100012137990', 'ordinary-0363100012120309', 'ordinary-0363100012165748'];

test('the three user spots are listed, each under the measured glass threshold and in the catalogue', () => {
  for (const id of USER_SPOTS) assert.ok(id in BLANK_INSTALLS, id);
  for (const [id, share] of Object.entries(BLANK_INSTALLS)) {
    assert.ok(share < BLANK_INSTALL_MAX_GLASS_SHARE, `${id} ${share}`);
    assert.ok(ORDINARY_BUILDINGS.some(m => m.id === id), `${id} is not a catalogue install`);
  }
});

test('the flag: on in a browser by default, ?bareFronts=0 and the window switch turn it off, Node keeps it off', () => {
  assert.equal(bareFrontsEnabled('', {}), true);
  assert.equal(bareFrontsEnabled('?bareFronts=0', {}), false);
  assert.equal(bareFrontsEnabled('?bareFronts=1', { __canalRecallBareFronts: false }), true);
  assert.equal(bareFrontsEnabled('', { __canalRecallBareFronts: false }), false);
  assert.equal(bareFrontsEnabled('', null), false);
  assert.equal(bareFrontsEnabled(), false, 'Node scripts see every install');
});

test('installDraws drops only listed installs and only with the flag on', () => {
  assert.equal(installDraws(USER_SPOTS[0], true), false);
  assert.equal(installDraws(USER_SPOTS[0], false), true);
  assert.equal(installDraws('ordinary-0363100012170734', true), true);
});
