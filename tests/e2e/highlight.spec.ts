/**
 * The default highlight (style a since 2026-10-13: outline + ground ring + beacon, src/canalRecall/look/highlight.ts)
 * is found on screen by its colour, in the default frame, the shared frame and MapLibre's fallback extrusions
 * (`?buildings3d=off`, where the marker draws the outline round the footprint's prism): parked facing the Anne Frank
 * House on the Westermarkt corner (the block of the user's 2026-10-13 screenshot), the accent appears only once the
 * card names it, and it sits on that building, not elsewhere. The building keeps its own colours (no yellow).
 * `?highlight=yellow` keeps the old yellow for comparison.
 *
 *   PW_PORT=4451 npx playwright test highlight.spec.ts
 */
import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';
import { openRoute } from './helpers';

const ANNE_FRANK = 'extract_landmarks_614625734';
const CORAL: [number, number, number] = [255, 128, 51];
const YELLOW: [number, number, number] = [255, 210, 31];

/** Pixels near a colour: count and their centroid (CSS px of the canvas). */
async function colourPixels(png: Buffer, rgb: [number, number, number], scale: number, tolerance = 55): Promise<{ n: number; x: number; y: number }> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0, sx = 0, sy = 0;
  for (let i = 0, p = 0; i < data.length; i += 3, p++) {
    if (Math.hypot(data[i] - rgb[0], data[i + 1] - rgb[1], data[i + 2] - rgb[2]) >= tolerance) continue;
    n++; sx += p % info.width; sy += Math.floor(p / info.width);
  }
  return { n, x: n ? sx / n / scale : NaN, y: n ? sy / n / scale : NaN };
}

async function park(page: Page, waitForThree = true): Promise<any> {
  const landmark = await page.evaluate(id => (window as any).canalRecallGame.landmarks.find((l: any) => l.id === id), ANNE_FRANK);
  expect(landmark, 'Anne Frank House in game.landmarks').toBeTruthy();
  const [lng, lat] = landmark.lngLat, deg = 115, m = 75, b = deg * Math.PI / 180;
  const p = { lng: lng + m * Math.sin(b) / (111320 * Math.cos(lat * Math.PI / 180)), lat: lat + m * Math.cos(b) / 111320, bearing: (deg + 180) % 360 };
  const teleport = () => page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number, r = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(r), Math.sin(r));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 }); g.player.handleInput = () => {};
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
  }, p);
  await teleport(); await page.waitForTimeout(3000); await teleport();
  if (waitForThree) await page.waitForFunction(() => { const t = (window as any).canalRecallGame.vectorMap._threeBuildings; return t?.ready && !t.pending.length && !t.inflight.size; }, null, { timeout: 120_000 });
  await page.waitForTimeout(5000);
  // Only the 3D frame: no labels, HUD or minimap in the colour count, and no drive-by card's highlight yet.
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    g._lastDriveByAt = Infinity; // no drive-by card takes the highlight from here on
    g.vectorMap.setActiveLandmark(null);
    g._landmarkNotice = null;
    const map = g.vectorMap.map, canvas = map.getCanvas();
    for (const layer of map.getStyle().layers) if (layer.type === 'symbol') map.setLayoutProperty(layer.id, 'visibility', 'none');
    for (const e of Array.from(document.body.querySelectorAll('*'))) if (e !== canvas && !e.contains(canvas)) (e as HTMLElement).style.visibility = 'hidden';
  });
  return landmark;
}

