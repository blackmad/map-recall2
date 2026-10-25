import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import jpeg from 'jpeg-js';
import { openRoute } from './helpers';

// White-flash probe (2026-10-25, issue #64): "random white screen flashes" while riding.
// Opt-in measurement: FLASH_PROBE=1 PW_PORT=4797 npx playwright test white-flash-probe --project=desktop
// FLASH_QUERY='?governor=0' adds a query; RIDE_S=180 sets the ride length; FLASH_CPU=4 throttles the CPU.
// Every compositor frame (CDP screencast) is decoded and its mean luma logged beside page events
// (pixel ratio changes, map resizes, style loads, context loss). Results: artifacts/perf/white-flash.json.
// FLASH_LOSE=1 loses and restores the WebGL context every 20 s.
// FLASH_DPR=2 emulates the high-DPI Mac; FLASH_FORCE_STEP=1 applies governor-sized pixel-ratio steps mid-ride.
test.skip(!process.env.FLASH_PROBE, 'set FLASH_PROBE=1 to measure');
test.use({ deviceScaleFactor: Number(process.env.FLASH_DPR ?? 1) });

const meanLuma = (b64: string): number => {
  const img = jpeg.decode(Buffer.from(b64, 'base64'), { useTArray: true });
  let sum = 0, n = 0;
  for (let i = 0; i < img.data.length; i += 4 * 7) {
    sum += 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
    n++;
  }
  return sum / n / 255;
};

test('white flash probe', async ({ page }) => {
  const rideS = Number(process.env.RIDE_S ?? 180);
  test.setTimeout(300_000 + rideS * 1000);
  const events: Array<{ t: number; what: string }> = [];
  page.on('console', m => { const s = m.text(); if (/render budget step|context|WebGL/i.test(s)) events.push({ t: Date.now(), what: `console: ${s.slice(0, 200)}` }); });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false, query: process.env.FLASH_QUERY ?? '', playerTimeoutMs: 180_000 });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 180_000 });
  await page.evaluate(() => {
    const w = window as any, vm = w.canalRecallGame.vectorMap, map = vm.map;
    if ((window as any).__flashNoAsks) w.canalRecallGame.maxAsksPerMinute = 0;
    w.__flashEvents = [];
    const log = (what: string) => w.__flashEvents.push({ t: Date.now(), what });
    const setPixelRatio = map.setPixelRatio.bind(map);
    map.setPixelRatio = (r: number) => { log(`setPixelRatio ${r}`); return setPixelRatio(r); };
    const resize = map.resize.bind(map);
    map.resize = (...a: unknown[]) => { log('map.resize'); return resize(...a); };
    for (const e of ['webglcontextlost', 'webglcontextrestored', 'style.load']) map.on(e, () => log(e));
    let lastState = w.canalRecallGame.state;
    setInterval(() => { const s = w.canalRecallGame.state; if (s !== lastState) { log(`state ${lastState}->${s}`); lastState = s; } }, 50);
  });
  const cdp = await page.context().newCDPSession(page);
  if (process.env.FLASH_CPU) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.FLASH_CPU) });
  const frames: Array<{ t: number; luma: number }> = [];
  mkdirSync('artifacts/perf/white-flash', { recursive: true });
  let brightest = 0;
  cdp.on('Page.screencastFrame', (f: any) => {
    const luma = +meanLuma(f.data).toFixed(3);
    frames.push({ t: Math.round(f.metadata.timestamp * 1000), luma });
    // Keep the first frame, the brightest so far and every flash candidate, to look at.
    if (frames.length === 1 || luma > brightest || luma > 0.85) writeFileSync(`artifacts/perf/white-flash/${frames.length === 1 ? 'first' : luma > 0.85 ? `flash-${frames.length}` : 'brightest'}.jpg`, Buffer.from(f.data, 'base64'));
    brightest = Math.max(brightest, luma);
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 30, maxWidth: 320, maxHeight: 200, everyNthFrame: 1 });
  await page.keyboard.down('ArrowUp');
  const t0 = Date.now();
  let k = 0;
  while (Date.now() - t0 < rideS * 1000) {
    // Steer now and then so the route, the camera and the tiles keep changing.
    const key = (k++ % 2) ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(key); await page.waitForTimeout(700); await page.keyboard.up(key);
    await page.waitForTimeout(4300);
    if (process.env.FLASH_FORCE_STEP && k % 4 === 2) {
      // From inside the map's `render` event, where the governor applies its steps (FLASH_FORCE_STEP=render),
      // or from outside the frame (FLASH_FORCE_STEP=1).
      await page.evaluate((inRender) => {
        const map = (window as any).canalRecallGame.vectorMap.map;
        const step = () => { const r = map.getPixelRatio(); map.setPixelRatio(r > 1.2 ? Math.max(1, Math.round(r * 75) / 100) : 2); };
        if (inRender) map.once('render', step); else step();
      }, process.env.FLASH_FORCE_STEP === 'render');
    }
    // FLASH_LOSE=1: a WebGL context loss and restore every 20 s, for what the restore puts on screen.
    if (process.env.FLASH_LOSE && k % 4 === 3) {
      await page.evaluate(() => { const w = window as any; w.__lose ??= w.canalRecallGame.vectorMap.map.painter.context.gl.getExtension('WEBGL_lose_context'); w.__lose.loseContext(); });
      await page.waitForTimeout(1500);
      await page.evaluate(() => (window as any).__lose.restoreContext());
    }
    const state = await page.evaluate(() => (window as any).canalRecallGame.state);
    if (state !== 4) await page.evaluate(() => { (window as any).canalRecallGame.state = 4; });
  }
  await page.keyboard.up('ArrowUp');
  await cdp.send('Page.stopScreencast');
  const pageEvents = await page.evaluate(() => (window as any).__flashEvents);
  const status = await page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; const gl = vm.map.painter.context.gl, dbg = gl.getExtension('WEBGL_debug_renderer_info'); return { renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null, pixelRatio: vm.map.getPixelRatio(), steps: vm._renderGovernor?.steps ?? null }; });
  const all = [...events, ...pageEvents].sort((a, b) => a.t - b.t);
  const sorted = frames.map(f => f.luma).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const flashes = frames.map((f, i) => ({ ...f, i })).filter(f => f.luma > 0.85 || f.luma - median > 0.25);
  const summary = { frames: frames.length, median, max: sorted[sorted.length - 1], flashes: flashes.length, status, events: all.length };
  console.log(JSON.stringify(summary));
  for (const f of flashes.slice(0, 40)) {
    const near = all.filter(e => Math.abs(e.t - f.t) < 1500).map(e => `${e.t - f.t}ms ${e.what}`);
    console.log(`FLASH t=${f.t} luma=${f.luma} prev=${frames[f.i - 1]?.luma} next=${frames[f.i + 1]?.luma} near=${JSON.stringify(near)}`);
  }
  for (const e of all) console.log(`EVENT t=${e.t} ${e.what}`);
  mkdirSync('artifacts/perf', { recursive: true });
  writeFileSync('artifacts/perf/white-flash.json', JSON.stringify({ query: process.env.FLASH_QUERY ?? '', summary, flashes, events: all, frames }, null, 2));
});
