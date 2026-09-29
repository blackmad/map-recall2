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
  await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    game.state = 5; // FINISHED
    game._runFinishAction('again');
  });
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.routeFrom?.id), { timeout: 60000 }).toBe(before.to);
  const after = await page.evaluate(() => ({ to: (window as any).canalRecallGame.routeTo?.id }));
  expect(after.to).not.toBe(before.to);
  expect(after.to).not.toBe(before.from);
});