const FRAMES = [
  { name: 'default frame', query: '' },
  { name: 'shared frame', query: '?sharedFrame=1' },
  { name: 'MapLibre fallback', query: '?buildings3d=off' },
];
for (const frame of FRAMES) {
  test(`highlight (default a): the destination is found by its accent (${frame.name})`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop' && frame.name !== 'default frame', 'phone: the default frame');
    test.setTimeout(240_000);
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: frame.query, abortHeavyTiles: true });
    const fallback = frame.name === 'MapLibre fallback';
    const landmark = await park(page, !fallback);
    const canvas = page.locator('canvas.maplibregl-canvas').first();
    const scale = await page.evaluate(() => window.devicePixelRatio);
    const before = await colourPixels(await canvas.screenshot(), CORAL, scale);
    const state: any = await page.evaluate((l) => {
      const vm = (window as any).canalRecallGame.vectorMap;
      vm.setActiveLandmark(l);
      const at = vm.map.project(l.lngLat);
      return { at: [at.x, at.y], models: (vm._signatureLandmarks?._entries ?? []).filter((e: any) => e.highlighted).length, extrusions: vm._threeBuildings?.highlighted?.size ?? 0,
        owns: vm._threeOwnsTops(), states: vm._highlightedBuildings.map((t: any) => vm.map.getFeatureState(t)) };
    }, landmark);
    await page.waitForTimeout(1500);
    // The hull's footprint arrives asynchronously (GeoJSONSource.getData), so read the marker after the wait.
    state.marker = await page.evaluate(() => (window as any).canalRecallGame.vectorMap._highlightMarker?.status());
    const shot = await canvas.screenshot();
    const after = await colourPixels(shot, CORAL, scale);
    const yellow = await colourPixels(shot, YELLOW, scale, 40);
    await info.attach(`highlight-a-${frame.name}`, { body: shot, contentType: 'image/png' });
    expect(state.marker?.ring, 'ground ring').toBe(true);
    expect(state.marker?.beacon, 'beacon').toBe(true);
    if (fallback) {
      // MapLibre draws the buildings: no yellow fill (feature-state `accent`, not `highlighted`), and the marker's hull
      // outlines the extrusion.
      expect(state.owns, 'three.js does not own the city').toBe(false);
      expect(state.states.length, 'the card resolved its building').toBeGreaterThan(0);
      for (const s of state.states) expect(s).toMatchObject({ highlighted: false, accent: true });
      // The outline: the marker's hull round the extrusion, or the landmark's own model (a GLB keeps its passes).
      expect(state.marker?.hull || state.models > 0, 'outline round the fallback extrusion').toBe(true);
    } else {
      expect(state.models + state.extrusions, 'a pipeline lit the building').toBeGreaterThan(0);
      expect(state.marker?.hull, 'the pipeline draws its own outline').toBe(false);
    }
    const size = await canvas.boundingBox();
    const area = size!.width * size!.height;
    // The accent appears (outline, ring, beacon: ≥ 0.05 % of the frame) and only then.
    expect(after.n - before.n, JSON.stringify({ before: before.n, after: after.n })).toBeGreaterThan(area * 0.0005);
    // It is on the building: the accent's centroid lies within a quarter of the screen of the card's point.
    expect(Math.hypot(after.x - state.at[0], after.y - state.at[1]), JSON.stringify({ accent: [after.x, after.y], at: state.at })).toBeLessThan(Math.max(size!.width, size!.height) / 4);
    // The building keeps its colours: no yellow paint anywhere near the old amount.
    expect(yellow.n, 'no yellow highlight').toBeLessThan(area * 0.001);
    // Clearing the card clears the accent.
    await page.evaluate(() => (window as any).canalRecallGame.vectorMap.setActiveLandmark(null));
    await page.waitForTimeout(1000);
    const cleared = await colourPixels(await canvas.screenshot(), CORAL, scale);
    expect(cleared.n).toBeLessThan(before.n + area * 0.0002);
  });
}

