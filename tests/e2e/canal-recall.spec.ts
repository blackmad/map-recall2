import { expect, Page, test } from '@playwright/test';

type HarnessGame = {
  state: number;
  quizCurrentName: string;
  quizCandidateName: string;
  quizPromptName: string;
  player: { x: number; y: number; angle: number; speed: number };
  track: { getNearestRoad(x: number, y: number): { dist: number; width: number; angle: number } | null };
  landmarks: Array<{ id: string; name: string; x: number; y: number }>;
  vectorMap: {
    ready?: boolean;
    map?: {
      getLayer(layer: string): unknown;
      getPaintProperty(layer: string, property: string): unknown;
      getSource(source: string): { _data?: { features: unknown[] } } | undefined;
    };
    inspectBuilding: (...args: unknown[]) => unknown;
    setActiveLandmark: (landmark: unknown) => void;
    _detailedBuildingsVisible?: boolean;
    _detailedBuildings?: { ready?: boolean; setActiveLandmark?: (landmark: unknown) => void } | null;
  };
  _landmarkNotice: { id: string; name: string } | null;
  streetKnowledge: Map<string, { name: string; wikipediaUrl: string; wikipediaExtract: string }>;
  _showStreetKnowledge: (name: string) => void;
  _neighborhoodNotice: { name: string; kind?: string; wikipediaExtract?: string } | null;
  _neighborhoodNoticeTimer: number;
  _neighborhoodImages: Map<string, HTMLImageElement>;
  _render: () => void;
  _renderNeighborhoodNotice: () => void;
  ctx: CanvasRenderingContext2D;
  hud: { drawCurrentLocation: (...args: unknown[]) => void };
  camera: { x: number; y: number; detached: boolean; panX: number; pan(dx: number, dy: number): void; resetPan(): void; update(target: unknown, dt: number): void };
  neighborhoods: Array<{ name: string; kind: string; rank: number; rings: Array<Array<{ x: number; y: number }>> }>;
  _previousNeighborhood: string;
  raceTime: number;
  _updateLandmarks: (dt: number) => void;
  showMiniMap: boolean;
  routePath: Array<{ x: number; y: number }> | null;
  _neighborhoodNoticeTimer: number;
};

declare global {
  interface Window {
    canalRecallGame: HarnessGame;
    CanalRecallCar: { constrainCarToRoad: (...args: unknown[]) => string };
  }
}

async function openCarRoute(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let seed = 0x5eed1234;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
  });
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/');
  await expect(page.locator('#route-card')).toBeVisible();
  await page.locator('#travel-mode').selectOption('car');
  await page.locator('#view-mode').selectOption('north');
  // Submit through the form so the driving harness is independent of mobile
  // scroll/zoom hit-testing; mobile setup tap targets have separate UI tests.
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(() => page.evaluate(() => Boolean(window.canalRecallGame?.player?.x))).toBe(true);
  await page.evaluate(() => { window.canalRecallGame.state = 4; });
}

test('boots and starts a route from the setup form', async ({ page }) => {
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean(window.canalRecallGame))).toBe(true);
  await expect(page.locator('#route-card')).toBeVisible();
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(() => page.evaluate(() => Boolean(window.canalRecallGame?.player?.x)), {
    timeout: 60_000,
  }).toBe(true);
});

test('typed road guard bundle is loaded by Canal Recall', async ({ page }) => {
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => typeof window.CanalRecallCar?.constrainCarToRoad)).toBe('function');
});

test('live MapLibre buildings use the OSM-aware color expression', async ({ page }) => {
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean(window.canalRecallGame?.vectorMap?.ready))).toBe(true);
  const paint = await page.evaluate(() => window.canalRecallGame.vectorMap.map
    ?.getPaintProperty('building-3d', 'fill-extrusion-color'));
  expect(Array.isArray(paint)).toBe(true);
  const serialized = JSON.stringify(paint);
  expect(serialized).toContain('colour');
  expect(serialized).toContain('render_height');
  await expect.poll(() => page.evaluate(() => Boolean(window.canalRecallGame.vectorMap.map
    ?.getLayer('osm-colored-building-roofs')))).toBe(true);
  const nemo = await page.evaluate(async () => {
    const collection = await fetch('../data/extracts/amsterdam/buildings-colored.geojson').then(response => response.json());
    return collection.features.find((feature: { properties: { osmId: string } }) => feature.properties.osmId === 'w1390692772')?.properties;
  });
  expect(nemo).toMatchObject({ colour: '#43888b', roofColour: '#f5f5dc', roofShape: 'skillion', height: 21.7 });
});

