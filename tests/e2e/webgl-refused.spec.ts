import { expect, test } from '@playwright/test';

// Sentry CANAL-RECALL-C (Chrome Mobile, Android 10): after repeated context losses Chrome blocks
// WebGL for the page ("Web page caused context loss and was blocked"), and `new maplibregl.Map`
// threw from the Game constructor at `load`, so the page never started. The ride now starts without
// the basemap and tells the rider to restart the browser.
test('a browser that refuses WebGL still opens the ride, with a notice', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (/webgl/i.test(kind)) return null;
      return (original as (...args: unknown[]) => unknown).call(this, kind, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { canalRecallGame?: unknown }).canalRecallGame))).toBe(true);
  await expect(page.locator('#canal-graphics-restarted')).toContainText('switched off 3D graphics');
  await expect(page.locator('#route-card')).toBeVisible();
  expect(errors).toEqual([]);
});
