import { test, expect } from '@playwright/test';

// Swapfiets is authored level with `Lenker` / `RadVorn` / `RadHinten` from
// `scripts/stylize-swapfiets-bike.py`. This pins that the fork turns about +Y,
// the frame does not, and the wheels roll about their +Z axle by distance
// travelled rather than by frame count. The bike is usually behind a building,
// so the pose is measured off the scene graph instead of a screenshot.
test('the front wheel steers and the wheels roll, and the frame stays put', async ({ page }) => {
  test.setTimeout(180000);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/');
  await expect(page.locator('#route-card')).toBeVisible();
  await page.locator('#travel-mode').selectOption('car');
  await page.locator('#view-mode').selectOption('chase');
  await page.locator('#route-card').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.player?.x)), { timeout: 90000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.vectorMap?.isPlayerBikeReady?.())), { timeout: 90000 }).toBe(true);

  const pose = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    g.state = 3;
    const bike = g.vectorMap._playerBike;
    const ll = g.vectorMap.worldToLngLat(g.player.x, g.player.y, g.osmLoader);
    // Local +Z of a Swapfiets wheel is its axle (carbon bike used +Y).
    const axleOf = (o: any) => {
      o.updateWorldMatrix(true, false);
      const e = o.matrixWorld.elements;
      const v = [e[8], e[9], e[10]];
      const n = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0] / n, v[1] / n, v[2] / n];
    };
    const read = (steer: number) => {
      for (let i = 0; i < 120; i++) bike.update(ll, g.player.angle, true, steer, 0);
      try { bike.layer.render(null, { defaultProjectionData: { mainMatrix: new Array(16).fill(0) } }); } catch (e) { /* pose is applied before projection */ }
      return { front: axleOf(bike.parts.frontWheel), rear: axleOf(bike.parts.rearWheel) };
    };
    // Local +X spins as the wheel rolls about +Z.
    const spinOf = (o: any) => {
      o.updateWorldMatrix(true, false);
      const e = o.matrixWorld.elements;
      const n = Math.hypot(e[0], e[1], e[2]) || 1;
      return [e[0] / n, e[1] / n, e[2] / n];
    };
    const left = read(-1);
    const straight = read(0);
    const right = read(1);
    for (let i = 0; i < 120; i++) bike.update(ll, g.player.angle, true, 0, 0);
    try { bike.layer.render(null, { defaultProjectionData: { mainMatrix: new Array(16).fill(0) } }); } catch (e) { /* pose applied first */ }
    const rollAt0 = spinOf(bike.parts.frontWheel);
    bike.update(ll, g.player.angle, true, 0, 400);
    try { bike.layer.render(null, { defaultProjectionData: { mainMatrix: new Array(16).fill(0) } }); } catch (e) { /* pose applied first */ }
    const rollAt400 = spinOf(bike.parts.frontWheel);
    const ang = (a: number[], b: number[]) =>
      (Math.acos(Math.max(-1, Math.min(1, a[0]*b[0]+a[1]*b[1]+a[2]*b[2]))) * 180 / Math.PI);
    return {
      hasParts: !!(bike.parts.steer && bike.parts.frontWheel && bike.parts.rearWheel),
      straightFrontVsRear: Math.min(ang(straight.front, straight.rear), 180 - ang(straight.front, straight.rear)),
      frontLeftVsStraight: ang(left.front, straight.front),
      frontRightVsStraight: ang(right.front, straight.front),
      frontLeftVsRight: ang(left.front, right.front),
      rearLeftVsStraight: ang(left.rear, straight.rear),
      rollAfter400px: ang(rollAt0, rollAt400),
    };
  });
  console.log(JSON.stringify(pose, null, 2));
  expect(pose.hasParts).toBe(true);
  expect(pose.straightFrontVsRear).toBeLessThan(15);
  expect(pose.rearLeftVsStraight).toBeLessThan(0.5);
  expect(pose.frontLeftVsStraight).toBeGreaterThan(10);
  expect(pose.frontLeftVsRight).toBeGreaterThan(20);
  expect(pose.rollAfter400px).toBeGreaterThan(20);
});
