import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// Render on change under ?engine=own (#129): the frame host draws only when something asked for a repaint (a camera
// move, an install, a fade), not every animation frame the simulation runs. Standing still, the world is not
// redrawn, the still frame is pixel-identical to a forced redraw, and input wakes the renderer at once.
//
//   PW_PORT=4523 npx playwright test render-on-change --project=desktop

test('standing still draws nothing, the still frame equals a redraw, and riding off draws at once', async ({ page }) => {
  test.setTimeout(240_000);
  await openRoute(page, { query: '?engine=own', viewMode: 'chase' });
  expect(await page.evaluate(() => (window as any).canalRecallGame.vectorMap.engine)).toBe('own');
  await page.evaluate(() => { const p = (window as any).canalRecallGame.player; Object.assign(p, { speed: 0, vx: 0, vy: 0 }); });
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.pendingWork().length), { timeout: 120_000, intervals: [500] }).toBe(0);
  // Fades and late installs finish; then two quiet seconds draw nothing while the simulation keeps running.
  // On failure the poll's last value names who kept asking for repaints (the first app frames of each caller).
  await expect.poll(() => page.evaluate(async () => {
    const host = (window as any).canalRecallGame.vectorMap.host, a = { ...host.stats }, callers: Record<string, number> = {};
    const own = host.triggerRepaint;
    host.triggerRepaint = function (...args: unknown[]) {
      const k = (new Error().stack ?? '').split('\n').slice(2, 4).map(l => l.trim().replace(/\(.*\//, '(').replace(/\?[^:)]*/, '')).join(' < ');
      callers[k] = (callers[k] ?? 0) + 1;
      return own.apply(this, args);
    };
    await new Promise(r => setTimeout(r, 2000));
    host.triggerRepaint = own;
    const renders = host.stats.frames - a.frames;
    return { renders, simulated: host.stats.idleFrames - a.idleFrames > 0, ...(renders ? { callers } : {}) };
  }), { timeout: 90_000, intervals: [0] }).toEqual({ renders: 0, simulated: true });

  // Only the engine's canvas: the HUD over it (the suburb card's fade, the minimap) changes on its own clock. Hidden by
  // visibility, which does not touch layout, so the canvas is neither resized nor redrawn by hiding it.
  const canvas = page.locator('canvas.engine-canvas');
  const hud = await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas.engine-canvas { visibility: visible !important; }' });
  // Who asks for a repaint while capturing (named in the failure: the iPhone run drew one frame here, 2026-11-01).
  const framesBefore = await page.evaluate(() => {
    const w = window as any, host = w.canalRecallGame.vectorMap.host, own = host.triggerRepaint;
    w.__captureCallers = {};
    host.triggerRepaint = function (...args: unknown[]) {
      const k = (new Error().stack ?? '').split('\n').slice(2, 6).map(l => l.trim().replace(/\(.*\//, '(').replace(/\?[^:)]*/, '')).join(' < ');
      w.__captureCallers[k] = (w.__captureCallers[k] ?? 0) + 1;
      return own.apply(this, args);
    };
    const ownResize = host.resize;
    host.resize = function (...args: unknown[]) {
      const before = host.viewport(), r = ownResize.apply(this, args), after = host.viewport();
      if (before.width !== after.width || before.height !== after.height || args[0]) {
        const k = `resize ${before.width}x${before.height} -> ${after.width}x${after.height}${args[0] ? ' (forced)' : ''}`;
        w.__captureCallers[k] = (w.__captureCallers[k] ?? 0) + 1;
      }
      return r;
    };
    w.__captureRestore = () => { host.triggerRepaint = own; host.resize = ownResize; };
    return host.stats.frames;
  });
  const still = await canvas.screenshot({ animations: 'disabled' });
  const captured = await page.evaluate(() => { const w = window as any; w.__captureRestore(); return { frames: w.canalRecallGame.vectorMap.host.stats.frames, callers: w.__captureCallers }; });
  expect(captured.frames, `capturing draws nothing (repaints asked by ${JSON.stringify(captured.callers)})`).toBe(framesBefore);
  await page.evaluate(() => (window as any).canalRecallGame.vectorMap.host.redraw());
  expect(Buffer.compare(still, await canvas.screenshot({ animations: 'disabled' })), 'the still frame is the frame a redraw makes').toBe(0);
  await hud.evaluate(el => el.remove());

  const before = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.host.stats.frames);
  await page.keyboard.down('ArrowUp');
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.host.stats.frames), { timeout: 2000, intervals: [50] }).toBeGreaterThan(before + 3);
  await page.keyboard.up('ArrowUp');
});
