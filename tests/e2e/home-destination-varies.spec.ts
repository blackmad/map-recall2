import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression (user, 2026-10-09): launching from home (Da Costakade 13-3)
// picked De Dolphijn every time. Math.random is seeded identically for both
// launches, so only the remembered recent destination can make them differ.
test('two consecutive launches from home pick different destinations', async ({ page }) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    if (localStorage.getItem('canalRecall.preferences.v1')) return;
    localStorage.setItem('canalRecall.preferences.v1', JSON.stringify({
      routePattern: 'home',
      homeAddress: 'Da Costakade 13-3',
      travelMode: 'car',
    }));
    localStorage.setItem('canalRecall.homeGeocodes.v2', JSON.stringify({
      'amsterdam|da costakade 13-3, amsterdam': { lat: 52.3728, lng: 4.8737, label: 'Da Costakade 13-3' },
    }));
  });
  const destinations: string[] = [];
  for (let launch = 0; launch < 2; launch += 1) {
    await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
    const routeTo = await page.evaluate(() => (window as any).canalRecallGame.routeTo?.id as string);
    const pattern = await page.evaluate(() => (window as any).canalRecallGame.routePattern as string);
    expect(pattern).toBe('home');
    destinations.push(routeTo);
  }
  expect(destinations[0]).toBeTruthy();
  expect(destinations[1]).not.toBe(destinations[0]);
});

// User request 2026-10-10: the next home ride does not go back home. It starts
// at the arrival and ends at another landmark inside the learning ring.
test('the next home ride starts at the arrival and stays near home', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'route choice; one project is enough');
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    localStorage.setItem('canalRecall.preferences.v1', JSON.stringify({
      routePattern: 'home',
      homeAddress: 'Da Costakade 13-3',
      travelMode: 'car',
    }));
    localStorage.setItem('canalRecall.homeGeocodes.v2', JSON.stringify({
      'amsterdam|da costakade 13-3, amsterdam': { lat: 52.3728, lng: 4.8737, label: 'Da Costakade 13-3' },
    }));
  });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  const first = await page.evaluate(() => (window as any).canalRecallGame.routeTo?.id as string);
  const next = await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    game.state = 5; // FINISHED
    game._runFinishAction('again');
    const route = (window as any).CanalRecallRoute;
    const to = game.routeTo;
    return {
      from: game.routeFrom?.id,
      to: to?.id,
      ringKm: game._homeLearningRadiusKm * route.HOME_RADIUS_OVERSHOOT,
      fromHomeKm: to ? route.kmBetween(to, game.homeBase) : Infinity,
    };
  });
  expect(next.from).toBe(first);
  expect(next.to).toBeTruthy();
  expect(next.to).not.toBe('home');
  expect(next.to).not.toBe(first);
  expect(next.fromHomeKm).toBeLessThanOrEqual(next.ringKm + 0.01);
});
