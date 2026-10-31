import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openRoute } from './helpers';

// The GL program budget lives in one place (tests/perf/budgets.json, read by scripts/perf-gate.mjs too).
const BUDGETS = JSON.parse(readFileSync('tests/perf/budgets.json', 'utf8')).entries;
const PROGRAMS_BUDGET: number = BUDGETS.programs.value;
const PARITY_PX: number = BUDGETS.cameraParityPx.value;

// Engine programme P1 (docs/handoffs/lane-engine-host-20261030.md): `?engine=own`
// is the second world view. Three.js owns the canvas; MapLibre is never
// constructed. Needs the engine bundle in index.html and the game.js choice
// (integrator lines in the lane hand-back).

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

test('?engine=own rides with three.js owning the frame; maplibregl.Map is never constructed', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await countMapLibre(page);
  await openRoute(page, { query: '?engine=own', viewMode: 'chase' });
  const view = await page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap;
    return { engine: vm.engine, hasCamera: typeof vm.camera?.project === 'function', canvas: !!vm.frameCanvas?.() };
  });
  expect(view).toEqual({ engine: 'own', hasCamera: true, canvas: true });
  // Ride: hold forward for a few seconds.
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(6000);
  await page.keyboard.up('ArrowUp');
  await expect.poll(() => page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap;
    return !!vm.status.booted && !!vm._ownGround?.ready;
  }), { timeout: 60_000 }).toBe(true);
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
      facades: !!vm._threeBuildings?.ready,
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
  expect(stats.frames).toBeGreaterThan(30);
  expect(stats.failed).toEqual([]);
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
    const map = vm.map, E = (window as any).CanalRecallEngine;
    const el = map.getCanvas();
    const c = map.getCenter();
    const cam = new E.EngineCamera(() => ({ width: el.clientWidth, height: el.clientHeight }), {
      center: [c.lng, c.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), maxPitch: 85,
      elevation: map.transform.elevation ?? 0,
    });
    const out: number[] = [];
    for (const [fx, fy] of [[0.5, 0.5], [0.2, 0.8], [0.8, 0.8], [0.5, 0.95], [0.3, 0.6], [0.7, 0.55]]) {
      const ll = map.unproject([fx * el.clientWidth, fy * el.clientHeight]);
      const a = map.project(ll), b = cam.project([ll.lng, ll.lat]);
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
