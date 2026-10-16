import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UTILITY_STATES as S, revealOnEnter, utilityVisibility } from './utilityTuck.ts';

test('riding and the flight tuck; menus, pause, setup and open panels keep the utilities', () => {
  assert.equal(utilityVisibility({ state: S.RACING, utilityOpen: false }), 'tuckable');
  // The pause card is a menu: the utilities stay up.
  assert.equal(utilityVisibility({ state: S.PAUSED, utilityOpen: false }), 'shown');
  assert.equal(utilityVisibility({ state: S.RACING, utilityOpen: true }), 'shown');
  assert.equal(utilityVisibility({ state: S.MENU, utilityOpen: false }), 'shown');
  assert.equal(utilityVisibility({ state: S.MAP_SELECT, utilityOpen: false }), 'shown');
  assert.equal(utilityVisibility({ state: S.LOADING, utilityOpen: false }), 'none');
  assert.equal(utilityVisibility({ state: S.FINISHED, utilityOpen: true }), 'none');
});

test('a ride on the bike opens with a reveal; the overview flight does not', () => {
  assert.equal(revealOnEnter(true, false), true);
  assert.equal(revealOnEnter(true, true), false);
  assert.equal(revealOnEnter(false, false), false);
});
