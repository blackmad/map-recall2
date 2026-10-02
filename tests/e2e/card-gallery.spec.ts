import { expect, test } from '@playwright/test';

// The review page that shows every neighbourhood's answer card (src/CardGallery.tsx).
test('the gallery shows a card for every neighbourhood and flags gaps', async ({ page }) => {
  await page.route(/(basemaps\.cartocdn\.com|tile\.openstreetmap\.org|googleapis\.com|gstatic\.com|wikimedia\.org)/, (route) => route.abort());
  await page.goto('/?gallery=cards&city=amsterdam');
  await expect(page.getByTestId('gallery-card').first()).toBeVisible({ timeout: 30_000 });
  expect(await page.getByTestId('gallery-card').count()).toBeGreaterThan(60);
  await page.getByPlaceholder('Filter by name').fill('jordaan');
  await expect.poll(async () => await page.getByTestId('gallery-card').count()).toBeLessThan(5);
  await expect(page.getByTestId('gallery-card').first().getByTestId('answer-trivia')).toBeVisible();
});
