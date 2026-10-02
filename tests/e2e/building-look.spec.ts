import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// The Building look setting switches wall layers live (default pattern layer <->
// three.js layer) without a reload, and a `?buildings3d=` look beats the saved
// preference. Cloud sandboxes: PW_OFFLINE_MAP=1 PW_CHROME=<chromium> (see helpers).


test('building look switches live and the URL look wins over the preference', async ({ page }) => {
  test.setTimeout(240_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.vectorMap._facadesActive?.() === true, null, { timeout: 90_000 });
  await page.waitForTimeout(6000);

  const read = () => page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
    const pattern = map.getLayer('osm-colored-building-facades') ? map.getLayoutProperty('osm-colored-building-facades', 'visibility') : 'absent';
    return { look: vm._buildings3dLook, pattern, three: vm._threeBuildings ? vm._threeBuildings.stats().chunks : 0, base: JSON.stringify(map.getPaintProperty('osm-colored-buildings', 'fill-extrusion-base')).includes('"has","facade"'),
      // Three looks draw the whole city: MapLibre's building layers are off, so no slab can hang in the air (user reports 2026-10-02).
      maplibreBuildings: ['osm-colored-buildings', 'osm-colored-building-roofs'].map(id => map.getLayoutProperty(id, 'visibility') ?? 'visible').join(',') };
  });

  const first = await read();
  expect(first).toMatchObject({ look: 'default', pattern: 'visible', three: 0 });

  await page.evaluate(() => (window as any).canalRecallGame.vectorMap.setBuildingLookPreference('cartoon'));
  await expect.poll(async () => (await read()).three, { timeout: 60_000 }).toBeGreaterThan(0);
  expect(await read()).toMatchObject({ look: 'cartoon', pattern: 'none', base: true, maplibreBuildings: 'none,none' });

  await page.evaluate(() => (window as any).canalRecallGame.vectorMap.setBuildingLookPreference('photo'));
  await expect.poll(async () => (await read()).look).toBe('photo');
  await page.waitForTimeout(3000);
  expect((await read()).three).toBeGreaterThan(0);

  await page.evaluate(() => (window as any).canalRecallGame.vectorMap.setBuildingLookPreference('default'));
  await expect.poll(async () => (await read()).pattern).toBe('visible');
  expect(await read()).toMatchObject({ look: 'default', three: 0, base: true, maplibreBuildings: 'visible,visible' });
});

test('a URL look is not overridden by the saved preference', async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => { (window as any).__canalRecallBuildings3d = 'cartoon'; });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.vectorMap._facadesActive?.() === true, null, { timeout: 90_000 });
  await page.evaluate(() => (window as any).canalRecallGame.vectorMap.setBuildingLookPreference('default'));
  expect(await page.evaluate(() => (window as any).canalRecallGame.vectorMap._buildings3dLook)).toBe('cartoon');
  await page.evaluate(() => (window as any).canalRecallGame.vectorMap.setBuildingLook('default'));
  expect(await page.evaluate(() => (window as any).canalRecallGame.vectorMap._buildings3dLook)).toBe('default');
});

test('B cycles the building look through every renderer and back, saved with the settings', async ({ page }) => {
  test.setTimeout(240_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: true });
  await page.waitForFunction(() => (window as any).canalRecallGame.vectorMap._facadesActive?.() === true, null, { timeout: 90_000 });
  const look = () => page.evaluate(() => (window as any).canalRecallGame.vectorMap.buildingLook());
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('canalRecall.preferences.v1') || '{}').buildingLook);

  expect(await look()).toBe('default');
  const seen = ['default'];
  for (const [expected, label] of [['procedural', 'Painted'], ['storybook', 'Storybook'], ['cartoon', 'Cartoon'], ['photo', 'Photo'], ['default', 'Default']] as const) {
    await page.keyboard.press('b');
    await expect.poll(look, { timeout: 15_000 }).toBe(expected);
    seen.push(expected);
    // A brief label says what changed, and the choice is saved like the Settings control would.
    await expect(page.locator('#canal-look-label')).toHaveText(`Buildings: ${label}`);
    await expect.poll(saved).toBe(expected);
  }
  expect(seen).toEqual(['default', 'procedural', 'storybook', 'cartoon', 'photo', 'default']);
  // The Settings panel shows the same choice (it reads the same preferences).
  expect(await page.evaluate(() => (window as any).canalRecallGame._prefs().buildingLook)).toBe('default');
});
