import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nullWorldView } from './nullWorldView';

test('the null world view answers like an idle, empty view and never throws on an unlisted method', async () => {
  const view = nullWorldView() as Record<string, any>;
  assert.equal(view.isNullWorldView, true);
  assert.equal(view.map, null);
  assert.equal(view.frameCanvas(), null);
  assert.equal(await view.captureFrame(), null);
  assert.equal(view.toggleLabels(), false);
  assert.equal(view.camera.zoom(), 0);
  assert.equal(view.camera.bounds(), null);
  await view.camera.whenIdle();
  const unsubscribe = view.camera.onFrame(() => assert.fail('never draws'));
  assert.equal(typeof unsubscribe, 'function');
  // Methods the WebGL-refused ride hit first (game-route.js _applyPrefsToRuntime), and ones nobody listed.
  assert.equal(view.applyTheme('day'), undefined);
  assert.equal(view.sync({}, {}, {}), undefined);
  assert.equal(view.someFutureMethod(1, 2), undefined);
  // Not a thenable, so `await view` and Promise.resolve(view) keep the view.
  assert.equal(await Promise.resolve(view), view);
  view.custom = 3;
  assert.equal(view.custom, 3);
});
