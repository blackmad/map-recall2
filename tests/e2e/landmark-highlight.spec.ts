import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression (user reports 2026-09-28, "why don't I see that museum on
// my screen highlighted?", Sexmuseum and the Sint Nicolaas basilica). A
// drive-by card knows only the landmark's point; the highlight was set on the
// hidden basemap building, or not at all. It now lights the streamed
// building(s) resolved at extract time (`scripts/resolve-landmark-buildings.ts`).
test('drive-by landmark cards light up their building', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'map lookup; one project is enough');
  test.setTimeout(200000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false });
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap._completeCityHasBuildings), { timeout: 60000 }).toBe(true);
  const result = await page.evaluate(() => {
    const game = (window as any).canalRecallGame, map = game.vectorMap;
    const features = map._completeCity.cache.collection().features;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const feature of features) {
      if (feature.geometry?.type !== 'Polygon') continue;
      for (const [x, y] of feature.geometry.coordinates[0]) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    const loaded = game.landmarks.filter((landmark: any) => landmark.lngLat
      && landmark.lngLat[0] > minX && landmark.lngLat[0] < maxX && landmark.lngLat[1] > minY && landmark.lngLat[1] < maxY);
    let highlighted = 0;
    for (const landmark of loaded) {
      map.setActiveLandmark(landmark);
      if (map._highlightedBuilding && map.map.getFeatureState(map._highlightedBuilding).highlighted) highlighted++;
    }
    map.setActiveLandmark(null);
    return { loaded: loaded.length, highlighted };
  });
  expect(result.loaded).toBeGreaterThan(4);
  // Plaques and monuments have no building and keep the locator dot.
  expect(result.highlighted / result.loaded, JSON.stringify(result)).toBeGreaterThan(0.6);
});

// Named regression (user report 2026-09-29, "why is this building highlighted
// yellow when no card is onscreen"). A question opening closed the card but
// left its building yellow; only the fade-out path cleared the highlight.
test('closing a landmark card any way clears its building', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'map lookup; one project is enough');
  test.setTimeout(200000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false });
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap._completeCityHasBuildings), { timeout: 60000 }).toBe(true);
  const result = await page.evaluate(() => {
    const game = (window as any).canalRecallGame, map = game.vectorMap;
    for (const landmark of game.landmarks) {
      map.setActiveLandmark(landmark);
      const target = map._highlightedBuilding;
      if (!target || !map.map.getFeatureState(target).highlighted) continue;
      game._landmarkNotice = { ...landmark };
      game._clearLandmarkNotice();
      return { found: true, still: Boolean(map.map.getFeatureState(target).highlighted), target: map._highlightedBuilding };
    }
    return { found: false };
  });
  expect(result.found, 'a landmark with a streamed building').toBe(true);
  expect(result.still, JSON.stringify(result)).toBe(false);
});

