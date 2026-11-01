import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { openRoute } from './helpers';

// The GL program budget lives in one place (tests/perf/budgets.json, read by scripts/perf-gate.mjs too).
const BUDGETS = JSON.parse(readFileSync('tests/perf/budgets.json', 'utf8')).entries;
const PROGRAMS_BUDGET: number = BUDGETS.programs.value;
const PARITY_PX: number = BUDGETS.cameraParityPx.value;

// Engine programme P1 (docs/handoffs/lane-engine-host-20261030.md): `?engine=own`
// is the second world view. Three.js owns the canvas; MapLibre is never
// constructed. Needs the engine bundle in index.html and the game.js choice
// (integrator lines in the lane hand-back).

/** The maplibre-gl script and stylesheet (unpkg, or a self-hosted copy). */
const MAPLIBRE_ASSET = /maplibre-gl(@[\d.]+)?\/dist\/maplibre-gl(-csp)?\.(js|css)|\/maplibre-gl(-csp)?\.(js|css)(\?|$)/;

test('the default path still loads maplibre-gl (script and stylesheet) and builds its map', async ({ page }) => {
  test.setTimeout(120_000);
  const requests: string[] = [];
  page.on('request', r => { if (MAPLIBRE_ASSET.test(r.url())) requests.push(r.url()); });
  test.skip(process.env.ENGINE === 'own', 'the default path only');
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => !!(window as any).canalRecallGame?.vectorMap?.map), { timeout: 90_000 }).toBe(true);
  expect(requests.some(u => /\.js(\?|$)/.test(u)), 'maplibre-gl.js requested').toBe(true);
  expect(requests.some(u => /\.css(\?|$)/.test(u)), 'maplibre-gl.css requested').toBe(true);
  expect(await page.evaluate(() => ({ lib: typeof (window as any).maplibregl, engine: (window as any).canalRecallGame.vectorMap.engine ?? 'maplibre' })))
    .toEqual({ lib: 'object', engine: 'maplibre' });
});

async function countMapLibre(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as any).__maplibreMaps = 0;
    let lib: any;
    Object.defineProperty(window, 'maplibregl', {
      configurable: true,
      get: () => lib,
      set: (value) => {
        lib = value;
        const Map = value.Map;
        value.Map = function (...args: unknown[]) { (window as any).__maplibreMaps++; return new Map(...args); };
        value.Map.prototype = Map.prototype;
      },
    });
  });
}

/**
 * Hold forward for `ms`, as a player would. Street following (the default) stops where there is no straight on until a
 * side is chosen (streetFollow.ts); the iPhone spawn stands across Polonceaukade, so that rider stood still (moved
 * 0.002) and the iPhone numbers were of a parked frame. Choosing a side there goes: since the T-junction tap fix (#136)
 * a single tap commits the turn as a hold does (street-follow-tap.spec.ts); holding it here is just as good.
 */
/**
 * Installed facade chunk meshes with geometry that are attached and not hidden (threeBuildingsBrowser.ts `chunks`).
 * Ancestors are not checked: the shared frame toggles its participant wrappers per pass.
 */
/** Share of the facades resident 3 s into a standing start that the first racing frame must already show. */
const FIRST_FRAME_SHARE = 0.7;

function facadeMeshCount(): number {
  const tb = (window as any).canalRecallGame?.vectorMap?._threeBuildings;
  let count = 0;
  for (const chunk of tb?.chunks?.values?.() ?? []) {
    if (chunk.mesh?.parent && chunk.mesh.visible !== false && chunk.info?.vertexCount > 0) count++;
  }
  return count;
}

/**
 * Hold forward for at least `ms`, then on until the rider is `untilMovedPx` from the track start (simulated
 * distance, not wall clock) or `ceilingMs` runs out. Under load (two lock slots, load 7-15) a 6 s wall-clock ride
 * covered 33-45 px against 506-1437 px unloaded, and "the rider rode" failed with nothing wrong (#129, 2026-11-01).
 */
