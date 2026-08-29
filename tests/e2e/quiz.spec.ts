import { expect, Page, test } from '@playwright/test';

const quizUrl = '/?city=amsterdam&mode=pinpoint&category=water&radius=4500&map=light_nolabels&labels=off&rounds=5';

async function quietExternalRequests(page: Page) {
  await page.route(/(basemaps\.cartocdn\.com|tile\.openstreetmap\.org|googleapis\.com|gstatic\.com)/, (route) => route.abort());
}

test('first launch is playable without an account', async ({ page }) => {
  await quietExternalRequests(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What would you like to learn?' })).toBeVisible();
  await expect(page.getByText('No account required')).toBeVisible();
  await expect(page.getByRole('button', { name: /Canals & Water/ })).toBeVisible();
  await expect(page.locator('text=Sign in').first()).toBeHidden();
});

test('a clean first launch stays in Amsterdam and starts from the local extract', async ({ page }) => {
  let overpassRequests = 0;
  await page.route(/overpass/i, (route) => {
    overpassRequests += 1;
    return route.abort();
  });
  await quietExternalRequests(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Canals & Water/ }).click();
  await expect(page.locator('#target-feature-name')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('city')).toBe('amsterdam');
  expect(overpassRequests).toBe(0);
});

test('Amsterdam uses the local extract and never contacts Overpass', async ({ page }) => {
  let overpassRequests = 0;
  await page.route(/overpass/i, (route) => {
    overpassRequests += 1;
    return route.abort();
  });
  await quietExternalRequests(page);
  await page.goto(quizUrl);
  await expect(page.locator('#target-feature-name')).toBeVisible();
  expect(overpassRequests).toBe(0);
});

test('the prompted feature remains the revealed feature', async ({ page }) => {
  await quietExternalRequests(page);
  await page.goto(quizUrl);
  const prompt = (await page.locator('#target-feature-name').textContent())?.trim();
  expect(prompt).toBeTruthy();
  const map = page.locator('.leaflet-container');
  const mapBox = await map.boundingBox();
  expect(mapBox).not.toBeNull();
  await map.click({
    position: {
      x: Math.min(mapBox!.width - 24, Math.max(24, mapBox!.width * 0.55)),
      y: Math.min(mapBox!.height - 180, Math.max(80, mapBox!.height * 0.3)),
    },
  });
  await page.locator('#confirm-pinpoint-btn').click();
  await expect(page.locator('#pinpoint-feedback-card')).toContainText(prompt!);
});

test('guest reviews persist locally across reloads', async ({ page }) => {
  await quietExternalRequests(page);
  await page.goto(quizUrl);
  await page.getByRole('button', { name: 'No idea' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('mapRecall_reviewStates_v1'))).not.toBeNull();
  const before = await page.evaluate(() => localStorage.getItem('mapRecall_reviewStates_v1'));
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('mapRecall_reviewStates_v1'))).toBe(before);
  await expect(page.locator('#target-feature-name')).toBeVisible();
});

test('core game chrome stays within an iPhone viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'Mobile layout assertion');
  await quietExternalRequests(page);
  await page.goto(quizUrl);
  const viewport = page.viewportSize()!;
  for (const selector of ['#app-game-header', '#header-menu-btn', '#pinpoint-bottom-card']) {
    const box = await page.locator(selector).boundingBox();
    expect(box, `${selector} should be laid out`).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
  }
  await testInfo.attach('iphone-game.png', { body: await page.screenshot(), contentType: 'image/png' });
});

test('desktop game hierarchy remains visually stable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop visual assertion');
  await quietExternalRequests(page);
  await page.goto(quizUrl);
  await expect(page.locator('#game-mode-switcher')).toBeVisible();
  await expect(page.locator('#pinpoint-bottom-card')).toBeVisible();
  await testInfo.attach('desktop-game.png', { body: await page.screenshot(), contentType: 'image/png' });
});
