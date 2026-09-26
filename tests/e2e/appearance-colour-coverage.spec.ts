import { expect, test } from '@playwright/test';

test('reviewed colour coverage hides priors and restores the normal city', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/canal-drive/');
  await page.locator('[data-choice="route:study"]').click();
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame?.vectorMap?._completeCity?.status().styledFeatures ?? 0), { timeout: 90_000 }).toBeGreaterThan(0);
  const result = await page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap;
    const before = vm.map.getFilter('osm-colored-buildings');
    vm.setMeasuredColoursOnly(true);
    const enabled = {
      filter: vm.map.getFilter('osm-colored-buildings'),
      basemap: vm.map.getLayoutProperty('building-3d', 'visibility'),
      buildingDetails: [...vm._studyRoofAreas, ...vm._studyFacadeAreas].some((layer: any) => layer.enabled),
    };
    vm.setMeasuredColoursOnly(false);
    return { before, enabled, after: vm.map.getFilter('osm-colored-buildings') };
  });
  expect(JSON.stringify(result.enabled.filter)).toContain('measured-accepted');
  expect(result.enabled.basemap).toBe('none');
  expect(result.enabled.buildingDetails).toBe(false);
  expect(result.after).toEqual(result.before);
});