async function ride(page: Page, ms: number, untilMovedPx = 0, ceilingMs = 60_000): Promise<number> {
  await page.keyboard.down('ArrowUp');
  const start = Date.now();
  let moved = 0;
  while (true) {
    const p = await page.evaluate(() => {
      const g = (window as any).canalRecallGame, p = g.player;
      return { w: !!p?.streetFollowView?.awaitingChoice, q: p?.streetFollowView?.queuedTurn ?? 0, v: p.speed, moved: Math.hypot(p.x - g.track.startPoint?.x || 0, p.y - g.track.startPoint?.y || 0) };
    });
    moved = p.moved;
    const elapsed = Date.now() - start;
    if (elapsed >= ms && (moved >= untilMovedPx || elapsed >= ceilingMs)) break;
    if (p.w || (p.q && Math.abs(p.v) < 1)) { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1200); await page.keyboard.up('ArrowRight'); }
    await page.waitForTimeout(250);
  }
  await page.keyboard.up('ArrowUp');
  return moved;
}

// 2026-11-01 (#129, hand-back 14): with the overview built in the worker pool the boot drew 468 fewer Math.random
// values (three's geometry ids) before the route card, the seeded surprise ride drew Micropia -> Artis (45 m apart)
// and stopped at "Start and finish are too close": the desktop ride never started. The picker now re-draws a
// neighbour (routeSelection.ts SURPRISE_MIN_PAIR_KM); this pins the seeded desktop ride with the pooled overview.
test('?engine=own: the overview is built in the worker pool and the seeded ride starts', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the desktop seed was the one that drew the neighbour');
  test.setTimeout(150_000);
  await openRoute(page, { query: '?engine=own', viewMode: 'chase' });
  const state = await page.evaluate(() => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap;
    return { engine: vm.engine, built: vm.status?.overviewBuilt, overview: !!vm._overview, from: g.routeFrom?.name, to: g.routeTo?.name };
  });
  console.log('overview pool', JSON.stringify(state));
  expect(state.engine).toBe('own');
  expect(state.overview, 'the overview layer is up').toBe(true);
  expect(state.built, 'the overview geometry came from the pool worker').toBe('pool');
});

