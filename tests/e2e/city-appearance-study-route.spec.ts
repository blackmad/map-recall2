import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const candidateManifestPath = process.env.FACADE_CANDIDATE_MANIFEST;
if (candidateManifestPath && !path.isAbsolute(candidateManifestPath)) throw Error('FACADE_CANDIDATE_MANIFEST must be an absolute staged-manifest path');
const candidateDescriptorBytes = candidateManifestPath ? readFileSync(candidateManifestPath) : null;
const candidateDescriptor = candidateDescriptorBytes ? JSON.parse(candidateDescriptorBytes.toString()) : null;
const nestedManifestPath = candidateDescriptor?.manifest?.path ? path.resolve(path.dirname(candidateManifestPath!), candidateDescriptor.root ?? '.', candidateDescriptor.manifest.path) : candidateManifestPath;
const candidateManifestBytes = nestedManifestPath ? readFileSync(nestedManifestPath) : null;
const candidateManifest = candidateManifestBytes ? JSON.parse(candidateManifestBytes.toString()) : null;
if (candidateManifest) {
  if (candidateDescriptor?.manifest?.sha256 && crypto.createHash('sha256').update(candidateManifestBytes!).digest('hex') !== candidateDescriptor.manifest.sha256) throw Error('Staged candidate manifest hash changed');
  const binding = candidateDescriptor?.candidate ?? candidateManifest.candidateBinding ?? candidateManifest.candidate;
  if (!/^[a-f0-9]{64}$/.test(candidateManifest.releaseId)) throw Error('Candidate manifest has no immutable release id');
  if (!binding || binding.releaseId !== candidateManifest.releaseId || !['compilerHash', 'recordsSha256', 'artifactsSha256'].every(key => /^[a-f0-9]{64}$/.test(binding[key]))) throw Error('Candidate manifest is missing its exact compiler, records or artifact binding');
  const serialized = candidateManifestBytes!.toString();
  if (serialized.includes('/data/city-expansion/current.json')) throw Error('Candidate manifest contains a mutable artifact URL');
  const releasePrefix = `/data/city-expansion/releases/${candidateManifest.releaseId}/`;
  const urls = [...serialized.matchAll(/"(?:url|indexUrl|manifestUrl)":"([^"]+)"/g)].map(match => match[1]);
  if (urls.some(url => url.startsWith('/data/city-expansion/') && !url.startsWith(releasePrefix))) throw Error('Candidate manifest artifact URLs are not bound to its immutable release');
}

const evaluationCameras = [
  { id: 'evaluation-01', kind: 'canal-edge', center: [4.869686, 52.372419], bearing: -18.29 },
  { id: 'evaluation-02', kind: 'ordinary-houses', center: [4.870719, 52.372627], bearing: -18.29 },
  { id: 'evaluation-03', kind: 'storefronts', center: [4.871752, 52.372835], bearing: -18.12 },
  { id: 'evaluation-04', kind: 'corner', center: [4.872786, 52.373042], bearing: -18.12 },
  { id: 'evaluation-05', kind: 'corner', center: [4.873820, 52.373249], bearing: -18.12 },
  { id: 'evaluation-06', kind: 'district-transition', center: [4.874854, 52.373455], bearing: -18.12 },
  { id: 'evaluation-07', kind: 'canal-edge', center: [4.874805, 52.372959], bearing: 128.71 },
  { id: 'evaluation-08', kind: 'bridge', center: [4.874219, 52.372412], bearing: 104.11 },
  { id: 'evaluation-09', kind: 'corner', center: [4.874284, 52.371787], bearing: -0.69 },
  { id: 'evaluation-10', kind: 'storefronts', center: [4.875304, 52.372008], bearing: -21.10 },
  { id: 'evaluation-11', kind: 'ordinary-houses', center: [4.876325, 52.372237], bearing: -22.36 },
  { id: 'evaluation-12', kind: 'district-transition', center: [4.877272, 52.372548], bearing: -43.99 },
  { id: 'evaluation-13', kind: 'storefronts', center: [4.881852, 52.369930], bearing: 162 },
  { id: 'evaluation-14', kind: 'ordinary-houses', center: [4.88673, 52.37934], bearing: 0 },
] as const;