test('detailed mode owns building depth and selection instead of drawing an OSM slab', async ({ page }) => {
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean(window.canalRecallGame?.vectorMap?.ready))).toBe(true);
  const result = await page.evaluate(() => {
    const vectorMap = window.canalRecallGame.vectorMap as unknown as {
      map: {
        getLayer(id: string): unknown;
        getLayoutProperty(id: string, property: string): unknown;
        getSource(id: string): { setData(data: unknown): void };
      };
      _detailedBuildings: { ready: boolean; setEnabled(value: boolean): void; setActiveLandmark(value: unknown): void };
      _detailedBuildingsVisible: boolean;
      setDetailedBuildingsVisible(value: boolean): void;
      setActiveLandmark(value: unknown): void;
    };
    let forwarded: unknown = null;
    let overlay: unknown = null;
    const originalSource = vectorMap.map.getSource('active-landmark');
    const originalSetData = originalSource.setData.bind(originalSource);
    originalSource.setData = data => { overlay = data; originalSetData(data); };
    vectorMap._detailedBuildings = {
      ready: true,
      setEnabled: () => undefined,
      setActiveLandmark: value => { forwarded = value; },
    };
    vectorMap.setDetailedBuildingsVisible(true);
    const landmark = {
      name: 'Old Church', lngLat: [4.8975, 52.3743],
      geojson: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [] } }] },
    };
    vectorMap.setActiveLandmark(landmark);
    return {
      building: vectorMap.map.getLayoutProperty('building-3d', 'visibility'),
      coloured: vectorMap.map.getLayoutProperty('osm-colored-buildings', 'visibility'),
      roofs: vectorMap.map.getLayoutProperty('osm-colored-building-roofs', 'visibility'),
      forwarded: forwarded === landmark,
      overlayFeatures: (overlay as { features?: unknown[] })?.features?.length,
      // The anti-slab guarantee: whatever is drawn must never be an extrusion
      // fabricated from the landmark's approximate OSM footprint.
      overlayTypes: ((overlay as { features?: Array<{ geometry: { type: string } }> })?.features ?? [])
        .map(feature => feature.geometry.type),
    };
  });
  expect(result).toEqual({
    building: 'none', coloured: 'none', roofs: 'none', forwarded: true,
    // A locator point, and only a point. The detailed renderer owns depth and
    // selection, but it raycasts straight down and finds nothing whenever the
    // place is not its own extruded building — so the dot has to survive here
    // or a card can name a landmark with nothing on the map pointing at it.
    overlayFeatures: 1, overlayTypes: ['Point'],
  });
});

test('HUD hides a new street before the delayed question opens', async ({ page }) => {
  await openCarRoute(page);
  const hudCall = await page.evaluate(() => {
    const game = window.canalRecallGame;
    game.quizCurrentName = 'Previous Street';
    game.quizCandidateName = 'Secret New Street';
    game.quizPromptName = '';
    let captured: unknown[] = [];
    game.hud.drawCurrentLocation = (...args: unknown[]) => { captured = args; };
    game._render();
    return { routeName: captured[1], answerHidden: captured[4] };
  });
  expect(hudCall).toEqual({ routeName: '', answerHidden: true });
});

test('an actual high-speed car cannot escape the mapped road corridor', async ({ page }) => {
  await openCarRoute(page);
  await page.evaluate(() => {
    const game = window.canalRecallGame;
    const road = game.track.getNearestRoad(game.player.x, game.player.y);
    if (!road) throw new Error('Harness route did not start on a road');
    game.player.angle = road.angle + Math.PI / 2;
    game.player.speed = 190;
  });

  await page.keyboard.down('ArrowUp');
  const samples: Array<{ excess: number; speed: number }> = [];
  for (let index = 0; index < 30; index++) {
    await page.waitForTimeout(50);
    samples.push(await page.evaluate(() => {
      const game = window.canalRecallGame;
      game.state = 4;
      const road = game.track.getNearestRoad(game.player.x, game.player.y);
      return { excess: road ? road.dist - road.width : Number.POSITIVE_INFINITY, speed: game.player.speed };
    }));
  }
  await page.keyboard.up('ArrowUp');

  expect(Math.max(...samples.map(sample => sample.excess))).toBeLessThanOrEqual(12.5);
  expect(samples.some(sample => sample.speed < 150)).toBe(true);
});

