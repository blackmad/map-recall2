// Throwaway measurement: landmark render cost at overview / mid / street zoom.
//   PERF_LOD=1 LOD_LABEL=baseline PW_PORT=4448 npx playwright test landmark-lod-perf --project=iphone
import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

test.skip(!process.env.PERF_LOD, 'set PERF_LOD=1');
const label = process.env.LOD_LABEL || 'run';
const pick = (v: number[], q: number) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0; };
const summary = (v: number[]) => ({ n: v.length, median: +pick(v, 0.5).toFixed(2), p95: +pick(v, 0.95).toFixed(2), mean: +(v.reduce((a, b) => a + b, 0) / Math.max(1, v.length)).toFixed(2) });
const STATES: Record<string, { center: [number, number]; zoom: number; pitch: number; bearing: number }> = {
  overview: { center: [4.9, 52.37], zoom: 11.2, pitch: 0, bearing: 0 },
  mid: { center: [4.8932, 52.3731], zoom: 14.8, pitch: 45, bearing: 20 },
  street: { center: [4.8924, 52.3722], zoom: 17.6, pitch: 62, bearing: 100 },
};
const CAM = ['jumpTo', 'easeTo', 'flyTo', 'setCenter', 'setZoom', 'setBearing', 'setPitch'];

test(`landmark lod ${label}`, async ({ page }, info) => {
  test.setTimeout(900_000);
  await openRoute(page, { travelMode: 'car', abortHeavyTiles: false, enterRacing: false, query: '?streetChunks=0' });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 }).catch(() => {});
  // Freeze the game camera so the map stays where the test puts it.
  await page.evaluate((cam) => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap, map = vm.map;
    for (const k of cam) { map['__' + k] = map[k]; map[k] = () => map; }
    vm._signatureLandmarks.setSuspended?.(false);
  }, CAM);
  const cdp = await page.context().newCDPSession(page);
  const results: Record<string, unknown> = {};
  for (const [name, cam] of Object.entries(STATES)) {
    await page.evaluate((c) => {
      const map = (window as any).canalRecallGame.vectorMap.map;
      map.__jumpTo.call(map, { center: c.center, zoom: c.zoom, pitch: c.pitch, bearing: c.bearing });
    }, cam);
    const t0 = Date.now();
    let last = -1, stable = 0;
    while (Date.now() - t0 < 200_000 && stable < 6) {
      await page.waitForTimeout(2000);
      const n = await page.evaluate(() => { const l = (window as any).canalRecallGame.vectorMap._signatureLandmarks; return l._entries.length * 1000 + l._pending.size; });
      stable = n === last ? stable + 1 : 0; last = n;
    }
    await page.screenshot({ path: `artifacts/landmark-lod/${label}-${name}-${info.project.name}.png` });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: info.project.name === 'iphone' ? 4 : 1 });
    await page.evaluate(() => {
      const w = window as any, vm = w.canalRecallGame.vectorMap, map = vm.map, THREE = w.CanalRecallThree.THREE;
      const t: Record<string, number[]> = { frame: [], mapRender: [], landmarkRender: [], rendererTri: [] };
      w.__perf = t; w.__stopFrames = false;
      const wrap = (obj: any, key: string, bucket: string) => { const o = obj[key].bind(obj); const orig = obj[key]; obj[key] = (...a: unknown[]) => { const s = performance.now(); try { return o(...a); } finally { t[bucket].push(performance.now() - s); } }; return () => { obj[key] = orig; }; };
      w.__unwrap = [wrap(map, '_render', 'mapRender')];
      w.__unwrap.push(wrap(vm._signatureLandmarks.layer, 'render', 'landmarkRender'));
      let frameTri = 0; const proto = THREE.WebGLRenderer.prototype, origR = proto.render;
      proto.render = function (...a: unknown[]) { const r = origR.apply(this, a); frameTri += this.info.render.triangles; return r; };
      w.__unwrap.push(() => { proto.render = origR; });
      let last = performance.now();
      const tick = (now: number) => { t.frame.push(now - last); last = now; t.rendererTri.push(frameTri); frameTri = 0; if (!w.__stopFrames) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      const rep = () => { if (!w.__stopFrames) { map.triggerRepaint(); requestAnimationFrame(rep); } }; rep();
    });
    await page.waitForTimeout(8000);
    const raw = await page.evaluate(() => {
      const w = window as any; w.__stopFrames = true; w.__unwrap.forEach((f: () => void) => f());
      const l = w.canalRecallGame.vectorMap._signatureLandmarks, mem = (performance as any).memory;
      let drawnTri = 0, drawn = 0, gpuBytes = 0;
      const lodCounts: Record<string, number> = {};
      for (const e of l._entries) {
        if (!l._nearby(e.spec, e.placement.anchor)) continue;
        drawn++;
        lodCounts[e.level || 'full'] = (lodCounts[e.level || 'full'] || 0) + 1;
        e.group.traverse((c: any) => {
          if (!c.isMesh) return; const g = c.geometry;
          drawnTri += (g.index ? g.index.count : g.attributes.position.count) / 3;
          for (const a of Object.values(g.attributes) as any[]) gpuBytes += a.array.byteLength;
          if (g.index) gpuBytes += g.index.array.byteLength;
        });
      }
      const rt = w.__perf.rendererTri.slice(5);
      return { t: w.__perf, entries: l._entries.length, drawn, drawnTri: Math.round(drawnTri), gpuMB: +(gpuBytes / 1048576).toFixed(1), lodCounts, heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null, rendererTri: Math.round(rt.reduce((a: number, b: number) => a + b, 0) / Math.max(1, rt.length)) };
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const frames = raw.t.frame.slice(5);
    results[name] = { frames: { ...summary(frames), over50: frames.filter((f: number) => f > 50).length, over100: frames.filter((f: number) => f > 100).length },
      mapRender: summary(raw.t.mapRender), landmarkRender: summary(raw.t.landmarkRender), entries: raw.entries, drawn: raw.drawn, drawnTriangles: raw.drawnTri,
      meanRendererTrianglesPerFrameAllLayers: raw.rendererTri, landmarkGeometryMB: raw.gpuMB, lodCounts: raw.lodCounts, heapMB: raw.heapMB };
    console.log('lod-perf', label, name, JSON.stringify(results[name]));
  }
  mkdirSync('artifacts/landmark-lod', { recursive: true });
  writeFileSync(`artifacts/landmark-lod/perf-${label}-${info.project.name}.json`, JSON.stringify(results, null, 1));
});
