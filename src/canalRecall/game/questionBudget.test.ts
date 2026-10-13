import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_BUDGET, decideQuestion, minGapSeconds, recentAsks, recordAsk, resolveSettings,
  type NameEvent, type QuestionBudgetState,
} from './questionBudget.ts';

const fresh: NameEvent = { name: 'Nes', kind: 'new-unlearned', teachingStreet: true };
const side: NameEvent = { name: 'Zoutsteeg', kind: 'new-unlearned' };
const due: NameEvent = { name: 'Rokin', kind: 'due-review' };
const known: NameEvent = { name: 'Damrak', kind: 'known' };

function ridden(asks: number[]): QuestionBudgetState {
  return { asks };
}

test('default budget is two asks a minute', () => {
  assert.equal(resolveSettings().maxAsksPerMinute, 2);
  assert.equal(resolveSettings({ maxAsksPerMinute: -3 }).maxAsksPerMinute, 0);
});

test('a known name is never asked', () => {
  assert.deepEqual(decideQuestion(EMPTY_BUDGET, known, 0), { action: 'skip', reason: 'known' });
});

test('a fresh ride asks the first teaching name', () => {
  assert.deepEqual(decideQuestion(EMPTY_BUDGET, fresh, 5), { action: 'ask', priority: 'teaching' });
});

test('once the minute is spent a new name is revealed after passing, a review stays due', () => {
  const state = ridden([10, 40]);
  assert.deepEqual(decideQuestion(state, fresh, 50), { action: 'reveal-after-pass', reason: 'budget' });
  assert.deepEqual(decideQuestion(state, due, 50), { action: 'skip', reason: 'budget' });
});

test('the window slides: an old ask frees a slot', () => {
  const state = ridden([10, 40]);
  assert.equal(decideQuestion(state, fresh, 71).action, 'ask');
});

test('asks cannot land back to back', () => {
  const state = ridden([10]);
  assert.equal(minGapSeconds(resolveSettings()), 15);
  assert.deepEqual(decideQuestion(state, due, 20), { action: 'skip', reason: 'spacing' });
  assert.deepEqual(decideQuestion(state, fresh, 20), { action: 'reveal-after-pass', reason: 'spacing' });
  assert.equal(decideQuestion(state, due, 26).action, 'ask');
});

test('the last slot is kept for a review or a teaching street, not a side street', () => {
  const state = ridden([10]);
  assert.deepEqual(decideQuestion(state, side, 30), { action: 'reveal-after-pass', reason: 'reserved' });
  assert.equal(decideQuestion(state, due, 30).action, 'ask');
  assert.equal(decideQuestion(state, fresh, 30).action, 'ask');
  // With both slots free a side street may still be asked.
  assert.deepEqual(decideQuestion(EMPTY_BUDGET, side, 30), { action: 'ask', priority: 'rest' });
});

test('priority is review over teaching over the rest', () => {
  assert.equal((decideQuestion(EMPTY_BUDGET, due, 0) as { priority: string }).priority, 'review');
  assert.equal((decideQuestion(EMPTY_BUDGET, fresh, 0) as { priority: string }).priority, 'teaching');
  assert.equal((decideQuestion(EMPTY_BUDGET, side, 0) as { priority: string }).priority, 'rest');
});

test('zero turns questions off but still teaches the names by revealing them', () => {
  const off = { maxAsksPerMinute: 0 };
  assert.equal(decideQuestion(EMPTY_BUDGET, fresh, 0, off).action, 'reveal-after-pass');
  assert.equal(decideQuestion(EMPTY_BUDGET, due, 0, off).action, 'skip');
});

test('Infinity restores ask-everything', () => {
  const all = { maxAsksPerMinute: Infinity };
  let state = EMPTY_BUDGET;
  for (let i = 0; i < 10; i++) {
    assert.equal(decideQuestion(state, side, i, all).action, 'ask');
    state = recordAsk(state, i);
  }
});

test('asks from an earlier ride (clock restarted) do not count', () => {
  assert.deepEqual(recentAsks(ridden([900, 950]), 5), []);
  assert.equal(decideQuestion(ridden([900, 950]), fresh, 5).action, 'ask');
});

test('a simulated ten-minute ride never exceeds the cap in any rolling minute', () => {
  let state = EMPTY_BUDGET;
  const asked: number[] = [];
  // A new street every 7 s, a mix of kinds.
  const kinds: NameEvent[] = [fresh, side, due, known, side, fresh];
  for (let t = 0, i = 0; t < 600; t += 7, i++) {
    const decision = decideQuestion(state, kinds[i % kinds.length], t);
    if (decision.action === 'ask') { state = recordAsk(state, t); asked.push(t); }
  }
  for (let start = 0; start + 60 <= 600; start += 1) {
    const inMinute = asked.filter(at => at >= start && at < start + 60).length;
    assert.ok(inMinute <= 2, `${inMinute} asks in the minute from ${start}s`);
  }
  assert.ok(asked.length >= 15, `the ride should still ask regularly, asked ${asked.length}`);
});
