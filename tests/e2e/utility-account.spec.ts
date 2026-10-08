import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

test('utility controls stay separate and Settings reflects account changes', async ({ page }) => {
  await page.route('**/deployment.json', route => route.fulfill({
    json: { sha: 'test-revision', short: 'testrev', builtAt: '2026-10-07T12:00:00Z' },
  }));
  await openRoute(page, { travelMode: 'car' });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.mouse.move(viewport.width - 20, 100);
    await page.evaluate(() => {
      const game = (window as any).canalRecallGame;
      game._feedbackOpen = true;
      game._utilityRevealUntil = performance.now() + 60_000;
      document.getElementById('utility-buttons')!.classList.remove('tucked');
    });
    const selectors = ['.cf-launch', '#open-settings', '#open-help', '#build-stamp'];
    const boxes = [];
    for (const selector of selectors) {
      await expect(page.locator(selector)).toBeVisible();
      boxes.push((await page.locator(selector).boundingBox())!);
    }
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i];
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.x + a.width).toBeLessThanOrEqual(viewport.width);
      expect(a.y + a.height).toBeLessThanOrEqual(viewport.height);
      for (const b of boxes.slice(i + 1)) {
        expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
      }
    }
    const pad = await page.evaluate(() => {
      const game = (window as any).canalRecallGame;
      const bounds = game.input.dpad?.bounds;
      if (!bounds) return null;
      const canvas = game.canvas.getBoundingClientRect();
      const sx = canvas.width / game.viewport.width, sy = canvas.height / game.viewport.height;
      return { x: canvas.left + bounds.x * sx, y: canvas.top + bounds.y * sy, width: bounds.width * sx, height: bounds.height * sy };
    });
    if (pad) for (const button of boxes.slice(0, 3)) {
      expect(button.x + button.width <= pad.x || pad.x + pad.width <= button.x || button.y + button.height <= pad.y || pad.y + pad.height <= button.y,
        'utility buttons must stay clear of the steering pad').toBe(true);
    }
    await page.screenshot({ path: `artifacts/utility-account/controls-${viewport.width}-${test.info().project.name}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    game._feedbackOpen = false;
    game._overlay.store.setAccount({ label: 'Playing as guest', note: 'Sign in to keep your progress on every device', buttonLabel: 'Sign in', busy: false });
    game._toggleUtilityPanel('settings');
    game._overlay.callbacks.onAccountClick = () => {
      game._overlay.store.setAccount({ label: 'Test rider', note: '12 synced', buttonLabel: 'Sign out', busy: false });
    };
  });
  await expect(page.locator('#settings-account-label')).toHaveText('Playing as guest');
  await page.locator('#settings-account-button').click();
  await expect(page.locator('#settings-account-label')).toHaveText('Signed in as Test rider');
  await expect(page.locator('#settings-account-button')).toHaveText('Sign out');
  await page.screenshot({ path: `artifacts/utility-account/settings-${test.info().project.name}.png` });
  await page.evaluate(() => (window as any).canalRecallGame._overlay.store.setAccount({ label: 'Playing as guest', buttonLabel: 'Sign in' }));
  await expect(page.locator('#settings-account-label')).toHaveText('Playing as guest');
});
