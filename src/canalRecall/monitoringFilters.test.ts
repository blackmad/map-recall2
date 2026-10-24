import test from 'node:test';
import assert from 'node:assert/strict';
import { isIgnoredErrorMessage } from './monitoringFilters';

test('drops the Microsoft link-scanner rejection (CANAL-RECALL-G/-F)', () => {
  // The message Sentry builds for a non-Error unhandled rejection, and the bare string.
  assert.ok(isIgnoredErrorMessage('Non-Error promise rejection captured with value: Object Not Found Matching Id:1, MethodName:update, ParamCount:4'));
  assert.ok(isIgnoredErrorMessage('Object Not Found Matching Id:2, MethodName:simulateEvent, ParamCount:21'));
});

test('drops empty-log shader failures from a dead GPU, keeps real GLSL errors', () => {
  assert.ok(isIgnoredErrorMessage('Error: Could not compile fragment shader: '));
  assert.ok(isIgnoredErrorMessage('Could not compile vertex shader: null'));
  assert.ok(isIgnoredErrorMessage('Program failed to link: '));
  assert.equal(isIgnoredErrorMessage("Could not compile fragment shader: ERROR: 0:12: 'foo' : undeclared identifier"), false);
});

test('keeps our own errors', () => {
  for (const message of [
    "TypeError: Cannot read properties of null (reading 'getSource')",
    "TypeError: Cannot read properties of undefined (reading 'DIFFICULTY_PRESETS')",
    'AbortError: signal is aborted without reason',
    'Error: reCAPTCHA Timeout (b)',
    'Object Not Found',
  ]) assert.equal(isIgnoredErrorMessage(message), false, message);
});
