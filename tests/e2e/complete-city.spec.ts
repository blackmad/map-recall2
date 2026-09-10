import { test, expect } from '@playwright/test';
import { flatRoofFilter } from '../../src/canalRecall/buildingStyle.ts';

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
  await expect
    .poll(
      () => page.evaluate(() => (window as any).canalRecallGame?.vectorMap?._appearanceAreas?.length ?? 0),
      { timeout: 60000 }
    )
    .toBeGreaterThan(0);

  const loaded = await page.evaluate(() => {
    const map = (window as any).canalRecallGame.vectorMap;
    return {
      status: map._completeCity.status(),
      appearanceAreas: map._appearanceAreas,
      // A hidden `building-3d` is the point: once every building is described
      // locally, the basemap's gray extrusion is a second solid in the same
      // place, which is what the height-offset stack existed to hide.
      basemapVisibility: map.map.getLayoutProperty('building-3d', 'visibility'),
      wallsVisible: map.map.getLayoutProperty('osm-colored-buildings', 'visibility') ?? 'visible',
      roofFilter: map.map.getFilter('osm-colored-building-roofs')
    };
  });

  expect(loaded.status.features, 'the streamed tiles carry real buildings').toBeGreaterThan(500);
  expect(loaded.appearanceAreas.map((area: any) => area.id), 'appearance districts are discovered through the catalog').toContain('da-costa-expansion-550m-v1');
  expect(loaded.status.contextualFeatures, 'most otherwise-uncolored BAG masses receive the explicit citywide display prior').toBeGreaterThan(loaded.status.features * 0.5);
  expect(loaded.status.contextualGrounds, 'every citywide unknown-wall prior receives its provenance-labelled street base').toBe(loaded.status.contextualFeatures);
  expect(loaded.status.contextualRoofs, 'most flat or unspecified caps receive a separate explicit roof display prior').toBeGreaterThan(loaded.status.features * 0.5);
  expect([undefined, 'none'], 'the basemap extrusion is absent or hidden').toContain(loaded.basemapVisibility);
  expect(loaded.wallsVisible, 'the merged source is what draws').toBe('visible');
  expect(loaded.roofFilter?.[0], 'the roof cap is a filter, not a paint').toBe('all');
  // The current filter allows flat/unspecified roofs, so it excludes pyramids
  // without spelling out every non-flat shape. Check the runtime wiring.
  expect(loaded.roofFilter, 'the renderer uses the tested flat-roof cap filter').toEqual(flatRoofFilter());

  // Read the rendered source back: every feature must resolve to an identity or
  // picking cannot return a BuildingHit for it, and a measured height is the
  // whole point of the change.
  //
  // Polled, not sampled once. `querySourceFeatures` returns what MapLibre has
  // re-tiled for the current viewport, which lags `setData` by a frame or two —
  // reading it immediately gives an empty array perhaps one run in three, and
  // that says nothing about whether the streamer worked.
  const readSample = () => page.evaluate(() => {
    const features = (window as any).canalRecallGame.vectorMap._completeCity.sampleFeatures(400);
    return features.slice(0, 400).map((feature: any) => ({
      id: feature.properties.id,
      height: feature.properties.height,
      tier: feature.properties.tier
    }));
  });
  let sample: Awaited<ReturnType<typeof readSample>> = [];
  await expect.poll(async () => {
    const candidate = await readSample();
    if (candidate.length) sample = candidate;
    return candidate.length;
  }, { timeout: 30000 }).toBeGreaterThan(0);
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
  const centreBefore = await page.evaluate(() => {
    const centre = (window as any).canalRecallGame.vectorMap.map.getCenter();
    return [centre.lng, centre.lat];
  });
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
  await page.evaluate(([lng, lat]) => {
    const vectorMap = (window as any).canalRecallGame.vectorMap;
    vectorMap.map.jumpTo({ center: [lng, lat] });
    vectorMap._completeCity.followCamera();
  }, centreBefore);
  await expect
    .poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap._completeCity.status().inFlight), { timeout: 30000 })
    .toBe(0);
  await expect.poll(() => page.evaluate((id) => {
    return (window as any).canalRecallGame.vectorMap._completeCity.sampleFeatures(100_000).some((feature: any) => feature.properties?.id === id);
  }, idBefore), { timeout: 30000 }).toBe(true);
  const sourceIdentity = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.map.getSource('osm-building-appearance').promoteId);
  expect(sourceIdentity, 'tile replacement keeps feature state keyed by canonical building identity').toBe('id');

  // Enter the published 550 m appearance study. The complete-city geometry
  // remains the game's source; matching BAG ids are decorated only after the
  // independently hashed appearance sidecar has verified successfully.
  await page.evaluate(() => {
    const vectorMap = (window as any).canalRecallGame.vectorMap, map = vectorMap.map;
    // Stop the game loop from immediately returning MapLibre to the random
    // route while this test inspects the published study working set.
    (window as any).__appearanceStudySync = vectorMap.sync;
    vectorMap.sync = () => undefined;
    map.jumpTo({ center: [4.8735, 52.3723], zoom: 17, pitch: 58 });
    vectorMap._completeCity.followCamera();
  });
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap._completeCity.status().inFlight), { timeout: 30000 }).toBe(0);
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap._completeCity.status().styledFeatures), { timeout: 30000 }).toBeGreaterThan(100);
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap._studyFacades?.debugResident ?? 0), { timeout: 30000 }).toBeGreaterThan(0);
  const integratedAppearance = await page.evaluate(() => {
    const vectorMap = (window as any).canalRecallGame.vectorMap, map = vectorMap.map;
    const appearanceSample = vectorMap._completeCity.sampleFeatures(100_000)
      .filter((feature: any) => feature.properties?.appearanceStyleSource === 'procedural-prior-not-measured');
    return {
      status: vectorMap._completeCity.status(),
      appearanceSample: appearanceSample.slice(0, 200).map((feature: any) => ({
        sideColour: feature.properties.sideColour,
        groundColour: feature.properties.groundColour,
        roofColour: feature.properties.roofColour,
      })),
      paint: map.getPaintProperty('osm-colored-buildings', 'fill-extrusion-color'),
      groundLayer: Boolean(map.getLayer('osm-colored-building-ground-floors')),
      groundPaint: map.getPaintProperty('osm-colored-building-ground-floors', 'fill-extrusion-color'),
      wallBase: map.getPaintProperty('osm-colored-buildings', 'fill-extrusion-base'),
      wallHeight: map.getPaintProperty('osm-colored-buildings', 'fill-extrusion-height'),
      light: map.getLight(),
      detailAreas: {
        roofs: vectorMap._studyRoofAreas.length,
        facades: vectorMap._studyFacadeAreas.length,
        trees: vectorMap._studyTreeAreas.length,
        publicRealm: vectorMap._studyPublicRealmAreas.length,
        failures: vectorMap._appearanceAreaFailures,
        layerIds: map.getStyle().layers.map((layer: any) => layer.id).filter((id: string) => id.startsWith('city-appearance-')),
      },
      sourceRoofs: vectorMap._studyRoofs ? {
        ready: vectorMap._studyRoofs.ready,
        renderable: vectorMap._studyRoofs.debugRenderable,
        buildings: vectorMap._studyRoofs.debugBuildings,
        surfaces: vectorMap._studyRoofs.debugSurfaces,
        resident: vectorMap._studyRoofs.debugResident,
        meshes: vectorMap._studyRoofs.debugMeshes,
        geometryBytes: vectorMap._studyRoofs.debugGeometryBytes,
      } : null,
      contextualFacades: vectorMap._studyFacades ? {
        ready: vectorMap._studyFacades.ready,
        renderable: vectorMap._studyFacades.debugRenderable,
        windows: vectorMap._studyFacades.debugWindows,
        doors: vectorMap._studyFacades.debugDoors,
        trims: vectorMap._studyFacades.debugTrims,
        resident: vectorMap._studyFacades.debugResident,
        triangles: vectorMap._studyFacades.debugTriangles,
        geometryBytes: vectorMap._studyFacades.debugGeometryBytes,
      } : null,
      inventoryTrees: vectorMap._studyTrees ? {
        ready: vectorMap._studyTrees.ready,
        renderable: vectorMap._studyTrees.debugRenderable,
        trees: vectorMap._studyTrees.debugTrees,
        resident: vectorMap._studyTrees.debugResident,
        meshes: vectorMap._studyTrees.debugMeshes,
        trunkAxis: vectorMap._studyTrees.debugTrunkAxis,
        geometryBytes: vectorMap._studyTrees.debugGeometryBytes,
      } : null,
      publicRealm: vectorMap._studyPublicRealm ? {
        ready: vectorMap._studyPublicRealm.ready,
        renderable: vectorMap._studyPublicRealm.debugRenderable,
        water: vectorMap._studyPublicRealm.debugWater,
        bridges: vectorMap._studyPublicRealm.debugBridges,
        bridgeMeshes: vectorMap._studyPublicRealm.debugBridgeMeshes,
        green: vectorMap._studyPublicRealm.debugGreen,
        footpaths: vectorMap._studyPublicRealm.debugFootpaths,
        cycleways: vectorMap._studyPublicRealm.debugCycleways,
        boundaries: vectorMap._studyPublicRealm.debugBoundaries,
        resident: vectorMap._studyPublicRealm.debugResident,
        meshes: vectorMap._studyPublicRealm.debugMeshes,
        geometryBytes: vectorMap._studyPublicRealm.debugGeometryBytes,
      } : null,
    };
  });
  expect(integratedAppearance.status.styledFeatures, 'the working set handed to the main game source contains verified appearance priors').toBeGreaterThan(100);
  expect(integratedAppearance.detailAreas, 'every catalog district gets independently namespaced optional renderers').toMatchObject({ roofs: 1, facades: 1, trees: 1, publicRealm: 1, failures: [] });
  expect(integratedAppearance.publicRealm, 'source-bound public realm is available in the live game').toMatchObject({ water: 19, bridges: 15, green: 92, footpaths: 348, cycleways: 112, boundaries: 35 });
  expect(new Set(integratedAppearance.detailAreas.layerIds).size, 'custom layer ids remain unique as the area catalog grows').toBe(integratedAppearance.detailAreas.layerIds.length);
  expect(integratedAppearance.appearanceSample.length, 'the test reads decorated buildings from the live game source').toBeGreaterThan(100);
  expect(integratedAppearance.appearanceSample.every((building: any) =>
    [building.sideColour, building.groundColour, building.roofColour].every(colour => /^#[0-9a-f]{6}$/i.test(colour))
  ), 'every decorated live building carries valid wall, ground-floor and roof colours').toBe(true);
  expect(new Set(integratedAppearance.appearanceSample.map((building: any) => building.sideColour)).size,
    'the live study uses multiple facade families, not one neutral fallback colour').toBeGreaterThan(4);
  expect(JSON.stringify(integratedAppearance.paint), 'the main game paint expression consumes sidecar wall colour').toContain('sideColour');
  expect(integratedAppearance.groundLayer, 'the game splits verified street storeys from upper walls').toBe(true);
  expect(JSON.stringify(integratedAppearance.groundPaint), 'the lower volume consumes the verified sidecar tone').toContain('groundColour');
  expect(JSON.stringify(integratedAppearance.wallBase), 'upper walls start above the sidecar street-storey height').toContain('groundFloorHeightM');
  expect(JSON.stringify(integratedAppearance.wallHeight), 'the renderer retains support for coherent measured eaves without forcing one eave across compound masses').toContain('roofEavesHeightM');
  expect(integratedAppearance.light, 'the clean theme installs stable map-anchored directional light').toEqual({ anchor: 'map', color: '#fff7ea', intensity: 0.5, position: [1.25, 210, 42] });
  expect(integratedAppearance.sourceRoofs?.ready).toBe(true);
  expect(integratedAppearance.sourceRoofs?.buildings).toBe(645);
  expect(integratedAppearance.sourceRoofs?.surfaces).toBe(1717);
  expect(integratedAppearance.sourceRoofs?.geometryBytes, 'the immutable source-roof GPU footprint remains bounded').toBeLessThan(2_000_000);
  expect(integratedAppearance.contextualFacades?.ready, 'the game installs the source-bound contextual facade streamer').toBe(true);
  expect(integratedAppearance.contextualFacades?.renderable).toBe(true);
  expect(integratedAppearance.contextualFacades?.windows, 'the release reports its deterministic opening coverage').toBe(17668);
  expect(integratedAppearance.sourceRoofs?.ready, 'the game installs the source roof tile streamer').toBe(true);
  expect(integratedAppearance.sourceRoofs?.renderable).toBe(true);
  expect(integratedAppearance.sourceRoofs?.resident, 'source roofs use a bounded nonempty working set').toBeGreaterThan(0);
  expect(integratedAppearance.sourceRoofs?.resident).toBeLessThanOrEqual(12);
  expect(integratedAppearance.sourceRoofs?.meshes).toBeLessThanOrEqual(12);
  expect(integratedAppearance.sourceRoofs?.geometryBytes).toBeLessThan(1_000_000);
  expect(integratedAppearance.contextualFacades?.doors).toBe(672);
  expect(integratedAppearance.contextualFacades?.trims, 'the release reports its source-contained procedural trim bands').toBe(3638);
  expect(integratedAppearance.contextualFacades?.resident, 'facade detail residency is bounded and nonempty near the study').toBeGreaterThan(0);
  expect(integratedAppearance.contextualFacades?.resident).toBeLessThanOrEqual(12);
  expect(integratedAppearance.contextualFacades?.triangles, 'resident facade tiles contribute actual geometry').toBeGreaterThan(1000);
  expect(integratedAppearance.contextualFacades?.geometryBytes).toBeLessThan(8_000_000);
  expect(integratedAppearance.inventoryTrees?.ready, 'the game installs the source-bound inventory tree streamer').toBe(true);
  expect(integratedAppearance.inventoryTrees?.renderable).toBe(true);
  expect(integratedAppearance.inventoryTrees?.trees, 'the tree release reports all source inventory positions').toBe(469);
  expect(integratedAppearance.inventoryTrees?.resident).toBeGreaterThan(0);
  expect(integratedAppearance.inventoryTrees?.resident).toBeLessThanOrEqual(12);
  expect(integratedAppearance.inventoryTrees?.meshes, 'resident trees are GPU-instanced rather than one draw per crown').toBeLessThanOrEqual(48);
  expect(integratedAppearance.inventoryTrees?.trunkAxis, 'tree trunk source geometry is vertical before instancing').toBe('z');
  expect(integratedAppearance.inventoryTrees?.geometryBytes).toBeLessThan(300_000);
  expect(integratedAppearance.publicRealm?.ready, 'the game installs the BGT public-realm streamer').toBe(true);
  expect(integratedAppearance.publicRealm?.renderable).toBe(true);
  expect(integratedAppearance.publicRealm?.water).toBe(19);
  expect(integratedAppearance.publicRealm?.bridges, 'exact BGT bridge records feed the understructure renderer').toBe(15);
  expect(integratedAppearance.publicRealm?.bridgeMeshes, 'bridge perimeter faces render without adding a road-top surface').toBeGreaterThan(0);
  expect(integratedAppearance.publicRealm?.resident).toBeGreaterThan(0);
  expect(integratedAppearance.publicRealm?.resident).toBeLessThanOrEqual(12);
  expect(integratedAppearance.publicRealm?.meshes, 'public-realm geometry remains at most six source-class batches per resident tile').toBeLessThanOrEqual(integratedAppearance.publicRealm!.resident*6);
  expect(integratedAppearance.publicRealm?.geometryBytes).toBeLessThan(1_500_000);
  const overviewLod = await page.evaluate(() => {
    const vectorMap = (window as any).canalRecallGame.vectorMap;
    vectorMap.map.jumpTo({ zoom: 14 });
    return {
      roofs: vectorMap._studyRoofs.debugRenderable,
      facades: vectorMap._studyFacades.debugRenderable,
      trees: vectorMap._studyTrees.debugRenderable,
      publicRealm: vectorMap._studyPublicRealm.debugRenderable,
    };
  });
  expect(overviewLod, 'overview LOD suppresses bounded local detail and leaves city-scale structure to the basemap').toEqual({ roofs: false, facades: false, trees: false, publicRealm: false });
  await expect.poll(() => page.evaluate(() => {
    const vectorMap = (window as any).canalRecallGame.vectorMap;
    return vectorMap._studyRoofs.debugResident + vectorMap._studyFacades.debugResident + vectorMap._studyTrees.debugResident + vectorMap._studyPublicRealm.debugResident;
  }), { timeout: 30_000 }).toBe(0);
  const releasedDetailBytes = await page.evaluate(() => {
    const vectorMap = (window as any).canalRecallGame.vectorMap;
    return vectorMap._studyRoofs.debugGeometryBytes + vectorMap._studyFacades.debugGeometryBytes + vectorMap._studyTrees.debugGeometryBytes + vectorMap._studyPublicRealm.debugGeometryBytes;
  });
  expect(releasedDetailBytes, 'overview LOD disposes invisible custom geometry instead of only hiding it').toBe(0);
  await page.evaluate(() => (window as any).canalRecallGame.vectorMap.map.jumpTo({ zoom: 17 }));
  await expect.poll(() => page.evaluate(() => {
    const vectorMap = (window as any).canalRecallGame.vectorMap;
    return [vectorMap._studyRoofs.debugResident, vectorMap._studyFacades.debugResident, vectorMap._studyTrees.debugResident, vectorMap._studyPublicRealm.debugResident].every(value => value > 0)
      && vectorMap._studyRoofs.inFlight === 0 && vectorMap._studyFacades.inFlight === 0 && vectorMap._studyTrees.inFlight === 0 && vectorMap._studyPublicRealm.inFlight === 0;
  }), { timeout: 30_000 }).toBe(true);
  const rehydratedDetail = await page.evaluate(() => {
    const vectorMap = (window as any).canalRecallGame.vectorMap;
    return {
      resident: [vectorMap._studyRoofs.debugResident, vectorMap._studyFacades.debugResident, vectorMap._studyTrees.debugResident, vectorMap._studyPublicRealm.debugResident],
      bytes: [vectorMap._studyRoofs.debugGeometryBytes, vectorMap._studyFacades.debugGeometryBytes, vectorMap._studyTrees.debugGeometryBytes, vectorMap._studyPublicRealm.debugGeometryBytes],
    };
  });
  expect(rehydratedDetail.resident.every(value => value > 0 && value <= 12), 'returning to gameplay reloads each bounded working set').toBe(true);
  expect(rehydratedDetail.bytes[0]).toBeLessThan(1_000_000);
  expect(rehydratedDetail.bytes[1]).toBeLessThan(8_000_000);
  expect(rehydratedDetail.bytes[2]).toBeLessThan(300_000);
  expect(rehydratedDetail.bytes[3]).toBeLessThan(1_500_000);
  await page.evaluate(() => { (window as any).canalRecallGame.vectorMap.sync = (window as any).__appearanceStudySync; });

  // Printed because "the city loaded" is the kind of pass that is worth being
  // able to read a number for when it later regresses to loading one tile.
  console.log(
    `streamed city: ${loaded.status.tiles} tiles, ${loaded.status.features} features, ` +
    `${integratedAppearance.status.styledFeatures} verified appearance priors; sampled ${sample.length} with heights ${Math.min(...sample.map((f: any) => f.height)).toFixed(1)}–` +
    `${Math.max(...sample.map((f: any) => f.height)).toFixed(1)} m`
  );
});
