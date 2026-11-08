import { expect, test, type Page, type Request } from '@playwright/test';
import { CANAL_CITIES } from '../../src/canalRecall/game/cities';
import { dailyPoolPair, dailyRideDateKey, dailyRideRouteId } from '../../src/canalRecall/game/dailyRide';
import { landingFixtureEntries, type LandingScenario } from '../../src/canalRecall/landing/landingFixtures';

// G2 (#272): the landing page for a returning player — Today's ride, Continue
// (names due) and Free Ride — drawn from localStorage alone; the daily route
// is the same in every browser on a date; Continue starts a review ride.
// Needs js/landing.bundle.js and the rebuilt route-selection bundle.

const LANDING = '/canal-drive/landing.html';
const shots = process.env.G2_SHOTS || 'artifacts/g2-landing';
const pois = CANAL_CITIES.amsterdam.curatedPois.map(poi => ({ ...poi }));
/** Hosts the static page itself loads (fonts, video loops); anything else is a network read. */
const STATIC_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com', 'media.rideamsterdam.nl']);

async function seed(page: Page, scenario: LandingScenario, now = Date.now()) {
  const entries = landingFixtureEntries(scenario, now);
  await page.addInitScript((data: Record<string, string>) => {
    if (sessionStorage.getItem('g2-seeded')) return;
    sessionStorage.setItem('g2-seeded', '1');
    for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value);
  }, entries);
}

function networkReads(page: Page): Request[] {
  const reads: Request[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    const type = request.resourceType();
    if (type === 'fetch' || type === 'xhr' || type === 'websocket' || type === 'eventsource') reads.push(request);
    else if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost' && !STATIC_HOSTS.has(url.hostname)) reads.push(request);
  });
  return reads;
}

test('a first-time visitor keeps the static landing', async ({ page }) => {
  await page.goto(LANDING);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Learn Amsterdam');
  await expect(page.locator('#landing-returning-slot')).toBeHidden();
  await expect(page.locator('[data-landing-card]')).toHaveCount(0);
});

test('a returning player gets three cards from localStorage alone, no network', async ({ page }, info) => {
  const now = Date.now();
  await seed(page, 'returning', now);
  const reads = networkReads(page);
  await page.goto(LANDING);
  const slot = page.locator('#landing-returning-slot');
  await expect(slot).toBeVisible();
  await expect(page.locator('[data-landing-card]')).toHaveCount(3);
  await expect(page.locator('[data-landing-card="review"] .landing-card-title')).toHaveText('7 names due · 12 min');
  await expect(page.locator('[data-landing-stats]')).toContainText('Streak · 3 days');
  await expect(page.locator('[data-landing-stats]')).toContainText('Passport · 4 stamps');
  await expect(page.locator('.landing-board li')).toHaveCount(3);
  const route = await page.locator('.landing-returning').getAttribute('data-daily-route');
  expect(route).toBe(dailyRideRouteId(dailyRideDateKey(now), pois));
  // The static hero still follows.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Learn Amsterdam');
  await page.waitForLoadState('networkidle');
  // The What's New toast (G7, whats-new-toast.bundle.js) reads the notes and the deployment stamp on
  // every landing load; the returning player's cards themselves come from localStorage alone.
  const toastReads = /\/(whats-new-notes|deployment)\.json(\?|$)/;
  expect(reads.filter(r => !toastReads.test(r.url())).map(r => `${r.resourceType()} ${r.url()}`)).toEqual([]);
  await page.screenshot({ path: `${shots}/landing-returning-${info.project.name}.png` });
  await page.locator('#landing-returning-slot').screenshot({ path: `${shots}/landing-cards-${info.project.name}.png` });
});

