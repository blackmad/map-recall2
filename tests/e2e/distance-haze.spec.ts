import { expect, test } from '@playwright/test';
import { openRoute } from './helpers';
import { OWN } from './worldCam';

// The "Distance haze" switch (preferences `distanceHaze`, Comfort & detail; lane E1 2026-11-05, plan #213 item E: "gentle
// far haze for now, but make it turn-off-able"). Off moves the depth fade's fog range out of reach on the next frame,
// with no reload and no recompile (look/depthFade.ts distanceHazeOn); on brings it back.
test('the Distance haze switch turns the far fade off and on mid-ride', async ({ page }, testInfo) => {
  test.skip(!OWN, 'the shared frame of the own engine (ENGINE=own)');
  test.skip(testInfo.project.name !== 'desktop', 'one camera is enough');
  test.setTimeout(180_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  const fogNear = () => page.evaluate(() => (window as any).canalRecallGame.vectorMap._sharedFrame?.scene?.fog?.near ?? null);
  const setHaze = (on: boolean) => page.evaluate(distanceHaze => {
    const g = (window as any).canalRecallGame;
    // What the in-ride settings panel does (OverlayApp `set` with live: patch, then onLiveChange).
    g._overlay.store.patchPrefs({ distanceHaze }, g._overlayZoom());
    g._overlay.callbacks.onLiveChange();
  }, on);
  await expect.poll(fogNear, { timeout: 30_000 }).toBeLessThan(1e6);
  await setHaze(false);
  await expect.poll(fogNear, { timeout: 10_000 }).toBe(1e7);
  expect(await page.evaluate(() => (window as any).__canalRecallDistanceHaze)).toBe(false);
  await setHaze(true);
  await expect.poll(fogNear, { timeout: 10_000 }).toBeLessThan(1e6);
});
