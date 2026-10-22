import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// The landing page as the dev server serves it (canal-drive/landing.html): the
// stats strip, its count-up, and the video slots falling back to the stills.
// canal-site.spec.ts covers the assembled site behind the Hosting rewrites.
const shots = process.env.LANDING_SHOTS || 'artifacts/landing-shots/stats';
const counted = JSON.parse(readFileSync('public/canal-drive/data/content-stats.json', 'utf8')) as { stats: Record<string, { count: number }> };

const figures = (page: Page) => page.locator('.stats-grid .stat-n').evaluateAll((els) => els.map((el) => ({
  text: el.textContent || '', target: Number(el.getAttribute('data-count')), plus: el.hasAttribute('data-plus'),
})));

test('stats strip shows the counted figures and the loops fall back to the stills', async ({ page }, info) => {
  await page.goto('/canal-drive/landing.html');
  const strip = page.locator('.stats-grid');
  await expect(strip.locator('li')).toHaveCount(6);
  // Display figures never overclaim: each is at or below its exact count in content-stats.json.
  const inlined = await strip.locator('li').evaluateAll((els) => els.map((el) => [el.getAttribute('data-stat') || '', Number(el.querySelector('.stat-n')?.getAttribute('data-count'))] as const));
  for (const [key, shown] of inlined) {
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThanOrEqual(counted.stats[key].count);
  }
  await strip.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await figures(page)).every(({ text, target }) => target > 0 && Number(text.replace(/[^0-9]/g, '')) === target)).toBe(true);
  // No horizontal overflow at this width.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${shots}/landing-top-${info.project.name}.png` });

  // Scroll through: sections reveal, and every loop (absent in the checkout) removes itself, leaving the still.
  for (let y = 0; y < 20; y += 1) { await page.mouse.wheel(0, 600); await page.waitForTimeout(100); }
  // (A loop whose frame is hidden, the desktop shot on a phone, is never requested: it may stay, without a src.)
  await expect.poll(() => page.locator('video.loop').evaluateAll((vs) => vs.filter((v) => v.getAttribute('src') || v.classList.contains('on')).length), { timeout: 15_000 }).toBe(0);
  expect(await page.locator('[data-loop]:visible').count()).toBeGreaterThan(0);
  expect(await page.locator('[data-loop]:visible video').count()).toBe(0);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('.reveal')].every((el) => el.classList.contains('in')))).toBe(true);
  await expect.poll(() => page.evaluate(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: `${shots}/landing-${info.project.name}.png`, fullPage: true });
});

test('reduced motion: final figures, no reveals, no videos', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/canal-drive/landing.html');
  expect((await figures(page)).every(({ text, target, plus }) => text === target.toLocaleString('en-GB') + (plus ? '+' : ''))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.classList.contains('motion'))).toBe(false);
  expect(await page.locator('video').count()).toBe(0);
});

test('without JavaScript the strip still shows the numbers', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/canal-drive/landing.html');
  const texts = await page.locator('.stats-grid .stat-n').allTextContents();
  expect(texts).toHaveLength(6);
  expect(texts.every((t) => Number(t.replace(/[^0-9]/g, '')) > 0)).toBe(true);
  await context.close();
});
