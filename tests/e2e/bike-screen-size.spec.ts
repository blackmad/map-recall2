import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression (user report 2026-09-28, "the bike is small in the chase
// view on desktop"). The bike is a world-space game piece, so it drew 24 CSS
// px long in a 1440x900 window: 2.7% of the short side, against 5.4% on a
// phone. It now grows with the window, so it reads alike on both.
test('the chase bike takes a similar share of the screen on desktop and phone', async ({ page }) => {
  test.setTimeout(180000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', seedRandom: false });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.vectorMap?.isPlayerBikeReady?.())), { timeout: 90000 }).toBe(true);
  const share = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const map = g.vectorMap.map;
    const metresPerPx = 156543.03392 * Math.cos(map.getCenter().lat * Math.PI / 180) / 2 ** map.getZoom();
    const bike = g.vectorMap._playerBike;
    const lengthM = 2.15 * bike.options.gameScale * bike.viewportScale();
    return lengthM / metresPerPx / Math.min(innerWidth, innerHeight);
  });
  expect(share, 'bike length as a share of the viewport short side').toBeGreaterThan(0.04);
  expect(share).toBeLessThan(0.08);
});
