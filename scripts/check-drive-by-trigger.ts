// When a landmark card opens by itself. Named regression: user report
// 2026-09-29, "this card/highlight happens a little late — after I've already
// almost passed it".

import assert from 'node:assert/strict';
import {
  DRIVE_BY_MIN_GAP_SECONDS, DRIVE_BY_RADIUS, PREEMPT_AFTER_SECONDS, approachAlong, driveByGapElapsed, mayReplaceNotice, pathAhead, pickDriveBy,
} from '../src/canalRecall/game/driveByTrigger';

const checks: string[] = [];
function check(name: string, run: () => void): void { run(); checks.push(name); }

const CRUISE = 260; // px/s, CAR_MAX_SPEED
const east = { x: 0, y: 0, angle: 0, speed: CRUISE };

check('at cruise the card opens seconds before the landmark, not as it passes', () => {
  // A landmark 100 px off the street, 700 px ahead: under the old centre radius
  // (300 px) it opened ~1.6 s later, at 270 px out.
  const landmark = { x: 700, y: 100 };
  const along = approachAlong(pathAhead(east, null), landmark);
  assert.ok(along !== null, 'within the lookahead');
  assert.ok(along! / CRUISE > 2, `reached in ${(along! / CRUISE).toFixed(1)} s`);
});

check('a stopped rider still gets what is beside them', () => {
  const stopped = { ...east, speed: 0 };
  assert.notEqual(approachAlong(pathAhead(stopped, null), { x: 0, y: 100 }), null);
  assert.equal(approachAlong(pathAhead(stopped, null), { x: 900, y: 0 }), null, 'not far ahead');
});

check('a passed landmark opens no card', () => {
  assert.equal(approachAlong(pathAhead(east, null), { x: -200, y: 50 }), null);
});

check('far off the path opens no card', () => {
  assert.equal(approachAlong(pathAhead(east, null), { x: 400, y: DRIVE_BY_RADIUS + 20 }), null);
});

check('on the route, the lookahead follows the turn rather than the heading', () => {
  // Route turns north (−y) after 200 px; the landmark sits up the new street.
  const route = [{ x: -100, y: 0 }, { x: 200, y: 0 }, { x: 200, y: -800 }];
  const landmark = { x: 300, y: -500 };
  assert.notEqual(approachAlong(pathAhead(east, route), landmark), null, 'along the route');
  assert.equal(approachAlong(pathAhead(east, null), landmark), null, 'the heading alone misses it');
});

check('off the route, the heading is used', () => {
  const route = [{ x: 0, y: 1000 }, { x: 1000, y: 1000 }];
  const path = pathAhead(east, route);
  assert.equal(path.length, 2);
  assert.equal(path[1].y, 0);
});

check('the landmark reached first wins, not the nearest centre', () => {
  const soon = { id: 'soon', x: 300, y: 120 };
  const nearButLater = { id: 'later', x: 500, y: 20 };
  assert.equal(pickDriveBy([nearButLater, soon], pathAhead(east, null))?.id, 'soon');
});

check('a landmark may replace a street card after a few seconds, never a clicked one', () => {
  const timed = { kind: 'timed' as const, seconds: 8 };
  assert.equal(mayReplaceNotice('street', timed, 1), false);
  assert.equal(mayReplaceNotice('street', timed, PREEMPT_AFTER_SECONDS), true);
  assert.equal(mayReplaceNotice('drive-by', { kind: 'proximity', anchor: { x: 0, y: 0 } }, 3), false);
  assert.equal(mayReplaceNotice('drive-by', { kind: 'proximity', anchor: { x: 0, y: 0 } }, PREEMPT_AFTER_SECONDS), true);
  assert.equal(mayReplaceNotice('click', timed, 7), false);
  assert.equal(mayReplaceNotice('arrival', { kind: 'sticky' }, 60), false);
  assert.equal(mayReplaceNotice(null, null, 0), true);
});

check('a landmark a block away opens no card (Huis Bartolotti, 2026-10-01)', () => {
  // 100 m off the street, as Huis Bartolotti was behind the houses ridden past.
  assert.equal(approachAlong(pathAhead(east, null), { x: 400, y: 300 }), null);
});

check('drive-by cards are spaced out', () => {
  assert.equal(driveByGapElapsed(null, 3), true, 'the first card of a ride');
  assert.equal(driveByGapElapsed(10, 10 + DRIVE_BY_MIN_GAP_SECONDS - 1), false);
  assert.equal(driveByGapElapsed(10, 10 + DRIVE_BY_MIN_GAP_SECONDS), true);
});

for (const name of checks) process.stdout.write(`· ${name}\n`);
process.stdout.write(`Drive-by trigger checks passed (${checks.length})\n`);
