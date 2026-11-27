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
    const map = g.vectorMap.map ?? g.vectorMap.cameraMap, canvas = map.getCanvas();
    if (g.vectorMap.map) { for (const layer of map.getStyle().layers) if (layer.type === 'symbol') map.setLayoutProperty(layer.id, 'visibility', 'none'); } else g.vectorMap.setLabelsVisible(false);
    for (const e of Array.from(document.body.querySelectorAll('*'))) if (e !== canvas && !e.contains(canvas)) (e as HTMLElement).style.visibility = 'hidden';
  });
  return landmark;
}


// Small targets (LOOK §Highlight): an ordinary terrace house from the chase camera covers ~0.2 % of the frame, and
// outline + ring + beacon alone gave 0.08 % accent pixels (the yellow 0.55 %). The roof wash and the raised beacon
// bring it to at least 0.3 %; the facade keeps its own colours and no street name is shown.
const TERRACE = { pand: 'NL.IMBAG.Pand.0363100012236453', pick: [4.87177, 52.36696] as [number, number], standDeg: 7, standM: 60 };

// `?highlight=yellow` keeps the old look for comparison: the building is painted yellow, no ring, beacon or coral.
test('highlight=yellow: the old yellow comparison still paints the destination', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one comparison is enough');
  test.setTimeout(240_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: '?highlight=yellow', abortHeavyTiles: true });
  const landmark = await park(page);
  const canvas = page.locator('canvas.maplibregl-canvas, canvas.engine-canvas').first();
  const scale = await page.evaluate(() => window.devicePixelRatio);
  const before = await colourPixels(await canvas.screenshot(), YELLOW, scale, 40);
  const marker = await page.evaluate((l) => { const vm = (window as any).canalRecallGame.vectorMap; vm.setActiveLandmark(l); return !!vm._highlightMarker; }, landmark);
  await page.waitForTimeout(1500);
  const size = await canvas.boundingBox();
  const after = await colourPixels(await canvas.screenshot(), YELLOW, scale, 40);
  expect(marker, 'no marker under yellow').toBe(false);
  expect(after.n - before.n, 'yellow paint').toBeGreaterThan(size!.width * size!.height * 0.001);
});
