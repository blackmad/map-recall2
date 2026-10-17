import { expect, test, type Page } from '@playwright/test';

// First-run intro (src/canalRecall/onboarding). Automated runs skip it unless
// asked, so every other spec still lands on a clear setup screen; these tests
// opt in with `__canalRecallOnboarding`.

async function boot(page: Page, { force = true } = {}) {
  if (force) await page.addInitScript(() => { (window as any).__canalRecallOnboarding = true; });
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame))).toBe(true);
}

const intro = (page: Page) => page.locator('#onboarding');

test('a first visit shows the intro; finishing it persists', async ({ page }, info) => {
  await boot(page);
  await expect(intro(page)).toBeVisible();
  await expect(intro(page).locator('h2')).toHaveText('Ride the real city');
  await expect(intro(page).locator('.onb-dots')).toHaveAttribute('aria-label', 'Step 1 of 3');
  // The control hint matches the device in hand.
  const hint = intro(page).locator('[data-onboarding="hint"]');
  if (info.project.name === 'iphone') await expect(hint).toContainText('Hold the ring');
  else await expect(hint).toContainText('Arrow keys');

  if (info.project.name === 'iphone') {
    await intro(page).locator('[data-onboarding="next"]').tap();
    await expect(intro(page).locator('h2')).toHaveText('Name it');
    await intro(page).locator('[data-onboarding="next"]').tap();
  } else {
    // Keyboard: the intro owns the keys while open.
    await page.keyboard.press('ArrowRight');
    await expect(intro(page).locator('h2')).toHaveText('Name it');
    await page.keyboard.press('ArrowLeft');
    await expect(intro(page).locator('h2')).toHaveText('Ride the real city');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
  }
  await expect(intro(page).locator('h2')).toHaveText('Points and names learned');
  await expect(intro(page).locator('[data-onboarding="skip"]')).toBeHidden();
  await expect(intro(page).locator('[data-onboarding="next"]')).toHaveText('Got it');
  // G opens settings in the game; with the intro up it must not.
  if (info.project.name !== 'iphone') {
    await page.keyboard.press('g');
    await expect(page.locator('#settings-panel')).toBeHidden();
  }
  await intro(page).locator('[data-onboarding="next"]').click();
  await expect(intro(page)).toHaveCount(0);
  await expect(page.locator('#route-card')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('canalRecall.onboarding.v1'))).toBe('done');

  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame))).toBe(true);
  await page.waitForTimeout(500);
  await expect(intro(page)).toHaveCount(0);
});

test('Escape skips the intro and How to play reopens it', async ({ page }, info) => {
  await boot(page);
  await expect(intro(page)).toBeVisible();
  if (info.project.name === 'iphone') await intro(page).locator('[data-onboarding="skip"]').tap();
  else await page.keyboard.press('Escape');
  await expect(intro(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('canalRecall.onboarding.v1'))).toBe('done');

  // How to play is reachable from the setup screen, and replays the intro.
  const help = page.locator('#open-help');
  await expect(help).toBeVisible();
  // Nothing sits on top of Start route on a phone (Feedback used to).
  const start = await page.locator('#route-start').boundingBox();
  for (const selector of ['#open-help', '.cf-launch']) {
    const box = await page.locator(selector).boundingBox();
    if (!start || !box) continue;
    const overlaps = box.x < start.x + start.width && box.x + box.width > start.x
      && box.y < start.y + start.height && box.y + box.height > start.y;
    expect(overlaps, `${selector} clears Start route`).toBe(false);
  }
  await help.click();
  await expect(page.locator('#help-panel')).toBeVisible();
  await page.locator('#replay-intro').click();
  await expect(page.locator('#help-panel')).toBeHidden();
  await expect(intro(page)).toBeVisible();
  await expect(intro(page).locator('h2')).toHaveText('Ride the real city');
  await intro(page).locator('[data-onboarding="close"]').click();
  await expect(intro(page)).toHaveCount(0);
});

test('automated runs do not get the intro unless they ask', async ({ page }) => {
  await boot(page, { force: false });
  await page.waitForTimeout(500);
  await expect(intro(page)).toHaveCount(0);
});
