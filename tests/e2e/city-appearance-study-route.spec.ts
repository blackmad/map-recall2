import { expect, test } from '@playwright/test';

test('the published Da Costa appearance lesson starts from the real game setup', async ({ page },testInfo) => {
  test.setTimeout(180_000);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/');
  await expect(page.locator('#route-card')).toBeVisible();

  await page.locator('[data-choice="route:study"]').click();
  await expect(page.locator('[data-choice="route:study"]')).toHaveClass(/active/);
  await expect(page.locator('#route-pattern')).toHaveValue('study');
  await expect(page.locator('#travel-mode')).toHaveValue('car');
  await expect(page.locator('#view-mode')).toHaveValue('chase');
  await expect(page.locator('#camera-zoom')).toHaveValue('0.8');
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());

  await expect.poll(() => page.evaluate(() => ({
    pattern: (window as any).canalRecallGame?.routePattern,
    view: (window as any).canalRecallGame?.viewMode,
    zoom: (window as any).canalRecallGame?.camera?.zoom,
    from: (window as any).canalRecallGame?.routeFrom?.name,
    to: (window as any).canalRecallGame?.routeTo?.name,
    hasPlayer: Number.isFinite((window as any).canalRecallGame?.player?.x),
  })), { timeout: 90_000 }).toEqual({
    pattern: 'study',
    view: 'chase',
    zoom: 0.8,
    from: 'Hugo de Grootkade',
    to: 'Rozengracht',
    hasPlayer: true,
  });

  await expect.poll(
    () => page.evaluate(() => (window as any).canalRecallGame?.vectorMap?._completeCity?.status().styledFeatures ?? 0),
    { timeout: 60_000 },
  ).toBeGreaterThan(0);

  const checkpoints = [];
  for (const fraction of [0, .25, .5, .75, 1]) {
    await page.evaluate((progress) => {
      const game = (window as any).canalRecallGame;
      const path = game.routePath;
      if (!Array.isArray(path) || path.length < 2) throw new Error('Study route path unavailable');
      if (!(window as any).__studyRouteMapSync) {
        (window as any).__studyRouteMapSync = game.vectorMap.sync.bind(game.vectorMap);
        game.vectorMap.sync = () => undefined;
      }
      const cumulative = [0];
      for (let index = 1; index < path.length; index++) cumulative.push(cumulative[index - 1] + Math.hypot(path[index].x - path[index - 1].x, path[index].y - path[index - 1].y));
      const target = cumulative.at(-1) * progress;
      let index = Math.min(path.length - 2, cumulative.findIndex(distance => distance >= target));
      if (index < 0) index = path.length - 2;
      if (cumulative[index] > target && index > 0) index--;
      const point = path[index], next = path[index + 1], segment = cumulative[index + 1] - cumulative[index] || 1, mix = Math.max(0, Math.min(1, (target - cumulative[index]) / segment));
      game.camera.x = point.x + (next.x - point.x) * mix;
      game.camera.y = point.y + (next.y - point.y) * mix;
      game.camera.rotation = Math.atan2(next.y - point.y, next.x - point.x);
      (window as any).__studyRouteMapSync(game.camera, game.osmLoader, game.canvas);
    }, fraction);
    await expect.poll(() => page.evaluate(() => {
      const map = (window as any).canalRecallGame.vectorMap;
      return map._completeCity.status().inFlight + map._completeCity.status().queued
        + (map._studyRoofs?.inFlight ?? 0) + (map._studyRoofs?.queue?.length ?? 0)
        + (map._studyFacades?.inFlight ?? 0) + (map._studyFacades?.queue?.length ?? 0)
        + (map._studyTrees?.inFlight ?? 0) + (map._studyTrees?.queue?.length ?? 0)
        + (map._studyPublicRealm?.inFlight ?? 0) + (map._studyPublicRealm?.queue?.length ?? 0);
    }), { timeout: 60_000 }).toBe(0);
    if(fraction===.5){
      await page.screenshot({path:`.cache/city-appearance/map-recall-study-${testInfo.project.name}.png`});
      const overview=await page.evaluate(()=>{const facade=(window as any).canalRecallGame.vectorMap._studyFacades;return{resident:facade.debugResident,triangles:facade.debugTriangles,visible:facade.debugVisibleMeshes};});
      await page.evaluate(()=>{const map=(window as any).canalRecallGame.vectorMap.map,center=map.getCenter();map.jumpTo({center:[center.lng,center.lat+.00045],zoom:19.55,pitch:65});map.triggerRepaint();});
      await expect.poll(()=>page.evaluate(()=>(window as any).canalRecallGame.vectorMap._studyFacades.debugVisibleMeshes)).toBeGreaterThan(overview.visible);
      const close=await page.evaluate(()=>{const facade=(window as any).canalRecallGame.vectorMap._studyFacades;return{resident:facade.debugResident,triangles:facade.debugTriangles,visible:facade.debugVisibleMeshes};});
      expect(close.resident,'facade LOD changes drawing without tile churn').toBe(overview.resident);
      expect(close.triangles,'facade LOD reuses resident geometry').toBe(overview.triangles);
      await page.screenshot({path:`.cache/city-appearance/map-recall-study-close-${testInfo.project.name}.png`});
      await page.evaluate(()=>{const game=(window as any).canalRecallGame;(window as any).__studyRouteMapSync(game.camera,game.osmLoader,game.canvas);});
    }
    checkpoints.push(await page.evaluate((progress) => {
      const map = (window as any).canalRecallGame.vectorMap;
      return {
        progress,
        city: map._completeCity.status(),
        roofs: { resident: map._studyRoofs.debugResident, meshes: map._studyRoofs.debugMeshes, bytes: map._studyRoofs.debugGeometryBytes },
        facades: { resident: map._studyFacades.debugResident, triangles: map._studyFacades.debugTriangles, bytes: map._studyFacades.debugGeometryBytes },
        trees: { resident: map._studyTrees.debugResident, meshes: map._studyTrees.debugMeshes, bytes: map._studyTrees.debugGeometryBytes },
        publicRealm: { resident: map._studyPublicRealm.debugResident, meshes: map._studyPublicRealm.debugMeshes, bytes: map._studyPublicRealm.debugGeometryBytes },
      };
    }, fraction));
  }
  expect(checkpoints.every(checkpoint => checkpoint.city.features > 500 && checkpoint.city.styledFeatures > 0)).toBe(true);
  console.log('study route public-realm telemetry:',checkpoints.map(checkpoint=>({progress:checkpoint.progress,resident:checkpoint.publicRealm.resident,meshes:checkpoint.publicRealm.meshes,bytes:checkpoint.publicRealm.bytes})));
  expect(checkpoints.every(checkpoint => checkpoint.city.tiles <= 12 && checkpoint.roofs.resident <= 12 && checkpoint.facades.resident <= 12 && checkpoint.trees.resident <= 12 && checkpoint.publicRealm.resident <= 12)).toBe(true);
  expect(checkpoints.every(checkpoint => checkpoint.facades.triangles > 1_000 && checkpoint.trees.meshes > 0 && checkpoint.trees.meshes <= 48 && checkpoint.publicRealm.meshes > 0 && checkpoint.publicRealm.meshes <= 32)).toBe(true);
  expect(checkpoints.every(checkpoint => checkpoint.roofs.bytes < 1_000_000 && checkpoint.facades.bytes < 8_000_000 && checkpoint.trees.bytes < 300_000 && checkpoint.publicRealm.bytes < 1_500_000)).toBe(true);
  expect(checkpoints.every(checkpoint => checkpoint.roofs.bytes + checkpoint.facades.bytes + checkpoint.trees.bytes + checkpoint.publicRealm.bytes < 11_000_000)).toBe(true);
  const maxDetailBytes = Math.max(...checkpoints.map(checkpoint => checkpoint.roofs.bytes + checkpoint.facades.bytes + checkpoint.trees.bytes + checkpoint.publicRealm.bytes));
  console.log('study route streaming:', checkpoints.map(checkpoint => `${Math.round(checkpoint.progress * 100)}%=${checkpoint.city.tiles}/${checkpoint.roofs.resident}/${checkpoint.facades.resident}/${checkpoint.trees.resident}/${checkpoint.publicRealm.resident} tiles`).join(', '), `detail buffers <= ${(maxDetailBytes / 1_000_000).toFixed(2)} MB`);
});
