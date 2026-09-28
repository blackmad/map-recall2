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

// Named regression (user report 2026-09-28): "why is the camera now jumping to
// almost overhead view when I back up or sometimes turn?". The chase camera
// leads the rider, and the clearance guard aimed its sightline at that lead
// point, which swung behind buildings on a turn or a reverse and snapped the
// pitch to 17° in one frame. The sightline now ends at the rider, and any
// pitch change the guard asks for is eased.
test('turning and reversing in chase view never snaps the pitch', async ({ page }) => {
  test.setTimeout(180000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90000 });
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {}; });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const w = window as any; w.__pitches = [];
    const tick = () => { w.__pitches.push(w.canalRecallGame.vectorMap.map.getPitch()); if (w.__pitches.length < 600) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(1500);
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(2500); await page.keyboard.up('ArrowDown');
  const { pitches, subject, rider } = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const request = g.vectorMap._cameraClearanceRequest;
    return {
      pitches: (window as any).__pitches as number[],
      subject: request?.subject ?? null,
      rider: g.vectorMap.worldToLngLat(g.player.x, g.player.y, g.osmLoader),
    };
  });
  let worst = 0;
  for (let i = 1; i < pitches.length; i++) worst = Math.max(worst, pitches[i - 1] - pitches[i]);
  expect(worst, `largest one-frame pitch drop (${pitches.length} frames)`).toBeLessThan(8);
  expect(subject, 'the clearance sightline has a subject').not.toBeNull();
  const metres = Math.hypot((subject[0] - rider[0]) * 111320 * Math.cos(rider[1] * Math.PI / 180), (subject[1] - rider[1]) * 111320);
  expect(metres, 'the sightline ends at the rider, not the lead point').toBeLessThan(12);
});
