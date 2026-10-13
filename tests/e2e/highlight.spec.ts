/**
 * The recommended highlight (`?highlight=a`: outline + ground ring + beacon, src/canalRecall/look/highlight.ts) is
 * found on screen by its colour, in the default frame and the shared frame: parked facing the Anne Frank House on
 * the Westermarkt corner (the block of the user's 2026-10-13 screenshot), the accent appears only once the card
 * names it, and it sits on that building, not elsewhere. The building keeps its own colours (no yellow).
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

async function park(page: Page): Promise<any> {
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
  await page.waitForFunction(() => { const t = (window as any).canalRecallGame.vectorMap._threeBuildings; return t?.ready && !t.pending.length && !t.inflight.size; }, null, { timeout: 120_000 });
  await page.waitForTimeout(5000);
  // Only the 3D frame: no labels, HUD or minimap in the colour count.
  await page.evaluate(() => {
    const map = (window as any).canalRecallGame.vectorMap.map, canvas = map.getCanvas();
    for (const layer of map.getStyle().layers) if (layer.type === 'symbol') map.setLayoutProperty(layer.id, 'visibility', 'none');
    for (const e of Array.from(document.body.querySelectorAll('*'))) if (e !== canvas && !e.contains(canvas)) (e as HTMLElement).style.visibility = 'hidden';
  });
  return landmark;
}

for (const frame of [{ name: 'default frame', query: '?highlight=a' }, { name: 'shared frame', query: '?highlight=a&sharedFrame=1' }]) {
  test(`highlight a: the destination is found by its accent (${frame.name})`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop' && frame.name === 'shared frame', 'phone: the default frame');
    test.setTimeout(240_000);
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: frame.query, abortHeavyTiles: true });
    const landmark = await park(page);
    const canvas = page.locator('canvas.maplibregl-canvas').first();
    const scale = await page.evaluate(() => window.devicePixelRatio);
    const before = await colourPixels(await canvas.screenshot(), CORAL, scale);
    const state = await page.evaluate((l) => {
      const vm = (window as any).canalRecallGame.vectorMap;
      vm.setActiveLandmark(l);
      const at = vm.map.project(l.lngLat);
      return { at: [at.x, at.y], marker: vm._highlightMarker?.status(), models: (vm._signatureLandmarks?._entries ?? []).filter((e: any) => e.highlighted).length, extrusions: vm._threeBuildings?.highlighted?.size ?? 0 };
    }, landmark);
    await page.waitForTimeout(1500);
    const shot = await canvas.screenshot();
    const after = await colourPixels(shot, CORAL, scale);
    const yellow = await colourPixels(shot, YELLOW, scale, 40);
    await info.attach(`highlight-a-${frame.name}`, { body: shot, contentType: 'image/png' });
    expect(state.marker?.ring, 'ground ring').toBe(true);
    expect(state.marker?.beacon, 'beacon').toBe(true);
    expect(state.models + state.extrusions, 'a pipeline lit the building').toBeGreaterThan(0);
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
