import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Scratch: timeline of who loads/feeds buildings across the intro.
test.skip(!process.env.PERF_INTRO, 'set PERF_INTRO=1');

test('trace intro building work', async ({ page }, info) => {
  test.setTimeout(240_000);
  const cdp = await page.context().newCDPSession(page);
  if (info.project.name === 'iphone') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    const w = window as any;
    w.__canalRecallForceIntro = !(window as any).__noIntro;
    w.__ev = [];
    const ev = (name: string, extra?: unknown, ms?: number) => w.__ev.push({ t: Math.round(performance.now()), name, ms: ms == null ? undefined : Math.round(ms), extra });
    const wrap = (obj: any, method: string, label: string, describe?: (args: any[]) => unknown) => {
      const orig = obj && obj[method];
      if (typeof orig !== 'function' || orig.__wrapped) return;
      const f = function (this: any, ...args: any[]) { const t0 = performance.now(); const r = orig.apply(this, args); ev(label, describe ? describe(args) : undefined, performance.now() - t0); return r; };
      (f as any).__wrapped = true;
      obj[method] = f;
    };
    const poll = () => {
      const g = w.canalRecallGame;
      if (g) {
        wrap(g, '_prepareIntro', 'prepareIntro');
        wrap(g, '_beginIntro', 'beginIntro');
        wrap(g, '_setupRace', 'setupRace');
        const vm = g.vectorMap;
        if (vm) {
          wrap(vm, '_syncThreeBuildings', 'vm.syncThree', a => a[0]?.length);
          wrap(vm, 'setActiveLandmark', 'vm.setActiveLandmark', a => a[0]?.id ?? null);
          wrap(vm, '_syncPyramidalRoofs', 'vm.syncRoofs', a => a[0]?.length);
          const cc = vm._completeCity;
          if (cc) {
            wrap(cc, 'update', 'cc.update', () => `${cc.preloadBounds ? 'preload' : 'camera'} pitch=${vm.map.getPitch().toFixed(0)} z=${vm.map.getZoom().toFixed(1)}`);
            wrap(cc, 'flush', 'cc.flush');
            wrap(cc, 'sendToSource', 'cc.send', a => a[1]?.length);
            wrap(cc, 'fetchTile', 'cc.fetch', a => `${a[0].z}/${a[0].x}/${a[0].y}`);
            wrap(cc, 'setSuspended', 'cc.suspend', a => a[0]);
          }
          const sl = vm._signatureLandmarks;
          if (sl) wrap(sl, '_add', 'sl.add', a => a[1]?.id);
          const it = vm._inventoryTrees;
          if (it) { wrap(it, 'clear', 'trees.clear'); wrap(it, 'rebuild', 'trees.rebuild'); }
          const tb = vm._threeBuildings;
          if (tb) {
            wrap(tb, 'setFeatures', 'tb.setFeatures', a => a[0]?.length);
            wrap(tb, 'rebuild', 'tb.rebuild', a => `${a[0]}:${a[1]?.length}`);
            wrap(tb, 'install', 'tb.install', a => a[0]);
          }
          const map = vm.map;
          if (map && !map.__traced) {
            map.__traced = true;
            map.on('dataloading', (e: any) => { if (e.tile) ev('ml.tileLoading', `${e.sourceId}@${e.tile.tileID?.canonical?.z}`); });
            map.on('data', (e: any) => { if (e.tile && e.sourceDataType !== 'metadata') ev('ml.tileData', `${e.sourceId}@${e.tile.tileID?.canonical?.z}`); });
          }
        }
        if (g._intro && !w.__fs) { w.__fs = 1; ev('FLIGHT_START', { zoom: vm?.map?.getZoom() }); }
        if (w.__fs === 1 && !g._intro) { w.__fs = 2; ev('FLIGHT_END', { zoom: vm?.map?.getZoom() }); }
      }
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
    new PerformanceObserver(list => { for (const e of list.getEntries()) ev('LONG', undefined, e.duration); }).observe({ type: 'longtask', buffered: true });
  });
  if (process.env.NO_INTRO) await page.addInitScript(() => { (window as any).__canalRecallForceIntro = false; });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  const t0 = await page.evaluate(() => performance.now());
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g.state === 4 && !g._intro; }, null, { timeout: 180_000, polling: 100 });
  await page.waitForTimeout(3000);
  const events = await page.evaluate(() => (window as any).__ev);
  // Collapse ml.* events into counts per 250 ms bucket per source.
  const out: string[] = [];
  let bucket: Record<string, number> = {}; let bucketT = -1;
  const flushBucket = () => { if (bucketT >= 0 && Object.keys(bucket).length) out.push(`${bucketT}\tML ${JSON.stringify(bucket)}`); bucket = {}; };
  for (const e of events) {
    const rel = Math.round(e.t - t0);
    if (rel < -2000) continue;
    if (e.name.startsWith('ml.')) {
      const b = Math.floor(rel / 500) * 500;
      if (b !== bucketT) { flushBucket(); bucketT = b; }
      const k = `${e.name.slice(3)}:${e.extra}`; bucket[k] = (bucket[k] ?? 0) + 1;
      continue;
    }
    if (e.name === 'tb.rebuild' || e.name === 'cc.fetch' || e.name === 'tb.install') { out.push(`${rel}\t${e.name} ${e.extra ?? ''} ${e.ms ?? ''}`); continue; }
    out.push(`${rel}\t${e.name} ${e.extra === undefined ? '' : JSON.stringify(e.extra)} ${e.ms ?? ''}ms`);
  }
  flushBucket();
  mkdirSync('artifacts/intro-flat', { recursive: true });
  writeFileSync(`artifacts/intro-flat/trace-${info.project.name}-${process.env.TRACE_TAG || 'x'}.txt`, out.join('\n'));
});