// Small targets (LOOK §Highlight): an ordinary terrace house from the chase camera covers ~0.2 % of the frame, and
// outline + ring + beacon alone gave 0.08 % accent pixels (the yellow 0.55 %). The roof wash and the raised beacon
// bring it to at least 0.3 %; the facade keeps its own colours and no street name is shown.
const TERRACE = { pand: 'NL.IMBAG.Pand.0363100012236453', pick: [4.87177, 52.36696] as [number, number], standDeg: 7, standM: 60 };
test('highlight (default a): a terrace house from the chase camera carries ≥ 0.3 % accent pixels (small-target boost)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop frame, as the sheets');
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true });
  const [lng, lat] = TERRACE.pick, b = TERRACE.standDeg * Math.PI / 180;
  const p = { lng: lng + TERRACE.standM * Math.sin(b) / (111320 * Math.cos(lat * Math.PI / 180)), lat: lat + TERRACE.standM * Math.cos(b) / 111320, bearing: (TERRACE.standDeg + 180) % 360 };
  const teleport = () => page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number, r = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(r), Math.sin(r));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 }); g.player.handleInput = () => {};
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
  }, p);
  await teleport(); await page.waitForTimeout(4000); await teleport();
  await page.waitForFunction(() => { const t = (window as any).canalRecallGame.vectorMap._threeBuildings; return t?.ready && !t.pending.length && !t.inflight.size; }, null, { timeout: 120_000 });
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    g._lastDriveByAt = Infinity;
    g.vectorMap.setActiveLandmark(null);
    g._landmarkNotice = null;
    const map = g.vectorMap.map, canvas = map.getCanvas();
    for (const layer of map.getStyle().layers) if (layer.type === 'symbol') map.setLayoutProperty(layer.id, 'visibility', 'none');
    for (const e of Array.from(document.body.querySelectorAll('*'))) if (e !== canvas && !e.contains(canvas)) (e as HTMLElement).style.visibility = 'hidden';
  });
  const canvas = page.locator('canvas.maplibregl-canvas').first();
  const scale = await page.evaluate(() => window.devicePixelRatio);
  const before = await colourPixels(await canvas.screenshot(), CORAL, scale, 60);
  await page.evaluate(({ pand, pick }) => (window as any).canalRecallGame.vectorMap.setActiveLandmark({
    id: `tapped-${pand}`, name: 'Terrace house', lngLat: pick, buildingIds: [pand], featureTarget: { source: 'osm-building-appearance', id: pand },
  }), TERRACE);
  await page.waitForTimeout(2500);
  const marker = await page.evaluate(() => (window as any).canalRecallGame.vectorMap._highlightMarker?.status());
  const shot = await canvas.screenshot();
  await info.attach('highlight-a-terrace-chase', { body: shot, contentType: 'image/png' });
  const after = await colourPixels(shot, CORAL, scale, 60);
  const size = await canvas.boundingBox();
  const area = size!.width * size!.height;
  const detail = JSON.stringify({ before: before.n / area, after: after.n / area, boost: marker?.boost });
  expect(marker?.boost?.weight, `small target: ${detail}`).toBeGreaterThan(0.9);
  expect(after.n / area, `accent share at the terrace: ${detail}`).toBeGreaterThanOrEqual(0.003);
  // Clearing the card clears the boost (roof wash and raised beacon).
  await page.evaluate(() => (window as any).canalRecallGame.vectorMap.setActiveLandmark(null));
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => (window as any).__canalRecallHighlightBoost)).toBe(0);
  expect((await colourPixels(await canvas.screenshot(), CORAL, scale, 60)).n).toBeLessThan(before.n + area * 0.0002);
});

// `?highlight=yellow` keeps the old look for comparison: the building is painted yellow, no ring, beacon or coral.
test('highlight=yellow: the old yellow comparison still paints the destination', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one comparison is enough');
  test.setTimeout(240_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: '?highlight=yellow', abortHeavyTiles: true });
  const landmark = await park(page);
  const canvas = page.locator('canvas.maplibregl-canvas').first();
  const scale = await page.evaluate(() => window.devicePixelRatio);
  const before = await colourPixels(await canvas.screenshot(), YELLOW, scale, 40);
  const marker = await page.evaluate((l) => { const vm = (window as any).canalRecallGame.vectorMap; vm.setActiveLandmark(l); return !!vm._highlightMarker; }, landmark);
  await page.waitForTimeout(1500);
  const size = await canvas.boundingBox();
  const after = await colourPixels(await canvas.screenshot(), YELLOW, scale, 40);
  expect(marker, 'no marker under yellow').toBe(false);
  expect(after.n - before.n, 'yellow paint').toBeGreaterThan(size!.width * size!.height * 0.001);
});