test('curated POI identity wins over an unnamed building hit', async ({ page }) => {
  await openCarRoute(page);
  const selected = await page.evaluate(() => {
    const game = window.canalRecallGame;
    const landmark = { id: 'harness-poi', name: 'Harness Museum', x: 100000, y: 100000 };
    game.landmarks = [landmark];
    game.vectorMap.inspectBuilding = () => ({ id: landmark.id, name: landmark.name, lngLat: [4.9, 52.37], poi: true });
    game.vectorMap.setActiveLandmark = () => undefined;
    const canvas = document.querySelector<HTMLCanvasElement>('#gameCanvas');
    if (!canvas) throw new Error('Canvas missing');
    const rect = canvas.getBoundingClientRect();
    const inspector = game as HarnessGame & { _inspectBuildingAt(x: number, y: number): void };
    inspector._inspectBuildingAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return { selected: game._landmarkNotice?.id, expected: landmark.id };
  });
  expect(selected.selected).toBe(selected.expected);
  await expect(page.locator('text=Unnamed building')).toHaveCount(0);
});

test('anonymous building footprints acknowledge the click without inventing a name', async ({ page }) => {
  await openCarRoute(page);
  const result = await page.evaluate(() => {
    const game = window.canalRecallGame;
    game.landmarks = [];
    game._landmarkNotice = null;
    game.vectorMap.inspectBuilding = () => ({ id: 'anonymous-footprint', name: '', lngLat: [4.9, 52.37] });
    const canvas = document.querySelector<HTMLCanvasElement>('#gameCanvas');
    if (!canvas) throw new Error('Canvas missing');
    const rect = canvas.getBoundingClientRect();
    const inspector = game as HarnessGame & { _inspectBuildingAt(x: number, y: number): void };
    inspector._inspectBuildingAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return game._landmarkNotice;
  });
  expect(result).toMatchObject({
    id: 'clicked-anonymous-footprint',
    name: 'No building details',
    detail: 'This building has no name in the map data.',
  });
  await expect(page.locator('text=Unnamed building')).toHaveCount(0);
});

// A card that names a landmark with nothing on the map pointing at it is the
// opposite of a geography game. The 3D highlight raycasts straight down and
// finds nothing whenever the place is not its own extruded building, so the
// locator dot has to survive detailed mode.
// The old minimap showed ~450 m of network, where every part of Amsterdam looks
// like every other part. This one is framed on the whole city.
test('the city overview draws the whole city, not a local scrap', async ({ page }) => {
  await openCarRoute(page);
  const drawn = await page.evaluate(() => {
    const game = window.canalRecallGame;
    game.showMiniMap = true;
    game._render();
    // Sample the overview rect and count pixels bright enough to be map ink
    // rather than the panel's own dark background.
    const data = game.ctx.getImageData(15, 720 - 215, 260, 200).data;
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] + data[i + 1] + data[i + 2] > 90) lit++;
    }
    return { lit, areas: game.neighborhoods?.length ?? 0 };
  });
  expect(drawn.areas, 'the city outline comes from the neighborhood boundaries').toBeGreaterThan(10);
  expect(drawn.lit, 'the overview panel is not blank').toBeGreaterThan(200);
});

test('an active landmark is always marked on the map', async ({ page }) => {
  await openCarRoute(page);
  // The highlight layers are created on basemap load, not on game start.
  await expect.poll(() => page.evaluate(() =>
    Boolean(window.canalRecallGame.vectorMap.map?.getSource('active-landmark'))
  ), { timeout: 30_000 }).toBe(true);

  const marked = await page.evaluate(() => {
    const game = window.canalRecallGame;
    const landmark = game.landmarks[0];
    if (!landmark) return { skipped: true, features: -1 };
    // Force the branch that used to suppress the dot: detailed mode on, with
    // the 3D renderer finding no mesh for this landmark.
    game.vectorMap._detailedBuildingsVisible = true;
    // A stand-in for the 3D renderer that accepts the landmark and finds no
    // mesh for it — exactly what happens for a place that is not its own
    // extruded building.
    game.vectorMap._detailedBuildings = { ready: true, setActiveLandmark() {} };
    game.vectorMap.setActiveLandmark(landmark);
    const source = game.vectorMap.map?.getSource('active-landmark') as
      { serialize?: () => { data?: { features?: unknown[] } } } | undefined;
    return { skipped: false, features: source?.serialize?.().data?.features?.length ?? -1 };
  });
  if (marked.skipped) test.skip(true, 'no landmarks loaded for this route');
  expect(marked.features, 'a landmark with no 3D mesh still gets a locator dot').toBeGreaterThan(0);
});

