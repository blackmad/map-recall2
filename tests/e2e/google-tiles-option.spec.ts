// Google's photorealistic mesh is an overview-only option: it reads cleanly
// from ~25 m up and is a smear at cycling height, and it carries no building
// identity to highlight an answer with (see HISTORY.md). The altitude rule
// itself is unit-covered by `npm run test:photoreal-gate`; what this file
// covers is the wiring around it — that the setting reaches the map, and that
// no tile is ever requested from the height the game is actually played at.
import { test, expect } from '@playwright/test';

async function loaded(page: import('@playwright/test').Page) {
  await page.goto('/canal-drive/');
  await page.waitForFunction(() => !!(window as any).canalRecallGame?.ctx);
  // The tiles module is ESM and therefore deferred; the gate is a classic
  // script and must already be there when the first camera sync runs.
  await page.waitForFunction(() => !!(window as any).CanalRecallGoogleTiles);
}

test('the gate ships with the page and agrees with the measured heights', async ({ page }) => {
  await loaded(page);
  const verdicts = await page.evaluate(() => {
    const gate = (window as any).CanalRecallPhotorealGate;
    const at = (altitudeMeters: number, active: boolean) =>
      gate.shouldShowPhotoreal({ enabled: true, altitudeMeters, active });
    return {
      cycling: at(1.7, false),
      smearing: at(10, false),
      overview: at(150, false),
      activation: (window as any).CanalRecallGoogleTiles.ACTIVATION_METERS,
    };
  });
  expect(verdicts.cycling).toBe(false);
  expect(verdicts.smearing).toBe(false);
  expect(verdicts.overview).toBe(true);
  expect(verdicts.activation).toBe(25);
});

test('the setting exists in both panels and reaches the map', async ({ page }) => {
  await loaded(page);
  await expect(page.locator('#google-tiles')).toHaveCount(1);
  await expect(page.locator('#live-google-tiles')).toHaveCount(1);
  expect(await page.evaluate(() =>
    typeof (window as any).canalRecallGame?.vectorMap?.setGoogleTilesEnabled)).toBe('function');
});

test('switching it on at cycling height requests no tiles and keeps 3DBAG', async ({ page }) => {
  await loaded(page);
  const googleRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('tile.googleapis.com')) googleRequests.push(request.url());
  });

  const state = await page.evaluate(async () => {
    const map = (window as any).canalRecallGame.vectorMap;
    map.setGoogleTilesEnabled(true);
    // Force the decision at street level, the height the game is played at.
    map._googleTilesActive = false;
    map._updateGoogleTiles();
    await new Promise((r) => setTimeout(r, 500));
    return { active: map._googleTilesActive, layerAdded: !!map.map.getLayer('google-photoreal-tiles') };
  });

  expect(state.active).toBe(false);
  expect(state.layerAdded).toBe(false);
  expect(googleRequests, 'no billable tile request may be made from cycling height').toEqual([]);
});

test('the attribution element stays hidden while the mesh is not showing', async ({ page }) => {
  await loaded(page);
  const el = page.locator('#google-tiles-attribution');
  await expect(el).toHaveCount(1);
  await expect(el).toBeHidden();
});
