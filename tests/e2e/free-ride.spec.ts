import { expect, type Page, test } from '@playwright/test';
import { setHiddenSelect } from './helpers';

// Free Ride (src/canalRecall/game/freeRide.ts, freeRideRuntime.ts): chosen on
// the setup screen, no route and no questions, markers over nearby places, a
// tap opens the card, Exit returns to setup.

type FreeRideGame = {
  state: number;
  freeRide?: boolean;
  quizPromptName: string;
  routePath: unknown[] | null;
  viewport: { width: number };
  canvas: HTMLCanvasElement;
  _landmarkNotice: { id: string; name: string } | null;
  _landmarkCloseBounds: { x: number; y: number; w: number; h: number } | null;
  _freeRideNearby?: Array<{ key: string; name: string }>;
  _freeRideMarkers?: Array<{ key: string; box: { x: number; y: number; w: number; h: number } }>;
};

const game = (page: Page) => page.evaluate(() => {
  const g = (window as unknown as { canalRecallGame: FreeRideGame }).canalRecallGame;
  return {
    state: g.state,
    freeRide: !!g.freeRide,
    quiz: g.quizPromptName,
    route: g.routePath?.length ?? 0,
    notice: g._landmarkNotice?.name ?? null,
    markers: g._freeRideMarkers?.length ?? 0,
  };
});

/** A canvas-space box's centre in page coordinates. */
async function pagePoint(page: Page, which: 'marker' | 'close'): Promise<{ x: number; y: number; name?: string } | null> {
  return page.evaluate((target) => {
    const g = (window as unknown as { canalRecallGame: FreeRideGame }).canalRecallGame;
    const rect = g.canvas.getBoundingClientRect();
    const scale = rect.width / g.viewport.width;
    if (target === 'close') {
      const b = g._landmarkCloseBounds;
      return b ? { x: rect.left + (b.x + b.w / 2) * scale, y: rect.top + (b.y + b.h / 2) * scale } : null;
    }
    const marker = g._freeRideMarkers?.[0];
    if (!marker) return null;
    const name = g._freeRideNearby?.find(place => place.key === marker.key)?.name;
    const b = marker.box;
    return { x: rect.left + (b.x + b.w / 2) * scale, y: rect.top + (b.y + b.h / 2) * scale, name };
  }, which);
}

test('free ride: ride without questions, tap a marker for its card, close it, exit to setup', async ({ page }) => {
  await page.addInitScript(() => {
    let seed = 0x5eed1234;
    Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
  });
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));

  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { canalRecallGame?: unknown }).canalRecallGame))).toBe(true);
  await expect(page.locator('#route-card')).toBeVisible();
  await setHiddenSelect(page, 'travel-mode', 'car');
  await setHiddenSelect(page, 'view-mode', 'north');
  // The visible control, as a rider picks it.
  await page.locator('[data-choice="route:free"]').click();
  await expect(page.locator('#route-start')).toHaveText(/free ride/i);
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(async () => (await game(page)).state, { timeout: 90_000 }).toBe(4);

  const started = await game(page);
  expect(started.freeRide).toBe(true);
  expect(started.route).toBe(0);
  await expect(page.locator('#free-ride-bar')).toBeVisible();

  // Ride a few seconds. Nothing is asked, however many streets go by.
  await page.locator('#gameCanvas').focus();
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(3000);
  await page.keyboard.up('ArrowUp');
  expect((await game(page)).quiz).toBe('');
  await expect(page.locator('#canal-prompt')).toBeHidden();

  // The start is a random hand-picked landmark, some with nothing else
  // nearby; put the bike on the street beside the Westerkerk so the markers
  // are deterministic.
  await page.evaluate(() => {
    const g = (window as unknown as { canalRecallGame: any }).canalRecallGame;
    const church = g.landmarks.find((l: { name: string }) => /^westerkerk$/i.test(l.name));
    if (!church) return;
    const road = g.track.getNearestRoad(church.x, church.y + 120);
    if (!road) return;
    g.player.x = road.x; g.player.y = road.y; g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    g.player.angle = road.angle;
    g.camera.resetForRide?.(g.player);
  });

  // A marker over a nearby place; tap it and its card opens.
  // Markers are laid out per frame (one can step aside for the vehicle), so
  // take the point from the same read that found it.
  let marker: Awaited<ReturnType<typeof pagePoint>> = null;
  await expect.poll(async () => (marker = await pagePoint(page, 'marker')) !== null, { timeout: 20_000 }).toBe(true);
  await page.mouse.click(marker!.x, marker!.y);
  await expect.poll(async () => (await game(page)).notice, { timeout: 5_000 }).not.toBeNull();
  const opened = (await game(page)).notice!;
  expect(opened.toLowerCase()).toContain(marker!.name!.toLowerCase().slice(0, 6));

  // Its close corner puts it away.
  await expect.poll(() => pagePoint(page, 'close')).not.toBeNull();
  const close = await pagePoint(page, 'close');
  await page.mouse.click(close!.x, close!.y);
  await expect.poll(async () => (await game(page)).notice).toBeNull();

  // Exit returns to the setup screen and ends the free ride.
  await page.locator('#free-ride-exit').click();
  await expect(page.locator('#route-card')).toBeVisible();
  const after = await game(page);
  expect(after.freeRide).toBe(false);
  await expect(page.locator('#free-ride-bar')).toBeHidden();
  expect(errors).toEqual([]);
});
