import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// Landmark stamps (src/canalRecall/collection) and themed tours
// (src/canalRecall/game/tourRoute.ts) wired into the ride, and the stamp rack
// on My progress. Arrival is forced the way progress.spec.ts does it: the
// bike is put on the finish point.

type Poi = { id: string; name: string; landmarkId?: string; tourStop?: boolean; tourRevealName?: string };
type Game = {
  state: number;
  routeFrom: Poi; routeTo: Poi;
  routePois: Poi[];
  player: { x: number; y: number; speed: number };
  track: { finishPoint: { x: number; y: number } };
  _shareUrl?: string;
  _tour: { tour: { id: string; stops: unknown[] }; state: { legIndex: number; completedStops: number[] }; completed: boolean } | null;
  _tourArrival: { name: string; why: string; stopIndex: number; completed: boolean } | null;
  _finishStamp: { kind: string; name: string; isNew: boolean } | null;
  _finishLandmark(): { id: string; name: string } | null;
  _destinationLabel(): string;
  _composeMissionBrief(): unknown;
  _runFinishAction(id: string): void;
  _openRouteSetup(): void;
  _overlay: { store: { getState(): { prefs: { travelMode: string; routePattern: string; cityId: string } } } };
};
declare global { interface Window { canalRecallGame: Game } }

const STAMPS_KEY = 'canalRecall.poiStamps.v1';
const PREFS_KEY = 'canalRecall.preferences.v1';

async function storedPrefs(page: Page): Promise<{ travelMode?: string; routePattern?: string; cityId?: string; difficulty?: string }> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}'), PREFS_KEY);
}
async function livePrefs(page: Page) {
  return page.evaluate(() => {
    const { travelMode, routePattern, cityId } = window.canalRecallGame._overlay.store.getState().prefs;
    return { travelMode, routePattern, cityId };
  });
}
const width = () => (test.info().project.name === 'iphone' ? '390' : '1440');
const shot = (name: string) => `artifacts/tours-stamps/${name}-${width()}.png`;

async function storedStamps(page: Page): Promise<Record<string, { id: string; kind: string; how: string; name: string }>> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}'), STAMPS_KEY);
}

/** Wait for the ride to start on its own (forcing RACING early let loading
 *  restart it and finish a second time), then put the bike on the finish. */
async function arrive(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean(window.canalRecallGame._shareUrl) && window.canalRecallGame.state === 4, null, { timeout: 150_000 });
  await page.evaluate(() => {
    const game = window.canalRecallGame;
    game.player.x = game.track.finishPoint.x;
    game.player.y = game.track.finishPoint.y;
    game.player.speed = 0;
  });
  await page.waitForFunction(() => window.canalRecallGame.state === 5, null, { timeout: 30_000 });
}

/** A fresh leg after Next stop: wait for its own route, not the last one's. */
async function nextLeg(page: Page, previousShare: string | undefined): Promise<void> {
  await page.evaluate(() => window.canalRecallGame._runFinishAction('again'));
  await page.waitForFunction(prev => {
    const game = window.canalRecallGame;
    return game.state !== 5 && Boolean(game._shareUrl) && game._shareUrl !== prev && Boolean(game.player?.x);
  }, previousShare, { timeout: 150_000 });
}

test('a ride that ends at its chosen destination stamps it, and My progress shows the stamp', async ({ page }) => {
  test.setTimeout(300_000);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => (window.canalRecallGame?.routePois || []).some(p => p.name === 'Rijksmuseum'))).toBe(true);
  const target = await page.evaluate(() => window.canalRecallGame.routePois.find(p => p.name === 'Rijksmuseum')!);
  expect(target.landmarkId).toBeTruthy();
  await page.selectOption('#poi-destination', target.id);
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(() => page.evaluate(() => Boolean(window.canalRecallGame?.player?.x)), { timeout: 120_000 }).toBe(true);
  await arrive(page);

  const finish = await page.evaluate(() => ({ stamp: window.canalRecallGame._finishStamp, to: window.canalRecallGame.routeTo }));
  expect(finish.to.id).toBe(target.id);
  expect(finish.stamp).toMatchObject({ kind: 'poi', name: 'Rijksmuseum', isNew: true });
  const stamps = await storedStamps(page);
  expect(stamps[target.landmarkId!]).toMatchObject({ kind: 'poi', how: 'arrived', name: 'Rijksmuseum' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: shot('stamp-moment') });

  await page.goto('/progress');
  const rack = page.getByTestId('stamps');
  await expect(rack).toBeVisible();
  await expect(rack.locator(`[data-stamp-id="${target.landmarkId}"]`)).toContainText('Rijksmuseum');
  await expect(rack).toContainText(/1 of \d+ collected/);
  await rack.scrollIntoViewIfNeeded();
  await page.screenshot({ path: shot('progress-rack'), fullPage: true });
});

