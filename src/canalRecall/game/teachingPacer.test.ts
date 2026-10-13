import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as pacer from './teachingPacer.ts';
import * as postcard from './postcardPacing.ts';
import * as driveBy from './driveByTrigger.ts';
import * as transit from '../transit/browser.ts';

test('the constants moved with their values unchanged', () => {
  assert.equal(pacer.DRIVE_BY_MIN_GAP_SECONDS, 15);
  assert.equal(pacer.PREEMPT_AFTER_SECONDS, 6);
  assert.equal(pacer.CLICK_PREEMPT_AFTER_SECONDS, 20);
  assert.equal(pacer.POSTCARD_FIRST_VISITS, 3);
  assert.equal(pacer.POSTCARD_QUIET_SECONDS, 45);
  assert.equal(pacer.POSTCARD_MIN_GAP_SECONDS, 120);
  assert.equal(pacer.POSTCARD_LULL_SECONDS, 90);
  assert.equal(pacer.POSTCARD_LULL_GAP_SECONDS, 180);
  assert.equal(pacer.BRIDGE_QUIZ_COOLDOWN_SECONDS, 90);
  assert.equal(pacer.TRANSIT_STOP_QUIZ_COOLDOWN_S, 18);
  assert.equal(pacer.TRANSIT_LINE_QUIZ_COOLDOWN_S, 45);
  assert.equal(pacer.TRANSIT_STREET_QUIZ_COOLDOWN_S, 22);
  assert.equal(pacer.TRANSIT_TRANSFER_QUIZ_COOLDOWN_S, 40);
});

test('the old homes still export the same names', () => {
  assert.equal(postcard.POSTCARD_QUIET_SECONDS, pacer.POSTCARD_QUIET_SECONDS);
  assert.equal(postcard.postcardOnEntry, pacer.postcardOnEntry);
  assert.equal(driveBy.DRIVE_BY_MIN_GAP_SECONDS, pacer.DRIVE_BY_MIN_GAP_SECONDS);
  assert.equal(driveBy.PREEMPT_AFTER_SECONDS, pacer.PREEMPT_AFTER_SECONDS);
  assert.equal(transit.TRANSIT_STOP_QUIZ_COOLDOWN_S, pacer.TRANSIT_STOP_QUIZ_COOLDOWN_S);
});

test('one rule for "how long since": a later time is an earlier ride', () => {
  assert.equal(pacer.sinceEvent(10, null), Infinity);
  assert.equal(pacer.sinceEvent(10, undefined), Infinity);
  assert.equal(pacer.sinceEvent(10, 400), Infinity);
  assert.equal(pacer.sinceEvent(10, -Infinity), Infinity);
  assert.equal(pacer.sinceEvent(10, 4), 6);
});

test('every flat cooldown is honoured to the second', () => {
  for (const kind of Object.keys(pacer.MIN_GAP_SECONDS) as Array<keyof typeof pacer.MIN_GAP_SECONDS>) {
    const gap = pacer.MIN_GAP_SECONDS[kind];
    assert.equal(pacer.gapElapsed(kind, 100, 100 + gap - 0.01), false, `${kind} just before`);
    assert.equal(pacer.gapElapsed(kind, 100, 100 + gap), true, `${kind} at the gap`);
    assert.equal(pacer.gapElapsed(kind, null, 100), true, `${kind} first of the ride`);
    assert.equal(pacer.gapElapsed(kind, 900, 100), true, `${kind} from an earlier ride`);
  }
  assert.equal(pacer.gapElapsed('bridge-quiz', 0, 80, 60), true, 'a page-supplied gap overrides the table');
});

test('a street question waits half a stop cooldown after a stop question', () => {
  assert.equal(pacer.streetClearOfStop(100, 108), false);
  assert.equal(pacer.streetClearOfStop(100, 109), true);
  assert.equal(pacer.streetClearOfStop(undefined, 0), true);
});

test('plaque feedback times out after 6 seconds, and is not timed while a question is open', () => {
  assert.equal(pacer.FEEDBACK_TIMEOUT_SECONDS, 6);
  assert.equal(pacer.feedbackExpired(10, 15.9), false);
  assert.equal(pacer.feedbackExpired(10, 16), true);
  assert.equal(pacer.feedbackExpired(null, 500), false);
  assert.equal(pacer.feedbackExpired(900, 5), true, 'a line stamped by an earlier ride is stale, not eternal');
});

test('cards that opened by themselves fold after 8 seconds; clicked and arrival cards stay', () => {
  assert.equal(pacer.cardCollapsed('drive-by', 7.9), false);
  assert.equal(pacer.cardCollapsed('drive-by', 8), true);
  assert.equal(pacer.cardCollapsed('street', 12), true);
  assert.equal(pacer.cardCollapsed('click', 600), false, 'sticky for user-clicked buildings');
  assert.equal(pacer.cardCollapsed('arrival', 600), false);
  assert.equal(pacer.cardCollapsed(null, 600), false);
});
