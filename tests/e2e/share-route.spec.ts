import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// "Share this route" on the arrival card (src/canalRecall/shareRoute.ts via
// CanalRouteHistory.shareRide): without a share sheet it copies the link and
// shows a "Link copied" toast; the link boots the same start, finish and mode
// in a fresh page; a Home start shares from a public stand-in, never from home.

type Game = {
  state: number;
  travelMode: string;
  _raceKey: string | null;
  _shareUrl?: string | null;
  routeFrom: { id?: string; name: string; lat: number; lng: number };
  routeTo: { name: string; reviewStop?: string };
  routePois: Array<{ id: string; name: string; lat: number; lng: number }>;
  player: { x: number; y: number; speed: number };
  track: { finishPoint: { x: number; y: number } };
};
declare global { interface Window { canalRecallGame: Game; __canalLastShare?: { url: string; outcome: string } } }

const raceKeyOf = (url: string) => {
  const [lat, lng, sLat, sLng, fLat, fLng] = url.slice(url.indexOf('#race=') + 6).split(',').map(Number);
  const f = (n: number) => n.toFixed(3);
  return `${f(lat)},${f(lng)}_${f(sLat)},${f(sLng)}_${f(fLat)},${f(fLng)}`;
};

async function arrive(page: Page) {
  await page.waitForFunction(() => Boolean(window.canalRecallGame._shareUrl), null, { timeout: 120_000 });
  await page.evaluate(() => { window.canalRecallGame.state = 4; });
  await page.evaluate(() => {
    const game = window.canalRecallGame;
    if (game.routeTo.reviewStop) game.routeTo = { ...game.routeTo, reviewStop: undefined };
    game.player.x = game.track.finishPoint.x;
    game.player.y = game.track.finishPoint.y;
    game.player.speed = 0;
  });
  await page.waitForFunction(() => window.canalRecallGame.state === 5, null, { timeout: 30_000 });
}

test('Share this route on arrival copies a link that boots the same route; a Home start is neutralised', async ({ page, context, browser }) => {
  test.skip(test.info().project.name !== 'desktop', 'the share path is the same on both; the e2e boots two rides');
  test.setTimeout(360_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // No share sheet in this browser: the clipboard path and its toast.
  await page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true }); });
  await openRoute(page, { travelMode: 'boat', viewMode: 'chase' });
  await arrive(page);
  const ride = await page.evaluate(() => ({ raceKey: window.canalRecallGame._raceKey, travelMode: window.canalRecallGame.travelMode }));

  await page.keyboard.press('KeyC');
  await expect(page.locator('#canal-share-toast')).toHaveText('Link copied');
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toMatch(/\/canal-drive\/\?travel=boat#race=/);
  expect(raceKeyOf(url)).toBe(ride.raceKey);
  await page.screenshot({ path: `artifacts/share-route/arrival-copied-${test.info().project.name}.png` });

  // The same ride from a Home start: the link must not carry the start point.
  const home = await page.evaluate(() => {
    const game = window.canalRecallGame;
    // A home ~220 m off the ride's start POI: what a geocoded address looks like in the replay hash.
    const raw = game._shareUrl!;
    const parts = raw.slice(raw.indexOf('#race=') + 6).split(',').map(Number);
    parts[2] += 0.002;
    game._shareUrl = `${raw.slice(0, raw.indexOf('#race='))}#race=${parts.map(n => n.toFixed(4)).join(',')}`;
    game.routeFrom = { id: 'home', name: 'Home', lat: parts[2], lng: parts[3] };
    return { pois: game.routePois.map(p => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`), raw: game._shareUrl };
  });
  await page.waitForTimeout(2100);
  await page.keyboard.press('KeyC');
  await expect(page.locator('#canal-share-toast')).toContainText('nearby landmark');
  const neutral = await page.evaluate(() => navigator.clipboard.readText());
  const [, , sLat, sLng] = neutral.slice(neutral.indexOf('#race=') + 6).split(',');
  const [, , rawLat, rawLng] = home.raw.slice(home.raw.indexOf('#race=') + 6).split(',');
  expect(`${sLat},${sLng}`).not.toBe(`${rawLat},${rawLng}`);
  expect(home.pois).toContain(`${sLat},${sLng}`);
  expect(neutral).not.toContain(`${rawLat},${rawLng}`);
  expect(neutral).not.toMatch(/home/i);

  // Another rider (a fresh context: no saved boat preference) opens the first link:
  // same mode, centre, start and finish.
  const fresh = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width: 1440, height: 900 } });
  const other = await fresh.newPage();
  await other.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await other.goto(url);
  await other.waitForFunction(() => window.canalRecallGame?.state === 4, null, { timeout: 150_000 });
  const replay = await other.evaluate(() => ({ raceKey: window.canalRecallGame._raceKey, travelMode: window.canalRecallGame.travelMode }));
  expect(replay).toEqual(ride);
  await fresh.close();
});

test('My progress shares public rides and keeps Home rides private', async ({ page, context }) => {
  test.skip(test.info().project.name !== 'desktop', 'one viewport pass covers both widths');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true }); });
  const ride = (id: string, endedAt: number, start: { name: string; lat: number; lng: number }) => ({
    id, schemaVersion: 1, startedAt: endedAt - 600_000, endedAt, mode: 'boat', cityId: 'amsterdam',
    start: { name: start.name, lngLat: [start.lng, start.lat] },
    finish: { name: 'Dam Square', landmarkId: 'dam', lngLat: [4.8926, 52.3731] },
    namedCount: 1, askedCount: 2, points: 50, streetsLearned: ['Singel'],
    raceHash: `#race=${((start.lat + 52.3731) / 2).toFixed(4)},${((start.lng + 4.8926) / 2).toFixed(4)},${start.lat.toFixed(4)},${start.lng.toFixed(4)},52.3731,4.8926`,
  });
  const now = Date.now();
  const records = [ride('pub', now - 1000, { name: 'Westerkerk', lat: 52.3747, lng: 4.8838 }), ride('home', now - 2000, { name: 'Home', lat: 52.3768, lng: 4.8829 })];
  await page.goto('/progress');
  await page.evaluate(list => localStorage.setItem('canalRecall.routeHistory.v1', JSON.stringify(list)), records);
  await page.reload();
  const pub = page.locator('[data-ride-id="pub"]');
  const home = page.locator('[data-ride-id="home"]');
  await expect(pub.getByTestId('ride-share')).toBeVisible();
  await expect(home.getByTestId('ride-share')).toHaveCount(0);
  await expect(home.getByTestId('ride-again')).toHaveAttribute('href', /\?travel=boat&start=home#race=/);
  await pub.getByTestId('ride-share').click();
  await expect(page.getByTestId('share-toast')).toHaveText('Link copied');
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toBe(`${new URL(page.url()).origin}/canal-drive/?travel=boat${records[0].raceHash}`);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `artifacts/share-route/progress-share-${viewport.width}.png`, fullPage: true });
  }
});