test('a finish that only falls back to the nearest landmark does not stamp', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'logic, not layout');
  test.setTimeout(240_000);
  await openRoute(page, { travelMode: 'car', enterRacing: false });
  await page.waitForFunction(() => Boolean(window.canalRecallGame._shareUrl), null, { timeout: 120_000 });
  // The destination is no longer a landmark id, so the finish card can only
  // name the landmark beside the finish through its 220 px nearest fallback.
  const fallback = await page.evaluate(() => {
    const game = window.canalRecallGame;
    game.routeTo = { id: 'test-not-a-landmark', name: 'Somewhere unnamed' };
    return game._finishLandmark();
  });
  expect(fallback, 'a landmark sits beside the finish, so the fallback engages').not.toBeNull();
  await arrive(page);
  expect(await page.evaluate(() => window.canalRecallGame._finishStamp)).toBeNull();
  expect(await storedStamps(page)).toEqual({});
});

test('?tour= starts the tour, hides a street stop until arrival, and rides on stop by stop', async ({ page }) => {
  test.setTimeout(600_000);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/?tour=jewish-amsterdam');
  await expect.poll(() => page.evaluate(() => window.canalRecallGame?._tour?.tour.id), { timeout: 60_000 }).toBe('jewish-amsterdam');
  await expect.poll(() => page.evaluate(() => Boolean(window.canalRecallGame?.player?.x)), { timeout: 120_000 }).toBe(true);

  // The lead-in rides from Centraal (no location permission here) to stop 1,
  // so the first stop is reached, not handed over at the start.
  const lead = await page.evaluate(() => ({ from: window.canalRecallGame.routeFrom.name, to: window.canalRecallGame.routeTo.name, tour: window.canalRecallGame._tour!.state }));
  expect(lead.from).toBe('Amsterdam Centraal');
  expect(lead.to).toBe('Anne Frank House');
  expect(lead.tour).toMatchObject({ legIndex: -1, completedStops: [] });
  await arrive(page);
  expect(await page.evaluate(() => window.canalRecallGame._tourArrival)).toMatchObject({ name: 'Anne Frank House', stopIndex: 0, completed: false });
  await nextLeg(page, await page.evaluate(() => window.canalRecallGame._shareUrl));

  // Leg 1 ends on Jodenbreestraat, a street: its name stays off the HUD and the briefing.
  const before = await page.evaluate(() => {
    const game = window.canalRecallGame;
    return { to: game.routeTo, label: game._destinationLabel(), brief: game._composeMissionBrief(), from: game.routeFrom.name };
  });
  expect(before.to.tourRevealName).toBe('Jodenbreestraat');
  expect(before.label).not.toContain('Jodenbree');
  expect(JSON.stringify(before.brief)).not.toContain('Jodenbree');
  expect(before.label).toBe('Jewish Amsterdam, stop 2 of 7');
  expect(before.from).toBe('Anne Frank House');

  await arrive(page);
  const first = await page.evaluate(() => ({ to: window.canalRecallGame.routeTo, arrival: window.canalRecallGame._tourArrival, tour: window.canalRecallGame._tour!.state }));
  expect(first.to.name).toBe('Jodenbreestraat');
  expect(first.arrival).toMatchObject({ name: 'Jodenbreestraat', stopIndex: 1, completed: false });
  expect(first.arrival!.why.length).toBeGreaterThan(20);
  expect(first.tour).toMatchObject({ tourId: 'jewish-amsterdam', legIndex: 1, completedStops: [0, 1] });
  await page.waitForTimeout(400);
  await page.screenshot({ path: shot('tour-stop-card') });

  // Next stop rides leg 2, from Jodenbreestraat to De Dokwerker, a landmark: it stamps.
  await nextLeg(page, await page.evaluate(() => window.canalRecallGame._shareUrl));
  const leg2 = await page.evaluate(() => ({ from: window.canalRecallGame.routeFrom.name, to: window.canalRecallGame.routeTo }));
  expect(leg2.from).toBe('Jodenbreestraat');
  expect(leg2.to.name).toBe('De Dokwerker');
  await arrive(page);
  const second = await page.evaluate(() => ({ arrival: window.canalRecallGame._tourArrival, stamp: window.canalRecallGame._finishStamp, tour: window.canalRecallGame._tour!.state }));
  expect(second.arrival).toMatchObject({ name: 'De Dokwerker', stopIndex: 2, completed: false });
  expect(second.stamp).toMatchObject({ kind: 'poi', name: 'De Dokwerker', isNew: true });
  expect(second.tour.completedStops).toEqual([0, 1, 2]);

  // Skip to the last leg: its arrival completes the tour and stamps it.
  await page.evaluate(() => {
    const t = window.canalRecallGame._tour!;
    t.state = { ...t.state, legIndex: 5, completedStops: [0, 1, 2, 3, 4, 5] };
  });
  await nextLeg(page, await page.evaluate(() => window.canalRecallGame._shareUrl));
  expect(await page.evaluate(() => window.canalRecallGame.routeTo.name)).toBe('Hollandsche Schouwburg');
  await arrive(page);
  const done = await page.evaluate(() => ({ arrival: window.canalRecallGame._tourArrival, stamp: window.canalRecallGame._finishStamp, completed: window.canalRecallGame._tour?.completed }));
  expect(done.arrival).toMatchObject({ completed: true, stopIndex: 6 });
  expect(done.stamp).toMatchObject({ kind: 'tour', name: 'Jewish Amsterdam', isNew: true });
  expect(done.completed).toBe(true);
  expect((await storedStamps(page))['tour:jewish-amsterdam']).toMatchObject({ kind: 'tour', how: 'completed' });
  // The whole tour rode by bike; the player's saved travel mode never changed.
  expect((await storedPrefs(page)).travelMode ?? 'boat').toBe('boat');
  await page.waitForTimeout(400);
  await page.screenshot({ path: shot('tour-complete') });
});

