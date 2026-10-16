import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// Buurt coverage map (coverage.html): click a buurt, explore its kits.
//   PW_PORT=4555 npx playwright test coverage-page --project=desktop --project=iphone
// COVERAGE_SHOTS=<dir> also writes light/dark screenshots of the three regression buurten per project.

const ready = (page: Page) => page.waitForFunction(() => (window as any).coveragePage?.ready === true, undefined, { timeout: 30_000 });
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const SHOTS = process.env.COVERAGE_SHOTS;

// Regression buurten: EQ01 Da Costabuurt-Noord (lots), FK05 Osdorp-Zuidoost (building types), NC03 Terrasdorp (nothing).

test('coverage map: buurt panels list faces, types, designs, or say there is nothing', async ({ page }, info) => {
  await page.goto('/canal-drive/coverage.html?buurt=EQ01');
  await ready(page);
  expect(await page.evaluate(() => (window as any).coveragePage.errors)).toEqual([]);
  const panel = page.locator('#panel');
  await expect(panel.locator('h2')).toHaveText('Da Costabuurt-Noord');
  // Installed block face with its photo/model thumbnails and a chunk link.
  const face = panel.locator('#face-bilder-081118-155417');
  await expect(face.locator('.badge.installed')).toHaveText('Installed');
  await expect(face.locator('a[href^="street-chunks.html?only=chunk-face-bilder-081118-155417"]')).toBeVisible();
  for (const img of await face.locator('img').all()) await img.scrollIntoViewIfNeeded(), await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(50);
  // Type libraries with measured swatches and kit keys.
  const types = panel.locator('#sec-types article');
  expect(await types.count()).toBeGreaterThanOrEqual(5);
  await expect(types.first().locator('.pal .sw').first()).toBeVisible();
  await expect(types.first().locator('.chips .chip').first()).toBeVisible();
  // Chunks already shown under their face are not repeated as models.
  await expect(panel.locator('#sec-models')).not.toContainText('chunk-face-bilder-081118-155417');
  // Placed models: per-house recipes link to their street-survey entry; any shipped photo decodes.
  await expect(panel.locator('#sec-models a[href="street-surveys.html#ordinary-0363100012081118"]')).toHaveCount(1);
  const modelImgs = panel.locator('#sec-models img');
  for (const img of await modelImgs.all()) await img.scrollIntoViewIfNeeded(), await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(50);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  if (SHOTS) await shots(page, info.project.name, 'da-costabuurt-noord');

  // Nieuw-West: building-type designs with counts and a 3D preview.
  await page.evaluate(() => (window as any).coveragePage.select('FK05'));
  await expect(panel.locator('h2')).toHaveText('Osdorp-Zuidoost');
  const rows = panel.locator('#sec-designs article.row');
  expect(await rows.count()).toBeGreaterThanOrEqual(3);
  await expect(rows.first().locator('a[href^="model-compare.html?"]')).toBeVisible();
  await rows.first().locator('button.prev').click();
  await expect(rows.first().locator('iframe')).toHaveAttribute('src', /building-types%2F.+\.glb/);
  await rows.first().locator('button.prev').click();
  if (SHOTS) await shots(page, info.project.name, 'osdorp-zuidoost');

  // A buurt with nothing says so and names the next generator candidate; search by name reaches it.
  await page.locator('#search').fill('Terrasdorp (NC03)');
  await page.locator('#search').dispatchEvent('change');
  await expect(panel.locator('h2')).toHaveText('Terrasdorp');
  await expect(panel.locator('.empty')).toContainText('Nothing yet');
  await expect(panel.locator('.empty .cand')).toContainText(/Next generator candidate: \d+–\d+ m wide × \d+–\d+ m high, built \d{4}–\d{4}: \d+ pands/);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  if (SHOTS) await shots(page, info.project.name, 'terrasdorp');

  // Clicking (or tapping, on the phone) the map selects the buurt under the pointer: the city centre, not Terrasdorp.
  const map = page.locator('#map');
  await map.scrollIntoViewIfNeeded();
  const box = (await map.boundingBox())!;
  const at = { x: box.width / 2, y: box.height / 2 };
  if (info.project.name === 'iphone') await map.tap({ position: at }); else await map.click({ position: at });
  await expect.poll(() => page.evaluate(() => (window as any).coveragePage.selected)).not.toBe('NC03');
});

async function shots(page: Page, project: string, slug: string) {
  mkdirSync(SHOTS!, { recursive: true });
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.evaluate(() => { window.scrollTo(0, 0); document.getElementById('panel')!.scrollTop = 0; });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOTS}/${slug}-${project}-${scheme}.png` });
    // On the phone the panel sits under the map: a second viewport shot from the panel's top, then one further down.
    if (project === 'iphone') {
      await page.evaluate(() => document.getElementById('panel')!.scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: `${SHOTS}/${slug}-${project}-${scheme}-panel.png` });
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.9));
      await page.screenshot({ path: `${SHOTS}/${slug}-${project}-${scheme}-panel2.png` });
    }
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  }
  await page.emulateMedia({ colorScheme: 'light' });
}

