import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Own-ground prototype (docs/research/own-ground-20261009.md). Opt-in:
//   OWN_GROUND=1 PW_PORT=4407 npx playwright test own-ground --project=desktop
//   OWN_GROUND=1 PW_PORT=4407 npx playwright test own-ground --project=iphone
// "same viewpoint" puts the game's bike on Nassaukade just south of the
// Bilderdijkgracht-mouth bridge with ?elevation=1, copies MapLibre's camera
// into the prototype, and screenshots both into artifacts/own-ground/.
// "ride cost" measures the prototype's autopilot ride the way ride-perf
// measures the game (12 s, iphone 4x CPU throttle).
test.skip(!process.env.OWN_GROUND, 'set OWN_GROUND=1');

const OUT = 'artifacts/own-ground';
// Nassaukade (way 1194778589), heading up the kade toward bridge way 7373504.
const RIDER = { lng: 4.87445, lat: 52.37286, bearing: 40 };
// Leidsegracht at the Herengracht, heading south-west along the Herengracht.
const RIDER_B = { lng: 4.88655, lat: 52.36720, bearing: 215 };

const pick = (values: number[], q: number) => { const s = [...values].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0; };
const summary = (v: number[]) => ({ n: v.length, median: +pick(v, 0.5).toFixed(2), p95: +pick(v, 0.95).toFixed(2), p99: +pick(v, 0.99).toFixed(2), over50: v.filter(f => f > 50).length });

async function openProto(page: Page, query: string): Promise<Record<string, unknown>> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`/canal-drive/own-ground.html?${query}`);
  await page.waitForFunction(() => (window as any).__ownGround?.ready || (window as any).__ownGround?.status?.error, null, { timeout: 180_000 });
  const status = await page.evaluate(() => (window as any).__ownGround.status);
  expect(status.error, String(status.error)).toBeUndefined();
  expect(errors).toEqual([]);
  return status;
}

test('same viewpoint: game elevation=1 vs own ground', async ({ page }, info) => {
  test.setTimeout(420_000);
  mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => { (window as any).__canalRecallElevation = true; });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 });
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.elevationStatus?.().ready), { timeout: 60_000 }).toBe(true);
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, RIDER);
  await page.waitForTimeout(12_000);
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.map.areTilesLoaded()), { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(1500);
  const cam = await page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap, map = vm.map, c = map.getCenter(), g = (window as any).canalRecallGame;
    return { lng: c.lng, lat: c.lat, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), fov: map.transform?.fov ?? 36.87, rider: vm.worldToLngLat(g.player.x, g.player.y, g.osmLoader), angle: g.player.angle };
  });
  await page.screenshot({ path: `${OUT}/${info.project.name}-1-maplibre-elevation.png` });
  const riderBearing = (Math.atan2(Math.cos(cam.angle), -Math.sin(cam.angle)) * 180 / Math.PI + 360) % 360;
  const rider = `rider=${cam.rider[0]},${cam.rider[1]},${riderBearing}`;
  const base = `box=nassaukade&auto=0&hud=0&${rider}&prefer=Nassaukade`;
  const s1 = await openProto(page, `${base}&cam=map&mapcam=${cam.lng},${cam.lat},${cam.zoom},${cam.pitch},${cam.bearing},${cam.fov}`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${info.project.name}-2-own-same-camera.png` });
  await openProto(page, `${base}&cam=chase`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${info.project.name}-3-own-chase.png` });
  await openProto(page, `${base}&cam=chase&relief=0`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${info.project.name}-4-own-chase-flat.png` });
  writeFileSync(`${OUT}/${info.project.name}-camera.json`, JSON.stringify({ cam, status: s1 }, null, 2));
});

test('canal belt: Herengracht / Leidsegracht', async ({ page }, info) => {
  test.setTimeout(300_000);
  mkdirSync(OUT, { recursive: true });
  const rider = `rider=${RIDER_B.lng},${RIDER_B.lat},${RIDER_B.bearing}`;
  const status = await openProto(page, `box=leidsegracht&auto=0&hud=0&${rider}&cam=chase&prefer=Herengracht&highlight=Leidsegracht`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${info.project.name}-5-leidsegracht-chase.png` });
  await openProto(page, `box=leidsegracht&auto=0&hud=0&${rider}&cam=map&mapcam=${RIDER_B.lng},${RIDER_B.lat},18.6,60,${RIDER_B.bearing},36.87&prefer=Herengracht&highlight=Leidsegracht`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${info.project.name}-6-leidsegracht-map.png` });
  writeFileSync(`${OUT}/${info.project.name}-leidsegracht.json`, JSON.stringify(status, null, 2));
});

const variants = [
  { label: 'nassaukade chase, all effects', query: 'box=nassaukade&cam=chase' },
  { label: 'nassaukade chase, no effects', query: 'box=nassaukade&cam=chase&fx=0' },
  { label: 'nassaukade chase, ground only (no buildings)', query: 'box=nassaukade&cam=chase&buildings=0' },
  { label: 'leidsegracht chase, all effects', query: 'box=leidsegracht&cam=chase' },
];
const results: unknown[] = [];
for (const v of variants) {
  test(`ride cost: ${v.label}`, async ({ page }, info) => {
    test.setTimeout(300_000);
    const status = await openProto(page, `auto=1&hud=0&${v.query}`);
    await page.waitForTimeout(3000);
    const cdp = await page.context().newCDPSession(page);
    const throttle = info.project.name === 'iphone' ? 4 : 1;
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await page.evaluate(() => { const s = (window as any).__ownGround; s.frames.length = 0; s.renderMs.length = 0; });
    await page.waitForTimeout(12_000);
    const raw = await page.evaluate(() => {
      const s = (window as any).__ownGround, mem = (performance as any).memory;
      return { frames: s.frames.slice(5), renderMs: s.renderMs.slice(5), info: s.info, dpr: s.opts.dpr, heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null, build: s.build, groundBuildMs: s.groundBuildMs, groundHeapMB: s.groundHeapMB, stats: s.stats };
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const sample = { label: v.label, project: info.project.name, throttle, dpr: raw.dpr, frames: summary(raw.frames), renderCpu: summary(raw.renderMs), drawCalls: raw.info.calls, trianglesDrawn: raw.info.triangles, heapMB: raw.heapMB, ground: status.ground, build: raw.build, groundBuildMs: raw.groundBuildMs, loadMs: status.loadMs };
    results.push(sample);
    console.log(JSON.stringify(sample));
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/perf-${info.project.name}.json`, JSON.stringify(results, null, 2));
    expect(raw.frames.length).toBeGreaterThan(20);
  });
}
