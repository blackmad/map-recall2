import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
test.skip(!process.env.PERF_RIDE, 'set PERF_RIDE=1 to measure');

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
    const t: Record<string, number[]> = { frame: [], mapRender: [], landmarkRender: [], threeLayers: [], moveend: [], move: [], labelFrame: [] };
    w.__perf = t;
    const wrap = (obj: any, key: string, bucket: string) => {
      const original = obj[key].bind(obj);
      obj[key] = (...args: unknown[]) => { const s = performance.now(); try { return original(...args); } finally { t[bucket].push(performance.now() - s); } };
    };
    wrap(map, '_render', 'mapRender');
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
    test.setTimeout(300_000);
    // CANAL_ELEVATION=1|0 forces the opt-in elevation layer on or off (docs/elevation.md).
    if (process.env.CANAL_ELEVATION) await page.addInitScript((on: boolean) => { (window as any).__canalRecallElevation = on; }, process.env.CANAL_ELEVATION === '1');
    // SHARED_FRAME=1|0 forces the shared three.js frame (rendererShared/) on or off; SHADOWS=0 drops its sun shadows.
    if (process.env.SHARED_FRAME) await page.addInitScript((on: boolean) => { (window as any).__canalRecallSharedFrame = on; }, process.env.SHARED_FRAME === '1');
    if (process.env.SHADOWS) await page.addInitScript((on: boolean) => { (window as any).__canalRecallShadows = on; }, process.env.SHADOWS === '1');
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
      landmarksShown: raw.shown, heapMB: raw.heapMB, threeBuildings: raw.three, hot,
    };
    results.push(sample);
    console.log(JSON.stringify(sample));
    mkdirSync('artifacts/perf', { recursive: true });
    writeFileSync(`artifacts/perf/ride-perf-${info.project.name}${process.env.CANAL_ELEVATION ? `-elevation${process.env.CANAL_ELEVATION}` : ''}${process.env.SHARED_FRAME ? `-shared${process.env.SHARED_FRAME}` : ''}${process.env.SHADOWS ? `-shadows${process.env.SHADOWS}` : ''}.json`, JSON.stringify(results, null, 2));
    expect(frames.length).toBeGreaterThan(20);
    if (info.project.name === 'desktop' && variant.landmarks === 'default' && !process.env.SHARED_FRAME && !process.env.CANAL_ELEVATION) {
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
