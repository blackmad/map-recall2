import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// Named regression (2026-09-30): clicking a building that is no landmark said
// "No building details — This building has no name in the map data." for
// nearly every building. It now says what the register knows: the year and
// period, the type when it is worth naming, a listing, and the size.
test('a clicked ordinary building tells its year instead of "no details"', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'map lookup; one project is enough');
  test.setTimeout(200000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false });
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap._completeCityHasBuildings), { timeout: 60000 }).toBe(true);
  // The fact tiles load from the first card need on (per-ride bytes gate,
  // 2026-10-31): stand in for that first click at the rider's position.
  await page.evaluate(() => {
    const game = (window as any).canalRecallGame;
    const [lat, lng] = game._toLatLon(game.player.x, game.player.y);
    return game._buildingFacts.ensureAt(lng, lat);
  });
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
