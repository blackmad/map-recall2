import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openRoute } from './helpers';

// Recipe tiles (`?recipeTiles=1`, docs/buildings-pipeline.md "Recipe tiles"): flag on vs off at the pilot spots,
// with the look-consistency camera and pixel method, plus per-spot draw calls, triangles and frame time.
//
//   node --import tsx scripts/building-tiles/compile-recipes.ts --stage=all          # staging data
//   npx esbuild src/canalRecall/tileBuildings/browser.ts --bundle --format=iife --global-name=CanalRecallTileBuildings \
//     --outfile=artifacts/recipe-tiles-bundles/tile-buildings.bundle.js --minify    # until the integrator publishes it
//   PW_OFFLINE_MAP=1 PW_PORT=4439 npx playwright test recipe-tiles --project=desktop
//   node scripts/compare-look-shots.mjs artifacts/recipe-tiles-e2e/off artifacts/recipe-tiles-e2e/on --diff-out=artifacts/recipe-tiles-e2e/diff
//
// RECIPE_TILES_DIR serves staging data at /canal-drive/recipe-tiles/ (default artifacts/recipe-tiles); RECIPE_BUNDLES_DIR
// serves bundles found there (default artifacts/recipe-tiles-bundles). RT_MODES picks the runs (label:query,...).
const OUT = process.env.RT_OUT || 'artifacts/recipe-tiles-e2e';
const DATA = process.env.RECIPE_TILES_DIR || 'artifacts/recipe-tiles';
const BUNDLES = process.env.RECIPE_BUNDLES_DIR || 'artifacts/recipe-tiles-bundles';
const MODES = (process.env.RT_MODES || 'off:?sharedFrame=1&cityLook=1&buildingTypes=0,on:?sharedFrame=1&cityLook=1&recipeTiles=1,types:?sharedFrame=1&cityLook=1')
  .split(',').map(s => { const i = s.indexOf(':'); return { label: s.slice(0, i), query: s.slice(i + 1) }; });
const PERF_MS = Number(process.env.RT_PERF_MS || 6000);

type View = { name: string; target: [number, number]; bearing: number; distM: number; altM: number; targetAltM: number };
const VIEWS: View[] = [
  // Bilderdijkstraat block faces (the look-consistency view) and the face run north of it.
  { name: 'bilderdijk', target: [4.87195, 52.36720], bearing: 110, distM: 120, altM: 40, targetAltM: 8 },
  { name: 'bilderdijk-north', target: [4.87100, 52.36850], bearing: 290, distM: 110, altM: 35, targetAltM: 8 },
  // Nieuw-West building types (Sonderbuur) and Slotermeer.
  { name: 'nieuw-west', target: [4.7991, 52.3641], bearing: 250, distM: 180, altM: 60, targetAltM: 6 },
  { name: 'slotermeer', target: [4.8125, 52.3759], bearing: 85, distM: 180, altM: 60, targetAltM: 6 },
  // Landmarks as kind glb: Dam (Palace, Nieuwe Kerk, Monument, Magna Plaza), Westerkerk + Anne Frank, Rijksmuseum.
  { name: 'dam', target: [4.89260, 52.37300], bearing: 250, distM: 170, altM: 60, targetAltM: 12 },
  { name: 'westerkerk', target: [4.88390, 52.37450], bearing: 200, distM: 140, altM: 45, targetAltM: 15 },
  { name: 'rijksmuseum', target: [4.88520, 52.36000], bearing: 200, distM: 220, altM: 70, targetAltM: 12 },
  // Large recipes: police station Van Leijenberghlaan, Leidsestraat 67.
  { name: 'politie-leijenbergh', target: [4.8799828, 52.3311922], bearing: 30, distM: 110, altM: 40, targetAltM: 8 },
  { name: 'leidsestraat-67', target: [4.8853524, 52.3651691], bearing: 160, distM: 90, altM: 30, targetAltM: 8 },
];
const ONLY = process.env.RT_VIEWS?.split(',');

const ahead = ([lng, lat]: number[], bearingDeg: number, metres: number): [number, number] => {
  const r = bearingDeg * Math.PI / 180;
  return [lng + Math.sin(r) * metres / (111320 * Math.cos(lat * Math.PI / 180)), lat + Math.cos(r) * metres / 111320];
};

async function quiet(page: Page): Promise<void> {
  await page.evaluate(() => {
    const map = (window as any).canalRecallGame.vectorMap.map;
    for (const layer of map.getStyle().layers) if (layer.type === 'symbol' && map.getLayoutProperty(layer.id, 'visibility') !== 'none') map.setLayoutProperty(layer.id, 'visibility', 'none');
    const canvas = map.getCanvas() as HTMLCanvasElement;
    for (const e of Array.from(document.body.querySelectorAll('*'))) if (e !== canvas && !e.contains(canvas)) (e as HTMLElement).style.visibility = 'hidden';
  });
}

