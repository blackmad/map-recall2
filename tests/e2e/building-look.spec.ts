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
      // Three looks own whole buildings: no MapLibre lid or wall band to hang in the air (user report 2026-10-02).
      lidOff: JSON.stringify(map.getFilter('osm-colored-building-roofs')).includes('["!",["has","facade"]]'),
      wallCollapsed: JSON.stringify(map.getPaintProperty('osm-colored-buildings', 'fill-extrusion-height')).includes('"has","facade"') };
  });

  const first = await read();
  expect(first).toMatchObject({ look: 'default', pattern: 'visible', three: 0 });

  await page.evaluate(() => (window as any).canalRecallGame.vectorMap.setBuildingLookPreference('cartoon'));
  await expect.poll(async () => (await read()).three, { timeout: 60_000 }).toBeGreaterThan(0);
  expect(await read()).toMatchObject({ look: 'cartoon', pattern: 'none', base: true, lidOff: true, wallCollapsed: true });

  await page.evaluate(() => (window as any).canalRecallGame.vectorMap.setBuildingLookPreference('photo'));
  await expect.poll(async () => (await read()).look).toBe('photo');
  await page.waitForTimeout(3000);
  expect((await read()).three).toBeGreaterThan(0);

  await page.evaluate(() => (window as any).canalRecallGame.vectorMap.setBuildingLookPreference('default'));
  await expect.poll(async () => (await read()).pattern).toBe('visible');
  expect(await read()).toMatchObject({ look: 'default', three: 0, base: true, lidOff: false, wallCollapsed: false });
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
