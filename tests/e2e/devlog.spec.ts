import { expect, test } from '@playwright/test';

// devlog.html (#84): the progress comments of issue #68, rendered safely, newest first.
test('dev log renders the issue comments newest first and fits the viewport', async ({ page }, info) => {
  await page.goto('/canal-drive/devlog.html');
  await page.waitForFunction(() => (window as any).devlog?.ready === true, undefined, { timeout: 20_000 });
  expect(await page.evaluate(() => (window as any).devlog.error ?? '')).toBe('');

  const entries = page.locator('#feed article.entry');
  expect(await entries.count()).toBeGreaterThan(2);
  const times = await page.locator('#feed article.entry time').evaluateAll(ts => ts.map(t => t.getAttribute('datetime')!));
  expect([...times].sort().reverse()).toEqual(times);
  await expect(entries.first().locator('.md li').first()).toBeVisible();
  await expect(entries.first().getByRole('link', { name: 'Read or reply on GitHub' })).toHaveAttribute('href', /github\.com\/blackmad\/map-recall2\/issues\/68#issuecomment-\d+/);
  await expect(page.getByRole('link', { name: 'Comment on GitHub' })).toHaveAttribute('href', /issues\/68$/);
  // Markdown is rendered, never injected: no script or inline handlers inside the feed.
  expect(await page.locator('#feed script, #feed [onerror], #feed [onclick]').count()).toBe(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/devlog-${info.project.name}.png` });
});
