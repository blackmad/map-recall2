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
  // The layer goes into the basemap's style, so wait for the basemap itself.
  await page.waitForFunction(() => (window as any).canalRecallGame?.vectorMap?.ready);
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
    // Actually put the camera at street level rather than only asserting from
    // the overview one. Resetting `_googleTilesActive` alone leaves the real
    // altitude in place, which is several hundred metres up and above the gate.
    map._cameraAltitudeMeters = () => 1.7;
    map._googleTilesActive = false;
    map.setGoogleTilesEnabled(true);
    map._updateGoogleTiles();
    await new Promise((r) => setTimeout(r, 500));
    return { active: map._googleTilesActive, layerAdded: !!map.map.getLayer('google-photoreal-tiles') };
  });

  expect(state.active).toBe(false);
  expect(state.layerAdded).toBe(false);
  expect(googleRequests, 'no billable tile request may be made from cycling height').toEqual([]);
});

// The three defects that shipped together and left the option doing nothing at
// all, each caught here without spending a Google request. Every test that
// existed before these passed while the feature was completely dead, because
// they only ever checked the pure gate, the plumbing, and a negative.
test('the camera altitude the gate is fed is a real number', async ({ page }) => {
  await loaded(page);
  // `getFreeCameraOptions()` is Mapbox GL JS, added after MapLibre forked, so
  // asking MapLibre for it returned undefined and the whole update was skipped
  // before the gate was ever consulted. An unreadable camera is indistinguishable
  // from a switched-off feature, so it has to be asserted directly.
  const altitude = await page.evaluate(() =>
    (window as any).canalRecallGame.vectorMap._cameraAltitudeMeters());
  expect(altitude).not.toBeNull();
  expect(Number.isFinite(altitude)).toBe(true);
  // Sanity, not a threshold: the game's camera hangs above a city, not in orbit.
  expect(altitude).toBeGreaterThan(1);
  expect(altitude).toBeLessThan(100_000);
});

test('switching it on at overview height actually asks Google for a tileset', async ({ page }) => {
  await loaded(page);
  const attempted: string[] = [];
  // Aborted, so this costs nothing and needs no network: what is under test is
  // that the request is attempted at all. It was not, because the layer only
  // called `tiles.update()` once it was `ready`, and only `update()` can fetch
  // the root tileset that makes it ready — a deadlock no negative test can see.
  await page.route('**://tile.googleapis.com/**', (route) => {
    attempted.push(route.request().url());
    return route.abort();
  });

  await page.evaluate(async () => {
    const map = (window as any).canalRecallGame.vectorMap;
    map.setGoogleTilesEnabled(true);
    map._updateGoogleTiles();
  });
  await expect.poll(() => attempted.length, { timeout: 10_000 }).toBeGreaterThan(0);
  expect(attempted[0]).toContain('3dtiles');
});

test('the mesh lands where the basemap says it should', async ({ page }) => {
  await loaded(page);

  // Google serves one global tileset in ECEF, so the root's bounding sphere is
  // centred on the middle of the Earth: the frame first derived from it aimed
  // at a latitude of several thousand degrees and MapLibre threw outright. The
  // frame is built from a chosen anchor now, and what matters is not that it
  // fails to throw but that it puts a known street on top of its own basemap.
  const offsets = await page.evaluate(() => {
    const api = (window as any).CanalRecallGoogleTiles;
    const { THREE } = (window as any).CanalRecallThree;
    const maplibre = (window as any).maplibregl;
    const anchor = { lng: 4.8952, lat: 52.3702 };
    const frame = api.localFrameAt(maplibre, anchor.lng, anchor.lat);

    // Amsterdam sits ~43 m above the ellipsoid, so a street at MapLibre altitude
    // 0 is at ellipsoid height 43. Sample the anchor and points a few hundred
    // metres out in each direction, which is where a wrong basis shows up.
    const samples = [
      anchor,
      { lng: anchor.lng + 0.004, lat: anchor.lat },
      { lng: anchor.lng, lat: anchor.lat + 0.004 },
      { lng: anchor.lng - 0.004, lat: anchor.lat - 0.004 },
    ];
    return samples.map((sample) => {
      const placed = api.ellipsoidPosition(sample.lng, sample.lat, 43)
        .applyMatrix4(frame.ecefToLocal)
        .applyMatrix4(frame.localTransform);
      const expected = maplibre.MercatorCoordinate.fromLngLat([sample.lng, sample.lat], 0);
      const metersPerUnit = 1 / expected.meterInMercatorCoordinateUnits();
      return new THREE.Vector3(
        placed.x - expected.x, placed.y - expected.y, placed.z - expected.z,
      ).length() * metersPerUnit;
    });
  });

  // A metre is the tolerance that matters here: the mesh has to sit on the right
  // side of a canal, and Amsterdam's narrowest are a few metres across.
  for (const offset of offsets) expect(offset).toBeLessThan(1);
});

test('the attribution element stays hidden while the mesh is not showing', async ({ page }) => {
  await loaded(page);
  const el = page.locator('#google-tiles-attribution');
  await expect(el).toHaveCount(1);
  await expect(el).toBeHidden();
});
