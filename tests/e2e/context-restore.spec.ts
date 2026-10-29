import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// GPU loss and regain (2026-10-24, lane-perf-phones item 2). MapLibre answers a restored WebGL context by rebuilding
// its style from a serialised copy, which drops custom layers: until this the shared three.js frame (ground, trees,
// facades, landmarks, the rider) stayed blank until a reload. The frame now re-adds its layers once the restored
// style loads and lets each participant rebuild what it freed after upload (sharedFrame.ts onContextRestored).
// Runs on both projects: on the iphone project ground cells free their arrays, so they are rebuilt by the worker.

test('the 3D layer draws again after the WebGL context is lost and restored', async ({ page }) => {
  test.setTimeout(240_000);
  // While the context is lost MapLibre has no style (map.style null): frame work that touched
  // getLayer/getSource threw (Sentry CANAL-RECALL-A/-8/-4/-B, Android 10).
  const styleless: string[] = [];
  const styleError = /reading '(getLayer|getSource|layers)'|this\.style\.getLayer/;
  page.on('pageerror', error => { if (styleError.test(error.message)) styleless.push(error.message); });
  page.on('console', message => { if (styleError.test(message.text())) styleless.push(message.text()); });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', playerTimeoutMs: 120_000 });
  await page.waitForFunction(() => (window as any).canalRecallGame?.state === 4, null, { timeout: 120_000 });
  await page.evaluate(() => { (window as any).canalRecallGame.maxAsksPerMinute = 0; });
  const state = () => page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap, frame = vm._sharedFrame;
    vm.map.triggerRepaint();
    const visible = (id: string) => !!frame?.registry.all().find((e: any) => e.id === id)?.participant.wrapper.visible;
    const ground = vm._ownGround?.status?.();
    return {
      renderer: !!frame?.renderer,
      context: frame?.contextEvents,
      mainFrames: frame?.stats.main.frames ?? 0,
      overlayCalls: frame?.stats.overlay.calls ?? 0,
      bike: visible('player-bike-3d'),
      groundCells: ground ? Object.keys(ground.cells).length : 0,
      // Resident cells cover the rider, so the basemap's ground under them is hidden (gameGround coversRider).
      groundDrawn: !!ground?.visible && !!ground?.basemapHidden,
    };
  });
  await expect.poll(async () => (await state()).groundCells, { timeout: 60_000 }).toBeGreaterThan(0);
  const before = await state();
  expect(before.renderer).toBe(true);

  await page.evaluate(() => {
    const gl = (window as any).canalRecallGame.vectorMap.map.painter.context.gl;
    (window as any).__loseContext = gl.getExtension('WEBGL_lose_context');
    (window as any).__loseContext.loseContext();
  });
  await expect.poll(async () => (await state()).renderer, { timeout: 5_000 }).toBe(false);
  // Keep riding without a context for a moment, as a phone whose GPU process was killed does.
  await page.waitForTimeout(1_500);
  await page.evaluate(() => (window as any).__loseContext.restoreContext());

  // The brief's bar: the 3D layer draws again within 5 s of the restore.
  const restoredAt = Date.now();
  await expect.poll(async () => {
    const s = await state();
    return s.renderer && s.bike && s.mainFrames > before.mainFrames && s.overlayCalls > 0;
  }, { timeout: 5_000, intervals: [250] }).toBe(true);
  const drawnMs = Date.now() - restoredAt;
  // Ground cells come back from the worker on phones (their arrays were freed), immediately on desktop.
  await expect.poll(async () => { const s = await state(); return s.groundCells > 0 && s.groundDrawn; }, { timeout: 30_000 }).toBe(true);
  const after = await state();
  expect(after.context).toEqual({ lost: 1, restored: 1 });
  expect(styleless).toEqual([]);
  // Map-side work deferred while the style was gone ran once the restored style loaded.
  await expect.poll(() => page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap;
    return [vm._suppressionStale, vm._detailedLayersStale, vm._modelShownStale].some(Boolean);
  }), { timeout: 10_000 }).toBe(false);
  console.log(JSON.stringify({ project: test.info().project.name, drawnMs, groundCells: after.groundCells }));
});

// #109 (#106 follow-up 3): MapLibre's restore resizes the map, and `resize()` fires `moveend`. The building streamer
// followed every moveend, so on the untouched briefing, where nothing had aimed it yet, a restore planned the style's
// Damrak default and 67-183 k facade triangles drew that had not drawn before the loss. A restore now leaves the
// briefing's resident set as it was (buildingTilesBrowser.ts, `aimed`).
test('a context restore on the briefing streams no buildings the briefing had not', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/canal-drive/');
  await page.waitForFunction(() => (window as any).canalRecallGame?.vectorMap?._sharedFrame?.renderer && (window as any).canalRecallGame?.vectorMap?._completeCity, null, { timeout: 90_000 });
  await page.waitForTimeout(3000);
  const resident = () => page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap;
    return { state: (window as any).canalRecallGame.state, tiles: vm._completeCity.cache.size, features: vm._tileFeatures.length, facadeChunks: vm._threeBuildings?.chunks?.size ?? 0 };
  });
  const before = await resident();
  expect(before.state).toBe(0);
  await page.evaluate(() => new Promise<void>(resolve => {
    const gl = (window as any).canalRecallGame.vectorMap.map.painter.context.gl, ext = gl.getExtension('WEBGL_lose_context');
    ext.loseContext();
    setTimeout(() => { ext.restoreContext(); resolve(); }, 173);
  }));
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap._sharedFrame.contextEvents.restored), { timeout: 5_000 }).toBe(1);
  await page.waitForTimeout(3000);
  expect(await resident()).toEqual(before);
});
