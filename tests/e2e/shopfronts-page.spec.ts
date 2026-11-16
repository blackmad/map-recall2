import { expect, test } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const shots = process.env.SHOPFRONT_SHOTS ?? path.join(os.tmpdir(), 'shopfront-shots');

for (const [name, size] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
  test(`shopfronts page loads at ${name} width`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/canal-drive/shopfronts.html');
    await page.waitForFunction(() => (window as unknown as { shopfrontsPage: { ready: boolean } }).shopfrontsPage.ready);
    await expect(page.locator('article').first()).toBeVisible();
    expect(await page.locator('article').count()).toBeGreaterThan(100);
    await page.locator('#q').fill('lidl');
    await expect(page.locator('article h2')).toContainText(['Lidl']);
    await expect(page.locator('article a', { hasText: 'See it in the game' }).first()).toHaveAttribute('href', /index\.html\?travel=car#race=/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator('#q').fill('');
    await page.locator('[data-tab=template]').click();
    await expect(page.locator('article h2').first()).toBeVisible();
    await page.waitForFunction(() => [...document.images].slice(0, 1).every(i => i.complete));
    await page.screenshot({ path: path.join(shots, `shopfronts-${name}.jpg`), type: 'jpeg', quality: 80 });
  });
}

test('whats-new Shopfronts button opens the gallery', async ({ page }) => {
  await page.goto('/canal-drive/whats-new.html');
  await page.locator('.seg button[data-kind=shopfronts]').click();
  await expect(page).toHaveURL(/shopfronts\.html$/);
});