test('a learned street can open its encyclopedia card and article', async ({ page }) => {
  await openCarRoute(page);
  await expect.poll(() => page.evaluate(() => window.canalRecallGame.streetKnowledge?.has('nes'))).toBe(true);
  const notice = await page.evaluate(() => {
    const game = window.canalRecallGame;
    game._showStreetKnowledge('Nes');
    return game._landmarkNotice;
  });
  expect(notice).toMatchObject({ name: 'Nes' });
  await expect(page.locator('#gameCanvas')).toBeVisible();
  expect(await page.evaluate(() => window.canalRecallGame.streetKnowledge.get('nes')?.wikipediaUrl))
    .toBe('https://en.wikipedia.org/wiki/Nes_(Amsterdam)');
});

test('neighborhood entry renders as a compact photo lower-third', async ({ page }, testInfo) => {
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => Boolean(window.canalRecallGame))).toBe(true);
  const cardMetrics = await page.evaluate(async () => {
    const game = window.canalRecallGame;
    const image = new Image();
    image.src = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300"><rect width="800" height="300" fill="#287a8c"/><circle cx="180" cy="90" r="70" fill="#f4c95d"/><path d="M0 250L170 130 300 230 470 80 800 250V300H0Z" fill="#315d45"/></svg>')}`;
    await image.decode();
    game._neighborhoodImages = new Map([['Jordaan', image]]);
    game._neighborhoodNotice = { name: 'Jordaan', kind: 'neighborhood' };
    game._neighborhoodNoticeTimer = 4;
    game._render = () => undefined;
    const canvas = document.querySelector<HTMLCanvasElement>('#gameCanvas');
    if (!canvas) throw new Error('Canvas missing');
    game.ctx.clearRect(0, 0, canvas.width, canvas.height);
    game._renderNeighborhoodNotice();
    // The game keeps a 1280×720 logical coordinate system while Retina/mobile
    // canvases have a scaled backing store. getImageData uses backing pixels,
    // unlike drawing APIs, so sample the logical card rectangle at that scale.
    const backingScale = game.ctx.getTransform().a;
    const card = window.CanalRecallBottomHud.bottomHudLayout({ tripWidth: 180 }).postcard;
    const pixels = game.ctx.getImageData(
      Math.round(card.x * backingScale),
      Math.round(card.y * backingScale),
      Math.round(card.width * backingScale),
      Math.round(card.height * backingScale)
    ).data;
    let opaque = 0;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) opaque++;
    return { opaqueRatio: opaque / (pixels.length / 4) };
  });
  expect(cardMetrics.opaqueRatio).toBeGreaterThan(0.8);
  await testInfo.attach(`neighborhood-postcard-${testInfo.project.name}.png`, {
    body: await page.locator('#gameCanvas').screenshot(),
    contentType: 'image/png',
  });
});

test('panning the map leaves the vehicle to drive across it', async ({ page }) => {
  await openCarRoute(page);
  const result = await page.evaluate(() => {
    const game = window.canalRecallGame;
    const camera = game.camera;
    camera.resetPan();
    for (let frame = 0; frame < 60; frame++) camera.update(game.player, 1 / 60);
    const settled = { x: camera.x, y: camera.y };
    camera.pan(150, 90);
    // The vehicle carries on while the player is looking somewhere else.
    for (let frame = 0; frame < 60; frame++) {
      game.player.x += 8;
      camera.update(game.player, 1 / 60);
    }
    const chasedThePlayer = Math.abs(camera.x - (settled.x + 60 * 8)) < 60;
    return { detached: camera.detached, chasedThePlayer, panX: Math.round(camera.panX) };
  });
  expect(result.detached).toBe(true);
  expect(result.chasedThePlayer).toBe(false);
  // The re-centre affordance keys off this drift, which grows as the vehicle
  // drives away from the held view.
  expect(Math.abs(result.panX)).toBeGreaterThan(40);
});

test('the first neighborhood entered also gets a postcard', async ({ page }) => {
  await openCarRoute(page);
  const notice = await page.evaluate(() => {
    const game = window.canalRecallGame;
    game.raceTime = 12;
    game._previousNeighborhood = '';
    game._neighborhoodNotice = null;
    game._neighborhoodNoticeTimer = 0;
    for (let i = 0; i < 9; i++) game._updateLandmarks(0.1);
    return {
      name: game._neighborhoodNotice && game._neighborhoodNotice.name,
      timer: game._neighborhoodNoticeTimer,
      kinds: [...new Set(game.neighborhoods.map(hood => hood.kind))].sort(),
    };
  });
  expect(notice.name).toBeTruthy();
  expect(notice.timer).toBeGreaterThan(0);
  // Districts and quarters count as places too, which is what lifted postcard
  // coverage from a tenth of the network to nearly all of it.
  expect(notice.kinds).toContain('quarter');
  expect(notice.kinds).toContain('suburb');
});
