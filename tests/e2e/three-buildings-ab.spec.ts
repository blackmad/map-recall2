import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { openRoute } from './helpers';

// A/B for the three.js building layer against the fill-extrusion pattern layer
// (spike, 2026-10-02). Opt-in, a measurement rather than a gate:
//   AB_BUILDINGS=1 PW_PORT=4390 npx playwright test three-buildings-ab --project=desktop
// (cloud sandbox: add PW_OFFLINE_MAP=1 PW_CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome)
// Per variant and named location it records
//   shimmer  – mean absolute luminance change between consecutive screenshots of
//              the same facades while the heading creeps by 0.017° (0.0003 rad) a frame, i.e.
//              what a slanted, slowly moving wall flickers by (lower is calmer);
//   frame    – rAF deltas while riding forward, and MapLibre's own render time;
//   memory   – JS heap and, for three, geometry and texture bytes;
// and writes screenshots plus JSON under artifacts/three-buildings/.
test.skip(!process.env.AB_BUILDINGS, 'set AB_BUILDINGS=1 to measure');

const OUT = process.env.AB_DIR || 'artifacts/three-buildings';
const SPOTS = [
  { name: 'keizersgracht', at: [4.884677, 52.366703], face: [4.889273, 52.364094] },
  { name: 'rozengracht', at: [4.8826, 52.3748], face: [4.8788, 52.3743] },
  { name: 'da-costakade', at: [4.8689, 52.3695], face: [4.8738, 52.3699] },
  { name: 'centraal', at: [4.9003, 52.3789], face: [4.9035, 52.3777] },
  { name: 'nassaukade', at: [4.8708, 52.3685], face: [4.8785, 52.3668] },
] as const;
const VARIANTS = [{ name: 'pattern', three: false }, { name: 'three', three: true }] as const;

async function park(page: Page, at: readonly number[], face: readonly number[], view: 'chase' | 'cockpit') {
  await page.evaluate(({ at, face, view }) => {
    const g = (window as any).canalRecallGame, L = g.osmLoader;
    const k = 111320 * Math.cos(L._lastCenterLat * Math.PI / 180) * PIXELS_PER_METER;
    const toWorld = ([lng, lat]: number[]) => ({ x: L._lastOffsetX + (lng - L._lastCenterLng) * k, y: L._lastOffsetY - (lat - L._lastCenterLat) * 111320 * PIXELS_PER_METER });
    const a = toWorld(at as number[]), b = toWorld(face as number[]);
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    g.player.x = a.x; g.player.y = a.y; g.player.angle = Math.atan2(b.y - a.y, b.x - a.x);
    g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    g.viewMode = view; g.camera.viewMode = view; g.camera.northUp = false;
  }, { at, face, view });
}

const results: Record<string, unknown>[] = [];
for (const variant of VARIANTS) {
  test(`ab: ${variant.name}`, async ({ page }, testInfo) => {
    test.setTimeout(1_500_000);
    await page.addInitScript((three) => { (window as any).__canalRecallFacades = true; (window as any).__canalRecallTrees3d = false; (window as any).__canalRecallBuildings3d = three; }, variant.three);
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: false });
    await page.waitForFunction(() => (window as any).canalRecallGame.state === 4 || true);
    await page.evaluate(() => { (window as any).canalRecallGame.state = 4; });
    mkdirSync(OUT, { recursive: true });
    for (const spot of SPOTS) {
      for (const view of (process.env.AB_VIEWS || 'chase').split(',') as Array<'chase' | 'cockpit'>) {
        await park(page, spot.at, spot.face, view);
        await page.waitForTimeout(6000);
        await park(page, spot.at, spot.face, view);
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${OUT}/${spot.name}-${view}-${variant.name}.png` });
        // Shimmer: creep the heading by a fraction of a pixel a frame (0.0003 rad), so real content
        // motion is tiny and what is left in the frame difference is aliasing flicker.
        const clip = { x: 360, y: 250, width: 720, height: 380 };
        const frames: Buffer[] = [];
        for (let i = 0; i < 8; i++) {
          await page.evaluate(() => { const g = (window as any).canalRecallGame; g.player.angle += Number((window as any).__creep ?? 0.0003); });
          await page.waitForTimeout(200);
          frames.push(await page.screenshot({ clip }));
        }
        const diffs: number[] = [];
        for (let i = 1; i < frames.length; i++) {
          const a = await sharp(frames[i - 1]).greyscale().raw().toBuffer(), b = await sharp(frames[i]).greyscale().raw().toBuffer();
          let sum = 0; for (let p = 0; p < a.length; p++) sum += Math.abs(a[p] - b[p]);
          diffs.push(sum / a.length);
        }
        const mean = diffs.reduce((x, y) => x + y, 0) / diffs.length;
        results.push({ variant: variant.name, spot: spot.name, view, shimmer: Number(mean.toFixed(3)) });
      }
    }
    // Frame cost while riding (software GL: relative, not absolute).
    await park(page, SPOTS[0].at, SPOTS[0].face, 'chase');
    await page.waitForTimeout(4000);
    const perf = await page.evaluate(async () => {
      const w = window as any, map = w.canalRecallGame.vectorMap.map;
      const renders: number[] = [], frames: number[] = [];
      const original = map._render.bind(map);
      map._render = (...a: unknown[]) => { const t = performance.now(); const o = original(...a); renders.push(performance.now() - t); return o; };
      let last = performance.now(), stop = false;
      const tick = (now: number) => { frames.push(now - last); last = now; if (!stop) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      const g = w.canalRecallGame;
      for (let i = 0; i < 60; i++) { g.player.x += Math.cos(g.player.angle) * 2; g.player.y += Math.sin(g.player.angle) * 2; await new Promise(r => setTimeout(r, 100)); }
      stop = true; map._render = original;
      const pick = (v: number[], q: number) => [...v].sort((a, b) => a - b)[Math.min(v.length - 1, Math.floor(q * v.length))] ?? 0;
      (w.gc || (() => {}))(); const heap = (performance as any).memory ? (performance as any).memory.usedJSHeapSize / 1048576 : null;
      const vm = w.canalRecallGame.vectorMap;
      return { frameMedian: pick(frames.slice(3), 0.5), frameP95: pick(frames.slice(3), 0.95), mapRenderMedian: pick(renders, 0.5), mapRenderP95: pick(renders, 0.95), heapMB: heap, three: vm._threeBuildings ? vm._threeBuildings.stats() : null };
    });
    results.push({ variant: variant.name, perf });
    console.log(JSON.stringify(results.filter(r => r.variant === variant.name), null, 1));
    writeFileSync(`${OUT}/ab-${testInfo.project.name}.json`, JSON.stringify(results, null, 1));
    expect(results.length).toBeGreaterThan(0);
  });
}
