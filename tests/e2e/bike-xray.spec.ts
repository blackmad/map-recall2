import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression (user report 2026-09-28, "why is the bike bright yellow
// now?"): the x-ray pass that shows the bike through buildings ran after the
// normal pass with a greater-than depth test, so it also passed on the model's
// own far side and painted the whole bike #ffd21f in the open. It must now draw
// the bike in its own colours where nothing covers it, and stay the last layer
// so buildings are already in the depth buffer when it draws.
test('the chase bike keeps its own colours in the open and draws after the buildings', async ({ page }) => {
  test.setTimeout(180000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90000 });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.vectorMap?.isPlayerBikeReady?.())), { timeout: 90000 }).toBe(true);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(2000);
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(1500);

  const order = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.map.style._order as string[]);
  const bikeIndex = order.indexOf('player-bike-3d');
  const lastBuilding = Math.max(...order.map((id, index) => (/building|facade|roof/.test(id) ? index : -1)));
  expect.soft(bikeIndex, 'bike draws after every building layer').toBeGreaterThan(lastBuilding);

  // Count x-ray yellow around the bike. A covered bike may be partly yellow;
  // an uncovered one in the open is not — and this start is re-rolled until
  // the bike is not inside a footprint, so the sample is what the eye sees.
  const box = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const ll = g.vectorMap.worldToLngLat(g.player.x, g.player.y, g.osmLoader);
    const p = g.vectorMap.map.project(ll);
    const rect = g.vectorMap.map.getCanvas().getBoundingClientRect();
    return { x: rect.left + p.x - 60, y: rect.top + p.y - 90, width: 120, height: 120 };
  });
  const png = await page.screenshot({ clip: box });
  const yellow = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 225 && data[i + 1] > 180 && data[i + 1] < 230 && data[i + 2] < 90) count++;
    }
    return count;
  }, png.toString('base64'));
  expect(yellow, 'x-ray yellow pixels around an uncovered bike').toBeLessThan(40);
});
