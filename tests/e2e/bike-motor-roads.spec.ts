import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression (user report 2026-09-28, "my bike is seemingly entirely
// stuck in this building"): a ride from Oosterdokskade to Noord was routed
// through the IJ-tunnel, a trunk autoweg closed to bikes, under the IJ and
// into its portal building. Street mode is cycling, so motorways and trunk
// roads are not loaded, and Noord is still reachable without them.
test('the cycling graph has no motor roads and still reaches Noord', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'data check; one project is enough');
  test.setTimeout(120000);
  await openRoute(page, { travelMode: 'car', viewMode: 'north' });
  const result = await page.evaluate(() => {
    const game = (window as any).canalRecallGame, track = game.track, loader = game.osmLoader;
    const world = (lat: number, lng: number) => {
      const mLat = 111320 * 3, mLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180) * 3;
      return { x: loader._lastOffsetX + (lng - loader._lastCenterLng) * mLng, y: loader._lastOffsetY - (lat - loader._lastCenterLat) * mLat };
    };
    const names = new Set(track.segments.map((segment: any) => segment.name));
    const route = track.findRoute(world(52.37655, 4.90750), world(52.40030, 4.93240));
    let length = 0;
    for (let i = 1; i < route.length; i++) length += Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y);
    return {
      tunnels: ['IJ-tunnel', 'Piet Heintunnel', 'Coen Tunnel', 'Ringweg-Noord'].filter(name => names.has(name)),
      points: route.length,
      km: length / 3000,
    };
  });
  expect(result.tunnels, 'motor roads closed to bikes').toEqual([]);
  expect(result.points, JSON.stringify(result)).toBeGreaterThan(10);
  expect(result.km, JSON.stringify(result)).toBeLessThan(15);
});
