import { expect, test } from '@playwright/test';
import { openRoute } from './helpers';

// User report 2026-10-02: the bike started pointing away from the route, with the camera
// behind it, so the first thing a rider saw was the route line running off behind them.
// The road's tangent has two directions and the extract picks one arbitrarily.
for (const [travelMode, seed] of [['car', 0x5eed1234], ['car', 0x1234abcd], ['car', 0x0badf00d], ['car', 0x7777aaaa], ['boat', 0x5eed1234], ['boat', 0x2468ace0]] as const) {
  test(`${travelMode} (seed ${seed.toString(16)}) starts facing along the route, camera behind`, async ({ page }) => {
    test.setTimeout(150_000);
    // START_HEADING_OFF=1 swaps the fix for the old behaviour, to show these tests do catch it.
    if (process.env.START_HEADING_OFF) {
      await page.addInitScript(() => {
        let routeApi: any;
        Object.defineProperty(window, 'CanalRecallRoute', { configurable: true, get: () => routeApi, set: (value) => { routeApi = { ...value, startHeading: undefined }; } });
      });
    }
    await openRoute(page, { travelMode, viewMode: 'chase', seed });
    const measure = () => page.evaluate(() => {
      const game = (window as any).canalRecallGame;
      const { x, y, angle } = game.player;
      const route: Array<{ x: number; y: number }> = game.routePath ?? [];
      const target = route.find(p => Math.hypot(p.x - x, p.y - y) >= 150) ?? route[route.length - 1];
      const dx = target.x - x, dy = target.y - y;
      const facing = (Math.cos(angle) * dx + Math.sin(angle) * dy) / Math.hypot(dx, dy);
      const bearing = game.vectorMap.map?.getBearing?.();
      const expected = (((angle + Math.PI / 2) * 180 / Math.PI) % 360 + 360) % 360;
      return { facing, bearing: bearing == null ? null : ((bearing % 360) + 360) % 360, expected, routePoints: route.length };
    });
    const result = await measure();
    expect(result.routePoints).toBeGreaterThan(1);
    // Toward the route, not away: positive along the way it goes (the route may bend within
    // the first 150 px, so this is not a tight angle).
    expect(result.facing, JSON.stringify(result)).toBeGreaterThan(0.05);
    // The camera eases around after the spawn; once settled it sits behind the bike.
    if (result.bearing != null) {
      await expect.poll(async () => {
        const now = await measure();
        return Math.abs(((now.bearing! - now.expected + 540) % 360) - 180);
      }, { timeout: 20_000, message: 'camera settles behind the heading' }).toBeLessThan(25);
    }
  });
}
