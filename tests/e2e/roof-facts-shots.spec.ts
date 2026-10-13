// Measured roofs (roof-facts, PDOK orthophoto): before/after aerial shots and frame cost.
//   ROOF_RUN=1 ROOF=0 PW_PORT=4456 npx playwright test roof-facts-shots --project=desktop   (before: ?roofFacts=0)
//   ROOF_RUN=1 ROOF=1 PW_PORT=4456 npx playwright test roof-facts-shots --project=desktop   (after)
// ROOF_BUNDLES=<dir> serves *.bundle.js from there (measure source before the integrator rebuilds bundles).
// Writes artifacts/roofs/shots/<label>-<view>-<project>.png and perf-<label>-<project>.json.
import { test } from '@playwright/test';
import fs, { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { openRoute } from './helpers';

test.skip(!process.env.ROOF_RUN, 'set ROOF_RUN=1');
const on = process.env.ROOF !== '0';
const label = on ? 'after' : 'before';
const pick = (v: number[], q: number) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0; };
const summary = (v: number[]) => ({ n: v.length, median: +pick(v, 0.5).toFixed(2), p95: +pick(v, 0.95).toFixed(2), mean: +(v.reduce((a, b) => a + b, 0) / Math.max(1, v.length)).toFixed(2) });
const VIEWS: Record<string, { center: [number, number]; zoom: number; pitch: number; bearing: number }> = {
  // The user's viewpoint (2026-10-13): ~200 m over the Kinkerbuurt, looking north-east over Ten Katestraat.
  'kinkerbuurt-200m': { center: [4.8712, 52.3668], zoom: 17.2, pitch: 58, bearing: 45 },
  'dam': { center: [4.8926, 52.3731], zoom: 17.2, pitch: 55, bearing: 330 },
  'nieuw-west': { center: [4.8105, 52.3628], zoom: 17.0, pitch: 55, bearing: 20 },
  'canal-belt-100m': { center: [4.8868, 52.3688], zoom: 18.2, pitch: 55, bearing: 200 },
};
const ONLY = process.env.ROOF_VIEWS?.split(',');
const CAM = ['jumpTo', 'easeTo', 'flyTo', 'setCenter', 'setZoom', 'setBearing', 'setPitch'];

test(`roof facts ${label}`, async ({ page }, info) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  if (process.env.ROOF_BUNDLES) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = path.join(process.env.ROOF_BUNDLES!, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
    return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  await openRoute(page, { travelMode: 'car', abortHeavyTiles: true, enterRacing: false, query: on ? '' : '?roofFacts=0' });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 }).catch(() => {});
  await page.evaluate((cam) => {
    const map = (window as any).canalRecallGame.vectorMap.map;
    for (const k of cam) { map['__' + k] = map[k]; map[k] = () => map; }
  }, CAM);
  const cdp = await page.context().newCDPSession(page);
  const results: Record<string, unknown> = {};
  const out = 'artifacts/roofs/shots';
  mkdirSync(out, { recursive: true });
  for (const [name, cam] of Object.entries(VIEWS)) {
    if (ONLY && !ONLY.includes(name)) continue;
    await page.evaluate((c) => { const map = (window as any).canalRecallGame.vectorMap.map; map.__jumpTo.call(map, { center: c.center, zoom: c.zoom, pitch: c.pitch, bearing: c.bearing }); }, cam);
    await page.waitForFunction(() => { const t = (window as any).canalRecallGame.vectorMap._threeBuildings; return t?.ready && t.chunks.size && !t.pending.length && !t.inflight.size; }, null, { timeout: 180_000 }).catch(() => {});
    await page.waitForTimeout(5000);
    await page.waitForFunction(() => { const t = (window as any).canalRecallGame.vectorMap._threeBuildings; return !t.pending.length && !t.inflight.size; }, null, { timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/${label}-${name}-${info.project.name}.png` });
    const stamped = await page.evaluate(() => {
      const t = (window as any).canalRecallGame.vectorMap._threeBuildings, feats = t.lastFeatures ?? [];
      return { features: feats.length, slots: feats.filter((f: any) => f.properties.roofSlot).length, furniture: feats.filter((f: any) => f.properties.roofFurniture).length, chunks: t.chunks.size };
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: info.project.name === 'iphone' ? 4 : 1 });
    await page.evaluate(() => {
      const w = window as any, vm = w.canalRecallGame.vectorMap, map = vm.map, t: number[] = [], layerMs: number[] = [];
      w.__frames = t; w.__layer = layerMs; w.__stop = false;
      // The building layer's own CPU cost per frame (its render() call), where the roof work lands.
      const layer = vm._threeBuildings.layer, orig = layer.render;
      layer.render = (...a: unknown[]) => { const s = performance.now(); try { return orig.apply(layer, a); } finally { layerMs.push(performance.now() - s); } };
      w.__unwrap = () => { layer.render = orig; };
      let prev = performance.now();
      const tick = (now: number) => { t.push(now - prev); prev = now; if (!w.__stop) { map.triggerRepaint(); requestAnimationFrame(tick); } };
      requestAnimationFrame(tick);
    });
    await page.waitForTimeout(8000);
    const [frames, layerMs, stats] = await page.evaluate(() => { const w = window as any; w.__stop = true; w.__unwrap(); const s = w.canalRecallGame.vectorMap._threeBuildings.stats?.() ?? null; return [w.__frames.slice(5), w.__layer.slice(5), s]; });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    results[name] = { frames: summary(frames), buildingLayerMs: summary(layerMs), stamped, stats };
  }
  writeFileSync(`${out}/perf-${label}-${info.project.name}.json`, JSON.stringify({ label, project: info.project.name, results, errors: errors.slice(0, 20) }, null, 1));
});
