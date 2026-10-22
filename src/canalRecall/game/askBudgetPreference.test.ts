import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ASK_BUDGETS, DEFAULT_ASK_BUDGET, coercePreferences, defaultPreferences, parsePreferences, patchLivePreferences,
  readPreferences, writePreferences,
} from './preferences.ts';
import { DEFAULT_MAX_ASKS_PER_MINUTE, resolveSettings } from './questionBudget.ts';

const zoom = { min: 0.2, max: 1.5, defaultZoom: 0.65 };

test('the preference default is the budget default, so a fresh rider is unchanged', () => {
  assert.equal(DEFAULT_ASK_BUDGET, DEFAULT_MAX_ASKS_PER_MINUTE);
  assert.equal(defaultPreferences(zoom).maxAsksPerMinute, 3);
});

test('only 1, 2, 3 and off (0) are accepted; anything else reads as the default', () => {
  assert.deepEqual([...ASK_BUDGETS], [1, 2, 3, 0]);
  for (const budget of ASK_BUDGETS) assert.equal(parsePreferences({ maxAsksPerMinute: budget }, zoom).maxAsksPerMinute, budget);
  for (const bad of [4, -1, 1.5, '2', null, undefined, Infinity, NaN]) {
    assert.equal(parsePreferences({ maxAsksPerMinute: bad }, zoom).maxAsksPerMinute, 3, `${String(bad)} is ignored`);
  }
});

test('the choice is what the budget module is given', () => {
  for (const budget of ASK_BUDGETS) {
    assert.equal(resolveSettings({ maxAsksPerMinute: budget }).maxAsksPerMinute, budget);
  }
});

test('a live change is kept by coercion and persists through storage', () => {
  const current = defaultPreferences(zoom);
  const next = patchLivePreferences(current, { maxAsksPerMinute: 0 }, zoom);
  assert.equal(next.maxAsksPerMinute, 0);
  assert.equal(next.difficulty, current.difficulty, 'it is not an assist, so difficulty stays');
  assert.equal(coercePreferences({ ...next }, zoom).maxAsksPerMinute, 0);
  const data = new Map<string, string>();
  const store = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  writePreferences(store, next);
  assert.equal(readPreferences(store, zoom).maxAsksPerMinute, 0, 'off survives a reload');
});
