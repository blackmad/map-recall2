import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// My progress (src/progress/ProgressPage.tsx) and the shared account chip.
// A guest sees "Sign in" in the ride and the quiz and an empty progress page;
// a finished ride lands in ride history (src/canalRecall/routeHistory.ts) and
// on the page, and its "Ride again" link boots the same start and finish.

type Game = {
  state: number;
  travelMode: string;
  _raceKey: string | null;
  _rideNamedNames?: string[];
  quizCorrect: number; quizAttempts: number; quizPoints: number;
  routeFrom: { name: string }; routeTo: { name: string; reviewStop?: string };
  player: { x: number; y: number; speed: number };
  track: { finishPoint: { x: number; y: number } };
};
declare global { interface Window { canalRecallGame: Game } }

const shots = (name: string) => `artifacts/progress/${name}-${test.info().project.name}.png`;

async function screenshotBoth(page: Page, name: string) {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(150);
    await page.screenshot({ path: shots(`${name}-${viewport.width}`), fullPage: true });
  }
}

test('a guest sees Sign in everywhere and an empty progress page', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one viewport pass covers both widths');
  await page.goto('/progress');
  await expect(page.getByTestId('progress-page')).toBeVisible();
  await expect(page.locator('#progress-account-chip')).toHaveText(/Sign in/);
  await expect(page.getByTestId('progress-summary')).toContainText('Nothing here yet');
  await expect(page.getByTestId('rides-empty')).toBeVisible();
  await expect(page.getByTestId('rides-empty').locator('a')).toHaveAttribute('href', '/canal-drive/');
  await expect(page.getByTestId('mastered-canal')).toHaveCount(0);
  await expect(page.locator('#progress-site-switch a[data-site="progress"]')).toHaveAttribute('aria-current', 'page');
  // The landmark-stamp module is another lane's; until it exists the section stays hidden.
  const stampsModule = await page.evaluate(() => typeof (window as { CanalCollection?: unknown }).CanalCollection);
  if (stampsModule === 'undefined') await expect(page.getByTestId('stamps')).toHaveCount(0);
  await screenshotBoth(page, 'guest-empty');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('#header-account-chip')).toHaveText(/Sign in/);
  await page.screenshot({ path: shots('quiz-header-guest-1440') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: shots('quiz-header-guest-390') });
});

test('a finished ride shows on My progress and Ride again boots the same route', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one viewport pass covers both widths');
  test.setTimeout(300_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  await expect(page.locator('#account-button')).toHaveCount(1);
  // openRoute forces RACING as soon as the bike spawns; the route's share link is
  // written a moment later, at the end of loading, as it is before a real ride starts.
  await page.waitForFunction(() => Boolean((window.canalRecallGame as unknown as { _shareUrl?: string })._shareUrl), null, { timeout: 120_000 });
  await page.evaluate(() => { window.canalRecallGame.state = 4; });

  // Arrive: seed what the answer path would have counted, then put the bike on the finish.
  const before = await page.evaluate(() => {
    const game = window.canalRecallGame;
    game._rideNamedNames = ['Prinsengracht', 'Bloemgracht'];
    Object.assign(game, { quizCorrect: 2, quizAttempts: 3, quizPoints: 240 });
    if (game.routeTo.reviewStop) game.routeTo = { ...game.routeTo, reviewStop: undefined };
    game.player.x = game.track.finishPoint.x;
    game.player.y = game.track.finishPoint.y;
    game.player.speed = 0;
    return { raceKey: game._raceKey, from: game.routeFrom.name, to: game.routeTo.name };
  });
  await page.waitForFunction(() => window.canalRecallGame.state === 5, null, { timeout: 30_000 });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('canalRecall.routeHistory.v1') || '[]'));
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({
    mode: 'bike', namedCount: 2, askedCount: 3, points: 240,
    start: { name: before.from }, streetsLearned: ['Prinsengracht', 'Bloemgracht'],
  });
  expect(stored[0].raceHash).toMatch(/^#race=/);

  await page.goto('/progress');
  const row = page.getByTestId('ride-row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(before.from);
  await expect(row).toContainText('2 of 3');
  await expect(row).toContainText('Prinsengracht, Bloemgracht');
  await expect(page.getByTestId('summary-rides')).toHaveText('1');
  await expect(page.getByTestId('rides-empty')).toHaveCount(0);
  const again = row.getByTestId('ride-again');
  await expect(again).toHaveAttribute('href', `/canal-drive/?travel=car${stored[0].raceHash}`);
  await screenshotBoth(page, 'one-ride');

  // Ride again: the share link replays the same centre, start and finish.
  await page.setViewportSize({ width: 1440, height: 900 });
  await again.click();
  await page.waitForFunction(() => window.canalRecallGame?.state === 4, null, { timeout: 120_000 });
  const replay = await page.evaluate(() => ({ raceKey: window.canalRecallGame._raceKey, travelMode: window.canalRecallGame.travelMode }));
  expect(replay.travelMode).toBe('car');
  const [lat, lng, sLat, sLng, fLat, fLng] = stored[0].raceHash.slice(6).split(',').map(Number);
  const f = (n: number) => n.toFixed(3);
  expect(replay.raceKey).toBe(`${f(lat)},${f(lng)}_${f(sLat)},${f(sLng)}_${f(fLat)},${f(fLng)}`);
});

test('the ride account chip opens My progress and Sign out when signed in', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one viewport pass covers both widths');
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean(window.canalRecallGame))).toBe(true);
  await expect(page.locator('#account-button')).toHaveText(/Sign in/);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: shots('ride-setup-guest-1440') });
  await page.evaluate(() => (window as unknown as { canalRecallGame: { _overlay: { store: { setAccount: (a: object) => void } } } })
    .canalRecallGame._overlay.store.setAccount({ label: 'Anna van der Berg-Oosterhout', note: '12 synced', buttonLabel: 'Sign out', signedIn: true, photoURL: null, busy: false }));
  const chip = page.locator('#account-button');
  await expect(chip).toHaveAttribute('aria-label', 'Account: Anna van der Berg-Oosterhout');
  await chip.click();
  const menu = page.getByRole('menu', { name: 'Account' });
  await expect(menu.getByRole('menuitem', { name: 'My progress' })).toHaveAttribute('href', '/progress');
  await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
  await page.screenshot({ path: shots('ride-setup-signed-in-menu-1440') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: shots('ride-setup-signed-in-menu-390') });
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
});

test('the quiz header keeps its account chip on screen during a round', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'sets both widths itself');
  await page.route(/(basemaps\.cartocdn\.com|tile\.openstreetmap\.org|googleapis\.com|gstatic\.com|wikimedia\.org)/, (route) => route.abort());
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/?city=amsterdam&mode=pinpoint&category=neighborhoods&radius=4500&map=light_nolabels&labels=off&rounds=10');
    await expect(page.locator('#target-feature-name')).toBeVisible({ timeout: 60_000 });
    const chip = page.locator('#header-account-chip');
    await expect(chip).toBeVisible();
    const [box, menu] = [await chip.boundingBox(), await page.locator('#header-menu-btn').boundingBox()];
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(menu!.x + menu!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.x + box!.width).toBeLessThanOrEqual(menu!.x);
    await page.screenshot({ path: shots(`quiz-round-header-${viewport.width}`) });
  }
});
