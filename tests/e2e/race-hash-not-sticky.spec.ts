import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression (user, 2026-10-09): every ride wrote `#race=start,finish`
// into the address bar, and loading a page with that hash replays the route
// without the menu or the destination picker. A reload, a restored tab or an
// autocompleted URL therefore replayed Da Costakade → De Dolphijn every time.
test('a ride does not leave its route in the address bar', async ({ page }) => {
  test.setTimeout(180_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  await page.waitForFunction(() => (window as any).canalRecallGame?.state === 4, null, { timeout: 120_000 });
  expect(new URL(page.url()).hash).toBe('');
});

test('a share link plays once, then clears itself', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/canal-drive/#race=52.3737,4.8816,52.3728,4.8737,52.3757,4.8898');
  await page.waitForFunction(() => (window as any).canalRecallGame?.state === 4, null, { timeout: 120_000 });
  expect(new URL(page.url()).hash).toBe('');
});
