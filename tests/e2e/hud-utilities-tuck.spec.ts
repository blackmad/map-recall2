import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// Desktop HUD: the corner utilities (feedback, settings, help, build stamp) fade
// out once the ride has settled and return on a mouse wiggle.
// HUD_SHOTS=dir writes the idle / wiggle screenshots at the current viewport.

const opacityOf = (page: Page, selector: string) =>
  page.evaluate(sel => {
    const el = document.querySelector(sel);
    return el ? Number(getComputedStyle(el).opacity) : null;
  }, selector);

const probe = async (page: Page) => ({
  cluster: await page.evaluate(() => [...document.getElementById('utility-buttons')!.classList].join(' ')),
  settings: await opacityOf(page, '#open-settings'),
  help: await opacityOf(page, '#open-help'),
  feedback: await opacityOf(page, '#utility-buttons .cf-launch'),
  stamp: await opacityOf(page, '#build-stamp'),
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
  test(`utilities hide 4 s into a ride and return 200 ms after a mouse move (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await page.route('**/deployment.json', route => route.fulfill({
      json: { sha: 'test-revision', short: 'testrev', builtAt: '2026-10-07T12:00:00Z' },
    }));
    await page.setViewportSize(viewport);
    await openRoute(page, { travelMode: 'car', viewMode: 'heading' });
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.waitForTimeout(4000);

    const hidden = await probe(page);
    expect(hidden.cluster.split(' ')).toContain('tucked');
    expect(hidden.stamp, 'build stamp present').not.toBeNull();
    for (const key of ['settings', 'help', 'feedback', 'stamp'] as const) {
      if (hidden[key] !== null) expect(hidden[key], key).toBe(0);
    }
    const dir = process.env.HUD_SHOTS;
    const tag = `${viewport.width}x${viewport.height}`;
    if (dir) await page.screenshot({ path: `${dir}/${tag}-idle.png` });

    // A steering key must not wake them.
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);
    expect((await probe(page)).settings).toBe(0);

    await page.mouse.move(viewport.width / 2 + 60, viewport.height / 2 + 40);
    await page.mouse.move(viewport.width / 2 + 120, viewport.height / 2 + 70);
    await page.waitForTimeout(200);
    const shown = await probe(page);
    expect(shown.cluster.split(' ')).not.toContain('tucked');
    expect(shown.settings!).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    if (dir) await page.screenshot({ path: `${dir}/${tag}-wiggle.png` });

    // They go again 3 s after the wiggle stops.
    await page.waitForTimeout(3500);
    expect((await probe(page)).settings).toBe(0);

    // The shortcut still opens settings while the button is hidden.
    await page.keyboard.press('g');
    await expect.poll(() => page.evaluate(() => !!(window as any).canalRecallGame._utilityOpen)).toBe(true);
  });
}
