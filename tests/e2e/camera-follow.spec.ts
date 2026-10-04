import { expect, test } from '@playwright/test';
import { openRoute } from './helpers';

test('recenter click and R restore live vehicle follow after a real drag', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop mouse and keyboard interaction');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openRoute(page, { travelMode: 'car' });
  await page.waitForFunction(() => (window.canalRecallGame as any).camera.introOverview === 0);
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
  await page.mouse.click(button.x, button.y);
  const follows = () => page.evaluate(() => {
    const camera = (window.canalRecallGame as any).camera;
    return !camera.detached && Math.hypot(camera.x - camera._followX, camera.y - camera._followY) < 60;
  });
  await expect.poll(follows).toBe(true);
  const before = await page.evaluate(() => ({ ...(window.canalRecallGame as any).player }));
  await page.keyboard.down('ArrowUp');
  await expect.poll(() => page.evaluate(({ x, y }) => {
    const player = (window.canalRecallGame as any).player;
    return Math.hypot(player.x - x, player.y - y);
  }, before), { timeout: 10_000 }).toBeGreaterThan(20);
  await page.keyboard.up('ArrowUp');
  await expect.poll(follows).toBe(true);
  await page.mouse.wheel(0, 250);
  await expect.poll(() => page.evaluate(() => (window.canalRecallGame as any).camera.detached)).toBe(true);
  await page.keyboard.press('r');
  await expect.poll(follows).toBe(true);
  expect(errors).toEqual([]);
});
