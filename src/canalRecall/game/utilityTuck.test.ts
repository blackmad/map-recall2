import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UTILITY_STATES as S, revealOnEnter, utilityBlockedByCards, utilityVisibility } from './utilityTuck.ts';

test('regression: Report a problem / settings / help never reveal over the 390×844 question card (teaser 2026-10-22)', () => {
  // Measured at 390×844 before the fix: the cluster sat inside the card's bottom-right.
  const card = { left: 12, top: 548, right: 378, bottom: 832 };
  const iphone = [
    { left: 280, top: 732, right: 380, bottom: 778 }, // Report a problem
    { left: 280, top: 786, right: 326, bottom: 832 }, // settings
    { left: 334, top: 786, right: 380, bottom: 832 }, // help
  ];
  assert.equal(utilityBlockedByCards(iphone, [card]), true);
  // 360×740 Android, measured.
  assert.equal(utilityBlockedByCards([{ left: 250, top: 628, right: 350, bottom: 674 }], [{ left: 12, top: 444, right: 348, bottom: 728 }]), true);
  // A desktop card docked right, mid-height, clear of the bottom-right corner.
  assert.equal(utilityBlockedByCards([{ left: 1040, top: 744, right: 1268, bottom: 790 }], [{ left: 880, top: 240, right: 1252, bottom: 560 }]), false);
  // Within the clearance counts as touching.
  assert.equal(utilityBlockedByCards([{ left: 0, top: 104, right: 10, bottom: 110 }], [{ left: 0, top: 0, right: 10, bottom: 100 }]), true);
  // No card, or a hidden (zero-size) one, never blocks.
  assert.equal(utilityBlockedByCards(iphone, [null, { left: 0, top: 0, right: 0, bottom: 0 }]), false);
});

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
