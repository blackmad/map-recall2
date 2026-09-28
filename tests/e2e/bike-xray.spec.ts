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

  // Three renders of the same frozen frame: normal (A), x-ray colour off (B),
  // bike hidden (C). B minus C is where the bike is genuinely visible; in A
  // those pixels must keep the bike's colours. The old pass painted all of
  // them yellow. (Where a building covers the bike, yellow is correct.)
  await page.evaluate(() => { (window as any).canalRecallGame._updateRacing = () => {}; });
  await page.waitForTimeout(300);
  const box = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const ll = g.vectorMap.worldToLngLat(g.player.x, g.player.y, g.osmLoader);
    const p = g.vectorMap.map.project(ll);
    const rect = g.vectorMap.map.getCanvas().getBoundingClientRect();
    return { x: Math.round(rect.left + p.x - 60), y: Math.round(rect.top + p.y - 90), width: 120, height: 120 };
  });
  const frame = async (setup: string) => {
    await page.evaluate((mode) => {
      const bike = (window as any).canalRecallGame.vectorMap._playerBike;
      bike._occlusionMaterial.colorWrite = mode !== 'no-xray';
      bike.__forceHidden = mode === 'hidden';
      if (!bike.__wrapped) {
        const update = bike.update.bind(bike);
        bike.update = (ll: unknown, angle: number, visible: boolean, ...rest: unknown[]) =>
          update(ll, angle, visible && !bike.__forceHidden, ...rest);
        bike.__wrapped = true;
      }
      bike.visible = !bike.__forceHidden;
      bike.map.triggerRepaint();
    }, setup);
    await page.waitForTimeout(400);
    return (await page.screenshot({ clip: box })).toString('base64');
  };
  const [a, b, c] = [await frame('normal'), await frame('no-xray'), await frame('hidden')];
  const result = await page.evaluate(async ([a64, b64, c64]) => {
    const pixels = async (b64: string) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, img.width, img.height).data;
    };
    const [pa, pb, pc] = await Promise.all([pixels(a64), pixels(b64), pixels(c64)]);
    let visible = 0, yellowOnVisible = 0;
    for (let i = 0; i < pa.length; i += 4) {
      const differs = Math.abs(pb[i] - pc[i]) + Math.abs(pb[i + 1] - pc[i + 1]) + Math.abs(pb[i + 2] - pc[i + 2]) > 60;
      if (!differs) continue;
      visible++;
      if (pa[i] > 225 && pa[i + 1] > 180 && pa[i + 1] < 230 && pa[i + 2] < 90) yellowOnVisible++;
    }
    return { visible, yellowOnVisible };
  }, [a, b, c]);
  expect(result.visible, 'the bike is on screen to test').toBeGreaterThan(40);
  expect(result.yellowOnVisible / result.visible, `x-ray yellow over the visible bike (${JSON.stringify(result)})`).toBeLessThan(0.1);
});
