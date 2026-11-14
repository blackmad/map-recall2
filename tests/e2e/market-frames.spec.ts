/**
 * Market frames (lane markets-20261114): rule-10 likeness frames (first person, 72 deg vertical FOV, 1440x900 at DPR 2,
 * the eye where a market-day panorama was taken, looking where the photo cut looks) and as-played chase frames on the
 * own engine, each without (`?markets=0`) and with (`?markets=1`) the stalls. The photo cuts and the sheets are
 * scripts/markets/frames-sheet.ts.
 *
 *   BUNDLES_DIR=artifacts/markets/bundles PW_PORT=4438 /tmp/canal-pw.sh npx playwright test tests/e2e/market-frames.spec.ts --workers=1 --project=desktop
 *
 * MARKETS_DATA (default scripts/data/markets/market-lines.json) is served at the extract path until the integrator
 * copies it to public/data/extracts/amsterdam/markets/. MK_OUT (default artifacts/markets/frames).
 */
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openRoute, settleWorld } from './helpers';
import { fpsPose } from '../../src/canalRecall/engine/fpsCamera';
import { MARKET_POSES, MARKET_RIDES } from './market-poses';

const OUT = process.env.MK_OUT ?? 'artifacts/markets/frames';
const DATA = process.env.MARKETS_DATA ?? 'scripts/data/markets/market-lines.json';
const only = process.env.MK_POSES?.split(',').filter(Boolean);
const W = 1440, H = 900;

async function serveData(page: Page): Promise<void> {
  await page.route(/\/extracts\/amsterdam\/markets\/market-lines\.json(\?.*)?$/, route => route.fulfill({ body: readFileSync(DATA), contentType: 'application/json' }));
}