test('?engine=own rides with three.js owning the frame; maplibregl.Map is never constructed', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  // P5 B1 (engine/mapLibreLoader.ts): under the flag maplibre-gl is not even fetched.
  const mapLibreRequests: string[] = [];
  page.on('request', r => { if (MAPLIBRE_ASSET.test(r.url())) mapLibreRequests.push(r.url()); });
  await countMapLibre(page);
  // BUNDLES_DIR=<dir>: serve *.bundle.js from a local build (a lane's source change before the integrator rebuilds).
  const bundles = process.env.BUNDLES_DIR;
  if (bundles) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = `${bundles}/${/\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]}`;
    return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  // The first racing frame must already have facades round the rider (#129 decision b, the deployed f840fb6 probe:
  // only the station and two blocks drew when racing began). Counted on the frame the game itself enters racing, so
  // the route opens without forcing the state and waits for the loading hold to end.
  await page.addInitScript(() => {
    const w = window as any;
    const watch = () => {
      const g = w.canalRecallGame;
      if (g?.state === 4) {
        const tb = g.vectorMap?._threeBuildings;
        let count = 0;
        for (const chunk of tb?.chunks?.values?.() ?? []) if (chunk.mesh?.parent && chunk.mesh.visible !== false && chunk.info?.vertexCount > 0) count++;
        w.__facadesAtRacing = { count, ready: !!tb?.ready, settle: g._lastMapSettle ?? null };
        return;
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  await openRoute(page, { query: '?engine=own', viewMode: 'chase', enterRacing: false });
  await expect.poll(() => page.evaluate(() => (window as any).__facadesAtRacing ?? null), { timeout: 90_000, message: 'the game enters racing' }).not.toBeNull();
  const atRacing = await page.evaluate(() => (window as any).__facadesAtRacing);
  console.log('facades at the first racing frame', JSON.stringify(atRacing));
  expect(atRacing.ready, 'the facade atlas is bound when racing begins').toBe(true);
  expect(atRacing.count, 'facade chunk meshes are visible in the first racing frame').toBeGreaterThan(0);
  // Not a token few: standing still, the set 3 s later is what the spawn view holds.
  await page.waitForTimeout(3000);
  const settledCount = await page.evaluate(facadeMeshCount);
  console.log('facades 3 s after racing began', settledCount);
  expect(atRacing.count, `facades at the first racing frame (${atRacing.count}) against 3 s later (${settledCount})`).toBeGreaterThanOrEqual(Math.ceil(settledCount * FIRST_FRAME_SHARE));
  const view = await page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap;
    return { engine: vm.engine, hasCamera: typeof vm.camera?.project === 'function', canvas: !!vm.frameCanvas?.() };
  });
  expect(view).toEqual({ engine: 'own', hasCamera: true, canvas: true });
  // Ride: hold forward for a few seconds and until the rider is well past the 50 px check below (load-independent).
  console.log('ride', await ride(page, 6000, 150));
  await expect.poll(() => page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap;
    return !!vm.status.booted && !!vm._ownGround?.ready;
  }), { timeout: 60_000 }).toBe(true);
  // Facades must actually draw (#129 P0): every facade chunk program once failed to compile under ?engine=own (a
  // Material.clone dropped the city-look defines) while this spec reported facades:true and failed:[] for four hours.
  // Facade chunk meshes installed and visible, and no program three.js could not compile or link.
  await expect.poll(() => page.evaluate(facadeMeshCount), { timeout: 60_000, message: 'facade chunk meshes are installed and visible' }).toBeGreaterThan(0);
  await page.waitForTimeout(2000);
  const stats = await page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap;
    const r = vm.host.renderer;
    const game = (window as any).canalRecallGame;
    return {
      maplibreMaps: (window as any).__maplibreMaps,
      frames: vm.host.stats.frames,
      calls: vm._sharedFrame.stats.main.calls + vm._sharedFrame.stats.overlay.calls,
      programs: r.info.programs.length,
      failed: vm.status.failed ?? [],
      zoom: vm.camera.zoom(), pitch: vm.camera.pitch(),
      water: vm.status.overview,
      moved: Math.hypot(game.player.x - game.track.startPoint?.x || 0, game.player.y - game.track.startPoint?.y || 0),
      heapMB: Math.round(((performance as any).memory?.usedJSHeapSize ?? 0) / 1e5) / 10,
      facades: !!vm._threeBuildings?.ready,
      shaderErrors: (window as any).__canalPerf?.shaderErrors?.() ?? null,
      hoodLines: vm._lines.hoods.lineCount, cycleLines: vm._lines.cycle.lineCount,
      labels: vm._labels.placed.map((l: any) => l.text),
      asked: [game.quizPromptName, game.quizCandidateName].filter(Boolean),
      // The participants that make the ride like-for-like with MapLibre's (engine/cityExtras.ts).
      landmarks: vm._signatureLandmarks ? vm._signatureLandmarks.describe().length : null,
      trees: vm._inventoryTrees ? { ready: !!vm._inventoryTrees.ready, enabled: !!vm._inventoryTrees.enabled, draws: vm._inventoryTrees.debugDraws ?? 0 } : null,
      roofs: !!vm._pyramidalRoofs, artis: !!vm._artisAnimals,
    };
  });
  console.log('engine=own', JSON.stringify(stats));
  await page.screenshot({ path: test.info().outputPath('engine-own-chase.png') });
  expect(stats.maplibreMaps).toBe(0);
  expect(mapLibreRequests, 'no maplibre-gl request under ?engine=own').toEqual([]);
  expect(await page.evaluate(() => typeof (window as any).maplibregl)).toBe('undefined');
  expect(stats.frames).toBeGreaterThan(30);
  expect(stats.moved, 'the rider rode (not a parked frame)').toBeGreaterThan(50);
  expect(stats.failed).toEqual([]);
  expect(stats.shaderErrors, 'no shader program failed to compile or link (__canalPerf.shaderErrors, sharedFrame.ts)').toBe(0);
  expect(await page.evaluate(facadeMeshCount), 'facade chunk meshes still visible after the ride').toBeGreaterThan(0);
  expect(stats.landmarks).not.toBeNull();
  expect(stats.trees).not.toBeNull();
  expect(stats.roofs).toBe(true);
  expect(stats.calls).toBeLessThanOrEqual(700);
  expect(stats.programs).toBeLessThanOrEqual(PROGRAMS_BUDGET);
  expect(errors).toEqual([]);
  // Spoiler rule: the name under question is never on the map.
  for (const name of stats.asked) expect(stats.labels.map((t: string) => t.toLowerCase())).not.toContain(String(name).toLowerCase());
  // With every name earned (labels on, every street learned), the asked one still is not drawn.
  const allEarned = await page.evaluate(() => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap;
    vm.setLabelsVisible(true);
    for (const s of g.track.segments) if (s.name) g._mapLabelNames.add(s.name);
    // The game's own question if it has one, else the first named street of the route.
    g.quizPromptName = g.quizPromptName || g.quizCandidateName || g.track.segments.find((s: any) => s.name)?.name;
    // Places whose other name is the asked one ("New Market" is nl:Nieuwmarkt) must stay quiet too.
    const asked = String(g.quizPromptName).toLowerCase();
    const aliasOf = (vm.placePois as any[]).filter(p => (p.aliases || []).some((a: string) => a.toLowerCase() === asked)).map(p => p.text);
    return new Promise<{ asked: string; labels: string[]; aliasOf: string[] }>(r => vm.camera.onFrame(() => r({ asked: g.quizPromptName, aliasOf, labels: vm._labels.placed.map((l: any) => l.text) })));
  });
  console.log('labels with every name earned', allEarned.labels.length, JSON.stringify(allEarned.labels.slice(0, 12)));
  expect(allEarned.labels).not.toContain(allEarned.asked);
  for (const other of allEarned.aliasOf) expect(allEarned.labels).not.toContain(other);
});

