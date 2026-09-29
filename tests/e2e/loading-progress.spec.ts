import { test, expect } from '@playwright/test';
import { setHiddenSelect } from './helpers';

// Named regression (user report 2026-09-29, "this progress bar jumps back and
// forth"). Two route loads in flight shared one abort flag, so a second start
// revived the first and both wrote the bar in turn. Only the newest load may
// touch it now, and its progress never goes backwards.
test('a restarted route load owns the progress bar alone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'loading flow; one project is enough');
  test.setTimeout(150000);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame))).toBe(true);
  await expect(page.locator('#route-card')).toBeVisible();
  await setHiddenSelect(page, 'travel-mode', 'car');
  await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    const samples: number[] = [];
    (window as any).__progress = samples;
    // Record every write, not frames: two loads can interleave within one.
    let progress = game.loadingProgress;
    Object.defineProperty(game, 'loadingProgress', {
      configurable: true,
      get: () => progress,
      set: (value: number) => { progress = value; samples.push(value); },
    });
    const from = { lat: 52.3731, lng: 4.8922 }, to = { lat: 52.3676, lng: 4.9041 };
    game._onLocationSelected((from.lat + to.lat) / 2, (from.lng + to.lng) / 2, from, to);
    // A second start while the first is settling the map (Escape, then a
    // new route, or a double start).
    const restart = () => {
      if (game.loadingProgress < 0.9) { requestAnimationFrame(restart); return; }
      samples.push(-1);
      game._onLocationSelected((from.lat + to.lat) / 2, (from.lng + to.lng) / 2, from, to);
    };
    restart();
  });
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.state), { timeout: 120000 }).not.toBe(2);
  // Let a stale load, if any, run to its end.
  await page.waitForTimeout(6000);
  const samples: number[] = await page.evaluate(() => (window as any).__progress);
  // After the restart (marked -1) the bar only rises.
  const after = samples.slice(samples.indexOf(-1) + 1);
  const drops = after.filter((value, i) => i > 0 && value < after[i - 1]);
  expect(drops, JSON.stringify(after.filter((v, i) => i === 0 || v !== after[i - 1]))).toEqual([]);
  expect(samples).toContain(-1);
  expect(after.at(-1)).toBe(1);
  expect(after.filter(value => value === 1)).toHaveLength(1);
});
