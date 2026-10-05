import { expect, test } from '@playwright/test';
import { openRoute } from './helpers';

test('new rides and replays land behind the bike despite an earlier camera orbit', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('canalRecall.preferences.v1', JSON.stringify({
      travelMode: 'car', viewMode: 'chase', controlMode: 'relative', cameraBearing: 120,
    }));
    (window as any).__canalRecallForceIntro = true;
  });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', enterRacing: false });
  await page.waitForFunction(() => (window.canalRecallGame as any).state === 4 && !(window.canalRecallGame as any)._intro);
  const read = () => page.evaluate(() => {
    const g = window.canalRecallGame as any;
    const wanted = g.player.angle + Math.PI / 2;
    const position = g.camera.followPosition(g.player);
    return { orbit: g.camera.bearingOffset,
      angleError: Math.abs(Math.atan2(Math.sin(g.camera.rotation - wanted), Math.cos(g.camera.rotation - wanted))),
      positionError: Math.hypot(g.camera.x - position.x, g.camera.y - position.y),
      detached: g.camera.detached,
      storedBearing: JSON.parse(localStorage.getItem('canalRecall.preferences.v1')!).cameraBearing,
    };
  });
  const checkLanding = async () => {
    await expect.poll(async () => {
      const value = await read();
      return value.orbit === 0 && value.angleError < 1e-8 && value.positionError < 0.01
        && !value.detached && value.storedBearing === 0;
    }).toBe(true);
  };
  await checkLanding();
  await page.screenshot({ path: testInfo.outputPath('camera-behind-bike.png') });
  // Replay after a turn/orbit/pan: reset before the overview, then exercise
  // the flight landing and its first normal follow frame.
  for (const controls of ['relative', 'absolute']) {
    await page.evaluate(controlMode => {
      const g = window.canalRecallGame as any;
      g._overlay.store.patchPrefs({ controlMode }, g._overlayZoom());
      g.player.x += 3000;
      g.camera.update(g.player, 1);
      g._nudgeCameraBearing(90);
      g.camera.pan(1000, 500);
      g.camera.northUp = true;
      g._setupRace();
      g._beginIntro();
      g._updateIntro(100);
      g.camera.update(g.player, 1 / 60);
    }, controls);
    await checkLanding();
  }
});

test('recenter click and R restore live vehicle follow after a real drag', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop mouse and keyboard interaction');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  await page.waitForFunction(() => (window.canalRecallGame as any).camera.introOverview === 0);
  await page.evaluate(() => (window.canalRecallGame as any)._nudgeCameraBearing(80));
  const canvas = await page.locator('#gameCanvas').boundingBox();
  expect(canvas).not.toBeNull();
  const x = canvas!.x + canvas!.width * 0.55;
  const y = canvas!.y + canvas!.height * 0.45;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 230, y + 160, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => Boolean((window.canalRecallGame as any)._recenterBtnBounds))).toBe(true);
  const button = await page.evaluate(() => {
    const game = window.canalRecallGame as any;
    const rect = game.canvas.getBoundingClientRect();
    const bounds = game._recenterBtnBounds;
    // Canvas coordinates are scaled to fit the CSS viewport.
    return { x: rect.left + (bounds.x + bounds.w / 2) * rect.width / game.viewport.width,
      y: rect.top + (bounds.y + bounds.h / 2) * rect.height / game.viewport.height };
  });
  await page.screenshot({ path: testInfo.outputPath('recenter-label.png'),
    clip: { x: button.x - 100, y: button.y - 40, width: 200, height: 80 } });
  await page.mouse.click(button.x, button.y);
  const follows = () => page.evaluate(() => {
    const camera = (window.canalRecallGame as any).camera;
    return !camera.detached && Math.hypot(camera.x - camera._followX, camera.y - camera._followY) < 60;
  });
  await expect.poll(follows).toBe(true);
  const unrotated = () => page.evaluate(() => {
    const game = window.canalRecallGame as any;
    return game.camera.bearingOffset === 0 && Math.abs(Math.atan2(
      Math.sin(game.camera.rotation - game.player.angle - Math.PI / 2),
      Math.cos(game.camera.rotation - game.player.angle - Math.PI / 2))) < 1e-8
      && JSON.parse(localStorage.getItem('canalRecall.preferences.v1')!).cameraBearing === 0;
  });
  await expect.poll(unrotated).toBe(true);
  const before = await page.evaluate(() => ({ ...(window.canalRecallGame as any).player }));
  await page.keyboard.down('ArrowUp');
  await expect.poll(() => page.evaluate(({ x, y }) => {
    const player = (window.canalRecallGame as any).player;
    return Math.hypot(player.x - x, player.y - y);
  }, before), { timeout: 10_000 }).toBeGreaterThan(20);
  await page.keyboard.up('ArrowUp');
  await expect.poll(follows).toBe(true);
  await page.evaluate(() => (window.canalRecallGame as any)._nudgeCameraBearing(90));
  await page.mouse.wheel(0, 250);
  await expect.poll(() => page.evaluate(() => (window.canalRecallGame as any).camera.detached)).toBe(true);
  await page.keyboard.press('r');
  await expect.poll(follows).toBe(true);
  await expect.poll(unrotated).toBe(true);
  // R also resets rotation when the camera is already following the bike.
  await page.evaluate(() => (window.canalRecallGame as any)._nudgeCameraBearing(-75));
  await page.keyboard.press('r');
  await expect.poll(unrotated).toBe(true);
  expect(errors).toEqual([]);
});
