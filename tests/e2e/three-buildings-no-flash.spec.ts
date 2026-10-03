import { expect, test } from '@playwright/test';
import { serveMapLibreOffline } from './helpers';

// A throw inside a MapLibre custom layer aborts the whole frame, so the world
// flashes. The three.js facade layer frees its CPU geometry once uploaded, and
// three.js then computed each new chunk's bounding sphere from the freed array:
// one throw (one flash) per chunk streamed in while riding.
test.use({ ignoreHTTPSErrors: true });

test('three.js building chunks stream in without throwing mid-frame', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error.stack || error)));
  await serveMapLibreOffline(page);
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame))).toBe(true);
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.player?.x)), { timeout: 120_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.vectorMap?.ready)), { timeout: 60_000 }).toBe(true);
  // Several chunks must arrive while the layer is drawing for the test to mean anything.
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame?.vectorMap?._threeBuildings?.stats?.().chunks ?? 0), { timeout: 90_000 }).toBeGreaterThan(2);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(8000);
  await page.keyboard.up('ArrowUp');
  expect(errors.filter(e => /three(-buildings)?\.bundle|computeBoundingSphere/.test(e))).toEqual([]);
});
