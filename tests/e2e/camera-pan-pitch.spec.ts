import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression (user report 2026-09-28): "when panning the map it seems to
// switch between top-down while panning and then back to 3d/isometric when
// stopped". The rider-sightline clearance guard ran against the panned centre
// and cut the pitch toward 17° on every drag frame. A drag must keep the tilt.
test('dragging the chase view keeps its tilt', async ({ page }) => {
  test.setTimeout(180000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  const settled = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.pitchForViewMode('chase'));
  const pitches = await page.evaluate(async () => {
    const g = (window as any).canalRecallGame;
    const seen: number[] = [];
    for (let i = 0; i < 40; i++) {
      g.camera.pan(14, -10);
      await new Promise(requestAnimationFrame);
      seen.push(g.vectorMap.map.getPitch());
    }
    return seen;
  });
  const lowest = Math.min(...pitches.slice(5));
  expect(lowest, `pitch while dragging (${pitches.map(p => p.toFixed(0)).join(',')})`).toBeGreaterThan(settled - 3);
});