// Starting a tour saved Bike/Amsterdam/Surprise as the player's settings
// (TODO, 2026-10-17). The tour rides with them; storage and setup keep the
// player's own, and leaving the tour puts them back.
test('a tour rides by bike without overwriting the player\'s settings', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'logic, not layout');
  test.setTimeout(240_000);
  await page.addInitScript(key => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem(key, JSON.stringify({ travelMode: 'boat', routePattern: 'here', difficulty: 'hard' }));
      sessionStorage.setItem('seeded', '1');
    }
  }, PREFS_KEY);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/?tour=jewish-amsterdam');
  await expect.poll(() => page.evaluate(() => window.canalRecallGame?._tour?.tour.id), { timeout: 60_000 }).toBe('jewish-amsterdam');
  await expect.poll(() => page.evaluate(() => Boolean(window.canalRecallGame?.player?.x)), { timeout: 120_000 }).toBe(true);
  expect(await livePrefs(page)).toEqual({ travelMode: 'car', routePattern: 'surprise', cityId: 'amsterdam' });
  expect(await storedPrefs(page)).toMatchObject({ travelMode: 'boat', routePattern: 'here', difficulty: 'hard' });

  // Any save mid-tour (the L key, a settings change) still writes the player's own.
  await page.evaluate(() => (window.canalRecallGame as unknown as { _savePreferences(): void })._savePreferences());
  expect(await storedPrefs(page)).toMatchObject({ travelMode: 'boat', routePattern: 'here' });

  // Abandoning for setup ends the tour and shows the player's settings again.
  await page.evaluate(() => window.canalRecallGame._openRouteSetup());
  expect(await page.evaluate(() => window.canalRecallGame._tour)).toBeNull();
  expect(await livePrefs(page)).toEqual({ travelMode: 'boat', routePattern: 'here', cityId: 'amsterdam' });
  expect(await storedPrefs(page)).toMatchObject({ travelMode: 'boat', routePattern: 'here', difficulty: 'hard' });
  await expect(page.locator('[data-choice="travel:boat"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-choice="route:here"]')).toHaveAttribute('aria-pressed', 'true');

  // A reload mid-tour comes back to the player's settings too.
  await page.goto('/canal-drive/?tour=jewish-amsterdam');
  await expect.poll(() => page.evaluate(() => window.canalRecallGame?._tour?.tour.id), { timeout: 60_000 }).toBe('jewish-amsterdam');
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean(window.canalRecallGame))).toBe(true);
  expect(await livePrefs(page)).toEqual({ travelMode: 'boat', routePattern: 'here', cityId: 'amsterdam' });
});

