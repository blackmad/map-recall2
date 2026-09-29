import { test, expect } from '@playwright/test';
import { setHiddenSelect } from './helpers';

// Utrecht, Rotterdam and Den Haag are playable from the briefing's City row
// (see HISTORY, "Full city selector"), but nothing drove them end to end: a
// ride could start in Amsterdam, or on no network at all, and every check
// would still pass. Each city must start a bike ride on its own streets,
// between its own landmarks, and key what it teaches to itself.
const CITIES = [
  { id: 'utrecht', lat: 52.0907, lng: 5.1214 },
  { id: 'rotterdam', lat: 51.9225, lng: 4.4792 },
  { id: 'den-haag', lat: 52.0705, lng: 4.3007 },
];

for (const city of CITIES) {
  test(`${city.id}: a bike ride starts on its own streets`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'data path, not layout; one project is enough');
    test.setTimeout(150_000);
    await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
    // Amsterdam-only files (street-name origins, the bridge register,
    // building facts) are absent here and must fail quietly.
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/canal-drive/');
    await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame))).toBe(true);
    await expect(page.locator('#route-card')).toBeVisible();
    await setHiddenSelect(page, 'travel-mode', 'car');
    await setHiddenSelect(page, 'city-id', city.id);
    await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.cityId)).toBe(city.id);
    await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.player?.x)), { timeout: 90_000 }).toBe(true);
    const ride = await page.evaluate(() => {
      const game = (window as any).canalRecallGame;
      const road = game.track.getNearestRoad(game.player.x, game.player.y);
      return {
        cityId: game.cityId,
        from: { name: game.routeFrom?.name, lat: game.routeFrom?.lat, lng: game.routeFrom?.lng },
        to: { name: game.routeTo?.name, lat: game.routeTo?.lat, lng: game.routeTo?.lng },
        pathPoints: game.routePath?.length ?? 0,
        onRoad: !!road && road.dist <= road.width * 1.5,
        segments: game.track.segments.length,
      };
    });
    const km = (lat: number, lng: number) => Math.hypot((lat - city.lat) * 111.32, (lng - city.lng) * 111.32 * Math.cos(city.lat * Math.PI / 180));
    expect(ride.cityId).toBe(city.id);
    expect(km(ride.from.lat, ride.from.lng), JSON.stringify(ride)).toBeLessThan(15);
    expect(km(ride.to.lat, ride.to.lng), JSON.stringify(ride)).toBeLessThan(15);
    expect(ride.pathPoints, 'a planned route between the two landmarks').toBeGreaterThan(1);
    expect(ride.onRoad, 'the bike spawns on the network').toBe(true);
    expect(ride.segments).toBeGreaterThan(1000);
    await page.waitForTimeout(3000);
    expect(errors, 'no uncaught errors from files this city lacks').toEqual([]);
  });
}
