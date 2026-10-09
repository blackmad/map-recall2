import { expect, test } from '@playwright/test';

test('whats-new landing page shows counts, a drawn 3D card, and fits the viewport', async ({ page }) => {
  await page.goto('/canal-drive/whats-new.html');
  await page.waitForFunction(() => (window as any).whatsNew?.ready === true, undefined, { timeout: 30_000 });

  for (const key of ['landmarks', 'ordinary', 'tris', 'week']) {
    const text = (await page.locator(`[data-k="${key}"]`).textContent()) ?? '';
    expect(text, key).toMatch(/\d/);
  }
  expect(Number((await page.locator('[data-k="landmarks"]').textContent())!.replace(/,/g, ''))).toBeGreaterThan(100);

  const cards = page.locator('#feed article.card');
  expect(await cards.count()).toBeGreaterThan(5);
  await expect(page.locator('#wip .wip').first()).toBeAttached();

  await expect(cards.first().locator('.ph')).toHaveClass(/hide/, { timeout: 60_000 });
  const painted = await cards.first().locator('canvas').evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });
  expect(painted).toBeGreaterThan(500);

  await page.getByRole('button', { name: 'Ordinary' }).click();
  const kinds = await page.locator('#feed .badge').allTextContents();
  expect(kinds.every(k => k !== 'Landmark')).toBe(true);
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.locator('#q').fill('zzzz-no-such-building');
  await expect(page.locator('#feed .empty')).toBeVisible();
  await page.locator('#q').fill('');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
