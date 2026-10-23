import { test, chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Weak-GPU proxy (2026-10-23): "too slow on their computers, fine on my M4".
// SwiftShader renders on the CPU, so GPU fill cost (pixel ratio, MSAA, shadow
// map) shows up in the frame interval the way it does on an integrated laptop
// GPU. Opt-in measurement, not a gate:
//   PERF_WEAK_GPU=1 PW_PORT=4391 npx playwright test weak-gpu-perf --project=desktop
// WEAK_GPU_DPR=2 emulates a 200 % laptop display (default 1.5, a common Windows
// scaling). WEAK_GPU_VARIANTS=default,dpr1 picks variants. Results go to
// artifacts/perf/weak-gpu-<dpr>.json. Absolute numbers depend on this machine's
// CPU and load; compare variants within one run.
test.skip(!process.env.PERF_WEAK_GPU, 'set PERF_WEAK_GPU=1 to measure');

// `governor=0` so each variant measures its raw cost; `governed` shows where
// the render governor settles on its own.
const VARIANTS: Record<string, string> = {
  default: '?governor=0',
  dpr1: '?governor=0&dpr=1',
  noShadows: '?governor=0&shadows=0',
  noMsaa: '?governor=0&msaa=0',
  dpr1NoShadowsNoMsaa: '?governor=0&dpr=1&shadows=0&msaa=0',
  ownGroundOff: '?governor=0&ownGround=0',
  governed: '',
};
const chosen = (process.env.WEAK_GPU_VARIANTS ?? Object.keys(VARIANTS).join(',')).split(',');
const dpr = Number(process.env.WEAK_GPU_DPR ?? 1.5);
const pick = (values: number[], q: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(q * values.length))] ?? 0;
const results: Record<string, unknown>[] = [];

for (const name of chosen) {
  test(`weak GPU ride: ${name} @${dpr}x`, async ({ baseURL }) => {
    test.setTimeout(400_000);
    const browser = await chromium.launch({
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
    });
    const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
    const page = await context.newPage();
    try {
      await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false, query: VARIANTS[name], playerTimeoutMs: 240_000 });
      await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 240_000 });
      await page.waitForTimeout(8000);
      await page.evaluate(() => {
        const w = window as any;
        w.__frames = [];
        let last = performance.now();
        const tick = (now: number) => { w.__frames.push(now - last); last = now; if (!w.__stop) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      });
      await page.keyboard.down('ArrowUp');
      await page.waitForTimeout(12_000);
      await page.keyboard.up('ArrowUp');
      const raw = await page.evaluate(() => {
        const w = window as any; w.__stop = true;
        const canvas = w.canalRecallGame.vectorMap.map.getCanvas();
        const mem = (performance as any).memory;
        const governor = w.canalRecallGame.vectorMap._renderGovernor;
        return { frames: w.__frames.slice(5) as number[], backing: [canvas.width, canvas.height], heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null, pixelRatio: w.canalRecallGame.vectorMap.map.getPixelRatio(), governorSteps: governor ? governor.steps : null };
      });
      const f = raw.frames;
      const sample = { name, dpr, n: f.length, fps: +(1000 / (f.reduce((a, b) => a + b, 0) / Math.max(1, f.length))).toFixed(1), median: +pick(f, 0.5).toFixed(1), p75: +pick(f, 0.75).toFixed(1), p95: +pick(f, 0.95).toFixed(1), backing: raw.backing, pixelRatio: raw.pixelRatio, heapMB: raw.heapMB, governorSteps: raw.governorSteps };
      results.push(sample);
      console.log(JSON.stringify(sample));
      mkdirSync('artifacts/perf', { recursive: true });
      writeFileSync(`artifacts/perf/weak-gpu-${dpr}.json`, JSON.stringify(results, null, 2));
    } finally {
      await browser.close();
    }
  });
}
