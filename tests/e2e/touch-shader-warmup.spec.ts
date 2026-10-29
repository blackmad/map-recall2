import { test, expect } from '@playwright/test';

// Sentry CANAL-RECALL-7 / -J / -N (2026-10-29): Firefox Mobile 159 on Android 17 lost its GPU process on the
// guest briefing (pitch 0, zoom 17, only `trees:46008` in the shared frame) at 7.8 s, and again 1.4 s after the
// context came back, while compiling shaders (three.js programs 2 -> 22). The own ground's warm-up compiled every
// ground program in one task: 14-24 three.js links within 100 ms (scripts/gpu-startup-timeline.mjs). A touch
// device now spreads it, 2 programs per 50 ms step (rendererShared/compileBudget.ts). Touch project only.

// `WARMUP_QS='?precompile=all'` restores the old single burst: this fails then (peak 21 links in 100 ms, 2026-10-29).
const THREE_WARMUP_PEAK_PER_100MS = 6;

test('a touch device spreads the ground shader warm-up, at start and after a context restore', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone', 'touch warm-up; desktop compiles in one call, unchanged');
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    const links: number[] = ((window as any).__threeLinks = []);
    for (const P of [(window as any).WebGL2RenderingContext?.prototype, (window as any).WebGLRenderingContext?.prototype].filter(Boolean)) {
      const link = P.linkProgram;
      // three.js's own compile path (`renderer.compile` -> acquireProgram), not MapLibre's or a draw's.
      P.linkProgram = function (...a: unknown[]) { if (/acquireProgram/.test(new Error().stack || '') && !/maplibre/.test(new Error().stack || '')) links.push(performance.now()); return link.apply(this, a); };
    }
  });
  await page.goto('/canal-drive/' + (process.env.WARMUP_QS || ''));
  // The briefing, untouched, as the Sentry rider: the ground warm-up runs from the first shared frame.
  await page.waitForFunction(() => (window as any).canalRecallGame?.vectorMap?._sharedFrame?.renderer?.info?.programs?.length >= 20, null, { timeout: 90_000 });
  await page.waitForTimeout(1500);
  const peak = (from: number) => page.evaluate((from) => {
    const t = ((window as any).__threeLinks as number[]).filter(x => x >= from);
    let best = 0;
    for (let a = 0; a < t.length; a++) { let b = a; while (b < t.length && t[b] - t[a] < 100) b++; best = Math.max(best, b - a); }
    return { peak: best, links: t.length };
  }, from);
  const start = await peak(0);
  expect(start.links, 'the warm-up ran').toBeGreaterThanOrEqual(15);
  expect(start.peak, `three.js warm-up links in any 100 ms at start: ${JSON.stringify(start)}`).toBeLessThanOrEqual(THREE_WARMUP_PEAK_PER_100MS);

  const restoredAt = await page.evaluate(() => new Promise<number>(resolve => {
    const gl = (window as any).canalRecallGame.vectorMap.map.painter.context.gl, ext = gl.getExtension('WEBGL_lose_context');
    ext.loseContext();
    setTimeout(() => { const t = performance.now(); ext.restoreContext(); resolve(t); }, 173);
  }));
  await page.waitForTimeout(4000);
  const after = await peak(restoredAt);
  expect(after.links, 'the warm-up ran again on the restored context').toBeGreaterThanOrEqual(15);
  expect(after.peak, `three.js warm-up links in any 100 ms after restore: ${JSON.stringify(after)}`).toBeLessThanOrEqual(THREE_WARMUP_PEAK_PER_100MS);
});
