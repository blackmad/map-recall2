import { test, expect } from '@playwright/test';

// The bicycle's front wheel is on its native -X and the boat's bow is on +X, so
// the two vehicles need opposite heading offsets. Swapping them makes the boat
// sail stern-first — which looks almost right in a still and is invisible in a
// diff — so the offsets are pinned here alongside the fact that boat mode
// actually reaches the mesh and stops drawing the canvas glyph.
test('boat mode draws the boat, facing forward', async ({ page }) => {
  test.setTimeout(180000);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/');
  await expect(page.locator('#route-card')).toBeVisible();
  await page.locator('#view-mode').selectOption('chase');
  await page.locator('#route-card').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.player?.x)), { timeout: 90000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.vectorMap?.isPlayerBoatReady?.())), { timeout: 90000 }).toBe(true);

  const report = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const map = g.vectorMap;
    const boat = map._playerBoat;
    const bike = map._playerBike;
    const ll = map.worldToLngLat(g.player.x, g.player.y, g.osmLoader);
    // Heel: the hull has no steering geometry, so a turn has to show in the
    // whole boat. Hold a lock and check it leans, then check it rights itself.
    for (let i = 0; i < 200; i++) boat.update(ll, 0, true, 1);
    const heeled = boat.heel;
    for (let i = 0; i < 400; i++) boat.update(ll, 0, true, 0);
    return {
      travelMode: g.travelMode,
      boatHeading: boat.options.headingOffset,
      bikeHeading: bike ? bike.options.headingOffset : null,
      boatLayer: Boolean(map.map.getLayer('player-boat-3d')),
      bikeLayer: Boolean(map.map.getLayer('player-bike-3d')),
      heeled,
      righted: boat.heel,
    };
  });
  console.log(JSON.stringify(report));

  expect(report.travelMode).not.toBe('car');
  expect(report.boatLayer).toBe(true);
  expect(report.bikeLayer).toBe(true);
  // Opposite noses, opposite offsets.
  expect(report.boatHeading).toBe(0);
  expect(report.bikeHeading).toBeCloseTo(Math.PI, 5);
  // A held turn leans the hull; letting go brings it back upright.
  expect(Math.abs(report.heeled)).toBeGreaterThan(0.1);
  expect(Math.abs(report.righted)).toBeLessThan(0.01);
});