// The parity oracle: at MapLibre's own cameras (the start flight and a chase ride), the engine camera
// (engine/cameraMap.ts EngineCamera) projects the same ground points to within the budget (tests/perf/budgets.json cameraParityPx).
// Under `?engine=own` itself: engine-parity.spec.ts.
test('engine camera matches MapLibre within the parity budget along the intro and a ride', async ({ page }) => {
  test.skip(process.env.ENGINE === 'own', 'the oracle is MapLibre: run without ENGINE=own');
  test.setTimeout(180_000);
  await openRoute(page, { viewMode: 'chase', enterRacing: false });
  const samples: number[][] = [];
  const sample = () => page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap;
    const map = vm.map ?? vm.cameraMap, E = (window as any).CanalRecallEngine;
    const el = map.getCanvas();
    const c = map.getCenter();
    const cam = new E.EngineCamera(() => ({ width: el.clientWidth, height: el.clientHeight }), {
      center: [c.lng, c.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), maxPitch: 85,
      elevation: map.transform.elevation ?? 0,
    });
    // What MapLibre draws: its view-projection matrix lifts the camera by the centre elevation, which `map.project`
    // (`_pixelMatrix`) leaves out (engine-parity.spec.ts); off by ~5 px on the iPhone ride's deck.
    const T = map.transform, vp = T._viewProjMatrix ?? T.currentTransform?._viewProjMatrix, ws = T.worldSize;
    const MC = (window as any).maplibregl.MercatorCoordinate;
    const drawn = (lng: number, lat: number) => {
      const q = MC.fromLngLat([lng, lat], 0), X = q.x * ws, Y = q.y * ws;
      const cx = vp[0] * X + vp[4] * Y + vp[12], cy = vp[1] * X + vp[5] * Y + vp[13], cw = vp[3] * X + vp[7] * Y + vp[15];
      return { x: (cx / cw + 1) / 2 * el.clientWidth, y: (1 - cy / cw) / 2 * el.clientHeight };
    };
    const out: number[] = [];
    for (const [fx, fy] of [[0.5, 0.5], [0.2, 0.8], [0.8, 0.8], [0.5, 0.95], [0.3, 0.6], [0.7, 0.55]]) {
      const ll = map.unproject([fx * el.clientWidth, fy * el.clientHeight]);
      const a = drawn(ll.lng, ll.lat), b = cam.project([ll.lng, ll.lat]);
      if (b.depth > 0) out.push(Math.hypot(a.x - b.x, a.y - b.y));
    }
    return [map.getZoom(), map.getPitch(), Math.max(...out)];
  });
  await page.evaluate(() => { (window as any).canalRecallGame.state = 4; });
  for (let i = 0; i < 12; i++) { samples.push(await sample()); await page.waitForTimeout(400); }
  await page.keyboard.down('ArrowUp');
  for (let i = 0; i < 10; i++) { samples.push(await sample()); await page.waitForTimeout(400); }
  await page.keyboard.up('ArrowUp');
  console.log('parity (zoom, pitch, max px):', JSON.stringify(samples.map(s => s.map(v => Math.round(v * 100) / 100))));
  expect(Math.max(...samples.map(s => s[2]))).toBeLessThanOrEqual(PARITY_PX);
});