// Named regression (user reports 2026-09-29, "I can't see where on the map
// this landmark is" and "why can't we tie buildings to OSM ids and need to do
// this 10m thing?"). The Bevrijdingslinde is a tree; the 10 m nearest-footprint
// rule lit a shed beside it and drew no dot. Buildings are now resolved at
// extract time (`landmark-buildings.json`): a tree keeps its dot, above the
// buildings, and a resolved landmark lights exactly its own building.
test('a tree keeps its dot; a resolved landmark lights its own building', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'map lookup; one project is enough');
  test.setTimeout(200000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false });
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.landmarks.some((l: any) => Array.isArray(l.buildingIds))), { timeout: 60000 }).toBe(true);
  const result = await page.evaluate(() => {
    const game = (window as any).canalRecallGame, map = game.vectorMap;
    const tree = game.landmarks.find((l: any) => l.name === 'Bevrijdingslinde');
    map.setActiveLandmark(tree);
    const treeState = {
      buildingIds: tree.buildingIds,
      highlighted: map._highlightedBuildings.length,
      dots: map.map.getSource('active-landmark')._data?.features?.length
        ?? map.map.getSource('active-landmark').serialize().data.features.length,
    };
    const order = map.map.getLayersOrder();
    let topBuilding = -1;
    order.forEach((id: string, index: number) => { if (/^osm-colored-building|^building-3d|detailed|signature/.test(id)) topBuilding = index; });
    const dotAbove = order.indexOf('active-landmark-point') > topBuilding;
    const hall = game.landmarks.find((l: any) => l.name === 'Concertgebouw');
    map.setActiveLandmark(hall);
    const hallState = { ids: hall.buildingIds, highlighted: map._highlightedBuildings.map((t: any) => t.id) };
    map.setActiveLandmark(null);
    return { treeState, dotAbove, hallState };
  });
  expect(result.treeState.buildingIds).toEqual([]);
  expect(result.treeState.highlighted).toBe(0);
  expect(result.treeState.dots).toBe(1);
  expect(result.dotAbove).toBe(true);
  expect(result.hallState.ids.length).toBeGreaterThan(0);
  expect(result.hallState.highlighted).toEqual(result.hallState.ids);
});

// Named regression (user report 2026-10-03, "houseboat museum doesn't light up
// yellow when the trivia comes up"). The museum is a barge, so no building way
// joins to it; it now lights the drawn houseboat it is aboard.
test('the Houseboat Museum lights its houseboat, not a dot', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'map lookup; one project is enough');
  test.setTimeout(200000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false });
  await expect.poll(() => page.evaluate(() => {
    const map = (window as any).canalRecallGame.vectorMap;
    return !!(map._buildings3dEnabled && map._threeBuildings?.boatForLandmark && map._threeBuildings.boatForLandmark([4.882602, 52.3701526], 'museum'));
  }), { timeout: 60000 }).toBe(true);
  const result = await page.evaluate(() => {
    const game = (window as any).canalRecallGame, map = game.vectorMap;
    const museum = game.landmarks.find((l: any) => l.name === 'Houseboat Museum');
    map.setActiveLandmark(museum);
    const lit = [...map._threeBuildings.highlighted];
    const dots = map.map.getSource('active-landmark')._data?.features?.length
      ?? map.map.getSource('active-landmark').serialize().data.features.length;
    map.setActiveLandmark(null);
    return { lit, dots, after: [...map._threeBuildings.highlighted] };
  });
  expect(result.lit).toEqual(['w174999382']);
  expect(result.dots).toBe(0);
  expect(result.after).toEqual([]);
});

// Named regression (2026-09-30): clicking a building that is no landmark said
// "No building details — This building has no name in the map data." for
// nearly every building. It now says what the register knows: the year and
// period, the type when it is worth naming, a listing, and the size.
test('a clicked ordinary building tells its year instead of "no details"', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'map lookup; one project is enough');
  test.setTimeout(200000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false });
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap._completeCityHasBuildings), { timeout: 60000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    const features = game.vectorMap._completeCity.cache.collection().features;
    return features.some((f: any) => game._buildingFacts?.lookup(f.properties.id));
  }), { timeout: 60000 }).toBe(true);
  const card = await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    // An ordinary building: not a landmark's, so the landmark card cannot answer.
    game.landmarks = [];
    const feature = game.vectorMap._completeCity.cache.collection().features
      .find((f: any) => (game._buildingFacts.lookup(f.properties.id) || [0])[0] > 0);
    const [lng, lat] = feature.geometry.type === 'Polygon' ? feature.geometry.coordinates[0][0] : feature.geometry.coordinates[0][0][0];
    return game._cardForClickedBuilding({ id: feature.properties.id, height: feature.properties.height, lngLat: [lng, lat], featureTarget: null });
  });
  expect(card.detail).toMatch(/built in \d{4}|Built in \d{4}/);
  expect(card.detail).not.toContain('no name in the map data');
});