test('the Tours picker sits beside Destination and lists no stop names', async ({ page }) => {
  await page.goto('/canal-drive/');
  const picker = page.locator('#tour-picker');
  await expect(picker.locator('option')).toHaveCount(9);
  const options = await picker.locator('option').allTextContents();
  for (const name of ['Jodenbreestraat', 'Golden Bend', 'Magere Brug', 'Waterlooplein']) {
    expect(options.join('|')).not.toContain(name);
  }
  await picker.selectOption('ice-cream');
  await expect(page.locator('#tour-note')).toContainText('checked 2026-10-17');
  await expect(page.locator('#route-start')).toHaveText('Start tour');
  await expect(page.locator('#poi-destination')).toBeDisabled();
  await page.locator('#tour-picker').scrollIntoViewIfNeeded();
  await page.screenshot({ path: shot('tours-picker') });
});

test('on a phone the five-item site switch fits and Report a problem covers neither it nor Start', async ({ page }) => {
  test.skip(test.info().project.name !== 'iphone', 'phone layout');
  await page.goto('/canal-drive/');
  await expect(page.locator('#route-card')).toBeVisible();
  const launch = page.locator('#utility-buttons .cf-launch');
  const sw = page.locator('#setup-site-switch');
  await expect(launch).toBeVisible();
  await expect(sw).toBeVisible();
  const boxes = await page.evaluate(() => {
    const rect = (el: Element) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    const switchNode = document.getElementById('setup-site-switch')!;
    const switchBox = rect(switchNode);
    const links = [...document.querySelectorAll('#setup-site-switch a')].map(rect);
    const labels = [...document.querySelectorAll('#setup-site-switch a')].map(a => ({
      text: a.textContent, href: a.getAttribute('href'), clipped: (a as HTMLElement).scrollWidth > (a as HTMLElement).clientWidth + 1,
    }));
    const start = rect(document.getElementById('route-start')!);
    const switchOverflow = switchNode.scrollWidth - switchNode.clientWidth;
    const others = [...document.querySelectorAll('#utility-buttons > *')]
      .filter(el => getComputedStyle(el).display !== 'none' && (el as HTMLElement).offsetParent !== null)
      .map(rect).filter(r => r.w > 0 && r.h > 0);
    return { switchBox, links, labels, start, switchOverflow, others, width: window.innerWidth };
  });
  // Five surfaces, Buildings last, and every label whole at 390 px.
  expect(boxes.labels.map(l => l.text)).toEqual(['Home', 'Ride', 'Quiz', 'Progress', 'Buildings']);
  expect(boxes.labels[4].href).toMatch(/explore(\.html)?$/);
  for (const label of boxes.labels) expect(label.clipped, `${label.text} is not cut off`).toBe(false);
  expect(boxes.switchOverflow, 'the switch does not scroll sideways').toBeLessThanOrEqual(1);
  const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const other of boxes.others) {
    expect(overlaps(other, boxes.switchBox), `${JSON.stringify(other)} vs switch ${JSON.stringify(boxes.switchBox)}`).toBe(false);
    expect(overlaps(other, boxes.start), `${JSON.stringify(other)} vs Start ${JSON.stringify(boxes.start)}`).toBe(false);
  }
  for (const link of boxes.links) {
    expect(link.x + link.w).toBeLessThanOrEqual(boxes.width);
    expect(link.x + link.w, 'each item ends inside the switch').toBeLessThanOrEqual(boxes.switchBox.x + boxes.switchBox.w + 0.5);
  }
  await page.screenshot({ path: shot('phone-setup-feedback') });
});
