// G7 (#277): What's New surfaces once per new note as a one-line toast on the
// landing page, links to the What's New page, is dismissible, and never
// appears inside the ride.
//
// Needs js/whats-new-toast.bundle.js (npm run build:canal-whats-new-toast).
// Run: PW_PORT=4693 /tmp/canal-pw.sh npx playwright test tests/e2e/whats-new-toast.spec.ts --project=desktop

import { expect, test } from '@playwright/test';

const NOTES = { note: 'test', notes: [
  { date: '2026-11-09', title: 'Tours are back under More options', text: '…', images: [] },
  { date: '2026-11-01', title: 'Older', text: '…', images: [] },
] };

test.beforeEach(async ({ page }) => {
  await page.route('**/whats-new-notes.json', route => route.fulfill({ json: NOTES }));
  await page.route('**/deployment.json', route => route.fulfill({ json: { sha: 'test', short: 'testrev' } }));
});

test('a returning rider sees the toast once, can dismiss it, and it links to What\'s New', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('g7-init')) { sessionStorage.setItem('g7-init', '1'); localStorage.clear(); localStorage.setItem('canalRecall.returningPlayer.v1', '1'); } });
  await page.goto('/canal-drive/landing.html');
  const toast = page.locator('#whats-new-toast');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('Tours are back under More options');
  await expect(toast.getByRole('link', { name: "What's New" })).toHaveAttribute('href', 'whats-new.html');
  const box = (await toast.boundingBox())!;
  const viewport = page.viewportSize()!;
  // R2-11 (#304): the phone banner wraps and carries 44 px targets, so it is taller than the desktop pill.
  const phone = viewport.width <= 600;
  expect(box.height, phone ? 'a phone banner of at most three lines' : 'one line').toBeLessThan(phone ? 112 : 56);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  await page.screenshot({ path: `artifacts/g7/whats-new-toast-${test.info().project.name}.png` });
  await toast.getByRole('button', { name: 'Dismiss' }).click();
  await expect(toast).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(800);
  await expect(page.locator('#whats-new-toast'), 'shown once per note').toHaveCount(0);
});

test('a first visit records the note silently', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('g7-init')) { sessionStorage.setItem('g7-init', '1'); localStorage.clear(); } });
  await page.goto('/canal-drive/landing.html');
  await page.waitForTimeout(800);
  await expect(page.locator('#whats-new-toast')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('canalRecall.whatsNewSeen.v1'))).toContain('Tours are back');
});

test('the ride never shows the toast', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('canalRecall.returningPlayer.v1', '1'); });
  await page.goto('/canal-drive/');
  await expect(page.locator('#route-card')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(800);
  await expect(page.locator('#whats-new-toast')).toHaveCount(0);
});
