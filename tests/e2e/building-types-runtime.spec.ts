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
  // 2026-10-11 type-1 extension areas: 4-storey brick (Hegelhof/Herderhof) and re-clad 5-storey (Wildeman/Notweg).
  'slotermeer-street': { center: [4.8125, 52.3759], zoom: 17.8, pitch: 62, bearing: 85 },
  'slotermeer-close': { center: [4.81548466, 52.3757425], zoom: 19.2, pitch: 60, bearing: 85 },
  'wildeman-street': { center: [4.7985, 52.3643], zoom: 17.8, pitch: 62, bearing: 252 },
  'wildeman-close': { center: [4.79715, 52.3639873], zoom: 19.2, pitch: 60, bearing: 252 },
  // 2026-10-11 sub-designs (types/nw-subtypes-20261011): A Osdorper Ban / Hooge Venne, B Nieuwenhuysenstraat, C John Lockehof, D Clauskindereweg.
  'osdorper-ban-street': { center: [4.8005, 52.3616], zoom: 17.8, pitch: 62, bearing: 252 },
  'osdorper-ban-close': { center: [4.80057427, 52.36157675], zoom: 19.2, pitch: 60, bearing: 251.6 },
  'nieuwenhuysen-street': { center: [4.8211, 52.3825], zoom: 17.8, pitch: 62, bearing: 284 },
  'nieuwenhuysen-close': { center: [4.82106495, 52.3825187], zoom: 19.2, pitch: 60, bearing: 284.4 },
  'lockehof-street': { center: [4.8112, 52.3768], zoom: 17.8, pitch: 62, bearing: 270 },
  'lockehof-close': { center: [4.8110033, 52.37716495], zoom: 19.2, pitch: 60, bearing: 265.1 },
  'clauskinderen-street': { center: [4.7932, 52.3584], zoom: 17.8, pitch: 62, bearing: 252 },
  'clauskinderen-close': { center: [4.79319306, 52.35836115], zoom: 19.2, pitch: 60, bearing: 251.6 },
};
const ONLY = process.env.BT_VIEWS?.split(',');
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
    if (ONLY && !ONLY.includes(name)) continue;
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
      const w = window as any, vm = w.canalRecallGame.vectorMap, map = vm.map;
      const t: Record<string, number[]> = { frame: [], landmarkRender: [], rendererTri: [], rendererCalls: [], renderCalls: [] };
      w.__perf = t; w.__stopFrames = false;
      const layer = vm._signatureLandmarks.layer, orig = layer.render;
      // three.js defines WebGLRenderer.render as an instance property (not on the prototype), and the layer's renderer
      // is private, so renderer.info is unreachable and a prototype patch never fires. Count the GL draws instead:
      // every draw issued while the landmark layer's render() is on the stack (all landmark and building-type meshes,
      // instanced draws multiplied by their instance count).
      let tri = 0, calls = 0, renders = 0, inLayer = false;
      const protos = [WebGLRenderingContext.prototype, (window as any).WebGL2RenderingContext?.prototype].filter(Boolean) as any[];
      const restore: (() => void)[] = [];
      const per = (mode: number, n: number) => (mode === 4 ? n / 3 : mode === 5 || mode === 6 ? Math.max(0, n - 2) : 0);
      for (const gp of protos) for (const [fn, instanced] of [['drawElements', false], ['drawArrays', false], ['drawElementsInstanced', true], ['drawArraysInstanced', true], ['drawRangeElements', false]] as const) {
        const o = gp[fn]; if (!o) continue;
        gp[fn] = function (this: any, ...a: number[]) {
          if (inLayer) { calls++; const count = fn === 'drawElements' ? a[1] : fn === 'drawArrays' ? a[2] : fn === 'drawRangeElements' ? a[3] : fn === 'drawElementsInstanced' ? a[1] : a[2]; tri += per(a[0], count) * (instanced ? (fn === 'drawElementsInstanced' ? a[4] : a[3]) : 1); }
          return o.apply(this, a);
        };
        restore.push(() => { gp[fn] = o; });
      }
      layer.render = (...a: unknown[]) => { const s = performance.now(); inLayer = true; renders++; try { return orig.apply(layer, a); } finally { inLayer = false; t.landmarkRender.push(performance.now() - s); } };
      w.__unwrap = [() => { layer.render = orig; }, ...restore];
      let prev = performance.now();
      const tick = (now: number) => { t.frame.push(now - prev); prev = now; t.rendererTri.push(tri); t.rendererCalls.push(calls); t.renderCalls.push(renders); tri = 0; calls = 0; renders = 0; if (!w.__stopFrames) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      const rep = () => { if (!w.__stopFrames) { map.triggerRepaint(); requestAnimationFrame(rep); } }; rep();
    });
    await page.waitForTimeout(8000);
    const raw = await page.evaluate(() => {
      const w = window as any; w.__stopFrames = true; w.__unwrap.forEach((f: () => void) => f());
      const l = w.canalRecallGame.vectorMap._signatureLandmarks;
      const areas = Object.fromEntries(Object.entries(w.__canalRecallBuildingTypes ?? {}).map(([k, v]: [string, any]) => [k, v.stats()]));
      const skip = 5, mean = (v: number[]) => Math.round(v.slice(skip).reduce((a, b) => a + b, 0) / Math.max(1, v.length - skip));
      return { t: w.__perf, entries: l._entries.map((e: any) => e.spec.id).filter((id: string) => id.startsWith('building-types')), suppressed: l.shownSuppressOsmIds().length, areas, tri: mean(w.__perf.rendererTri), calls: mean(w.__perf.rendererCalls), renders: mean(w.__perf.renderCalls) };
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const frames = raw.t.frame.slice(5);
    results[name] = { frames: summary(frames), landmarkRender: summary(raw.t.landmarkRender.slice(5)), meanLandmarkLayerTrianglesPerFrame: raw.tri, meanLandmarkLayerDrawCallsPerFrame: raw.calls, meanLandmarkLayerRendersPerFrame: raw.renders, typeEntries: raw.entries, suppressedPands: raw.suppressed, areas: raw.areas };
    console.log('building-types', label, name, JSON.stringify(results[name]));
  }
  writeFileSync(`artifacts/building-types/perf-${label}-${info.project.name}.json`, JSON.stringify({ results, errors }, null, 1));
  console.log('errors', JSON.stringify(errors.slice(0, 5)));
});
