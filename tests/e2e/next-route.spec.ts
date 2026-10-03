import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression (user report 2026-09-29, "I hit enter at the end of a route
// and it just repeated the same route"). Enter on the finish card now rides on
// from where the route ended, to somewhere that is not the start just left.
test('Enter on the finish card rides on from the arrival', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'route choice; one project is enough');
  test.setTimeout(200000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  const before = await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    return { from: game.routeFrom?.id, to: game.routeTo?.id };
  });
  expect(before.to).toBeTruthy();
  // Riding on reuses the city already in memory (user report 2026-10-03, "why
  // does hitting enter at the end of route reload the whole game?"): no
  // loading screen, the same routing network, racing again in the same call.
  const rideOn = await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    const track = game.track;
    game.state = 5; // FINISHED
    const t0 = performance.now();
    game._runFinishAction('again');
    return {
      ms: performance.now() - t0,
      state: game.state,
      sameTrack: game.track === track,
      from: game.routeFrom?.id,
      to: game.routeTo?.id,
      start: game.track.startPoint,
      player: { x: game.player.x, y: game.player.y },
    };
  });
  expect(rideOn.state).toBe(4); // RACING, never LOADING (2)
  expect(rideOn.sameTrack).toBe(true);
  expect(rideOn.from).toBe(before.to);
  expect(rideOn.to).not.toBe(before.to);
  expect(rideOn.to).not.toBe(before.from);
  expect(Math.hypot(rideOn.player.x - rideOn.start.x, rideOn.player.y - rideOn.start.y)).toBeLessThan(1);
  console.log(`ride on took ${rideOn.ms.toFixed(0)} ms`);
});