test('?landing=0 keeps the static landing for a returning player', async ({ page }) => {
  await seed(page, 'returning');
  await page.goto(`${LANDING}?landing=0`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Learn Amsterdam');
  await expect(page.locator('[data-landing-card]')).toHaveCount(0);
});

test('today’s route is identical in two browsers on the same date', async ({ browser }) => {
  // 23:30 UTC on 11 Nov is 12 Nov in Amsterdam: the ride follows Amsterdam's date, not the browser's.
  // (A buurt-pool day, after DAILY_POOL_CUTOVER.)
  const at = Date.UTC(2026, 10, 11, 23, 30);
  const ids: Array<string | null> = [];
  for (const timezoneId of ['Europe/Amsterdam', 'America/Los_Angeles']) {
    const context = await browser.newContext({ timezoneId });
    const page = await context.newPage();
    await page.clock.setFixedTime(at);
    await seed(page, 'returning', at);
    await page.goto(LANDING);
    await expect(page.locator('.landing-returning')).toBeVisible();
    ids.push(await page.locator('.landing-returning').getAttribute('data-daily-route'));
    await context.close();
  }
  expect(ids[0]).toBeTruthy();
  expect(ids[1]).toBe(ids[0]);
  expect(ids[0]).toBe(dailyRideRouteId('2026-11-12', pois));
  expect(ids[0]).toMatch(/^2026-11-12:(buurt|tour)-/);
});

type RideGame = {
  state: number;
  routePattern: string;
  routeFrom: { id: string } | null;
  routeTo: { id: string } | null;
  _reviewRoute: { dueNear: string[] } | null;
};

const rideState = (page: Page) => page.evaluate(() => {
  const w = window as unknown as {
    canalRecallGame?: RideGame;
    __canalRecallSession?: { landingCardChosen?: string };
    CanalRecallRoute?: { dailyRidePair?: unknown };
  };
  const g = w.canalRecallGame;
  return g ? {
    state: g.state,
    pattern: g.routePattern,
    from: g.routeFrom?.id ?? null,
    to: g.routeTo?.id ?? null,
    review: g._reviewRoute ? g._reviewRoute.dueNear : null,
    chosen: w.__canalRecallSession?.landingCardChosen ?? null,
    hasDaily: typeof w.CanalRecallRoute?.dailyRidePair === 'function',
  } : null;
});

test('Continue starts a review ride past the names due', async ({ page }) => {
  test.setTimeout(150_000);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await seed(page, 'returning');
  await page.goto(LANDING);
  await page.locator('[data-landing-go="review"]').click();
  await expect(page).toHaveURL(/\?ride=review/);
  await expect.poll(async () => (await rideState(page))?.chosen, { timeout: 60_000 }).toBe('review');
  await expect.poll(async () => (await rideState(page))?.review?.length ?? 0, { timeout: 90_000 }).toBeGreaterThan(0);
  const ride = await rideState(page);
  expect(ride?.pattern).toBe('surprise');
});

test('Today’s ride launches the pair the landing named', async ({ page }) => {
  test.setTimeout(150_000);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  const now = Date.now();
  await seed(page, 'returning', now);
  await page.goto(LANDING);
  const id = await page.locator('.landing-returning').getAttribute('data-daily-route');
  await page.locator('[data-landing-go="daily"]').click();
  await expect(page).toHaveURL(/\?ride=daily/);
  await expect.poll(async () => (await rideState(page))?.chosen, { timeout: 60_000 }).toBe('daily');
  const ride = await rideState(page);
  expect(ride?.hasDaily).toBe(true);
  expect(`${dailyRideDateKey(now)}:${ride?.from}>${ride?.to}`).toBe(id);
});

// The buurt pool (#279): a real ride for three dates starts on the pair the
// date names, plans a route, and arrives. `?dailyDate=` is the test-only
// override of "today" in dailyRideDateKey().
for (const date of ['2026-11-10', '2026-12-24', '2027-03-01']) {
  test(`?ride=daily on ${date} starts the buurt pair and arrives`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one ride per date is enough; the iphone project runs the landing tests');
    test.setTimeout(180_000);
    await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
    await seed(page, 'returning');
    // The pool's ends sit on streets: ride in street mode (bike). The default travel mode is boat, and
    // `?ride=daily` does not set street mode yet (integrator: game-route.js _checkShareLink, #279 hand-back).
    await page.addInitScript(() => {
      if (!localStorage.getItem('canalRecall.preferences.v1')) localStorage.setItem('canalRecall.preferences.v1', JSON.stringify({ travelMode: 'car' }));
    });
    const pair = dailyPoolPair(date)!;
    await page.goto(`/canal-drive/index.html?ride=daily&dailyDate=${date}`);
    await expect.poll(async () => (await rideState(page))?.chosen, { timeout: 60_000 }).toBe('daily');
    const ride = await rideState(page);
    expect(`${date}:${ride?.from}>${ride?.to}`).toBe(pair.id);
    // A route was planned between the ends, and the ride is under way.
    await expect.poll(() => page.evaluate(() => {
      const g = (window as unknown as { canalRecallGame?: { state: number; travelMode?: string; routePath?: unknown[]; _plannedRouteLengthPx?: number } }).canalRecallGame;
      return g && g.state === 4 && g.travelMode === 'car' && (g.routePath?.length ?? 0) > 1 && (g._plannedRouteLengthPx ?? 0) > 0;
    }), { timeout: 90_000 }).toBe(true);
    const planned = await page.evaluate(() => {
      const g = (window as unknown as { canalRecallGame: { _plannedRouteLengthPx: number; track: { startPoint: { x: number; y: number }; finishPoint: { x: number; y: number } } } }).canalRecallGame;
      return { px: g._plannedRouteLengthPx, crow: Math.hypot(g.track.finishPoint.x - g.track.startPoint.x, g.track.finishPoint.y - g.track.startPoint.y) };
    });
    // 3 px = 1 m. The planned route is at least the straight line, and the ends are the pair's (straight line within 25%).
    expect(planned.px).toBeGreaterThanOrEqual(planned.crow * 0.99);
    expect(planned.crow / 3 / 1000).toBeGreaterThan((pair.km / 1.3) * 0.75);
    expect(planned.crow / 3 / 1000).toBeLessThan((pair.km / 1.3) * 1.25);
    // Arrive: put the rider on the finish.
    await page.evaluate(() => {
      const g = (window as unknown as { canalRecallGame: { player: { x: number; y: number; speed: number }; track: { finishPoint: { x: number; y: number } } } }).canalRecallGame;
      g.player.x = g.track.finishPoint.x; g.player.y = g.track.finishPoint.y; g.player.speed = 0;
    });
    await expect.poll(async () => (await rideState(page))?.state, { timeout: 30_000 }).toBe(5);
    console.log(`${date}: ${pair.from.name} → ${pair.to.name}, ${pair.km} km est., planned ${(planned.px / 3000).toFixed(2)} km`);
    await page.screenshot({ path: `${shots}/daily-${date}-arrived-${info.project.name}.png` });
  });
}
