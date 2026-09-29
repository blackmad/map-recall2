import { test, expect } from '@playwright/test';
import { setHiddenSelect } from './helpers';

// TODO item 6, "due-aware where next". Plan review used to switch questions
// to due names while the route stayed a random pair, so most due names never
// came under the wheels. With Plan review on, the ride now runs between the
// landmarks whose line passes the most due names, and the briefing counts
// them without naming them.
test('plan review picks a ride past the names that are due', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'route choice; one project is enough');
  test.setTimeout(150000);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame))).toBe(true);
  await expect(page.locator('#route-card')).toBeVisible();
  await setHiddenSelect(page, 'travel-mode', 'car');
  await expect.poll(() => page.evaluate(() => ((window as any).canalRecallGame.routePois || []).length)).toBeGreaterThan(10);
  const planted = await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    const pois = game.routePois;
    // Two landmarks 1.5–4 km apart; due names sit on the line between them.
    let pair: any = null;
    for (const a of pois) {
      for (const b of pois) {
        const km = Math.hypot((a.lat - b.lat) * 111.32, (a.lng - b.lng) * 111.32 * 0.61);
        if (a.id !== b.id && km > 1.5 && km < 4) { pair = [a, b]; break; }
      }
      if (pair) break;
    }
    const [a, b] = pair;
    const at = (t: number) => [a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t];
    const due = [0.3, 0.5, 0.7].map((t, i) => ({ name: `Due street ${i}`, type: 'street', cityId: game.cityId || 'amsterdam', center: at(t), dueAt: Date.now() - 1000 }));
    game.recall.dueReviews = () => due;
    return { a: a.id, b: b.id };
  });
  // Plan review from the knowledge screen turns on due-only questions.
  await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    const prefs = game._prefs();
    game._prefs = () => ({ ...prefs, skipMastered: true });
  });
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame._reviewRoute)), { timeout: 30000 }).toBe(true);
  const result = await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    const a = game.routeFrom, b = game.routeTo;
    const kx = 111.32 * Math.cos(a.lat * Math.PI / 180), ky = 111.32;
    const offLine = game.recall.dueReviews().map((place: any) => {
      const px = (place.center[1] - a.lng) * kx, py = (place.center[0] - a.lat) * ky;
      const bx = (b.lng - a.lng) * kx, by = (b.lat - a.lat) * ky;
      const t = Math.max(0, Math.min(1, (px * bx + py * by) / (bx * bx + by * by)));
      return Math.hypot(px - bx * t, py - by * t);
    });
    return { from: a.id, to: b.id, offLine, dueNear: game._reviewRoute.dueNear, tease: game._composeMissionBrief().tease };
  });
  // Landmarks are dense in the centre, so another pair may pass the same
  // names; what matters is that every due name is on the chosen line.
  for (const km of result.offLine) expect(km, JSON.stringify({ planted, result })).toBeLessThanOrEqual(0.2);
  expect(result.dueNear).toHaveLength(3);
  expect(result.tease).toBe('Review ride: 3 overdue names on the way');
});
