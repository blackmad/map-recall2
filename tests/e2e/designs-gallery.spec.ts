import { expect, test } from '@playwright/test';

// designs.html (#84): every repeated building design with its photo, render, map and a ride link.
test('building designs page lists designs with pictures, filters, links into the ride and fits the viewport', async ({ page }, info) => {
  const bad: string[] = [];
  page.on('response', r => { if (r.status() >= 400 && r.url().includes('/canal-drive/')) bad.push(`${r.status()} ${r.url()}`); });
  await page.goto('/canal-drive/designs.html');

  const cards = page.locator('#designs > li.design');
  expect(await cards.count()).toBeGreaterThan(50);
  const houses = Number(((await page.locator('.stat b').nth(1).textContent()) ?? '').replace(/,/g, ''));
  expect(houses).toBeGreaterThan(5000);

  const first = cards.first();
  await first.scrollIntoViewIfNeeded();
  for (const img of await first.locator('.pics img').all()) {
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  }
  await expect(first.locator('svg.map path.dots')).toBeAttached();
  const ride = await first.getByRole('link', { name: 'See it in the game' }).getAttribute('href');
  expect(ride).toMatch(/^index\.html\?travel=car#race=5\d\.\d{4},4\.\d{4}/);

  // Filter: a district narrows the list, a nonsense search empties it.
  const all = await cards.count();
  await page.locator('#st').selectOption('Zuidoost');
  const zo = await page.locator('#designs > li.design:not([hidden])').count();
  expect(zo).toBeGreaterThan(0);
  expect(zo).toBeLessThan(all);
  await page.locator('#q').fill('zzzz-no-such-design');
  await expect(page.locator('#none')).toBeVisible();
  await page.locator('#q').fill('');
  await page.locator('#st').selectOption('');
  await expect(page.locator('#designs > li.design:not([hidden])')).toHaveCount(all);

  // Neighbourhood pages link back by anchor.
  await page.goto('/canal-drive/designs.html#zo-vw-bay');
  await expect(page.locator('#zo-vw-bay')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  if (process.env.SHOT_DIR) {
    await page.goto('/canal-drive/designs.html');
    await page.screenshot({ path: `${process.env.SHOT_DIR}/designs-${info.project.name}.png`, fullPage: false });
    const card = page.locator('#designs > li.design').nth(2);
    await card.scrollIntoViewIfNeeded();
    for (const img of await card.locator('.pics img').all()) await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    await page.screenshot({ path: `${process.env.SHOT_DIR}/designs-${info.project.name}-card.png` });
  }
  expect(bad).toEqual([]);
});
