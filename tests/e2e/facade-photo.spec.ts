import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

const manifestPath = 'public/canal-drive/facade-photo-review/local/pilot-01/manifest.json';
test.skip(!existsSync(manifestPath), 'Local photo development run is not installed; structural checks do not need images.');

test('real photo detections compile, edits alter mesh, rejected sources clear preview', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/canal-drive/facade-photo-lab.html?run=pilot-01');
  await page.waitForFunction(() => (window as any).canalRecallPhotoLab?.status().ready);
  const status = () => page.evaluate(() => (window as any).canalRecallPhotoLab.status());
  const before = await status();
  expect(before.source).toContain('Keizersgracht-136');
  expect(before.openings).toHaveLength(9);
  expect(await page.locator('#photo-frame img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(264);
  await page.locator('#opening').selectOption('window-2');
  await page.locator('#y1').fill('111');
  await page.locator('#apply').click();
  await expect.poll(async () => (await status()).edits).toBe(1);
  expect((await status()).meshHash).not.toBe(before.meshHash);
  const edited = (await status()).meshHash;
  await page.locator('#x1').fill('9999'); await page.locator('#apply').click();
  await expect(page.locator('#error')).toContainText('Invalid pixel box');
  expect((await status()).meshHash).toBe(edited);
  await page.locator('#import').setInputFiles({ name: 'stale.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ extractionHash: 'wrong', sourceSha256: 'wrong' })) });
  await expect(page.locator('#error')).toContainText('another source');
  expect((await status()).meshHash).toBe(edited);
  await page.locator('#source').selectOption('3');
  await expect(page.locator('#empty')).toContainText('missing-height');
  await expect(page.locator('#diagnostic')).toBeHidden();
  expect((await status()).meshHash).toBeUndefined();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('changed source pixels are refused before displaying a mesh', async ({ page }) => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const record = manifest.records.find((r: any) => r.source.address === 'Keizersgracht 136');
  await page.route(`**/${record.image}`, route => route.fulfill({ contentType: 'image/jpeg', body: Buffer.from('changed bytes') }));
  await page.goto('/canal-drive/facade-photo-lab.html?run=pilot-01');
  await expect(page.locator('#error')).toContainText('Source image changed');
  await expect(page.locator('#diagnostic')).toBeHidden();
});
