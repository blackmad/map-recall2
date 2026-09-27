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
