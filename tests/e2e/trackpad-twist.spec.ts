import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// User ask 2026-10-03: "spin the camera with a two-finger twist gesture on my
// trackpad". Safari reports the twist as gesture events with `rotation`;
// Chromium has none, so this synthesises them, plus the Option/Alt + scroll
// route other browsers get.
test('a trackpad twist orbits the chase camera', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: testInfo.outputPath('before.png') });
  const bearing = () => page.evaluate(() => (window as any).canalRecallGame.camera.bearingOffset * 180 / Math.PI);
  const start = await bearing();

  const twist = (degrees: number[]) => page.evaluate(async steps => {
    const canvas = (window as any).canalRecallGame.canvas as HTMLCanvasElement;
    const fire = (type: string, rotation: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true }) as any;
      Object.assign(event, { rotation, scale: 1 });
      canvas.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const prevented = [fire('gesturestart', 0)];
    for (const rotation of steps) { prevented.push(fire('gesturechange', rotation)); await new Promise(requestAnimationFrame); }
    prevented.push(fire('gestureend', steps[steps.length - 1]));
    return prevented.every(Boolean);
  }, degrees);

  // A pinch's wobble stays inside the dead zone and leaves the view alone.
  expect(await twist([2, -3, 4, -2])).toBe(true);
  expect(Math.abs((await bearing()) - start)).toBeLessThan(0.01);

  // A real clockwise twist of 6+60° turns the bearing 60° the other way.
  await twist([3, 6, 20, 40, 66]);
  const twisted = await bearing();
  expect(Math.abs(((start - 60 - twisted) % 360 + 540) % 360 - 180)).toBeLessThan(0.5);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: testInfo.outputPath('after-twist.png') });

  // The world turns with the fingers: a point north of the rider swings
  // clockwise on screen (screen angles grow clockwise, y pointing down).
  const northAngle = () => page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const a = g.camera.worldToScreen(g.player.x, g.player.y);
    const b = g.camera.worldToScreen(g.player.x, g.player.y - 200);
    return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  });
  // MapLibre's bearing grows as the map turns anticlockwise. It only syncs
  // once its style loads, which needs the network.
  const mapBearing = () => page.evaluate(() => { const v = (window as any).canalRecallGame.vectorMap; return v?.ready ? v.map.getBearing() as number : null; });
  const beforeNorth = await northAngle();
  const beforeMap = await mapBearing();
  await twist([10, 20, 40]);
  await page.waitForTimeout(2500);
  const swing = ((await northAngle()) - beforeNorth + 540) % 360 - 180;
  const afterMap = await mapBearing();
  if (beforeMap !== null && afterMap !== null) {
    expect(((afterMap - beforeMap + 540) % 360) - 180, 'the rendered map turns clockwise too').toBeLessThan(-15);
  }
  expect(swing, 'north swings clockwise with a clockwise twist').toBeGreaterThan(15);
  expect(swing).toBeLessThan(45);
  const afterSwing = await bearing();
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame._overlay.store.getState().prefs.cameraBearing as number)).toBeCloseTo(afterSwing, 0);

  // Persisted once the gesture settles.

  // Option/Alt + scroll is the Chrome/Firefox route.
  const box = await page.evaluate(() => { const r = (window as any).canalRecallGame.canvas.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down('Alt');
  await page.mouse.wheel(0, 120);
  await page.keyboard.up('Alt');
  await page.waitForTimeout(300);
  expect(Math.abs((await bearing()) - afterSwing)).toBeGreaterThan(5);
  expect(await page.evaluate(() => (window as any).canalRecallGame.camera.detached)).toBe(false);
});
