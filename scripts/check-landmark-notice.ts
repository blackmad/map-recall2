// How long a landmark card stays up. Previously one countdown served three
// different intentions, which is why a drive-by card expired while the player
// was still approaching the thing it described.

import assert from 'node:assert/strict';

import {
  advanceNotice,
  openNotice,
  DEFAULT_NOTICE_CONFIG,
  type NoticeConfig,
  type NoticeHold,
  type NoticeState,
} from '../src/canalRecall/game/landmarkNotice';
import type { WorldPoint } from '../src/canalRecall/game/worldTypes';

const checks: string[] = [];
function check(name: string, run: () => void): void {
  run();
  checks.push(name);
}

const CONFIG: NoticeConfig = { exitRadius: 480, minSeconds: 6, fadeSeconds: 0.8 };
const ANCHOR: WorldPoint = { x: 0, y: 0 };

/** Run frames at 60 fps, moving the player as a function of elapsed time. */
function run(
  hold: NoticeHold,
  seconds: number,
  positionAt: (t: number) => WorldPoint | null,
  state: NoticeState = openNotice(),
): { state: NoticeState; alpha: number; visible: boolean } {
  const dt = 1 / 60;
  let current = { state, alpha: 0, visible: true };
  for (let t = 0; t < seconds; t += dt) {
    current = advanceNotice(current.state, hold, positionAt(t + dt), dt, CONFIG);
    if (!current.visible) break;
  }
  return current;
}

const parked = (): WorldPoint => ({ x: 0, y: 0 });

check('a proximity card stays while the player is still near it', () => {
  // The reported bug: six seconds beside a church you are still approaching.
  const after = run({ kind: 'proximity', anchor: ANCHOR }, 30, parked);
  assert.equal(after.visible, true, 'thirty seconds parked beside a landmark and the card is still up');
  assert.equal(after.alpha, 1, 'and fully opaque, not mid-fade');
});

check('a proximity card fades once the player leaves', () => {
  // Sit for two seconds, then drive away past the exit radius.
  const leaving = (t: number): WorldPoint => ({ x: t < 2 ? 0 : 2000, y: 0 });
  const after = run({ kind: 'proximity', anchor: ANCHOR }, 30, leaving);
  assert.equal(after.visible, false, 'the card is dropped after the player has gone');
});

check('passing at speed still leaves the card readable', () => {
  // Never within the exit radius at all: the minimum dwell is what makes a
  // fast pass legible instead of a flash.
  const flyPast = (): WorldPoint => ({ x: 5000, y: 0 });
  const early = run({ kind: 'proximity', anchor: ANCHOR }, 3, flyPast);
  assert.equal(early.visible, true, 'still up three seconds after the player has gone');
  assert.ok(early.alpha > 0.9, 'and readable, not fading');

  const later = run({ kind: 'proximity', anchor: ANCHOR }, 20, flyPast);
  assert.equal(later.visible, false, 'but it does eventually go');
});

check('driving along the boundary does not flicker the card', () => {
  // Entry is 300 px; the card is held out to 480. Hovering between the two
  // must not reopen and reclose it.
  const onTheEdge = (t: number): WorldPoint => ({ x: 380 + Math.sin(t * 10) * 60, y: 0 });
  const after = run({ kind: 'proximity', anchor: ANCHOR }, 30, onTheEdge);
  assert.equal(after.visible, true, 'the exit radius is wider than the entry radius for exactly this reason');
  assert.ok(DEFAULT_NOTICE_CONFIG.exitRadius > 300,
    'the shipped exit radius must stay wider than the 300 px that opens a card');
});

check('a proximity card is held while there is no vehicle', () => {
  // Loading, or the finish screen. "Nobody is nearby" is not "the player left".
  const after = run({ kind: 'proximity', anchor: ANCHOR }, 30, () => null);
  assert.equal(after.visible, true);
});

check('a clicked card is timed, because a click says nothing about distance', () => {
  const faraway = (): WorldPoint => ({ x: 100_000, y: 0 });
  const early = run({ kind: 'timed', seconds: 8 }, 5, faraway);
  assert.equal(early.visible, true, 'a click on a distant building still gets its full read');
  assert.equal(early.alpha, 1);

  const after = run({ kind: 'timed', seconds: 8 }, 20, faraway);
  assert.equal(after.visible, false);
});

check('a sticky card stays until something replaces it', () => {
  // The arrival card on the finish screen, which used to be `timer = 3600`.
  const after = run({ kind: 'sticky' }, 120, () => null);
  assert.equal(after.visible, true);
  assert.equal(after.alpha, 1);
});

check('every card fades in rather than appearing', () => {
  const dt = 1 / 60;
  const first = advanceNotice(openNotice(), { kind: 'sticky' }, null, dt, CONFIG);
  assert.ok(first.alpha > 0 && first.alpha < 0.1, `expected a faint first frame, got ${first.alpha}`);
  const half = run({ kind: 'sticky' }, CONFIG.fadeSeconds / 2, () => null);
  assert.ok(half.alpha > 0.4 && half.alpha < 0.7, `expected mid-fade, got ${half.alpha}`);
});

check('alpha never leaves 0..1', () => {
  const leaving = (t: number): WorldPoint => ({ x: t < 1 ? 0 : 9000, y: 0 });
  let current = { state: openNotice(), alpha: 0, visible: true };
  const hold: NoticeHold = { kind: 'proximity', anchor: ANCHOR };
  for (let t = 0; t < 20; t += 1 / 60) {
    current = advanceNotice(current.state, hold, leaving(t), 1 / 60, CONFIG);
    assert.ok(current.alpha >= 0 && current.alpha <= 1, `alpha out of range: ${current.alpha}`);
    if (!current.visible) break;
  }
});

check('a long frame cannot skip a card past its fade', () => {
  // A tab regaining focus delivers one enormous dt.
  const after = advanceNotice(openNotice(), { kind: 'timed', seconds: 8 }, null, 30, CONFIG);
  assert.equal(after.visible, false, 'the card is dropped rather than left up at a stale alpha');
  assert.equal(after.alpha, 0);
});

console.log(`Landmark notice OK: ${checks.length} checks.`);
for (const name of checks) console.log(`  · ${name}`);
