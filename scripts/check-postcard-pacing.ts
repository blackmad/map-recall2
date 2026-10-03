// When the "welcome to" neighbourhood postcard comes up. Named request: David,
// 2026-10-03, "use the 'welcome to' neighborhood cards occasionally, when we
// don't have trivia, the first few times in a new hood".

import assert from 'node:assert/strict';
import {
  POSTCARD_FIRST_VISITS, POSTCARD_LULL_GAP_SECONDS, POSTCARD_LULL_SECONDS, POSTCARD_MIN_GAP_SECONDS, POSTCARD_QUIET_SECONDS,
  loadEntryCounts, postcardForLull, postcardOnEntry, recordEntry,
} from '../src/canalRecall/game/postcardPacing';
import { driveByGapElapsed } from '../src/canalRecall/game/driveByTrigger';

const checks: string[] = [];
function check(name: string, run: () => void): void { run(); checks.push(name); }

check('the first few entries to a neighbourhood always get the postcard', () => {
  for (let prior = 0; prior < POSTCARD_FIRST_VISITS; prior++) {
    assert.equal(postcardOnEntry({ now: 100, priorEntries: prior, lastTriviaAt: 99, lastPostcardAt: 99 }), true);
  }
});

check('a familiar neighbourhood gets it only after a stretch without trivia or postcards', () => {
  const familiar = { priorEntries: POSTCARD_FIRST_VISITS };
  assert.equal(postcardOnEntry({ ...familiar, now: 300, lastTriviaAt: 290, lastPostcardAt: null }), false, 'trivia just shown');
  assert.equal(postcardOnEntry({ ...familiar, now: 300, lastTriviaAt: 300 - POSTCARD_QUIET_SECONDS, lastPostcardAt: 290 }), false, 'postcard just shown');
  assert.equal(postcardOnEntry({ ...familiar, now: 300, lastTriviaAt: 300 - POSTCARD_QUIET_SECONDS, lastPostcardAt: 300 - POSTCARD_MIN_GAP_SECONDS }), true);
  assert.equal(postcardOnEntry({ ...familiar, now: 300, lastTriviaAt: null, lastPostcardAt: null }), true, 'nothing told yet');
});

check('a long quiet stretch inside one neighbourhood brings its postcard back', () => {
  assert.equal(postcardForLull({ now: 50, enteredAt: 0, lastTriviaAt: null, lastPostcardAt: 2 }), false);
  assert.equal(postcardForLull({ now: POSTCARD_LULL_GAP_SECONDS + 5, enteredAt: 0, lastTriviaAt: 5, lastPostcardAt: 5 }), true);
  assert.equal(postcardForLull({ now: 400, enteredAt: 0, lastTriviaAt: 400 - POSTCARD_LULL_SECONDS + 1, lastPostcardAt: null }), false, 'trivia recently');
  assert.equal(postcardForLull({ now: 400, enteredAt: 400 - POSTCARD_LULL_SECONDS + 1, lastTriviaAt: null, lastPostcardAt: null }), false, 'only just arrived');
});

check('times from an earlier ride do not block the next ride', () => {
  // raceTime restarts at 0; the last ride's times are in its future.
  assert.equal(postcardOnEntry({ now: 5, priorEntries: 9, lastTriviaAt: 800, lastPostcardAt: 700 }), true);
  assert.equal(driveByGapElapsed(800, 5), true);
});

check('entries are counted per city and survive a reload', () => {
  const store = new Map<string, string>();
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  const counts = loadEntryCounts(storage, 'amsterdam');
  assert.equal(recordEntry(storage, 'amsterdam', counts, 'De Pijp'), 0);
  assert.equal(recordEntry(storage, 'amsterdam', counts, 'De Pijp'), 1);
  assert.equal(loadEntryCounts(storage, 'amsterdam').get('De Pijp'), 2);
  assert.equal(loadEntryCounts(storage, 'utrecht').get('De Pijp'), undefined);
  assert.equal(loadEntryCounts({ getItem: () => '{bad', setItem: () => {} }, 'amsterdam').size, 0, 'corrupt storage reads as empty');
  assert.equal(recordEntry(null, 'amsterdam', new Map(), 'Jordaan'), 0, 'no storage still counts');
});

for (const name of checks) console.log(`· ${name}`);
console.log(`Postcard pacing checks passed (${checks.length})`);
