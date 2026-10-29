import { test, expect } from '@playwright/test';

// Sentry CANAL-RECALL-7 / -J / -N (2026-10-29): Firefox Mobile 159 on Android 17 lost its GPU process on the
// guest briefing (pitch 0, zoom 17, only `trees:46008` in the shared frame) at 7.8 s, and again 1.4 s after the
// context came back, while compiling shaders (three.js programs 2 -> 22). The own ground's warm-up compiled every
// ground program in one task: 14-24 three.js links within 100 ms (scripts/gpu-startup-timeline.mjs). A touch
// device now spreads it, 2 programs per 50 ms step (rendererShared/compileBudget.ts). Touch project only.
// Since #109 nothing draws or warms up while the briefing covers the map (rendererShared/mapCover.ts): the warm-up
// runs once the rider presses Start, and the restore is measured on the ride.

// `WARMUP_QS='?precompile=all'` restores the old single burst: this fails then (peak 21 links in 100 ms, 2026-10-29).
const THREE_WARMUP_PEAK_PER_100MS = 6;

test('a touch device spreads the ground shader warm-up, at start and after a context restore', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone', 'touch warm-up; desktop compiles in one call, unchanged');
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    const links: number[] = ((window as any).__threeLinks = []);
    for (const P of [(window as any).WebGL2RenderingContext?.prototype, (window as any).WebGLRenderingContext?.prototype].filter(Boolean)) {
      const link = P.linkProgram;
      // Warm-up links only: three.js's compile path called from a precompile (the own ground's steps, the vehicles'),
      // not MapLibre's nor a draw's. Until #109 the test was `acquireProgram && !maplibre` on a 10-frame stack, which
      // also counted draw-time links once the stack was too deep to show MapLibre; a restore mid-ride re-links every
      // drawn program in its first frame (11 in 100 ms with `?coverPause=0` too), and that is not the warm-up.
      P.linkProgram = function (...a: unknown[]) {
        const limit = (Error as any).stackTraceLimit; (Error as any).stackTraceLimit = 30;
        const stack = new Error().stack || ''; (Error as any).stackTraceLimit = limit;
        if (/acquireProgram/.test(stack) && /precompile/i.test(stack)) links.push(performance.now());
        return link.apply(this, a);
      };
    }
  });
  await page.goto('/canal-drive/' + (process.env.WARMUP_QS || ''));
  // The briefing, untouched, as the Sentry rider: it covers the map, so the frame neither draws nor warms up.
  await page.waitForFunction(() => (window as any).canalRecallGame?.vectorMap?._sharedFrame?.renderer && (window as any).canalRecallGame?.routePois?.length, null, { timeout: 90_000 });
  await page.waitForTimeout(3000);
  const briefing = await page.evaluate(() => ({ links: ((window as any).__threeLinks as number[]).length, paused: (window as any).canalRecallGame.vectorMap._sharedFrame.coverPaused }));
  if (!/coverPause=0/.test(process.env.WARMUP_QS || '')) expect(briefing, 'no warm-up behind the briefing').toEqual({ links: 0, paused: true });
  await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
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
