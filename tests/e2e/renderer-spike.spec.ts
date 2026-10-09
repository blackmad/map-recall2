import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Own-renderer spike (docs/research/own-renderer-spike-20261009.md). Opt-in:
//   RENDERER_SPIKE=1 PW_PORT=4415 npx playwright test renderer-spike --project=desktop
//   RENDERER_SPIKE=1 PW_PORT=4415 npx playwright test renderer-spike --project=iphone
// "same viewpoint" puts the game's bike on Raadhuisstraat by the Westerkerk,
// copies MapLibre's camera into the spike (mapcam=…), and screenshots both
// into artifacts/renderer-spike/. "ride cost" measures the spike's autopilot
// ride the way ride-perf measures the game (12 s, iphone 4x CPU throttle).
test.skip(!process.env.RENDERER_SPIKE, 'set RENDERER_SPIKE=1');

const OUT = 'artifacts/renderer-spike';
const RIDER = { lng: 4.88475, lat: 52.37395, bearing: 355 };

const pick = (values: number[], q: number) => { const s = [...values].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0; };
const summary = (v: number[]) => ({ n: v.length, median: +pick(v, 0.5).toFixed(2), p95: +pick(v, 0.95).toFixed(2), p99: +pick(v, 0.99).toFixed(2), over50: v.filter(f => f > 50).length });

/** Count WebGL draw calls and triangles per animation frame, for the game and the spike alike. */
async function countGl(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as any, c = { calls: 0, tris: 0 };
    w.__gl = { frames: [] as Array<{ calls: number; tris: number }> };
    const P = WebGL2RenderingContext.prototype as any;
    const wrap = (name: string, countArg: number, instArg = -1) => {
      const original = P[name];
      P[name] = function (this: unknown, ...a: number[]) {
        c.calls++;
        if (a[0] === 4) c.tris += (a[countArg] / 3) * (instArg >= 0 ? a[instArg] : 1);
        return original.apply(this, a);
      };
    };
    wrap('drawElements', 1); wrap('drawArrays', 2); wrap('drawElementsInstanced', 1, 4); wrap('drawArraysInstanced', 2, 3);
    const tick = () => { if (c.calls) w.__gl.frames.push({ calls: c.calls, tris: c.tris }); c.calls = 0; c.tris = 0; if (w.__gl.frames.length > 600) w.__gl.frames.splice(0, 300); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}
const glSample = (page: Page) => page.evaluate(async () => {
  const w = window as any; w.__gl.frames.length = 0;
  await new Promise(r => setTimeout(r, 3000));
  const f = w.__gl.frames as Array<{ calls: number; tris: number }>, mid = (k: 'calls' | 'tris') => f.map(x => x[k]).sort((a, b) => a - b)[f.length >> 1];
  const mem = (performance as any).memory;
  return { frames: f.length, calls: mid('calls'), triangles: Math.round(mid('tris')), heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null };
});

async function openSpike(page: Page, query: string): Promise<void> {
  await page.goto(`/canal-drive/renderer-spike.html?${query}`);
  await page.waitForFunction(() => (window as any).__spike?.ready || (window as any).__spike?.status?.error, null, { timeout: 120_000 });
  expect(await page.evaluate(() => (window as any).__spike.status.error)).toBeUndefined();
}

test('same viewpoint: game vs spike', async ({ page }, info) => {
  test.setTimeout(300_000);
  mkdirSync(OUT, { recursive: true });
  await countGl(page);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 });
  // Teleport the bike (inverse of vectorMap.worldToLngLat) and let the camera settle.
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    if ('speed' in g.player) g.player.speed = 0;
  }, RIDER);
  await page.waitForTimeout(12_000);
  const cam = await page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap, map = vm.map, c = map.getCenter();
    const g = (window as any).canalRecallGame;
    return { lng: c.lng, lat: c.lat, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), fov: map.transform?.fov ?? 36.87, rider: vm.worldToLngLat(g.player.x, g.player.y, g.osmLoader), angle: g.player.angle };
  });
  const gl: Record<string, unknown> = { game: await glSample(page) };
  await page.screenshot({ path: `${OUT}/${info.project.name}-1-game.png` });
  const riderBearing = (Math.atan2(Math.cos(cam.angle), -Math.sin(cam.angle)) * 180 / Math.PI + 360) % 360;
  const rider = `rider=${cam.rider[0]},${cam.rider[1]},${riderBearing}`;
  await openSpike(page, `auto=0&hud=0&cam=map&mapcam=${cam.lng},${cam.lat},${cam.zoom},${cam.pitch},${cam.bearing},${cam.fov}&${rider}&lat=${cam.lat}&lng=${cam.lng}`);
  await page.waitForTimeout(2500);
  gl.spikeSameCamera = await glSample(page);
  await page.screenshot({ path: `${OUT}/${info.project.name}-2-spike-same-camera.png` });
  await openSpike(page, `auto=0&hud=0&cam=chase&${rider}&lat=${cam.lat}&lng=${cam.lng}`);
  await page.waitForTimeout(2500);
  gl.spikeChase = await glSample(page);
  await page.screenshot({ path: `${OUT}/${info.project.name}-3-spike-chase.png` });
  await openSpike(page, `auto=0&hud=0&cam=chase&fx=0&${rider}&lat=${cam.lat}&lng=${cam.lng}`);
  await page.waitForTimeout(2500);
  gl.spikeChaseNoEffects = await glSample(page);
  await page.screenshot({ path: `${OUT}/${info.project.name}-4-spike-chase-no-effects.png` });
  console.log(JSON.stringify(gl));
  writeFileSync(`${OUT}/${info.project.name}-camera.json`, JSON.stringify({ cam, gl }, null, 2));
});

const variants = [
  { label: 'chase, all effects', query: 'cam=chase' },
  { label: 'chase, no effects', query: 'cam=chase&fx=0' },
  { label: 'chase, shadows only', query: 'cam=chase&ao=0' },
  { label: 'map camera, all effects', query: 'cam=map' },
  { label: 'chase, all effects + AO forced', query: 'cam=chase&ao=1' },
];
const results: unknown[] = [];
for (const v of variants) {
  test(`ride cost: ${v.label}`, async ({ page }, info) => {
    test.setTimeout(240_000);
    await openSpike(page, `auto=1&hud=0&${v.query}`);
    await page.waitForTimeout(3000);
    const cdp = await page.context().newCDPSession(page);
    const throttle = info.project.name === 'iphone' ? 4 : 1;
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await page.evaluate(() => { const s = (window as any).__spike; s.frames.length = 0; s.renderMs.length = 0; });
    await page.waitForTimeout(12_000);
    const raw = await page.evaluate(() => {
      const s = (window as any).__spike, mem = (performance as any).memory;
      return { frames: s.frames.slice(5), renderMs: s.renderMs.slice(5), info: s.info, status: s.status, dpr: s.opts.dpr, heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null };
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const sample = { label: v.label, project: info.project.name, throttle, dpr: raw.dpr, frames: summary(raw.frames), renderCpu: summary(raw.renderMs), drawCalls: raw.info.calls, triangles: raw.info.triangles, heapMB: raw.heapMB, loadMs: raw.status.loadMs, buildings: raw.status.buildings };
    results.push(sample);
    console.log(JSON.stringify(sample));
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/perf-${info.project.name}.json`, JSON.stringify(results, null, 2));
    expect(raw.frames.length).toBeGreaterThan(20);
  });
}
