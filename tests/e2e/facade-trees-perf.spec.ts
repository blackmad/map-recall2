import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Frame-cost A/B for the generic facades and stylised 3D trees (2026-10-01).
// Opt-in (it is a measurement, not a regression gate):
//   PERF_FACADES=1 PW_PORT=4402 npx playwright test facade-trees-perf --project=iphone
// Each run rides the same seeded route in chase view with the CPU throttled 4x,
// once with the old flat look (`?facades=0&trees3d=0`) and once with both on,
// and writes the rAF frame deltas to test-results/facade-trees-perf.json.
test.skip(!process.env.PERF_FACADES, 'set PERF_FACADES=1 to measure');

type Sample = { label: string; frames: number; median: number; p95: number; p99: number; over50: number; over100: number; mapRenderMedian: number; mapRenderP95: number };

const variants: Array<{ label: string; facades: boolean; trees: boolean }> = [
  { label: 'old look', facades: false, trees: false },
  { label: 'facades + trees', facades: true, trees: true },
  { label: 'old look (repeat)', facades: false, trees: false },
  { label: 'facades + trees (repeat)', facades: true, trees: true },
];

const results: Sample[] = [];

for (const variant of variants) {
  test(`frame cost: ${variant.label}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.addInitScript(([facades, trees]) => {
      (window as any).__canalRecallFacades = facades;
      (window as any).__canalRecallTrees3d = trees;
    }, [variant.facades, variant.trees]);
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
    await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 90_000 });
    // Let the streamed city and the decorations land before measuring.
    await page.waitForTimeout(6000);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(() => {
      const w = window as any;
      w.__frames = [];
      w.__mapRender = [];
      const map = w.canalRecallGame.vectorMap.map;
      const original = map._render.bind(map);
      map._render = (...args: unknown[]) => { const t = performance.now(); const out = original(...args); w.__mapRender.push(performance.now() - t); return out; };
      let last = performance.now();
      const tick = (now: number) => { w.__frames.push(now - last); last = now; if (!w.__stopFrames) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(9000);
    await page.keyboard.up('ArrowUp');
    const { frames, mapRender } = await page.evaluate(() => { const w = window as any; w.__stopFrames = true; return { frames: w.__frames.slice(5) as number[], mapRender: w.__mapRender.slice(5) as number[] }; });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const pick = (values: number[], q: number) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0; };
    const sample: Sample = {
      label: variant.label,
      frames: frames.length,
      median: pick(frames, 0.5), p95: pick(frames, 0.95), p99: pick(frames, 0.99),
      over50: frames.filter(f => f > 50).length, over100: frames.filter(f => f > 100).length,
      mapRenderMedian: pick(mapRender, 0.5), mapRenderP95: pick(mapRender, 0.95),
    };
    results.push(sample);
    console.log(JSON.stringify(sample));
    mkdirSync('test-results', { recursive: true });
    writeFileSync('test-results/facade-trees-perf.json', JSON.stringify(results, null, 2));
    expect(frames.length).toBeGreaterThan(20);
  });
}
