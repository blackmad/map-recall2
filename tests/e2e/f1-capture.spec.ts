import { expect, test } from '@playwright/test';
import { landingFixtureEntries } from '../../src/canalRecall/landing/landingFixtures';

// F1 (#311) strip capture: the returning landing, the Free Ride plaque near a
// checklist buurt, and the passport album. F1_SHOTS=<dir> F1_TAG=before|after.
const SHOTS = process.env.F1_SHOTS || '/tmp/f1-shots';
const TAG = process.env.F1_TAG || 'after';

test('landing', async ({ page }, info) => {
  const entries = landingFixtureEntries('returning', Date.now());
  await page.addInitScript((data: Record<string, string>) => {
    if (sessionStorage.getItem('f1')) return; sessionStorage.setItem('f1', '1');
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
    localStorage.setItem('canalRecall.whatsNewSeen.v1', '9999-12-31');
  }, entries);
  await page.goto('/canal-drive/landing.html');
  await expect(page.locator('#landing-returning-slot')).toBeVisible();
  await page.waitForTimeout(500);
  const cards = await page.locator('[data-landing-card]').count();
  console.log(`F1 ${TAG} ${info.project.name} landing cards=${cards}`);
  await page.screenshot({ path: `${SHOTS}/${TAG}-landing-${info.project.name}.png` });
});

test('free ride plaque', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/?ride=free');
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame?.state), { timeout: 120_000 }).toBe(4);
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const l = g.landmarks.find((x: any) => /Rijksmuseum/.test(x.name)) ?? g.landmarks[0];
    const road = g.track.getNearestRoad(l.x - 450, l.y);
    g.player.x = road.x; g.player.y = road.y; g.player.speed = 0; g.player.angle = road.angle ?? 0;
    g.camera.resetForRide?.(g.player); g._freeRideRefresh = 0;
  });
  await page.waitForTimeout(3000);
  const s = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    return { collection: !!g._freeRideCollection, tally: g._freeRideTally(), token: !!g._freeRideCollection?.token, radar: g._freeRideRadarPlaces().length, markers: g._freeRideMarkers.length };
  });
  console.log(`F1 ${TAG} ${info.project.name} freeRide ${JSON.stringify(s)}`);
  await page.screenshot({ path: `${SHOTS}/${TAG}-free-ride-${info.project.name}.png` });
});

test('album', async ({ page }, info) => {
  test.setTimeout(120_000);
  const entries = landingFixtureEntries('returning', Date.now());
  await page.addInitScript((data: Record<string, string>) => {
    if (sessionStorage.getItem('f1')) return; sessionStorage.setItem('f1', '1');
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
  }, entries);
  await page.goto('/canal-drive/');
  await expect(page.locator('#knowledge-button')).toBeVisible({ timeout: 60_000 });
  await page.locator('#knowledge-button').click();
  const album = page.getByTestId('stamp-album');
  await expect(album).toBeVisible();
  console.log(`F1 ${TAG} ${info.project.name} album body=${JSON.stringify(await album.innerText().then(t => t.slice(0, 200)))}`);
  await album.screenshot({ path: `${SHOTS}/${TAG}-album-${info.project.name}.png` });
});
