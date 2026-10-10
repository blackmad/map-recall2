// Building types runtime (`?buildingTypes=1`): in-game shots and perf, flag on vs off.
//   BT_RUN=1 BT=1 PW_PORT=4458 npx playwright test building-types-runtime --project=iphone
//   BT_RUN=1 BT=0 ...   (flag off: the default game)
// Writes artifacts/building-types/<label>-<view>-<project>.png and perf-<label>-<project>.json.
import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

test.skip(!process.env.BT_RUN, 'set BT_RUN=1');
const on = process.env.BT !== '0';
const label = on ? 'types' : 'default';
const pick = (v: number[], q: number) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0; };
const summary = (v: number[]) => ({ n: v.length, median: +pick(v, 0.5).toFixed(2), p95: +pick(v, 0.95).toFixed(2), mean: +(v.reduce((a, b) => a + b, 0) / Math.max(1, v.length)).toFixed(2) });
const VIEWS: Record<string, { center: [number, number]; zoom: number; pitch: number; bearing: number }> = {
  'sonderbuur-street': { center: [4.7991, 52.3641], zoom: 17.8, pitch: 62, bearing: 250 },
  'sonderbuur-close': { center: [4.79931801, 52.3639055], zoom: 19.2, pitch: 60, bearing: 72 },
  'comenius-street': { center: [4.8267, 52.3587], zoom: 17.8, pitch: 62, bearing: 270 },
  'comenius-close': { center: [4.82968457, 52.35906528], zoom: 19.2, pitch: 60, bearing: 269 },
};
const CAM = ['jumpTo', 'easeTo', 'flyTo', 'setCenter', 'setZoom', 'setBearing', 'setPitch'];

test(`building types ${label}`, async ({ page }, info) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || /Building types|unavailable/.test(m.text())) errors.push(m.text()); });
  await openRoute(page, { travelMode: 'car', abortHeavyTiles: false, enterRacing: false, query: on ? '?buildingTypes=1' : '' });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 }).catch(() => {});
  await page.evaluate((cam) => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap, map = vm.map;
    for (const k of cam) { map['__' + k] = map[k]; map[k] = () => map; }
    vm._signatureLandmarks.setSuspended?.(false);
  }, CAM);
  const cdp = await page.context().newCDPSession(page);
  const results: Record<string, unknown> = {};
  mkdirSync('artifacts/building-types', { recursive: true });
  for (const [name, cam] of Object.entries(VIEWS)) {
    await page.evaluate((c) => {
      const map = (window as any).canalRecallGame.vectorMap.map;
      map.__jumpTo.call(map, { center: c.center, zoom: c.zoom, pitch: c.pitch, bearing: c.bearing });
    }, cam);
    const t0 = Date.now();
    let last = -1, stable = 0;
    while (Date.now() - t0 < 120_000 && stable < 4) {
      await page.waitForTimeout(2000);
      const n = await page.evaluate(() => { const l = (window as any).canalRecallGame.vectorMap._signatureLandmarks; return l._entries.length * 1000 + l._pending.size; });
      stable = n === last ? stable + 1 : 0; last = n;
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `artifacts/building-types/${label}-${name}-${info.project.name}.png` });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: info.project.name === 'iphone' ? 4 : 1 });
    await page.evaluate(() => {
      const w = window as any, vm = w.canalRecallGame.vectorMap, map = vm.map, THREE = w.CanalRecallThree.THREE;
      const t: Record<string, number[]> = { frame: [], landmarkRender: [], rendererTri: [], rendererCalls: [] };
      w.__perf = t; w.__stopFrames = false;
      const layer = vm._signatureLandmarks.layer, orig = layer.render;
      layer.render = (...a: unknown[]) => { const s = performance.now(); try { return orig.apply(layer, a); } finally { t.landmarkRender.push(performance.now() - s); } };
      let tri = 0, calls = 0; const proto = THREE.WebGLRenderer.prototype, origR = proto.render;
      proto.render = function (...a: unknown[]) { const r = origR.apply(this, a); tri += this.info.render.triangles; calls += this.info.render.calls; return r; };
      w.__unwrap = [() => { layer.render = orig; }, () => { proto.render = origR; }];
      let prev = performance.now();
      const tick = (now: number) => { t.frame.push(now - prev); prev = now; t.rendererTri.push(tri); t.rendererCalls.push(calls); tri = 0; calls = 0; if (!w.__stopFrames) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      const rep = () => { if (!w.__stopFrames) { map.triggerRepaint(); requestAnimationFrame(rep); } }; rep();
    });
    await page.waitForTimeout(8000);
    const raw = await page.evaluate(() => {
      const w = window as any; w.__stopFrames = true; w.__unwrap.forEach((f: () => void) => f());
      const l = w.canalRecallGame.vectorMap._signatureLandmarks;
      const areas = Object.fromEntries(Object.entries(w.__canalRecallBuildingTypes ?? {}).map(([k, v]: [string, any]) => [k, v.stats()]));
      const skip = 5, mean = (v: number[]) => Math.round(v.slice(skip).reduce((a, b) => a + b, 0) / Math.max(1, v.length - skip));
      return { t: w.__perf, entries: l._entries.map((e: any) => e.spec.id).filter((id: string) => id.startsWith('building-types')), suppressed: l.shownSuppressOsmIds().length, areas, tri: mean(w.__perf.rendererTri), calls: mean(w.__perf.rendererCalls) };
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const frames = raw.t.frame.slice(5);
    results[name] = { frames: summary(frames), landmarkRender: summary(raw.t.landmarkRender.slice(5)), meanTrianglesPerFrameAllThreeRenders: raw.tri, meanDrawCallsPerFrameAllThreeRenders: raw.calls, typeEntries: raw.entries, suppressedPands: raw.suppressed, areas: raw.areas };
    console.log('building-types', label, name, JSON.stringify(results[name]));
  }
  writeFileSync(`artifacts/building-types/perf-${label}-${info.project.name}.json`, JSON.stringify({ results, errors }, null, 1));
  console.log('errors', JSON.stringify(errors.slice(0, 5)));
});