async function setPlayer(page: Page, lngLat: [number, number], headingDeg: number, fps: unknown): Promise<void> {
  await page.evaluate(({ lngLat, headingDeg, fps }) => {
    const w = window as any, g = w.canalRecallGame, l = g.osmLoader;
    const mLng = 111320 * Math.cos(l._lastCenterLat * Math.PI / 180), ppm = 3;
    g.player.x = l._lastOffsetX + (lngLat[0] - l._lastCenterLng) * mLng * ppm;
    g.player.y = l._lastOffsetY - (lngLat[1] - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = (headingDeg - 90) * Math.PI / 180;
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    w.__marketPose = fps;
    g.state = 4;
  }, { lngLat, headingDeg, fps });
}

const hud = `body > *:not(#vector-map) { visibility: hidden !important; } .maplibregl-control-container { display: none !important; }`;
const debugOf = (page: Page) => page.evaluate(() => { const d = (window as any).__canalMarkets?.debug; return d ? JSON.parse(JSON.stringify(d)) : null; });

for (const variant of ['today', 'markets'] as const) {
  test(`market likeness frames: ${variant}`, async ({ browser }) => {
    test.setTimeout(900_000);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await serveData(page);
    await openRoute(page, { travelMode: 'car', query: `?engine=own&cam=fps&markets=${variant === 'markets' ? 1 : 0}`, abortHeavyTiles: true });
    await page.evaluate(() => {
      const g = (window as any).canalRecallGame, vm = g.vectorMap;
      g.player.handleInput = () => {};
      if (!vm.fpsCameraOn()) vm.setFpsCamera(true);
      vm.solveFps = function solveFpsMarketFrames(this: any) { const p = (window as any).__marketPose; this._lastFps = { pose: p, backM: 0, stuckId: null, elevation: 0 }; return p; };
    });
    await page.addStyleTag({ content: hud });
    for (const p of MARKET_POSES) {
      if (only && !only.includes(p.key)) continue;
      const fps = fpsPose({ rider: p.at, bearingDeg: p.headingDeg, viewportHeightPx: H, eyeHeightM: 2.44, fovDeg: 72, lookDownDeg: p.lookDownDeg ?? 5, maxPitchDeg: 85 });
      await setPlayer(page, p.at, p.headingDeg, fps); await page.waitForTimeout(1500); await setPlayer(page, p.at, p.headingDeg, fps);
      const settle = await settleWorld(page, p.key, 90_000);
      if (variant === 'markets') await expect.poll(() => debugOf(page).then(d => d?.instances ?? 0), { timeout: 60_000 }).toBeGreaterThan(0);
      await setPlayer(page, p.at, p.headingDeg, fps); await page.waitForTimeout(600);
      const dir = join(OUT, p.key); mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${variant}.png`), await page.screenshot({ type: 'png' }));
      const debug = await debugOf(page);
      const cam = await page.evaluate(() => { const c = (window as any).canalRecallGame?.camera ?? {}; return { viewMode: c.viewMode, zoom: c.zoom, pitch: c.pitch, northUp: c.northUp }; });
      const t = await page.evaluate(async () => { const ts: number[] = []; let last = performance.now(); for (let i = 0; i < 60; i++) { await new Promise(r => requestAnimationFrame(r)); const n = performance.now(); ts.push(n - last); last = n; } ts.sort((a, b) => a - b); return { p50: ts[30], p95: ts[57] }; });
      writeFileSync(join(dir, `${variant}.json`), JSON.stringify({ ...p, variant, camera: 'first person', vfovDeg: 72, dpr: 2, engine: 'own', world: 'default world-v1', debug, frameMs: t, settle }, null, 1));
      console.log(JSON.stringify({ key: p.key, variant, debug, frameMs: t }));
    }
    await ctx.close();
  });

  test(`market as-played chase frames: ${variant}`, async ({ browser }) => {
    test.setTimeout(600_000);
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await serveData(page);
    // The game's own chase camera (round 1 left the view select on its default, a near-aerial frame).
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: `?engine=own&markets=${variant === 'markets' ? 1 : 0}`, abortHeavyTiles: true, controlMode: 'relative' });
    await page.evaluate(() => { const g = (window as any).canalRecallGame; g.player.handleInput = () => {}; g.viewMode = 'chase'; if (g.camera) { g.camera.viewMode = 'chase'; g.camera.northUp = false; } });
    await page.addStyleTag({ content: hud });
    // Two chase framings per ride: the game's default zoom (CAMERA_ZOOM_INITIAL scaled to the window, what a fresh ride
    // shows) and the closest the zoom keys reach (camera.maxZoom), where a rider looking at the street plays.
    for (const [r, close] of MARKET_RIDES.flatMap(r => [[r, false], [r, true]] as const)) {
      if (only && !only.includes(r.key)) continue;
      await page.evaluate((close) => { const g = (window as any).canalRecallGame; g._zoomTouchedByPlayer = close; g.camera.zoom = close ? g.camera.maxZoom : g._defaultZoom; }, close);
      await setPlayer(page, r.at, r.headingDeg, {}); await page.waitForTimeout(1500); await setPlayer(page, r.at, r.headingDeg, {});
      const settle = await settleWorld(page, r.key, 90_000);
      if (variant === 'markets') await expect.poll(() => debugOf(page).then(d => d?.instances ?? 0), { timeout: 60_000 }).toBeGreaterThan(0);
      await setPlayer(page, r.at, r.headingDeg, {}); await page.waitForTimeout(800);
      const dir = join(OUT, close ? `${r.key}-close` : r.key); mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${variant}.png`), await page.screenshot({ type: 'png' }));
      const debug = await debugOf(page);
      const cam = await page.evaluate(() => { const c = (window as any).canalRecallGame?.camera ?? {}; const m = (window as any).canalRecallGame?.vectorMap?.map; return { viewMode: c.viewMode, zoom: c.zoom, maxZoom: c.maxZoom, northUp: c.northUp, mapZoom: m?.getZoom?.(), mapPitch: m?.getPitch?.() }; });
      const t = await page.evaluate(async () => { const ts: number[] = []; let last = performance.now(); for (let i = 0; i < 120; i++) { await new Promise(r => requestAnimationFrame(r)); const n = performance.now(); ts.push(n - last); last = n; } ts.sort((a, b) => a - b); return { p50: ts[60], p95: ts[114] }; });
      writeFileSync(join(dir, `${variant}.json`), JSON.stringify({ ...r, variant, camera: close ? 'chase, closest zoom' : 'chase (default zoom)', cam, dpr: 2, engine: 'own', world: 'default world-v1', debug, frameMs: t, settle }, null, 1));
      console.log(JSON.stringify({ key: r.key, close, variant, cam, debug, frameMs: t }));
    }
    await ctx.close();
  });
}
