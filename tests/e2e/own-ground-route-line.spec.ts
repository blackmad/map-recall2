import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { openRoute } from './helpers';

// One route ribbon and one highlight band under own ground (`?ownGround=1`),
// Kostverlorenvaart in the Chassebuurt (user shot 2026-10-13). Opt-in:
//   OWN_GROUND=1 PW_PORT=4457 npx playwright test own-ground-route-line --project=desktop
test.skip(!process.env.OWN_GROUND, 'set OWN_GROUND=1');

const OUT = process.env.ROUTE_SHOTS_OUT || 'artifacts/route-line-bounce/after';
const SPOT = { lng: 4.8705, lat: 52.3735, bearing: 250 };

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => { (window as any).__canalRecallOwnGround = true; });
  await openRoute(page, { travelMode: 'boat', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  return errors;
}

async function teleport(page: Page): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, SPOT);
}

/** Route line on, the canal under the boat as the open question and as the route (the user's screenshot). */
async function askQuestion(page: Page): Promise<string> {
  return page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const hit = g.track.getNearestRoad(g.player.x, g.player.y, g.player.angle);
    const seg = g.track.segments[hit.segIdx];
    g.routeOptions.line = true;
    g._liveRoutePath = seg.points;
    g.quizPromptName = seg.name;
    g.quizPromptSegmentIndex = hit.segIdx;
    g.quizPromptPointIndex = 0;
    return seg.name as string;
  });
}

const state = (page: Page) => page.evaluate(() => {
  const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
  const op = (id: string) => map.getLayer(id) ? { vis: map.getLayoutProperty(id, 'visibility'), lineOpacity: map.getPaintProperty(id, 'line-opacity') } : null;
  return {
    status: vm.ownGroundStatus(),
    layers: Object.fromEntries(['navigation-route-casing', 'navigation-route-line', 'active-street-line', 'cycle-tracks'].map(id => [id, op(id)])),
    route: !!vm._ownGroundRoute, highlight: !!vm._ownGroundHighlight,
  };
});

async function settle(page: Page): Promise<void> {
  await expect.poll(async () => {
    const s = (await state(page)).status;
    return s.ready && !s.queued && !Object.keys(s.pending ?? {}).length && Object.values(s.cells ?? {}).includes(0);
  }, { timeout: 180_000, intervals: [1000] }).toBe(true);
  await page.waitForTimeout(3000);
}

/**
 * Route-coloured pixels per scan row of a frame: the route blue (#38BDF8 draped, #0EA5E9 flat) and the flat band's yellow
 * edge. A row crossing one route ribbon holds one blue run (runs closer than 8 px merge); a second line is a second run.
 */
async function routePixels(png: Buffer): Promise<{ rowsWithRoute: number; doubledRows: number; yellow: number }> {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  let rowsWithRoute = 0, doubledRows = 0, yellow = 0;
  for (let y = 120; y < info.height - 120; y += 4) {
    let runs = 0, last = -100;
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * ch, r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 230 && g > 170 && b < 80) yellow++;
      if (!(y > 640 && x < 320) && !(y > 520 && y < 620 && Math.abs(x - info.width / 2) < 60) && r > 30 && r < 100 && g > 160 && g < 215 && b > 225) { if (x - last > 8) runs++; last = x; }
    }
    if (runs) rowsWithRoute++;
    if (runs > 1) doubledRows++;
  }
  return { rowsWithRoute, doubledRows, yellow };
}

test('route line: one ribbon, one highlight band, stable between frames', async ({ page }, info) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const errors = await boot(page);
  await teleport(page);
  await settle(page);
  console.log('QUESTION', await askQuestion(page));
  await page.waitForTimeout(1500);
  await expect.poll(async () => (await state(page)).highlight, { timeout: 15_000 }).toBe(true);
  const s = await state(page);
  console.log('STATE', JSON.stringify({ layers: s.layers, route: s.route, highlight: s.highlight, rev: s.status.surfaceRevision }));
  const a = await page.screenshot({ path: `${OUT}/${info.project.name}-a.png` });
  await page.evaluate(() => { (window as any).canalRecallGame.player.angle += 0.6; });
  await page.waitForTimeout(2000);
  const b = await page.screenshot({ path: `${OUT}/${info.project.name}-b.png` });
  const frames = [await routePixels(a), await routePixels(b)];
  console.log('PIXELS', JSON.stringify(frames));
  expect(s.highlight, 'the question street is draped').toBe(true);
  for (const f of frames) {
    expect(f.rowsWithRoute, 'the route is visible').toBeGreaterThan(20);
    // A second line beside the first doubles nearly every row; a bridge rail or the boat's hull can split a row or two.
    expect(f.doubledRows, 'one band across the canal, not two').toBeLessThanOrEqual(Math.ceil(f.rowsWithRoute * 0.03));
    expect(f.yellow, 'no flat yellow-edged band').toBe(0);
  }
  expect(errors).toEqual([]);
});
