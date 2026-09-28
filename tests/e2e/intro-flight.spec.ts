// Start-of-ride orientation flight. Named regression for the user report
// (2026-09-27): "when the game starts it's really hard to get oriented". A ride
// now opens on an overview of start and destination and flies down to the
// driving camera; any input skips it.

import { expect, Page, test } from '@playwright/test';
import { openRoute } from './helpers';

type IntroGame = {
  state: number;
  camera: { zoom: number; x: number; y: number; worldToScreen: (x: number, y: number) => { x: number; y: number } };
  player: { x: number; y: number; speed: number } | null;
  track: { finishPoint: { x: number; y: number } };
  _intro: { playZoom: number; overview: number } | null;
};
declare global {
  interface Window { canalRecallGame: IntroGame }
  const CANVAS_W: number;
  const CANVAS_H: number;
}

async function startWithIntro(page: Page): Promise<number> {
  await page.addInitScript(() => {
    (window as unknown as { __canalRecallForceIntro: boolean }).__canalRecallForceIntro = true;
  });
  // Let the route's own load reach RACING, which is what starts the flight.
  await openRoute(page, { travelMode: 'car', enterRacing: false });
  await expect.poll(() => page.evaluate(() => !!window.canalRecallGame._intro), { timeout: 30_000 }).toBe(true);
  return page.evaluate(() => window.canalRecallGame._intro!.playZoom);
}

test('the ride opens on an overview of start and destination, then lands on the driving camera', async ({ page }, testInfo) => {
  const playZoom = await startWithIntro(page);
  // A few frames into the hold, so MapLibre has synced to the overview camera.
  await page.waitForTimeout(500);
  const overview = await page.evaluate(() => {
    const game = window.canalRecallGame;
    const here = game.camera.worldToScreen(game.player!.x, game.player!.y);
    const finish = game.camera.worldToScreen(game.track.finishPoint.x, game.track.finishPoint.y);
    return { zoom: game.camera.zoom, here, finish, w: CANVAS_W, h: CANVAS_H };
  });
  expect(overview.zoom, 'opens well wider than the driving zoom').toBeLessThanOrEqual(playZoom * 0.2 + 1e-6);
  for (const [name, point] of [['start', overview.here], ['destination', overview.finish]] as const) {
    expect(point.x, `${name} is on screen`).toBeGreaterThan(0);
    expect(point.x).toBeLessThan(overview.w);
    expect(point.y, `${name} is on screen`).toBeGreaterThan(0);
    expect(point.y).toBeLessThan(overview.h);
  }
  await page.screenshot({ path: testInfo.outputPath('intro-overview.png') });
  // Named regression (user report 2026-09-28): the overview pins were drawn
  // with flat camera maths while the map drew at another scale, so START sat
  // mid-way along the route line and jumped into place on landing. Every pin
  // must sit where MapLibre itself projects the same point.
  const misfit = await page.evaluate(() => {
    const g = window.canalRecallGame as unknown as {
      camera: IntroGame['camera']; player: { x: number; y: number }; track: IntroGame['track'];
      vectorMap: { map: { project(ll: [number, number]): { x: number; y: number }; getCanvas(): HTMLCanvasElement }; worldToLngLat(x: number, y: number, loader: unknown): [number, number] };
      osmLoader: unknown; canvas: HTMLCanvasElement;
    };
    const rect = g.canvas.getBoundingClientRect();
    const mapRect = g.vectorMap.map.getCanvas().getBoundingClientRect();
    const scale = rect.width / CANVAS_W;
    let worst = 0;
    for (const point of [g.player, g.track.finishPoint]) {
      const drawn = g.camera.worldToScreen(point.x, point.y);
      const map = g.vectorMap.map.project(g.vectorMap.worldToLngLat(point.x, point.y, g.osmLoader));
      const dx = (rect.left + drawn.x * scale) - (mapRect.left + map.x);
      const dy = (rect.top + drawn.y * scale) - (mapRect.top + map.y);
      worst = Math.max(worst, Math.hypot(dx, dy));
    }
    return worst;
  });
  expect(misfit, 'overview pins sit on the map (CSS px)').toBeLessThan(4);
  // The vehicle waits for the flight.
  expect(await page.evaluate(() => window.canalRecallGame.player!.speed)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.canalRecallGame._intro), { timeout: 8_000 }).toBe(null);
  expect(await page.evaluate(() => window.canalRecallGame.camera.zoom)).toBeCloseTo(playZoom, 6);
});

test('any input skips the flight straight to driving', async ({ page }, testInfo) => {
  const playZoom = await startWithIntro(page);
  if (testInfo.project.name === 'iphone') {
    await page.touchscreen.tap(200, 300);
  } else {
    await page.keyboard.press('ArrowUp');
  }
  await expect.poll(() => page.evaluate(() => window.canalRecallGame._intro), { timeout: 2_000 }).toBe(null);
  expect(await page.evaluate(() => window.canalRecallGame.camera.zoom)).toBeCloseTo(playZoom, 6);
});

// The mismatch showed on a retina laptop window, not at the default size.
test.describe('on a retina laptop window', () => {
  test.use({ viewport: { width: 1000, height: 615 }, deviceScaleFactor: 2 });
  test('overview pins sit on the map', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop window size');
    await startWithIntro(page);
    await page.waitForTimeout(500);
    const misfit = await page.evaluate(() => {
      const g = window.canalRecallGame as unknown as {
        camera: IntroGame['camera']; player: { x: number; y: number }; track: IntroGame['track'];
        vectorMap: { map: { project(ll: [number, number]): { x: number; y: number }; getCanvas(): HTMLCanvasElement }; worldToLngLat(x: number, y: number, loader: unknown): [number, number] };
        osmLoader: unknown; canvas: HTMLCanvasElement;
      };
      const rect = g.canvas.getBoundingClientRect();
      const mapRect = g.vectorMap.map.getCanvas().getBoundingClientRect();
      const scale = rect.width / CANVAS_W;
      let worst = 0;
      for (const point of [g.player, g.track.finishPoint]) {
        const drawn = g.camera.worldToScreen(point.x, point.y);
        const map = g.vectorMap.map.project(g.vectorMap.worldToLngLat(point.x, point.y, g.osmLoader));
        worst = Math.max(worst, Math.hypot((rect.left + drawn.x * scale) - (mapRect.left + map.x), (rect.top + drawn.y * scale) - (mapRect.top + map.y)));
      }
      return worst;
    });
    expect(misfit, 'overview pins sit on the map (CSS px)').toBeLessThan(4);
  });
});
