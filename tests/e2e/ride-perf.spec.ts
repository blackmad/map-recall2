import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadavg } from 'node:os';
import { openRoute } from './helpers';

// Riding frame-cost baseline (2026-10-09 perf cycle).
// Opt-in measurement, not a gate:
//   PERF_RIDE=1 PW_PORT=4388 npx playwright test ride-perf --project=iphone
// Optional: PERF_PROFILE=1 adds a CDP CPU profile aggregated by self time
// (ignore the ~1.7 s Profiler.start stall; see the perf memory note).
//
// Each variant rides the same seeded route in chase view for 12 s with the CPU
// throttled 4x on the iphone project, and records rAF deltas plus wrapper
// timers around the map render, the signature-landmark layer and every
// `moveend` dispatch (the game calls `jumpTo` each frame, so `moveend` fires
// each frame too). Results go to artifacts/perf/ride-perf-<project>.json.
//
// Desktop budget (2026-10-13, docs/performance/desktop-20261013.md): the
// `default` variants on the desktop project must stay inside DESKTOP_BUDGET.
// The budget is in main-thread ms, not frame intervals, because the frame
// interval is the display cadence (16.7 or 33.3 ms depending on the machine
// and whether its display is awake) whenever the frame fits. BUNDLES_DIR=<dir>
// serves *.bundle.js from a local build (measure before the integrator rebuilds).
test.skip(!process.env.PERF_RIDE && !process.env.PERF_MOTION, 'set PERF_RIDE=1 (or PERF_MOTION=1 for the motion test only) to measure');

/**
 * Pinned at the 2026-10-13 desktop numbers after the label and landmark
 * fixes, with slack for a loaded machine (after: map render median 2.2-3.1 ms,
 * p95 3.6-7.2; label overlay mean 0.26-0.42 ms, worst 9.9-17.6 ms; before:
 * label overlay mean 0.91-1.23 ms). The mean catches a return of the per-frame
 * `getStyle()`; the worst-frame bound is a gross guard only (this chase route
 * never had the 40 ms plans the aerial hold had; those are measured with
 * scripts/ride-perf-owners.mjs).
 *
 * Tightened 2026-10-14 (docs/performance/desktop-20261014.md) after the bike's
 * single render and the landmark pick BVH: map render median 1.8-1.9 ms, p95
 * 2.6-2.9; label overlay mean 0.15-0.16 ms, worst 5.6-6.2 ms. Median and label
 * bounds keep ~2x over the loaded-machine numbers of 2026-10-13; p95 keeps
 * room for a tile batch.
 *
 * Own ground on by default (2026-10-14): the `default` variants now ride with the own ground and
 * the shared frame. Fixed route, 3 runs x 2 default variants, medians off -> on: frame interval
 * 16.7 -> 16.7 ms (display cadence), map render 2.35 -> 3.5 ms (p95 4.0 -> 5.3), three.js
 * 0.73 -> 2.11 ms per frame, JS heap 788 -> 881 MB, no frame over 50 ms either way. The budget
 * below still holds; `OWN_GROUND=0` measures the old default.
 */
const DESKTOP_BUDGET = { mapRenderMedianMs: 4, mapRenderP95Ms: 10, labelFrameMeanMs: 0.4, labelFrameMaxMs: 20, framesOver100: 2 };

type Variant = { label: string; landmarks: 'default' | 'off' | 'all' };
const variants: Variant[] = [
  { label: 'default', landmarks: 'default' },
  { label: 'landmarks off', landmarks: 'off' },
  { label: 'all landmarks resident', landmarks: 'all' },
  { label: 'default (repeat)', landmarks: 'default' },
];

const pick = (values: number[], q: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
};
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const summary = (values: number[]) => ({ n: values.length, median: +pick(values, 0.5).toFixed(2), p95: +pick(values, 0.95).toFixed(2), totalMs: +sum(values).toFixed(0) });

