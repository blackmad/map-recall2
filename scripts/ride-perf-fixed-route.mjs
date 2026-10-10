// Fixed-route ride frame cost for A/B of render flags (method of ride-perf.spec.ts /
// facade-trees-perf.spec.ts; route fixed as in review-city-performance.mjs).
//   PORT=4402 node scripts/ride-perf-fixed-route.mjs <label> "<query>" [touch|desktop] [seconds]
// e.g. "?sharedFrame=1" vs "". Same route every run (Anne Frank Huis -> Rijksmuseum),
// iPhone 13 with 4x CPU throttle for touch; appends to artifacts/shared-frame/perf/ride.jsonl.
import {chromium, devices} from 'playwright';
import fs from 'node:fs';
const [label = 'x', qs = '', device = 'touch', secs = '12'] = process.argv.slice(2);
const browser = await chromium.launch({headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page = await browser.newPage(device === 'touch' ? devices['iPhone 13'] : {viewport: {width: 1440, height: 900}});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(() => { let s = 0x5eed1234; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; });
await page.goto(`http://127.0.0.1:${process.env.PORT || 4402}/canal-drive/` + qs);
await page.waitForFunction(() => window.canalRecallGame?.routePois?.length, null, {timeout: 60000});
await page.locator('#travel-mode').selectOption('car', {force: true}); await page.locator('#view-mode').selectOption('chase', {force: true});
await page.waitForFunction(() => canalRecallGame.routePois.some(p => p.id === 'anne-frank') && canalRecallGame.routePois.some(p => p.id === 'rijksmuseum'));
await page.locator('#poi-destination').selectOption('rijksmuseum');
await page.evaluate(() => { const g = canalRecallGame; g._pickDestinationNear = () => g.routePois.find(p => p.id === 'anne-frank'); });
await page.locator('#route-card').evaluate(f => f.requestSubmit());
await page.waitForFunction(() => canalRecallGame.player?.x && canalRecallGame.state === 4 && canalRecallGame.camera.introOverview === 0, null, {timeout: 180000});
await page.waitForFunction(() => { const t = canalRecallGame.vectorMap._threeBuildings; return t?.ready && t.chunks.size && !t.pending.length && !t.inflight.size; }, null, {timeout: 180000});
await page.waitForTimeout(6000);
const start = await page.evaluate(() => ({x: canalRecallGame.player.x, y: canalRecallGame.player.y, center: canalRecallGame.vectorMap.map.getCenter().toArray()}));
const cdp = await page.context().newCDPSession(page);
const throttle = device === 'touch' ? 4 : 1;
await cdp.send('Emulation.setCPUThrottlingRate', {rate: throttle});
await page.evaluate(() => {
  const w = window, vm = canalRecallGame.vectorMap, map = vm.map;
  const t = w.__perf = {frame: [], mapRender: [], threeLayers: [], calls: [], redraws0: vm._sharedFrame?.shadowRedraws ?? null};
  const wrap = (obj, key, bucket) => { const o = obj[key].bind(obj); obj[key] = (...a) => { const s = performance.now(); try { return o(...a); } finally { t[bucket].push(performance.now() - s); } }; };
  wrap(map, '_render', 'mapRender');
  const own = vm._sharedFrame ? [vm._sharedFrame.mainLayer, vm._sharedFrame.overlayLayer]
    : [vm._threeBuildings?.layer, vm._signatureLandmarks?.layer, vm._inventoryTrees?.layer, vm._artisAnimals?.layer, vm._pyramidalRoofs?.layer, vm._playerBike?.layer, vm._playerFerry?.layer, vm._playerBoat?.layer, vm._playerTransit?.layer];
  for (const l of own) if (l?.render && map.getLayer(l.id)) wrap(l, 'render', 'threeLayers');
  // WebGL draw calls per frame (all of MapLibre + ours).
  const gl = map.painter.context.gl; let calls = 0;
  for (const fn of ['drawArrays', 'drawElements', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) { const o = gl[fn]?.bind(gl); if (o) gl[fn] = (...a) => { calls++; return o(...a); }; }
  map.on('render', () => { t.calls.push(calls); calls = 0; });
  if (vm._sharedFrame) {
    const f = vm._sharedFrame; t.sigChanges = {}; t.boxMoves = 0;
    const sig = f.casterSignature.bind(f); let lastParts = null;
    f.casterSignature = (d) => { const out = sig(d); const parts = out.split(';'); if (lastParts) parts.forEach((p, i) => { if (p !== lastParts[i]) { const k = d[i]?.wrapper?.name || i; t.sigChanges[k] = (t.sigChanges[k] || 0) + 1; } }); lastParts = parts; return out; };
    const follow = f.rig.follow.bind(f.rig); let lastT = '';
    f.rig.follow = (...a) => { const fit = follow(...a); const k = fit.targetAbs.map(v => v.toFixed(2)).join(','); if (k !== lastT) t.boxMoves++; lastT = k; return fit; };
  }
  let last = performance.now();
  const tick = now => { t.frame.push(now - last); last = now; if (!w.__stop) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(Number(secs) * 1000);
await page.keyboard.up('ArrowUp');
const raw = await page.evaluate(() => { window.__stop = true; const m = performance.memory; return {redraws: canalRecallGame.vectorMap._sharedFrame ? canalRecallGame.vectorMap._sharedFrame.shadowRedraws - window.__perf.redraws0 : null, t: window.__perf, heapMB: m ? Math.round(m.usedJSHeapSize / 1048576) : null, end: {x: canalRecallGame.player.x, y: canalRecallGame.player.y}}; });
await cdp.send('Emulation.setCPUThrottlingRate', {rate: 1});
const pick = (v, q) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0; };
const sum = v => v.reduce((a, b) => a + b, 0);
const summ = v => ({n: v.length, median: +pick(v, .5).toFixed(2), p95: +pick(v, .95).toFixed(2), mean: +(sum(v) / Math.max(1, v.length)).toFixed(2)});
const frames = raw.t.frame.slice(5);
// threeLayers: the shared frame makes 2 calls per frame and the legacy path up to 9; report per-frame totals.
const perFrameThree = raw.t.mapRender.length ? sum(raw.t.threeLayers) / raw.t.mapRender.length : 0;
const result = {label, device, throttle, qs, frames: {...summ(frames), p99: +pick(frames, .99).toFixed(2), over50: frames.filter(f => f > 50).length, over100: frames.filter(f => f > 100).length},
  mapRender: summ(raw.t.mapRender), threeLayersPerFrameMs: +perFrameThree.toFixed(2), drawCalls: summ(raw.t.calls.slice(5)), heapMB: raw.heapMB, shadowRedraws: raw.redraws, sigChanges: raw.t.sigChanges, boxMoves: raw.t.boxMoves, start: {x: Math.round(start.x), y: Math.round(start.y)}, end: {x: Math.round(raw.end.x), y: Math.round(raw.end.y)}, errors: errors.length};
console.log(JSON.stringify(result));
fs.mkdirSync('artifacts/shared-frame/perf', {recursive: true});
fs.appendFileSync('artifacts/shared-frame/perf/ride.jsonl', JSON.stringify(result) + '\n');
await browser.close();
