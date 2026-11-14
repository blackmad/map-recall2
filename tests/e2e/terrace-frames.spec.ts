/**
 * Terrace frames (lane terraces-20261114): rule-10 likeness frames (first person 72 deg, 1440 x 900, dpr 2) at the
 * poses scripts/terraces/frames.ts prep wrote, today and with `?terraces=1`, plus one as-played chase frame and a
 * perf read at each pose (frame time over 3 s, terrace draws / instances / triangles).
 *
 *   npx tsx scripts/terraces/frames.ts prep
 *   node scripts/build-canal-engine.mjs --outdir=artifacts/terraces/bundles
 *   PW_PORT=4442 BUNDLES_DIR=artifacts/terraces/bundles TERRACE_FRAMES_JOB=artifacts/terraces/frames/job.json \
 *     bash /tmp/canal-pw.sh npx playwright test tests/e2e/terrace-frames.spec.ts --project=desktop --workers=1
 *   npx tsx scripts/terraces/frames.ts sheet
 *
 * The staged extract (data/terraces/terraces-v1/index.json) is served for <extract>/terraces-v1/index.json until the
 * integrator publishes it.
 */
import { test, type Page, type BrowserContext } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { openRoute, settleWorld } from './helpers';

const JOB = process.env.TERRACE_FRAMES_JOB;
const STAGED = 'data/terraces/terraces-v1/index.json';
type Pose = { key: string; lngLat: [number, number]; headingDeg: number; fps: Record<string, unknown> };

async function routeData(ctx: BrowserContext): Promise<void> {
  await ctx.route(/\/data\/extracts\/amsterdam\/terraces-v1\/index\.json(\?.*)?$/, route => existsSync(STAGED) ? route.fulfill({ path: STAGED, contentType: 'application/json' }) : route.continue());
}

async function setPose(page: Page, pose: Pick<Pose, 'lngLat' | 'headingDeg' | 'fps'>): Promise<void> {
  await page.evaluate(({ lngLat, headingDeg, fps }) => {
    const w = window as any, g = w.canalRecallGame, l = g.osmLoader;
    const mLng = 111320 * Math.cos(l._lastCenterLat * Math.PI / 180), ppm = 3;
    g.player.x = l._lastOffsetX + (lngLat[0] - l._lastCenterLng) * mLng * ppm;
    g.player.y = l._lastOffsetY - (lngLat[1] - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = (headingDeg - 90) * Math.PI / 180;
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    w.__terraceFramesPose = fps;
    g.state = 4;
  }, pose);
}

async function perf(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(async () => {
    const times: number[] = [];
    await new Promise<void>(done => { let last = performance.now(); const t0 = last; const f = (now: number) => { times.push(now - last); last = now; if (now - t0 < 3000) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
    times.sort((a, b) => a - b);
    const w = window as any, d = w.__canalTerraces?.debug;
    return { frames: times.length, p50: +times[Math.floor(times.length / 2)].toFixed(1), p95: +times[Math.floor(times.length * 0.95)].toFixed(1), terraces: d ? { draws: d.draws, instances: d.instances, near: d.near, far: d.far, triangles: d.triangles, buildMs: d.buildMs, byModel: d.byModel } : null };
  });
}

test('terrace frames', async ({ browser }) => {
  test.skip(!JOB, 'set TERRACE_FRAMES_JOB (scripts/terraces/frames.ts prep)');
  const job = JSON.parse(readFileSync(JOB!, 'utf8'));
  test.setTimeout(300_000 + job.poses.length * 180_000);
  const out = job.out as string, results: Record<string, unknown> = {};
  for (const variant of ['today', 'terraces'] as const) {
    const ctx = await browser.newContext({ viewport: { width: job.width, height: job.height }, deviceScaleFactor: job.dpr });
    await routeData(ctx);
    const page = await ctx.newPage();
    try {
      await openRoute(page, { travelMode: 'car', query: `?engine=own&cam=fps${variant === 'terraces' ? '&terraces=1' : ''}`, abortHeavyTiles: true });
      await page.evaluate(() => {
        const g = (window as any).canalRecallGame, vm = g.vectorMap;
        g.player.handleInput = () => {};
        if (!vm.fpsCameraOn()) vm.setFpsCamera(true);
        vm.solveFps = function solveFpsTerraceFrames(this: any) { const p = (window as any).__terraceFramesPose; this._lastFps = { pose: p, backM: 0, stuckId: null, elevation: 0 }; return p; };
      });
      await page.addStyleTag({ content: `body > *:not(#vector-map) { visibility: hidden !important; } .maplibregl-control-container { display: none !important; }` });
      for (const pose of job.poses as Pose[]) {
        await setPose(page, pose); await page.waitForTimeout(1500); await setPose(page, pose);
        const settle = await settleWorld(page, `${pose.key} ${variant}`, 60_000);
        await setPose(page, pose); await page.waitForTimeout(1200);
        await page.screenshot({ path: `${out}/${pose.key}-${variant}.png` });
        results[`${pose.key}-${variant}`] = { settle, perf: await perf(page) };
      }
    } finally { await ctx.close(); }
  }
  // As played: the chase camera (own engine: the terraces are an own-engine layer), terraces on, dpr 2.
  {
    const a = job.asPlayed, ctx = await browser.newContext({ viewport: { width: job.width, height: job.height }, deviceScaleFactor: job.dpr });
    await routeData(ctx);
    const page = await ctx.newPage();
    try {
      await openRoute(page, { travelMode: 'car', query: '?engine=own&terraces=1', abortHeavyTiles: true, controlMode: 'relative' });
      await page.evaluate(() => { (window as any).canalRecallGame.player.handleInput = () => {}; });
      await page.addStyleTag({ content: `body > *:not(#vector-map) { visibility: hidden !important; } .maplibregl-control-container { display: none !important; }` });
      const at = { lngLat: a.lngLat, headingDeg: a.headingDeg, fps: {} };
      await setPose(page, at); await page.waitForTimeout(1500); await setPose(page, at);
      const settle = await settleWorld(page, 'as-played', 60_000);
      await setPose(page, at); await page.waitForTimeout(1500);
      await page.screenshot({ path: `${out}/as-played-${a.key}.png` });
      results[`as-played-${a.key}`] = { settle, perf: await perf(page) };
    } finally { await ctx.close(); }
  }
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 1));
});