async function instrument(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    const vm = w.canalRecallGame.vectorMap;
    const map = vm.map;
    const t: Record<string, number[]> = { frame: [], mapRender: [], landmarkRender: [], threeLayers: [], moveend: [], move: [], labelFrame: [], minimap: [], gameRender: [] };
    w.__perf = t;
    const wrap = (obj: any, key: string, bucket: string) => {
      const original = obj[key].bind(obj);
      obj[key] = (...args: unknown[]) => { const s = performance.now(); try { return original(...args); } finally { t[bucket].push(performance.now() - s); } };
    };
    wrap(map, '_render', 'mapRender');
    // The HUD frame and, inside it, the minimap (the riding radar since 2026-10-16, the city sheet before).
    const game = w.canalRecallGame;
    wrap(game, '_render', 'gameRender');
    if (typeof game._renderMinimap === 'function') wrap(game, '_renderMinimap', 'minimap');
    else wrap(game.hud, 'drawCityOverview', 'minimap');
    // The POI label overlay's per-frame handler (plan, occlusion picks, placement).
    if (vm._labelOverlay?.frame) wrap(vm._labelOverlay, 'frame', 'labelFrame');
    const layer = vm._signatureLandmarks?.layer;
    if (layer?.render && !vm._sharedFrame) wrap(layer, 'render', 'landmarkRender');
    // All of our three.js drawing, either as the legacy per-feature layers or
    // as the shared frame's two passes (SHARED_FRAME=1), for a like-for-like total.
    const own = vm._sharedFrame ? [vm._sharedFrame.mainLayer, vm._sharedFrame.overlayLayer]
      : [vm._threeBuildings?.layer, vm._signatureLandmarks?.layer, vm._inventoryTrees?.layer, vm._artisAnimals?.layer, vm._pyramidalRoofs?.layer,
        vm._playerBike?.layer, vm._playerFerry?.layer, vm._playerBoat?.layer, vm._playerTransit?.layer];
    for (const l of own) if (l?.render && map.getLayer(l.id)) wrap(l, 'render', 'threeLayers');
    const fire = map.fire.bind(map);
    map.fire = (event: any, ...rest: unknown[]) => {
      const type = typeof event === 'string' ? event : event?.type;
      if (type !== 'moveend' && type !== 'move') return fire(event, ...rest);
      const s = performance.now();
      try { return fire(event, ...rest); } finally { t[type].push(performance.now() - s); }
    };
    let last = performance.now();
    const tick = (now: number) => { t.frame.push(now - last); last = now; if (!w.__stopFrames) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}

const results: Record<string, unknown>[] = [];

for (const variant of variants) {
  test(`ride frame cost: ${variant.label}`, async ({ page }, info) => {
    test.skip(!process.env.PERF_RIDE, 'set PERF_RIDE=1 to measure');
    test.setTimeout(300_000);
    // OWN_GROUND=1|0 forces the own ground (default on since 2026-10-14) on or off.
    if (process.env.OWN_GROUND) await page.addInitScript((on: boolean) => { (window as any).__canalRecallOwnGround = on; }, process.env.OWN_GROUND === '1');
    // CANAL_ELEVATION=1|0 forces the opt-in elevation layer on or off (docs/elevation.md); the
    // own ground retires that layer, so CANAL_ELEVATION=1 turns the own ground off.
    if (process.env.CANAL_ELEVATION) await page.addInitScript((on: boolean) => { (window as any).__canalRecallElevation = on; if (on) (window as any).__canalRecallOwnGround = false; }, process.env.CANAL_ELEVATION === '1');
    // SHARED_FRAME=1|0 forces the shared three.js frame (rendererShared/) on or off; SHADOWS=0 drops its sun shadows.
    if (process.env.SHARED_FRAME) await page.addInitScript((on: boolean) => { (window as any).__canalRecallSharedFrame = on; }, process.env.SHARED_FRAME === '1');
    if (process.env.SHADOWS) await page.addInitScript((on: boolean) => { (window as any).__canalRecallShadows = on; }, process.env.SHADOWS === '1');
    // OWN_GROUND=1|0 and RECIPE_TILES=1|0 force the own ground and the recipe-tile near tier (both imply the shared frame).
    if (process.env.OWN_GROUND) await page.addInitScript((on: boolean) => { (window as any).__canalRecallOwnGround = on; }, process.env.OWN_GROUND === '1');
    if (process.env.RECIPE_TILES) await page.addInitScript((on: boolean) => { (window as any).__canalRecallRecipeTiles = on; }, process.env.RECIPE_TILES === '1');
    const bundles = process.env.BUNDLES_DIR;
    if (bundles) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
      const file = join(bundles, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
      return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
    });
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
    await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 });
    await page.evaluate(async (mode) => {
      const landmarks = (window as any).canalRecallGame.vectorMap._signatureLandmarks;
      if (!landmarks) return;
      if (mode === 'off') landmarks.setEnabled(false);
      if (mode === 'all') { landmarks.loadVisibleOnly = false; landmarks._requestModels(); }
    }, variant.landmarks);
    // Let the streamed city, decorations and (for "all") every model land.
    await page.waitForFunction((mode) => {
      const l = (window as any).canalRecallGame.vectorMap._signatureLandmarks;
      return mode !== 'all' || !l || (l._pending.size === 0 && l.shown.size + l._failed.size >= l.models.length * 0.95);
    }, variant.landmarks, { timeout: 180_000, polling: 1000 });
    await page.waitForTimeout(6000);
    const cdp = await page.context().newCDPSession(page);
    const throttle = info.project.name === 'iphone' ? 4 : 1;
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    const profiling = !!process.env.PERF_PROFILE;
    if (profiling) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
    await instrument(page);
    const loadBefore = loadavg()[0];
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(12_000);
    await page.keyboard.up('ArrowUp');
    const raw = await page.evaluate(() => {
      const w = window as any; w.__stopFrames = true;
      const l = w.canalRecallGame.vectorMap._signatureLandmarks;
      const three = w.canalRecallGame.vectorMap._threeBuildings?.stats?.();
      const mem = (performance as any).memory;
      return { t: w.__perf, shown: l?.shown?.size ?? 0, entries: l?._entries?.length ?? 0, three, heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null };
    });
    let hot: Array<{ fn: string; selfMs: number }> = [];
    if (profiling) {
      const { profile } = await cdp.send('Profiler.stop') as any;
      const self = new Map<string, number>();
      const dt = new Map<number, number>();
      profile.samples.forEach((id: number, i: number) => dt.set(id, (dt.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000));
      for (const node of profile.nodes) {
        const f = node.callFrame; const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber}`;
        self.set(key, (self.get(key) ?? 0) + (dt.get(node.id) ?? 0));
      }
      hot = [...self].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([fn, ms]) => ({ fn, selfMs: +ms.toFixed(1) }));
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const frames = raw.t.frame.slice(5);
    const sample = {
      label: variant.label, project: info.project.name, throttle,
      frames: { ...summary(frames), p99: +pick(frames, 0.99).toFixed(2), over50: frames.filter((f: number) => f > 50).length, over100: frames.filter((f: number) => f > 100).length },
      mapRender: summary(raw.t.mapRender), landmarkRender: summary(raw.t.landmarkRender), threeLayers: summary(raw.t.threeLayers),
      labelFrame: { ...summary(raw.t.labelFrame), maxMs: +Math.max(0, ...raw.t.labelFrame).toFixed(1) },
      moveend: summary(raw.t.moveend), move: summary(raw.t.move),
      minimap: { ...summary(raw.t.minimap), p99: +pick(raw.t.minimap, 0.99).toFixed(2), maxMs: +Math.max(0, ...raw.t.minimap).toFixed(1) },
      gameRender: summary(raw.t.gameRender),
      landmarksShown: raw.shown, heapMB: raw.heapMB, threeBuildings: raw.three, hot,
      // Machine load (1-min average) around the measured ride; numbers taken above ~20 are not comparable.
      load: { before: +loadBefore.toFixed(1), after: +loadavg()[0].toFixed(1) },
    };
    results.push(sample);
    console.log(JSON.stringify(sample));
    mkdirSync('artifacts/perf', { recursive: true });
    writeFileSync(`artifacts/perf/ride-perf-${info.project.name}${process.env.OWN_GROUND ? `-ownGround${process.env.OWN_GROUND}` : ''}${process.env.CANAL_ELEVATION ? `-elevation${process.env.CANAL_ELEVATION}` : ''}${process.env.SHARED_FRAME ? `-shared${process.env.SHARED_FRAME}` : ''}${process.env.SHADOWS ? `-shadows${process.env.SHADOWS}` : ''}${process.env.RECIPE_TILES ? `-recipe${process.env.RECIPE_TILES}` : ''}.json`, JSON.stringify(results, null, 2));
    expect(frames.length).toBeGreaterThan(20);
    if (info.project.name === 'desktop' && variant.landmarks === 'default' && !process.env.SHARED_FRAME && !process.env.CANAL_ELEVATION && !process.env.OWN_GROUND && !process.env.RECIPE_TILES) {
      expect(sample.mapRender.median, 'map render median (ms)').toBeLessThanOrEqual(DESKTOP_BUDGET.mapRenderMedianMs);
      expect(sample.mapRender.p95, 'map render p95 (ms)').toBeLessThanOrEqual(DESKTOP_BUDGET.mapRenderP95Ms);
      if (raw.t.labelFrame.length) {
        // Mean, not p95: the occlusion picks run up to 3 ms in a few frames of every plan by design.
        expect(sample.labelFrame.totalMs / Math.max(1, sample.labelFrame.n), 'label overlay mean (ms)').toBeLessThanOrEqual(DESKTOP_BUDGET.labelFrameMeanMs);
        expect(sample.labelFrame.maxMs, 'label overlay worst frame (ms)').toBeLessThanOrEqual(DESKTOP_BUDGET.labelFrameMaxMs);
      }
      expect(sample.frames.over100, 'frames over 100 ms').toBeLessThanOrEqual(DESKTOP_BUDGET.framesOver100);
    }
  });
}

// Motion stutter (2026-10-16, docs/perf-motion-stutter-20261016.md): the rider carried on rails at a
// constant speed through the Jordaan to Kinkerstraat (Noorderkerk -> Westermoskee via Westerstraat, the
// Leliegracht, the Westerkerk, the Prinsengracht, Rozengracht, De Hallen), questions shown but not
// holding the ride; after a 10 s warm-up, 60 s of rAF intervals while tiles, chunks and ground cells
// stream in. Same route and method as scripts/motion-stutter.mjs (which adds the attribution).
// Desktop, no throttle. Before the fixes (3 runs): 4-6 frames over 50 ms a minute, 1-3 over 100 ms,
// longest 333-600 ms. After: see the doc; none over 100 ms, longest under 100 ms.
//   PERF_MOTION=1 PW_PORT=4544 npx playwright test ride-perf --project=desktop -g motion
const MOTION_BUDGET = { longestMs: 200, over100: 1, over50: 4 };
const MOTION_START = 'lm-extract_landmarks_433737872', MOTION_DEST = 'lm-extract_landmarks_1632187034';
const MOTION_VIA = ['lm-extract_landmarks_660242980', 'lm-extract_landmarks_238467800', 'westerkerk', 'lm-extract_landmarks_941219842',
  'lm-extract_landmarks_1997051448', 'lm-extract_landmarks_564717297', 'lm-extract_landmarks_155371643', MOTION_DEST, 'lm-requested-chassekerk'];

test('motion stutter: steady ride through the Jordaan to Kinkerstraat', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop budget; the phone is measured as information with scripts/motion-stutter.mjs');
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  // BUNDLES_DIR=<dir>: serve *.bundle.js from there (e.g. the pre-fix bundles, to see the budget fail).
  const bundles = process.env.BUNDLES_DIR;
  if (bundles) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = join(bundles, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
    return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
  await page.goto('/canal-drive/');
  await page.waitForFunction(([a, b]) => (window as any).canalRecallGame?.routePois?.some((p: any) => p.id === a) && (window as any).canalRecallGame.routePois.some((p: any) => p.id === b), [MOTION_START, MOTION_DEST], { timeout: 90_000 });
  await page.locator('#travel-mode').selectOption('car', { force: true });
  await page.locator('#view-mode').selectOption('chase', { force: true });
  await page.locator('#poi-destination').selectOption(MOTION_DEST);
  await page.evaluate((a) => { const g = (window as any).canalRecallGame; g._pickDestinationNear = () => g.routePois.find((p: any) => p.id === a); }, MOTION_START);
  await page.locator('#route-card').evaluate((f: HTMLFormElement) => f.requestSubmit());
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g.state === 4 && g.camera.introOverview === 0; }, null, { timeout: 120_000 });
  const railPx = await page.evaluate((via) => {
    const g = (window as any).canalRecallGame, p = g.player, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER');
    g._quizFreezesRide = () => false;
    p.handleInput = () => {};
    const world = (lat: number, lng: number) => ({ x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm });
    const stops = [{ x: p.x, y: p.y }, ...via.map((id: string) => g.routePois.find((q: any) => q.id === id)).filter(Boolean).map((q: any) => world(q.lat, q.lng))];
    const path: { x: number; y: number }[] = [];
    for (let k = 1; k < stops.length; k++) { const leg = g.track.findRoute(stops[k - 1], stops[k]); if (leg && leg.length > 1) path.push(...(path.length ? leg.slice(1) : leg)); }
    const cum = [0]; for (let k = 1; k < path.length; k++) cum.push(cum[k - 1] + Math.hypot(path[k].x - path[k - 1].x, path[k].y - path[k - 1].y));
    let at = 0, seg = 1; const v = 120;
    p.update = function (this: any, dt: number) {
      at = Math.min(cum[cum.length - 1], at + v * dt);
      while (seg < path.length - 1 && cum[seg] < at) seg++;
      const a = path[seg - 1], b = path[seg], f = (at - cum[seg - 1]) / Math.max(1e-6, cum[seg] - cum[seg - 1]);
      let d = Math.atan2(b.y - a.y, b.x - a.x) - this.angle; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.x = a.x + (b.x - a.x) * f; this.y = a.y + (b.y - a.y) * f; this.angle += d * Math.min(1, dt * 6);
      this.speed = at < cum[cum.length - 1] ? v : 0; this.vx = Math.cos(this.angle) * this.speed; this.vy = Math.sin(this.angle) * this.speed;
    };
    return cum[cum.length - 1] ?? 0;
  }, MOTION_VIA);
  expect(railPx, 'route on rails (px)').toBeGreaterThan(9000);
  await page.waitForTimeout(10_000);
  await page.evaluate(() => {
    const w = window as any; w.__motion = [];
    let last = performance.now();
    const tick = (now: number) => { w.__motion.push(now - last); last = now; if (!w.__motionStop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(60_000);
  const frames: number[] = await page.evaluate(() => { const w = window as any; w.__motionStop = true; return w.__motion.slice(1); });
  const over = (ms: number) => frames.filter(f => f > ms).length;
  const sample = { project: info.project.name, frames: frames.length, p95: +pick(frames, 0.95).toFixed(1), p99: +pick(frames, 0.99).toFixed(1), over50: over(50), over100: over(100), longestMs: +Math.max(0, ...frames).toFixed(1) };
  console.log(JSON.stringify({ motion: sample }));
  mkdirSync('artifacts/perf', { recursive: true });
  writeFileSync(`artifacts/perf/ride-perf-motion-${info.project.name}.json`, JSON.stringify(sample, null, 2));
  expect(frames.length).toBeGreaterThan(1000);
  expect(sample.longestMs, 'longest frame while riding (ms)').toBeLessThanOrEqual(MOTION_BUDGET.longestMs);
  expect(sample.over100, 'frames over 100 ms in 60 s of riding').toBeLessThanOrEqual(MOTION_BUDGET.over100);
  expect(sample.over50, 'frames over 50 ms in 60 s of riding').toBeLessThanOrEqual(MOTION_BUDGET.over50);
});
