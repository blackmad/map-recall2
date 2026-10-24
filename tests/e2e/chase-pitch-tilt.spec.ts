import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// Issue #25 (player report 2026-10-24): choosing the behind-bike Chase camera
// still looked top-down, and the 3D tilt slider did nothing. Chase opened at
// pitch 12°, flatter than the 14° 2D views, and the left half of the ±36°
// slider clamped to 0°. The chase base and slider range now live in
// src/canalRecall/game/preferences.ts (chasePitch).

const pitchNow = (page: Page) => page.evaluate(() => (window as any).canalRecallGame.vectorMap.map.getPitch() as number);

/** The pitch once it has held still for a second. A raised tilt waits for
 *  the next clearance check (up to 1 s) and then eases up over ~2 s. */
async function settledPitch(page: Page): Promise<number> {
  let last = -1;
  let still = 0;
  for (let i = 0; i < 60 && still < 4; i++) {
    await page.waitForTimeout(250);
    const p = await pitchNow(page);
    still = Math.abs(p - last) < 0.2 ? still + 1 : 0;
    last = p;
  }
  return last;
}

async function setSlider(page: Page, value: number): Promise<void> {
  const slider = page.locator('#live-tilt');
  if (!(await slider.isVisible())) await page.keyboard.press('g');
  await expect(slider).toBeVisible();
  await slider.fill(String(value));
}

async function rideChase(page: Page) {
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90000 });
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {}; });
  expect(await page.evaluate(() => (window as any).canalRecallGame.viewMode)).toBe('chase');
}

test('choosing Chase in setup gives a 3D pitch and the tilt slider moves it', async ({ page }) => {
  test.setTimeout(180000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await rideChase(page);
  const chase = await settledPitch(page);
  expect(chase, 'chase pitch').toBeGreaterThan(30);
  await page.keyboard.press('g');
  const slider = page.locator('#live-tilt');
  await expect(slider).toBeVisible();
  const range = await slider.evaluate((el: HTMLInputElement) => ({ min: Number(el.min), max: Number(el.max), value: Number(el.value) }));
  expect(range.value, 'slider starts at the default tilt').toBe(0);
  await setSlider(page, range.min);
  const flat = await settledPitch(page);
  expect(flat, `slider at ${range.min}`).toBeLessThan(chase - 20);
  await setSlider(page, Math.round((range.min + range.max) / 2));
  const mid = await settledPitch(page);
  expect(mid, 'slider at mid-range').toBeGreaterThan(flat + 5);
  expect(mid).toBeLessThan(chase - 5);
});

test('a saved Chase setting with a saved tilt opens in 3D', async ({ page }) => {
  test.setTimeout(180000);
  // A save from before the fix: Chase with the slider pushed right (+20 of
  // the old ±36 range) and left (-20); both must open as a 3D view.
  for (const cameraTilt of [20, -20]) {
    await page.addInitScript((tilt: number) => {
      try {
        const key = 'canalRecall.preferences.v1';
        const saved = JSON.parse(localStorage.getItem(key) || '{}');
        localStorage.setItem(key, JSON.stringify({ ...saved, viewMode: 'chase', travelMode: 'car', cameraTilt: tilt }));
      } catch { /* storage blocked */ }
    }, cameraTilt);
    await openRoute(page, { travelMode: 'car', abortHeavyTiles: false, enterRacing: false });
    await rideChase(page);
    expect(await settledPitch(page), `saved tilt ${cameraTilt}`).toBeGreaterThan(30);
  }
});
