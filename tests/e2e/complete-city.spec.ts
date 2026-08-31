import { test, expect } from '@playwright/test';

// The complete LoD1 city is 336,784 BAG-keyed buildings at AHN-measured
// heights, streamed as z14 tiles instead of the single 5.5 MB file that
// describes a tenth of the city with mostly invented heights.
//
// It publishes into the versioned extract as a reviewed decision, so this spec
// skips rather than fails when the tiles are absent — and starts running by
// itself the moment they land. Everything it asserts is invisible to a
// screenshot: whether the streamer actually found the index, whether tiles are
// resident, and whether the basemap's redundant extrusion was hidden. A picture
// of a city with buildings in it looks identical either way.
test('the streamed city loads, and replaces the basemap extrusion', async ({ page }) => {
  test.setTimeout(180000);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/');
  await expect(page.locator('#route-card')).toBeVisible();
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());

  await expect
    .poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.vectorMap?.ready)), { timeout: 90000 })
    .toBe(true);

  const status = await page.evaluate(async () => {
    const map = (window as any).canalRecallGame?.vectorMap;
    // The probe is one HEAD request issued during load; give it a moment to
    // land rather than racing it.
    for (let attempt = 0; attempt < 40 && !map?._completeCity?.status().available; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    return map?._completeCity?.status() ?? null;
  });

  test.skip(!status?.available, 'the complete city is not published into the extract yet');

  await expect
    .poll(
      () => page.evaluate(() => (window as any).canalRecallGame?.vectorMap?._completeCity?.status().tiles ?? 0),
      { timeout: 60000 }
    )
    .toBeGreaterThan(0);

  const loaded = await page.evaluate(() => {
    const map = (window as any).canalRecallGame.vectorMap;
    return {
      status: map._completeCity.status(),
      // A hidden `building-3d` is the point: once every building is described
      // locally, the basemap's gray extrusion is a second solid in the same
      // place, which is what the height-offset stack existed to hide.
      basemapVisibility: map.map.getLayoutProperty('building-3d', 'visibility'),
      wallsVisible: map.map.getLayoutProperty('osm-colored-buildings', 'visibility') ?? 'visible',
      roofFilter: map.map.getFilter('osm-colored-building-roofs')
    };
  });

  expect(loaded.status.features, 'the streamed tiles carry real buildings').toBeGreaterThan(500);
  expect(loaded.basemapVisibility, 'the basemap extrusion is hidden').toBe('none');
  expect(loaded.wallsVisible, 'the merged source is what draws').toBe('visible');
  expect(loaded.roofFilter, 'the roof cap only draws where a roof colour exists').toEqual(['has', 'roofColour']);

  // Read the rendered source back: every feature must resolve to an identity or
  // picking cannot return a BuildingHit for it, and a measured height is the
  // whole point of the change.
  //
  // Polled, not sampled once. `querySourceFeatures` returns what MapLibre has
  // re-tiled for the current viewport, which lags `setData` by a frame or two —
  // reading it immediately gives an empty array perhaps one run in three, and
  // that says nothing about whether the streamer worked.
  const readSample = () => page.evaluate(() => {
    const map = (window as any).canalRecallGame.vectorMap.map;
    return map.querySourceFeatures('osm-building-appearance').slice(0, 400).map((feature: any) => ({
      id: feature.properties.id,
      height: feature.properties.height,
      tier: feature.properties.tier
    }));
  });
  await expect.poll(async () => (await readSample()).length, { timeout: 30000 }).toBeGreaterThan(0);
  const sample = await readSample();
  expect(sample.every((f: any) => typeof f.id === 'string' && f.id.length > 0), 'every building has an identity').toBe(true);
  // A height is present only when 3DBAG measured a positive one. Four buildings
  // in the whole city have none and fall through to the layer's fallback, so
  // the invariant is "never an unusable number", not "always a number".
  expect(
    sample.every((f: any) => f.height === undefined || (typeof f.height === 'number' && f.height > 0)),
    'no building carries a zero or negative height'
  ).toBe(true);
  expect(
    sample.filter((f: any) => typeof f.height === 'number').length,
    'essentially every building stands at a measured height'
  ).toBeGreaterThan(sample.length * 0.99);
  // Most of the city is a measured pand; the hand-mapped parts are the minority
  // that must survive rather than the norm.
  expect(sample.filter((f: any) => f.tier === 3).length, 'measured extrusions dominate').toBeGreaterThan(sample.length * 0.5);

  // Feature ids must be the building's own identity, not its index in the
  // array. The streamer rewrites that array on every tile load and eviction, so
  // an index-based id comes back pointing at a different building and the
  // highlight jumps to an unrelated house while the player drives. Pan far
  // enough to change the working set, then check the same building is still
  // addressable by the same id.
  const idBefore = sample[0].id;
  const stateHeld = await page.evaluate((id) => {
    const map = (window as any).canalRecallGame.vectorMap.map;
    map.setFeatureState({ source: 'osm-building-appearance', id }, { highlighted: true });
    return map.getFeatureState({ source: 'osm-building-appearance', id }).highlighted;
  }, idBefore);
  expect(stateHeld, 'feature state can be set by the building id').toBe(true);

  await page.evaluate(() => {
    const map = (window as any).canalRecallGame.vectorMap.map;
    const centre = map.getCenter();
    map.jumpTo({ center: [centre.lng + 0.02, centre.lat + 0.012] });
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap._completeCity.status().inFlight), { timeout: 30000 })
    .toBe(0);
  const stateAfterMove = await page.evaluate((id) => {
    const map = (window as any).canalRecallGame.vectorMap.map;
    return map.getFeatureState({ source: 'osm-building-appearance', id }).highlighted;
  }, idBefore);
  expect(stateAfterMove, 'the highlight still names the same building after the tiles change').toBe(true);

  // Printed because "the city loaded" is the kind of pass that is worth being
  // able to read a number for when it later regresses to loading one tile.
  console.log(
    `streamed city: ${loaded.status.tiles} tiles, ${loaded.status.features} features, ` +
    `sampled ${sample.length} with heights ${Math.min(...sample.map((f: any) => f.height)).toFixed(1)}–` +
    `${Math.max(...sample.map((f: any) => f.height)).toFixed(1)} m`
  );
});
