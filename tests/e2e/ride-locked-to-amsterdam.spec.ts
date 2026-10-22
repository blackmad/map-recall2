import { test, expect } from '@playwright/test';

// The ride is Amsterdam-only (2026-10-22): the City row is gone from setup, and
// a preference saved before the picker went away must not start Utrecht,
// Rotterdam or Den Haag. The destination and tour pickers are gone from the
// card too; the scripts use their off-screen selects.
test('setup offers no city, destination or tour picker and rides Amsterdam', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'data path, not layout; one project is enough');
  test.setTimeout(150_000);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  // A rider from before the lock has another city stored.
  await page.addInitScript(() => {
    localStorage.setItem('canalRecall.preferences.v1', JSON.stringify({ cityId: 'utrecht', travelMode: 'car' }));
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame))).toBe(true);
  await expect(page.locator('#route-card')).toBeVisible();

  await expect(page.locator('.setup-city-select'), 'no city field').toHaveCount(0);
  await expect(page.getByText('City', { exact: true }), 'no city label').toHaveCount(0);
  await expect(page.getByText('Destination', { exact: true }), 'no destination field').toHaveCount(0);
  await expect(page.getByText('Tours', { exact: true }), 'no tours field').toHaveCount(0);
  await expect(page.locator('#mission-brief'), 'no briefing line under Start').toHaveCount(0);

  const city = page.locator('#city-id');
  await expect(city).toHaveCount(1);
  await expect(city.locator('option')).toHaveCount(1);
  await expect(city.locator('option')).toHaveAttribute('value', 'amsterdam');
  await expect(page.locator('#tour-picker')).toHaveCount(1);
  // Kept for the review scripts, but clipped to a pixel, out of the tab order
  // and out of the accessibility tree.
  const hooks = await page.evaluate(() => {
    const wrapper = document.querySelector('.setup-automation-controls') as HTMLElement;
    const select = document.getElementById('poi-destination') as HTMLSelectElement;
    const clip = getComputedStyle(wrapper).clipPath;
    return {
      clip,
      overflow: getComputedStyle(wrapper).overflow,
      ariaHidden: select.getAttribute('aria-hidden'),
      tabIndex: select.tabIndex,
    };
  });
  expect(hooks.clip, 'the control wrapper is clipped away').toContain('inset(50%)');
  expect(hooks.overflow).toBe('hidden');
  expect(hooks.ariaHidden).toBe('true');
  expect(hooks.tabIndex).toBe(-1);

  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.cityId)).toBe('amsterdam');
  await page.evaluate(() => (window as any).canalRecallGame._overlay.store.patchPrefs({ cityId: 'rotterdam' }, { min: 0.2, max: 1.5, defaultZoom: 0.5 }));
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame._overlay.store.getState().prefs.cityId)).toBe('amsterdam');

  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.player?.x)), { timeout: 90_000 }).toBe(true);
  const ride = await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    return {
      cityId: game.cityId,
      from: { lat: game.routeFrom?.lat, lng: game.routeFrom?.lng },
      to: { lat: game.routeTo?.lat, lng: game.routeTo?.lng },
      pathPoints: game.routePath?.length ?? 0,
    };
  });
  const km = (lat: number, lng: number) => Math.hypot((lat - 52.3728) * 111.32, (lng - 4.8936) * 111.32 * Math.cos(52.37 * Math.PI / 180));
  expect(ride.cityId).toBe('amsterdam');
  expect(km(ride.from.lat, ride.from.lng), JSON.stringify(ride)).toBeLessThan(15);
  expect(km(ride.to.lat, ride.to.lng), JSON.stringify(ride)).toBeLessThan(15);
  expect(ride.pathPoints, 'a planned route between the two landmarks').toBeGreaterThan(1);
  expect(errors, 'no uncaught errors').toEqual([]);
});
