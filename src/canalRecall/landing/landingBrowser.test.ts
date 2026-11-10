import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAILY_RIDE_ON_LANDING } from '../featureFlags';

// F1 (#311): the landing adapter wires Today's ride exactly when the flag says so.
test('the landing adapter imports the daily card only when DAILY_RIDE_ON_LANDING is on', () => {
  const source = readFileSync(new URL('./landingBrowser.ts', import.meta.url), 'utf8');
  const wired = /^import[^\n]*from '\.\/landingDaily'/m.test(source);
  assert.equal(wired, DAILY_RIDE_ON_LANDING);
});
