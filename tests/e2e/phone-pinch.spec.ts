import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// Named regressions (user reports 2026-09-28): "zoom in out on mobile is way
// too sensitive, can only get to 10% or 150%" and "centering on the phone is
// now horribly wrong, it puts the bike entirely offscreen". The zoom-slider
// sync threw on every pinch step, so each step multiplied by the distance
// since the pinch began (a 1.1x pinch zoomed 1.7x); and the pinch's first
// finger started a map drag that detached the camera from the bike.
test('a pinch zooms 1:1 with the fingers and leaves the camera on the bike', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'touch gesture');
  test.setTimeout(180000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  await page.waitForTimeout(1500);
  const cdp = await page.context().newCDPSession(page);
  const camera = () => page.evaluate(() => {
    const c = (window as any).canalRecallGame.camera;
    return { zoom: c.zoom as number, detached: !!c.detached };
  });
  const pinch = async (from: number, to: number) => {
    const at = (d: number) => [{ x: 195 - d / 2, y: 250, id: 1 }, { x: 195 + d / 2, y: 250, id: 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(from) });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(from + (to - from) * i / 10) });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const before = await camera();
  await pinch(100, 110);
  const after = await camera();
  expect(after.zoom / before.zoom).toBeCloseTo(1.1, 2);
  expect(after.detached, 'a pinch is not a pan').toBe(false);
});
