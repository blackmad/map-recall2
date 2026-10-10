import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openRoute } from './helpers';

// The game with `?ownMap=1` (drop-MapLibre step 1): no third-party basemap
// tiles or style, the own map draws the flat cartography in the shared frame
// and the label layers on its canvas, isWater answers from our water polygons.
//   PW_PORT=4426 npx playwright test own-map-game --project=desktop

const OUT = 'artifacts/own-map';
// Nassaukade (way 1194778589), as in no-maplibre.spec.ts.
const RIDER = { lng: 4.87445, lat: 52.37286, bearing: 40 };

test('game ?ownMap=1: no basemap host, own cartography + labels, water from our polygons', async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  const hosts = new Set<string>();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('request', r => hosts.add(new URL(r.url()).host));
  await page.addInitScript(() => { (window as any).__canalRecallForceIntro = true; });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: false, query: '?ownMap=1' });
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.ownMapStatus().loaded), { timeout: 60_000 }).toBe(true);
  mkdirSync(OUT, { recursive: true });
  // Hold the start flight's overview for a city-scale look.
  await expect.poll(() => page.evaluate(() => !!(window as any).canalRecallGame._intro), { timeout: 60_000 }).toBe(true);
  await page.evaluate(() => { (window as any).canalRecallGame._intro.plan.hold = 1e9; });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/${info.project.name}-game-ownmap-route.png` });
  // Land and ride onto Nassaukade.
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g._intro.elapsed = 1e9; g._intro.plan.hold = 0; });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4 && !(window as any).canalRecallGame._intro, null, { timeout: 30_000 });
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, RIDER);
  await page.waitForTimeout(8000);
  await page.screenshot({ path: `${OUT}/${info.project.name}-game-ownmap-street.png` });
  const r = await page.evaluate(() => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const world = (lng: number, lat: number) => [l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm];
    const [wx, wy] = world(4.87485, 52.37269), [bx, by] = world(4.87567, 52.37259);
    return { status: vm.ownMapStatus(), singelgracht: vm.isWater(wx, wy, l), kazerne: vm.isWater(bx, by, l), style: vm.map.getStyle().name };
  });
  expect(r.style).toBe('own-map');
  expect(r.singelgracht, 'Singelgracht is water').toBe(true);
  expect(r.kazerne, 'Kazerne Hendrik block is not').toBe(false);
  expect(r.status.frames).toBeGreaterThan(30);
  expect(r.status.placed, 'labels drawn in the riding view').toBeGreaterThan(0);
  expect([...hosts].filter(h => /openfreemap|openstreetmap\.org|nominatim/.test(h)), 'no basemap host').toEqual([]);
  expect(errors).toEqual([]);
  console.log(JSON.stringify(r.status), [...hosts].join(' '));
});
