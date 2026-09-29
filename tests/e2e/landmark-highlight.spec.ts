import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression (user reports 2026-09-28, "why don't I see that museum on
// my screen highlighted?", Sexmuseum and the Sint Nicolaas basilica). A
// drive-by card knows only the landmark's point; the highlight was set on the
// hidden basemap building, or not at all. It now finds the streamed building:
// the landmark's own OSM way, the footprint around its node, or the nearest
// footprint within 10 m of an entrance node.
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
