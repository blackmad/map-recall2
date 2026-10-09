import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openRoute } from './helpers';
import { localToLngLat, type BridgeExtract, type ElevationIndex } from '../../src/canalRecall/elevation/elevationData';

// Canal elevation (`?elevation=1`, docs/elevation.md): before/after screenshots
// at named bridges and canal-side landmarks, plus the rider lifted onto a deck.
//   PW_PORT=4400 npx playwright test canal-elevation --project=desktop --project=iphone
// Images go to artifacts/elevation/<project>/{flat,elevation}-<place>.png.

const EXTRACT = 'public/data/extracts/amsterdam/elevation-v1';
const index: ElevationIndex = JSON.parse(readFileSync(`${EXTRACT}/index.json`, 'utf8'));
const bridges: BridgeExtract = JSON.parse(readFileSync(`${EXTRACT}/bridges.json`, 'utf8'));
const q = index.quantization.xy;

type Place = { name: string; lngLat: [number, number]; axisBearing: number; crownM?: number };

/** Crown of a measured bridge and the bearing of its road, from the published profile. */
function measuredPlace(id: string, name: string): Place {
  const b = bridges.measured.find(m => m.id === id)!;
  let best = 3;
  for (let i = 3; i < b.p.length; i += 4) if (b.p[i] > b.p[best]) best = i;
  const at = (k: number) => localToLngLat(index, b.p[k - 3] * q, b.p[k - 2] * q);
  const prev = Math.max(3, best - 8), next = Math.min(b.p.length - 1, best + 8);
  const east = (b.p[next - 3] - b.p[prev - 3]) * q, north = (b.p[next - 2] - b.p[prev - 2]) * q;
  return { name, lngLat: at(best), axisBearing: (Math.atan2(east, north) * 180) / Math.PI, crownM: b.p[best] / 100 };
}

/** Centre and long axis of an unmeasured footprint. */
function fallbackPlace(id: string, name: string): Place {
  const b = bridges.fallback.find(f => f.id === id)!;
  let cx = 0, cy = 0, n = b.ring.length / 2;
  for (let i = 0; i < b.ring.length; i += 2) { cx += b.ring[i] * q / n; cy += b.ring[i + 1] * q / n; }
  let far = 0, axis = 0;
  for (let i = 0; i < b.ring.length; i += 2) for (let j = i + 2; j < b.ring.length; j += 2) {
    const dx = (b.ring[j] - b.ring[i]) * q, dy = (b.ring[j + 1] - b.ring[i + 1]) * q;
    if (Math.hypot(dx, dy) > far) { far = Math.hypot(dx, dy); axis = (Math.atan2(dx, dy) * 180) / Math.PI; }
  }
  return { name, lngLat: localToLngLat(index, cx, cy), axisBearing: axis };
}

const PLACES: Place[] = [
  measuredPlace('BRU0057', 'papiermolensluis'),
  measuredPlace('BRU0076', 'oetgensbrug'),
  measuredPlace('BRU0299', 'hoofdbrug-flat'),
  fallbackPlace('BRU0242', 'magere-brug-fallback'),
  { name: 'westerkerk-prinsengracht', lngLat: [4.88424, 52.37450], axisBearing: 0 },
  { name: 'munttoren-singel', lngLat: [4.89350, 52.36660], axisBearing: 30 },
];

async function placeRider(page: Page, place: Place) {
  await page.evaluate(({ lngLat, axisBearing }) => {
    const game = (window as any).canalRecallGame, loader = game.osmLoader;
    const perLat = 111320 * 3, perLng = 111320 * Math.cos(loader._lastCenterLat * Math.PI / 180) * 3;
    const b = axisBearing * Math.PI / 180;
    Object.assign(game.player, {
      x: loader._lastOffsetX + (lngLat[0] - loader._lastCenterLng) * perLng,
      y: loader._lastOffsetY - (lngLat[1] - loader._lastCenterLat) * perLat,
      // Game angle: east = cos, south = sin. A bearing's east = sin b, north = cos b.
      angle: Math.atan2(-Math.cos(b), Math.sin(b)), speed: 0, vx: 0, vy: 0,
    });
    game.player.handleInput = () => {};
  }, place);
}

async function settle(page: Page, ms = 2500) {
  await page.waitForTimeout(ms);
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.map.areTilesLoaded()), { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(500);
}

for (const mode of ['flat', 'elevation'] as const) {
  test(`canal elevation screenshots: ${mode}`, async ({ page }, info) => {
    test.setTimeout(420_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(String(error.stack || error)));
    await page.addInitScript((on: boolean) => { (window as any).__canalRecallElevation = on; }, mode === 'elevation');
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false });
    if (mode === 'elevation') {
      await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.elevationStatus().ready), { timeout: 60_000 }).toBe(true);
    }
    const dir = resolve('artifacts/elevation', info.project.name);
    mkdirSync(dir, { recursive: true });
    const report: Record<string, unknown> = {};
    for (const place of PLACES) {
      await placeRider(page, place);
      // Chase view along the road, the game's own camera.
      await settle(page, 3500);
      await page.screenshot({ path: resolve(dir, `${mode}-${place.name}-chase.png`) });
      const pose = await page.evaluate(() => {
        const vm = (window as any).canalRecallGame.vectorMap;
        return { altitude: vm._playerBike?.altitudeM ?? null, pitch: vm._playerBike?.surfacePitch ?? null, elevation: vm.elevationStatus() };
      });
      // Side view across the canal: hold the camera still, the bike keeps drawing.
      await page.evaluate(({ lngLat, axisBearing }) => {
        const vm = (window as any).canalRecallGame.vectorMap;
        vm.__sync = vm.__sync || vm.sync;
        vm.sync = () => {};
        vm.map.jumpTo({ center: lngLat, zoom: 19.2, pitch: 62, bearing: axisBearing + 70, elevation: 0 });
      }, place);
      await settle(page);
      await page.screenshot({ path: resolve(dir, `${mode}-${place.name}-side.png`) });
      await page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; vm.sync = vm.__sync; });
      report[place.name] = { ...pose, crownM: place.crownM ?? null };
    }
    writeFileSync(resolve(dir, `${mode}-report.json`), JSON.stringify({ report, errors }, null, 2));
    expect(errors.filter(e => /elevation|vector-map|three-buildings|player-vehicles/.test(e))).toEqual([]);
    if (mode === 'elevation') {
      const papier = report.papiermolensluis as { altitude: number; elevation: { cells: number; measuredDecks: number } };
      // Rider model on the Papiermolensluis crown (~1.8 m) instead of the street.
      expect(papier.altitude).toBeGreaterThan(1.2);
      expect(papier.elevation.cells).toBeGreaterThan(0);
      expect(papier.elevation.measuredDecks).toBeGreaterThan(0);
      const flat = report['hoofdbrug-flat'] as { altitude: number };
      expect(flat.altitude).toBeLessThan(0.8);
    }
  });
}
