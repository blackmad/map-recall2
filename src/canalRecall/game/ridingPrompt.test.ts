import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RIDING_LEAVE_STREET_SECONDS, RIDING_PROMPT_TIMEOUT_SECONDS,
  advanceRidingPrompt, openRidingPrompt, promptModeFor, questionFreezesRide,
  type RidingPromptEvent,
} from './ridingPrompt.ts';

function ride(name: string, roads: string[], dt = 0.1) {
  let state = openRidingPrompt(name);
  const events: Array<[number, RidingPromptEvent]> = [];
  let closed = false; // the runtime drops the question on 'leave'
  roads.forEach((roadName, i) => {
    if (closed) return;
    const step = advanceRidingPrompt(state, { dt, roadName });
    state = step.state;
    if (step.event !== 'none') events.push([i, step.event]);
    if (step.event === 'leave') closed = true;
  });
  return { state, events };
}

test('a question times out at 12 s while still on the street', () => {
  const steps = Math.round((RIDING_PROMPT_TIMEOUT_SECONDS + 1) / 0.1);
  const { state, events } = ride('Nes', Array(steps).fill('Nes'));
  assert.equal(events.length, 1);
  assert.equal(events[0][1], 'expire');
  assert.ok(events[0][0] * 0.1 >= RIDING_PROMPT_TIMEOUT_SECONDS - 0.2);
  assert.equal(state.expired, true);
});

test('expiring fires once, not every frame', () => {
  const { events } = ride('Nes', Array(300).fill('Nes'));
  assert.deepEqual(events.map(e => e[1]), ['expire']);
});

test('riding off the street ends the question and nothing is revealed before that', () => {
  const roads = [...Array(30).fill('Nes'), ...Array(30).fill('Kalverstraat')];
  const { events } = ride('Nes', roads);
  assert.equal(events.length, 1);
  assert.equal(events[0][1], 'leave');
  assert.ok(events[0][0] >= 30, 'the leave event is never before the street is left');
});

test('a junction wobble is not leaving', () => {
  const wobble = Math.floor((RIDING_LEAVE_STREET_SECONDS - 0.3) / 0.1);
  const roads = [...Array(20).fill('Nes'), ...Array(wobble).fill('Langebrugsteeg'), ...Array(20).fill('Nes')];
  assert.deepEqual(ride('Nes', roads).events, []);
});

test('having no road under the vehicle counts as off the street', () => {
  const roads = [...Array(5).fill('Nes'), ...Array(20).fill('')];
  assert.equal(ride('Nes', roads).events[0][1], 'leave');
});

test('leaving after the timeout still reveals (expired -> leave)', () => {
  const roads = [...Array(140).fill('Nes'), ...Array(20).fill('Damrak')];
  assert.deepEqual(ride('Nes', roads).events.map(e => e[1]), ['expire', 'leave']);
});

test('only multiple-choice route questions ride', () => {
  const base = { hookInstalled: true, answerMode: 'multiple', kind: 'route', transit: false };
  assert.equal(promptModeFor(base), 'riding');
  assert.equal(promptModeFor({ ...base, answerMode: 'typed' }), 'blocking');
  assert.equal(promptModeFor({ ...base, kind: 'bridge' }), 'blocking');
  assert.equal(promptModeFor({ ...base, kind: 'crossing-water' }), 'blocking');
  assert.equal(promptModeFor({ ...base, transit: true }), 'blocking');
  assert.equal(promptModeFor({ ...base, enabled: false }), 'blocking');
  assert.equal(promptModeFor({ ...base, hookInstalled: false }), 'blocking');
});

test('the frame loop freezes only for an open blocking question', () => {
  assert.equal(questionFreezesRide(true, 'blocking'), true);
  assert.equal(questionFreezesRide(true, 'riding'), false);
  assert.equal(questionFreezesRide(false, 'blocking'), false);
});
