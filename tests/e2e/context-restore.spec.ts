import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// GPU loss and regain (2026-10-24, lane-perf-phones item 2). MapLibre answers a restored WebGL context by rebuilding
// its style from a serialised copy, which drops custom layers: until this the shared three.js frame (ground, trees,
// facades, landmarks, the rider) stayed blank until a reload. The frame now re-adds its layers once the restored
// style loads and lets each participant rebuild what it freed after upload (sharedFrame.ts onContextRestored).
// Runs on both projects: on the iphone project ground cells free their arrays, so they are rebuilt by the worker.

test('the 3D layer draws again after the WebGL context is lost and restored', async ({ page }) => {
  test.setTimeout(240_000);
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
  console.log(JSON.stringify({ project: test.info().project.name, drawnMs, groundCells: after.groundCells }));
});