test('the published Da Costa–Jordaan appearance lesson renders through the real game', async ({ page },testInfo) => {
  test.setTimeout(180_000);
  const outputDirectory = candidateManifest ? `.cache/city-appearance/candidates/${candidateManifest.releaseId}` : '.cache/city-appearance';
  mkdirSync(outputDirectory, { recursive: true });
  if (candidateManifest) await page.route('**/data/city-expansion/current.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: candidateManifestBytes! }));
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
    hasPlayer: Number.isFinite((window as any).canalRecallGame?.player?.x),
  })), { timeout: 90_000 }).toEqual({
    pattern: 'study',
    view: 'chase',
    zoom: 0.8,
    hasPlayer: true,
  });

  await expect.poll(
    () => page.evaluate(() => (window as any).canalRecallGame?.vectorMap?._completeCity?.status().styledFeatures ?? 0),
    { timeout: 60_000 },
  ).toBeGreaterThan(0);

  const checkpoints = [];
  for (const camera of evaluationCameras) {
    await page.evaluate((checkpoint) => {
      const game = (window as any).canalRecallGame;
      if (!(window as any).__studyRouteMapSync) {
        (window as any).__studyRouteMapSync = game.vectorMap.sync.bind(game.vectorMap);
        game.vectorMap.sync = () => undefined;
      }
      const map = game.vectorMap.map;
      map.jumpTo({ center: checkpoint.center, zoom: 19.55, pitch: 65, bearing: checkpoint.bearing });
      game.vectorMap._clearCameraFromBuildingFootprints(checkpoint.center, { zoom: 19.55, pitch: 65, bearing: checkpoint.bearing });
      map.triggerRepaint();
    }, camera);
    const renderReady = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.whenAppearanceRenderReady(60_000));
    expect(renderReady.ready, `${camera.id} waits for MapLibre and every visible Three layer to paint`).toBe(true);
    expect(renderReady.withinBudget, `${camera.id} detail buffers fit the viewport-wide ceiling`).toBe(true);
    // The z14 GeoJSON source finishes parsing after its fetch has settled.
    // Re-evaluate clearance against those newly queryable footprints before
    // freezing the checkpoint, matching the game's periodic sync check.
    await page.evaluate((checkpoint) => {
      const map = (window as any).canalRecallGame.vectorMap;
      map._clearCameraFromBuildingFootprints(checkpoint.center, { zoom: 19.55, pitch: 65, bearing: checkpoint.bearing });
      map.map.triggerRepaint();
    }, camera);
    await page.evaluate(() => (window as any).canalRecallGame.vectorMap.whenAppearanceRenderReady(60_000));
    checkpoints.push(await page.evaluate((checkpoint) => {
      const map = (window as any).canalRecallGame.vectorMap;
      const transform = map.map.transform;
      const physicalCamera = transform.getCameraLngLat();
      const cameraPoint = [physicalCamera.lng, physicalCamera.lat];
      const cameraAltitude = transform.getCameraAltitude();
      return {
        id: checkpoint.id,
        kind: checkpoint.kind,
        physicalCamera,
        cameraAltitude,
        cameraBlocked: Boolean(map._cameraBlockingFeature(cameraPoint, cameraAltitude)),
        sightlineBlocked: Boolean(map._cameraSightlineBlocker(cameraPoint, checkpoint.center, cameraAltitude)),
        visibleMasses: map.map.queryRenderedFeatures(undefined, { layers: ['osm-colored-buildings'] }).length,
        facadePaints: map._studyFacadeAreas.reduce((sum: number, layer: any) => sum + layer.debugPaints, 0),
        activeAreaId: map._activeAppearanceAreaId,
        enabledAreaIds: [...new Set([map._studyRoofAreas, map._studyFacadeAreas, map._studyTreeAreas, map._studyPublicRealmAreas].flat().filter((layer: any) => layer.enabled).map((layer: any) => layer.areaId))],
        render: map.appearanceRenderStatus(),
        city: map._completeCity.status(),
        roofs: { resident: map._studyRoofs.debugResident, meshes: map._studyRoofs.debugMeshes, bytes: map._studyRoofs.debugGeometryBytes },
        facades: { resident: map._studyFacades.debugResident, triangles: map._studyFacades.debugTriangles, bytes: map._studyFacades.debugGeometryBytes, textureBytes: map._studyFacades.debugSigns*512*64*4 },
        trees: { resident: map._studyTrees.debugResident, meshes: map._studyTrees.debugMeshes, bytes: map._studyTrees.debugGeometryBytes },
        publicRealm: { resident: map._studyPublicRealm.debugResident, meshes: map._studyPublicRealm.debugMeshes, bytes: map._studyPublicRealm.debugGeometryBytes },
      };
    }, camera));
    await page.screenshot({ path: `${outputDirectory}/map-recall-${camera.id}-${testInfo.project.name}.png` });
  }
  const festSign = await page.evaluate(async () => {
    const vectorMap = (window as any).canalRecallGame.vectorMap;
    const maplibregl = (window as any).maplibregl;
    const origin = maplibregl.MercatorCoordinate.fromLngLat([4.872449997145829, 52.369280002196604], 0);
    const scale = origin.meterInMercatorCoordinateUnits();
    const center = new maplibregl.MercatorCoordinate(origin.x - 104.45736396174512*scale, origin.y - 212.5743884047187*scale, 0).toLngLat();
    const camera = { center: [center.lng, center.lat], zoom: 21, pitch: 78, bearing: -20 };
    vectorMap.map.jumpTo(camera);
    vectorMap._clearCameraFromBuildingFootprints(camera.center, camera);
    await vectorMap.whenAppearanceRenderReady(60_000);
    vectorMap._clearCameraFromBuildingFootprints(camera.center, camera);
    await vectorMap.whenAppearanceRenderReady(60_000);
    const meshes = [...vectorMap._studyFacades.resources.values()].flat();
    return {
      center: camera.center,
      resident: vectorMap._studyFacades.debugResident,
      bytes: vectorMap._studyFacades.debugGeometryBytes,
      signResident: meshes.some((mesh: any) => mesh.userData.observationId === '0363100012237236_e_07oi4ua'),
      render: vectorMap.appearanceRenderStatus(),
    };
  });
  expect(festSign.signResident, 'the FEST source-positive sign is admitted in its nearest facade tile').toBe(true);
  expect(festSign.render.withinBudget, 'the sign development view remains inside the shared detail budget').toBe(true);
  await page.screenshot({ path: `${outputDirectory}/map-recall-fest-sign-${testInfo.project.name}.png` });
  const beforeOverview = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.appearanceRenderStatus());
  await page.evaluate(() => (window as any).canalRecallGame.vectorMap.map.jumpTo({ center: [4.91, 52.385], zoom: 14, pitch: 35, bearing: 0 }));
  await expect.poll(() => page.evaluate(() => {
    const map = (window as any).canalRecallGame.vectorMap;
    return [map._studyRoofAreas, map._studyFacadeAreas, map._studyTreeAreas, map._studyPublicRealmAreas].flat().reduce((sum: number, layer: any) => sum + layer.debugResident, 0);
  })).toBe(0);
  await page.evaluate((checkpoint) => (window as any).canalRecallGame.vectorMap.map.jumpTo({ center: checkpoint.center, zoom: 19.55, pitch: 65, bearing: checkpoint.bearing }), evaluationCameras[0]);
  const rehydrated = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.whenAppearanceRenderReady(60_000));
  expect(beforeOverview.withinBudget && rehydrated.withinBudget && rehydrated.detailBytes > 0, 'overview traversal disposes detail and returning rehydrates within budget').toBe(true);
  expect(checkpoints.every(checkpoint => checkpoint.city.features > 500 && checkpoint.city.styledFeatures > 0)).toBe(true);
  expect(checkpoints.every(checkpoint => !checkpoint.cameraBlocked), 'every frozen physical camera clears measured building footprints').toBe(true);
  expect(checkpoints.filter(checkpoint => checkpoint.sightlineBlocked).map(checkpoint => checkpoint.id), 'every frozen camera-to-route sightline clears measured building masses').toEqual([]);
  expect(checkpoints.every(checkpoint => checkpoint.visibleMasses > 0 && checkpoint.facadePaints > 0), 'opaque massing and facade detail both paint before evaluation').toBe(true);
  expect(checkpoints.every(checkpoint => checkpoint.activeAreaId && checkpoint.enabledAreaIds.length === 1 && checkpoint.enabledAreaIds[0] === checkpoint.activeAreaId), 'all viewport detail streams share one active catalog-area residency').toBe(true);
  console.log('study route public-realm telemetry:',checkpoints.map(checkpoint=>({camera:checkpoint.id,resident:checkpoint.publicRealm.resident,meshes:checkpoint.publicRealm.meshes,bytes:checkpoint.publicRealm.bytes,clearance:checkpoint.render.cameraClearance})));
  expect(checkpoints.every(checkpoint => checkpoint.city.tiles <= 12 && checkpoint.roofs.resident <= 12 && checkpoint.facades.resident <= 12 && checkpoint.trees.resident <= 12 && checkpoint.publicRealm.resident <= 12)).toBe(true);
  expect(checkpoints.every(checkpoint => Object.values(checkpoint.render.residents).every(resident => Number(resident) <= 12)), 'tile ceilings apply across every resident area in the viewport').toBe(true);
  expect(checkpoints.every(checkpoint => checkpoint.facades.triangles > 1_000 && checkpoint.trees.meshes > 0 && checkpoint.trees.meshes <= 48 && checkpoint.publicRealm.meshes > 0 && checkpoint.publicRealm.meshes <= 32)).toBe(true);
  // Facade resident bytes already include sign textures. Report the split so
  // the release gate can prove that textures were counted without double-counting.
  const measured = checkpoints.map(checkpoint => ({
    geometryBytes: checkpoint.roofs.bytes + checkpoint.facades.bytes - checkpoint.facades.textureBytes + checkpoint.trees.bytes + checkpoint.publicRealm.bytes,
    textureBytes: checkpoint.facades.textureBytes,
  }));
  expect(measured.every(value => value.geometryBytes + value.textureBytes <= 11_000_000)).toBe(true);
  const maxDetailBytes = Math.max(...measured.map(value => value.geometryBytes + value.textureBytes));
  const releaseId = await page.evaluate(async () => (await (await fetch('/data/city-expansion/current.json', { cache: 'no-store' })).json()).releaseId);
  writeFileSync(`${outputDirectory}/game-evaluation-${testInfo.project.name}.json`, JSON.stringify({
    releaseId,
    candidate: candidateManifest ? {
      descriptorPath: candidateManifestPath,
      manifestPath: nestedManifestPath,
      manifestSha256: crypto.createHash('sha256').update(candidateManifestBytes!).digest('hex'),
      compilerHash: (candidateDescriptor?.candidate ?? candidateManifest.candidateBinding ?? candidateManifest.candidate).compilerHash,
      recordsSha256: (candidateDescriptor?.candidate ?? candidateManifest.candidateBinding ?? candidateManifest.candidate).recordsSha256,
      artifactsSha256: (candidateDescriptor?.candidate ?? candidateManifest.candidateBinding ?? candidateManifest.candidate).artifactsSha256,
    } : null,
    project: testInfo.project.name,
    viewport: page.viewportSize(),
    cameras: evaluationCameras,
    checkpoints,
    memory: { checkpoints: measured, texturesIncluded: true },
    maxDetailBytes,
    overview: { before: beforeOverview, residentAfterDisposal: 0, rehydrated },
    signDevelopmentView: festSign,
  }, null, 2));
  console.log('study route streaming:', checkpoints.map(checkpoint => `${checkpoint.id}=${checkpoint.city.tiles}/${checkpoint.roofs.resident}/${checkpoint.facades.resident}/${checkpoint.trees.resident}/${checkpoint.publicRealm.resident} tiles`).join(', '), `detail buffers <= ${(maxDetailBytes / 1_000_000).toFixed(2)} MB`);
});
