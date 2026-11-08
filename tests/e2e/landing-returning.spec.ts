import { expect, test, type Page, type Request } from '@playwright/test';
import { CANAL_CITIES } from '../../src/canalRecall/game/cities';
import { dailyRideDateKey, dailyRideRouteId } from '../../src/canalRecall/game/dailyRide';
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
  // 23:30 UTC on 8 Nov is 9 Nov in Amsterdam: the ride follows Amsterdam's date, not the browser's.
  const at = Date.UTC(2026, 10, 8, 23, 30);
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
  expect(ids[0]).toBe(dailyRideRouteId('2026-11-09', pois));
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
