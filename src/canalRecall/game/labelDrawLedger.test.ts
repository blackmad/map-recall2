import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  approachKept, bumpSkipCounter, CARD_RECENT_MS, createLedger, LABEL_RECENT_MS, landmarkSkipReason, lastCardShown,
  lastLabelDrawn, namesMatch, noteCardShown, setDrawn, sharedLedger,
} from './labelDrawLedger.ts';
import { nameKey } from './landmarkQuestion.ts';
import { withheldNames } from '../ownMap/labelPolicy.ts';

const BRAKKE = 'Vlaams Cultuurhuis De Brakke Grond';

test('ledger: a drawn name is "now" while on screen, then stamped when it leaves', () => {
  const ledger = createLedger();
  setDrawn(ledger, 'overlay', [BRAKKE, 'Walloon Church'], 1000);
  assert.equal(lastLabelDrawn(ledger, BRAKKE, 9000), 9000, 'still drawn: now');
  setDrawn(ledger, 'overlay', ['Walloon Church'], 5000);
  assert.equal(lastLabelDrawn(ledger, BRAKKE, 9000), 5000, 'left the set at 5000');
  assert.equal(lastLabelDrawn(ledger, 'Westerkerk', 9000), null, 'never drawn');
  // Another layer's set does not clear this one's.
  setDrawn(ledger, 'engine', [], 6000);
  assert.equal(lastLabelDrawn(ledger, 'Walloon Church', 9000), 9000);
});

test('ledger: names match equal or as whole words, never on short stems', () => {
  assert.equal(namesMatch(nameKey(BRAKKE), nameKey('De Brakke Grond')), true);
  assert.equal(namesMatch(nameKey('Brakke Grond'), nameKey(BRAKKE)), true);
  assert.equal(namesMatch(nameKey('Westerkerk'), nameKey('Westerkerk')), true);
  assert.equal(namesMatch(nameKey('Noorderkerk'), nameKey('Westerkerk')), false);
  assert.equal(namesMatch(nameKey('De'), nameKey('De Brakke Grond')), false);
  assert.equal(namesMatch(nameKey('Kerk'), nameKey('Westerkerk')), false, 'whole words only');
  const ledger = createLedger();
  setDrawn(ledger, 'overlay', [BRAKKE], 0);
  assert.equal(lastLabelDrawn(ledger, 'De Brakke Grond', 100), 100);
});

test('eligibility: label in the last 30 s, card in the last 60 s', () => {
  const ledger = createLedger();
  setDrawn(ledger, 'overlay', [BRAKKE], 0);
  assert.equal(landmarkSkipReason(ledger, BRAKKE, 5000), 'labelRecent', 'on screen now');
  setDrawn(ledger, 'overlay', [], 10_000);
  assert.equal(landmarkSkipReason(ledger, BRAKKE, 10_000 + LABEL_RECENT_MS - 1), 'labelRecent');
  assert.equal(landmarkSkipReason(ledger, BRAKKE, 10_000 + LABEL_RECENT_MS), null);
  noteCardShown(ledger, 'Westerkerk', 50_000);
  assert.equal(lastCardShown(ledger, 'Westerkerk'), 50_000);
  assert.equal(landmarkSkipReason(ledger, 'Westerkerk', 50_000 + CARD_RECENT_MS - 1), 'cardRecent');
  assert.equal(landmarkSkipReason(ledger, 'Westerkerk', 50_000 + CARD_RECENT_MS), null);
  // Both apply: the label rule is reported.
  setDrawn(ledger, 'engine', ['Westerkerk'], 60_000);
  assert.equal(landmarkSkipReason(ledger, 'Westerkerk', 61_000), 'labelRecent');
});

test('shared ledger lives on the target; skip counter counts each landmark once per reason', () => {
  const target: Record<string, any> = {};
  assert.equal(sharedLedger(target), sharedLedger(target));
  const seen = new Set<string>();
  assert.equal(bumpSkipCounter(target, seen, 'bg', 'labelRecent'), true);
  assert.equal(bumpSkipCounter(target, seen, 'bg', 'labelRecent'), false);
  bumpSkipCounter(target, seen, 'bg', 'cardRecent');
  bumpSkipCounter(target, seen, 'wk', 'labelRecent');
  assert.deepEqual(target.__canalRecallSession.landmarkSkips, { labelRecent: 2, cardRecent: 1 });
});

test('approach: kept a little past the band and the cone, released beyond', () => {
  const PX = 3, band = 300 * PX;
  const rider = { x: 0, y: 0, angle: 0, speed: 10 };
  assert.equal(approachKept(rider, { x: 340 * PX, y: 0 }, band), true, '340 m < 375 m');
  assert.equal(approachKept(rider, { x: 400 * PX, y: 0 }, band), false);
  const at = (deg: number) => ({ x: Math.cos(deg * Math.PI / 180) * 100 * PX, y: Math.sin(deg * Math.PI / 180) * 100 * PX });
  assert.equal(approachKept(rider, at(70), band), true, '70° < 55° + 20°');
  assert.equal(approachKept(rider, at(80), band), false);
});

test('withheldNames: the approach withholds before the question opens, then both', () => {
  assert.deepEqual(withheldNames({ landmarkApproachWithheld: ['A', 'B'] }), ['A', 'B']);
  assert.deepEqual(withheldNames({ quizPromptName: 'A', quizWithheldNames: ['A', 'B'], landmarkApproachWithheld: ['B', 'C'] }), ['A', 'B', 'C']);
  assert.deepEqual(withheldNames({ quizPromptName: '', quizWithheldNames: ['A'] }), []);
  assert.deepEqual(withheldNames({ quizPromptName: 'A', quizWithheldNames: ['A', 'B'] }), ['A', 'B']);
});
