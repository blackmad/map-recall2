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
    return { from: a.id, to: b.id, offLine, dueNear: game._reviewRoute.dueNear };
  });
  // Landmarks are dense in the centre, so another pair may pass the same
  // names; what matters is that every due name is on the chosen line.
  for (const km of result.offLine) expect(km, JSON.stringify({ planted, result })).toBeLessThanOrEqual(0.2);
  expect(result.dueNear).toHaveLength(3);

  // Once the path is planned, the briefing promises only the due names it
  // actually rides (2026-09-30). These planted names are on no real street,
  // so an honest briefing makes no review promise at all.
  await expect.poll(() => page.evaluate(() => Array.isArray((window as any).canalRecallGame._reviewRoute?.dueOnPath)), { timeout: 90000 }).toBe(true);
  const planned = await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    return { dueOnPath: game._reviewRoute.dueOnPath, tease: game._composeMissionBrief().tease || '' };
  });
  expect(planned.dueOnPath).toEqual([]);
  expect(planned.tease).not.toContain('Review ride');
});

// The router rides the due names: a real street beside the planned path,
// once due, pulls the path onto it when the detour is within the cap.
test('a review ride routes along a due street it would otherwise avoid', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'route choice; one project is enough');
  test.setTimeout(150000);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame))).toBe(true);
  await setHiddenSelect(page, 'travel-mode', 'car');
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.player?.x)), { timeout: 90000 }).toBe(true);
  const result = await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    const track = game.track;
    const start = track.startPoint, finish = track.finishPoint;
    const namesOn = (path: Array<{ x: number; y: number }>) => {
      const names = new Set<string>();
      for (let i = 1; i < path.length; i++) {
        const name = track.getRoadName((path[i - 1].x + path[i].x) / 2, (path[i - 1].y + path[i].y) / 2,
          Math.atan2(path[i].y - path[i - 1].y, path[i].x - path[i - 1].x));
        if (name) names.add(name);
      }
      return names;
    };
    track._reviewDueNames = null;
    const plain = track.planRoute(start, finish);
    const onPlain = namesOn(plain.path);
    // Candidate due streets: named segments near the plain path, not on it.
    const candidates = new Set<string>();
    for (const segment of track.segments) {
      const name = segment.name || segment.tags?.name;
      if (!name || onPlain.has(name)) continue;
      const near = segment.points?.some((p: any) => plain.path.some((q: any) => Math.hypot(p.x - q.x, p.y - q.y) < 120));
      if (near) candidates.add(name);
    }
    for (const name of candidates) {
      track._reviewDueNames = new Set([name]);
      const review = track.planRoute(start, finish);
      if (review.dueNamesOnPath.includes(name)) {
        track._reviewDueNames = null;
        return { name, rode: true, detour: review.physicalDistance / plain.physicalDistance, tried: candidates.size };
      }
    }
    track._reviewDueNames = null;
    return { name: null, rode: false, detour: 0, tried: candidates.size };
  });
  expect(result.tried, 'there are streets beside the path to try').toBeGreaterThan(0);
  expect(result.rode, JSON.stringify(result)).toBe(true);
  // Capped against the shortest path, which the plain plan is no shorter than.
  expect(result.detour).toBeLessThanOrEqual(1.25 + 1e-6);
});