async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const w = window as any, vm = w.canalRecallGame.vectorMap, t = vm._threeBuildings, l = vm._signatureLandmarks, r = vm._tileBuildings;
    const c = vm.map.getCenter(); vm.map.jumpTo({ center: [c.lng + 1e-9, c.lat] });
    const idle = !t || (t.ready && !t.pending.length && !t.inflight.size);
    const landmarksIdle = !l || !l._pending || !l._pending.size;
    const rs = r?.stats();
    const tilesIdle = !rs || (!rs.loading && rs.ready === rs.tiles.length);
    const key = `${t?.stats?.().buildings ?? 0}|${t?.chunks?.size ?? 0}|${l?.shown?.size ?? 0}|${rs?.ready ?? -1}|${rs?.tiles.join() ?? ''}`;
    w.__rtIdle = idle && landmarksIdle && tilesIdle && key === w.__rtKey ? (w.__rtIdle || 0) + 1 : 0;
    w.__rtKey = key;
    return w.__rtIdle >= 5;
  }, null, { timeout: 180_000, polling: 1000 });
  await page.evaluate(() => { const w = window as any; w.canalRecallGame.vectorMap.map.jumpTo(w.__rtCamera); });
  await page.waitForTimeout(4000);
}

/** Draw calls and triangles inside the shared frame's main pass, whole-page draws, frame time, resident counts. */
async function measure(page: Page, ms: number) {
  await page.evaluate(() => {
    const w = window as any, vm = w.canalRecallGame.vectorMap, map = vm.map, f = vm._sharedFrame;
    const t: Record<string, number[]> = { frame: [], frameCalls: [], frameTri: [], allCalls: [], mainMs: [] };
    w.__rtPerf = t; w.__rtStop = false;
    let tri = 0, calls = 0, all = 0, inMain = false;
    const per = (mode: number, n: number) => (mode === 4 ? n / 3 : mode === 5 || mode === 6 ? Math.max(0, n - 2) : 0);
    const protos = [WebGLRenderingContext.prototype, (window as any).WebGL2RenderingContext?.prototype].filter(Boolean) as any[];
    const restore: (() => void)[] = [];
    for (const gp of protos) for (const fn of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) {
      const o = gp[fn]; if (!o) continue;
      gp[fn] = function (this: any, ...a: number[]) {
        all++;
        if (inMain) {
          calls++;
          const count = fn === 'drawElements' ? a[1] : fn === 'drawArrays' ? a[2] : fn === 'drawRangeElements' ? a[3] : fn === 'drawElementsInstanced' ? a[1] : a[2];
          tri += per(a[0], count) * (fn === 'drawElementsInstanced' ? a[4] : fn === 'drawArraysInstanced' ? a[3] : 1);
        }
        return o.apply(this, a);
      };
      restore.push(() => { gp[fn] = o; });
    }
    const layer = f?.mainLayer, orig = layer?.render;
    if (layer) layer.render = (...a: unknown[]) => { const s = performance.now(); inMain = true; try { return orig.apply(layer, a); } finally { inMain = false; t.mainMs.push(performance.now() - s); } };
    w.__rtUnwrap = [() => { if (layer) layer.render = orig; }, ...restore];
    let prev = performance.now();
    const tick = (now: number) => { t.frame.push(now - prev); prev = now; t.frameCalls.push(calls); t.frameTri.push(tri); t.allCalls.push(all); tri = 0; calls = 0; all = 0; if (!w.__rtStop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const rep = () => { if (!w.__rtStop) { map.triggerRepaint(); requestAnimationFrame(rep); } }; rep();
  });
  await page.waitForTimeout(ms);
  return page.evaluate(() => {
    const w = window as any; w.__rtStop = true; w.__rtUnwrap.forEach((f: () => void) => f());
    const vm = w.canalRecallGame.vectorMap, f = vm._sharedFrame, t = w.__rtPerf;
    const pick = (v: number[], q: number) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0; };
    const sum = (v: number[]) => ({ n: v.length, mean: +(v.reduce((a, b) => a + b, 0) / Math.max(1, v.length)).toFixed(2), median: +pick(v, 0.5).toFixed(2), p95: +pick(v, 0.95).toFixed(2) });
    const skip = (v: number[]) => v.slice(5);
    // Resident and drawn-this-frame counts per participant.
    const participants: Record<string, { meshes: number; triangles: number }> = {};
    for (const e of f?.registry.all() ?? []) {
      let meshes = 0, triangles = 0;
      e.participant.participant.root.traverseVisible((o: any) => {
        if (!o.isMesh || !o.geometry) return;
        const g = o.geometry, n = (g.index?.count ?? g.getAttribute('position')?.count ?? 0) / 3;
        meshes++; triangles += n * (o.isInstancedMesh ? o.count : 1);
      });
      participants[e.id] = { meshes, triangles: Math.round(triangles) };
    }
    const sl = vm._signatureLandmarks;
    return {
      frame: sum(skip(t.frame)), mainPassMs: sum(skip(t.mainMs)), mainPassDrawCalls: sum(skip(t.frameCalls)), mainPassTriangles: sum(skip(t.frameTri)), pageDrawCalls: sum(skip(t.allCalls)),
      participants, recipeTiles: vm._tileBuildings?.stats() ?? null,
      landmarksDrawn: (sl?._entries ?? []).filter((e: any) => e.holder?.visible).map((e: any) => e.spec.id).sort(),
      heapMB: (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1048576) : null,
    };
  });
}

for (const mode of MODES) test(`recipe tiles: ${mode.label}`, async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop' && !process.env.RT_ALL_PROJECTS, 'desktop first; RT_ALL_PROJECTS=1 for the iPhone run');
  test.skip(mode.query.includes('recipeTiles=1') && !existsSync(join(DATA, 'index.json')), `no staging data in ${DATA} (compile-recipes.ts --stage=all)`);
  test.setTimeout(900_000);
  const dir = join(OUT, info.project.name === 'desktop' ? mode.label : `${mode.label}-${info.project.name}`);
  mkdirSync(dir, { recursive: true });
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1280, height: 800 });
  const errors: string[] = [], bundleRequests: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (/Recipe tile|recipe tiles/i.test(m.text())) errors.push(m.text()); });
  page.on('request', r => { if (/tile-buildings\.bundle|\/recipe-tiles\//.test(r.url())) bundleRequests.push(r.url()); });
  await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = join(BUNDLES, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
    return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  await page.route(/\/canal-drive\/recipe-tiles\/([^?]*)/, route => {
    const file = join(DATA, /\/canal-drive\/recipe-tiles\/([^?]*)/.exec(route.request().url())![1]);
    return existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404, body: '' });
  });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: false, query: mode.query });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  const on = mode.query.includes('recipeTiles=1');
  const results: Record<string, unknown> = {};
  for (const view of VIEWS) {
    if (ONLY && !ONLY.includes(view.name)) continue;
    const eye = ahead(view.target, view.bearing, view.distM);
    await page.evaluate(({ eye, view }) => {
      const g = (window as any).canalRecallGame, vm = g.vectorMap, map = vm.map;
      g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {}; (window as any).__rtIdle = 0;
      g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
      vm.sync = () => {}; map.stop(); map.setMaxPitch(85); map.setVerticalFieldOfView(50); map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      (window as any).__rtCamera = map.calculateCameraOptionsFromTo({ lng: eye[0], lat: eye[1] }, view.altM, { lng: view.target[0], lat: view.target[1] }, view.targetAltM);
      map.jumpTo((window as any).__rtCamera);
    }, { eye, view });
    await settle(page);
    await quiet(page);
    await page.waitForTimeout(1500);
    await page.locator('canvas.maplibregl-canvas').first().screenshot({ path: join(dir, `${view.name}.png`) });
    const perf = await measure(page, PERF_MS);
    let pick: unknown = null;
    if (on) {
      // Picking through the game's own inspector on a 16x10 grid: how many points resolve to a recipe-tile pand.
      pick = await page.evaluate(() => {
        const vm = (window as any).canalRecallGame.vectorMap, rect = vm.map.getCanvas().getBoundingClientRect(), pands = new Set<string>();
        let hits = 0, tileHits = 0;
        for (let i = 0; i < 16; i++) for (let j = 0; j < 10; j++) {
          const r = vm.inspectBuilding((i + 0.5) * rect.width / 16, (j + 0.5) * rect.height / 10, rect);
          if (!r) continue;
          hits++;
          if (r.recipeTile) { tileHits++; pands.add(r.id); }
        }
        return { points: 160, hits, tileHits, pands: [...pands].slice(0, 8), distinctPands: pands.size };
      });
      const rs = perf.recipeTiles as any;
      expect(rs, `${view.name}: tile stats`).toBeTruthy();
      expect(rs.ready, `${view.name}: a near tile is drawn`).toBeGreaterThan(0);
      expect(rs.errors, `${view.name}: no tile errors`).toEqual([]);
    }
    results[view.name] = { ...perf, pick };
    console.log('recipe-tiles', mode.label, view.name, JSON.stringify({ frame: perf.frame, mainPassMs: perf.mainPassMs, calls: perf.mainPassDrawCalls, tri: perf.mainPassTriangles, participants: perf.participants, pick }));
  }
  if (on) {
    // Replaced specs are withheld from the landmark loader while their tile is drawn.
    const leak = await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap, sl = vm._signatureLandmarks;
      return (sl?._entries ?? []).filter((e: any) => e.holder?.visible && !sl.canShowModel(e.spec)).map((e: any) => e.spec.id);
    });
    expect(leak).toEqual([]);
  } else {
    // Flag off: nothing of the near tier is fetched or created.
    expect(bundleRequests).toEqual([]);
    expect(await page.evaluate(() => !!(window as any).canalRecallGame.vectorMap._tileBuildings)).toBe(false);
  }
  writeFileSync(join(dir, 'results.json'), JSON.stringify({ query: mode.query, project: info.project.name, results, errors: errors.slice(0, 20) }, null, 1));
  expect(errors.filter(e => !/progress is local only/.test(e))).toEqual([]);
});
