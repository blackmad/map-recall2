import { test, expect } from '@playwright/test';
import jpeg from 'jpeg-js';
import { openRoute } from './helpers';

// White flashes while riding (issue #64, 2026-10-25). The render governor took its pixel-ratio steps inside the
// map's `render` event, after the frame was drawn: resizing the canvas cleared it and the browser composited the
// empty canvas, one frame of the page's paper background (mean luma 0.89 against the ride's ~0.48), 17–37 ms after
// each "[canal-recall] render budget step". Probe: tests/e2e/white-flash-probe.spec.ts.
// Here a busy `render` listener makes every frame slow, so the real governor steps 2 -> 1.5 -> 1.13; every
// compositor frame (CDP screencast) across the steps must stay near the ride's luma.
test.use({ deviceScaleFactor: 2 });

const meanLuma = (b64: string): number => {
  const img = jpeg.decode(Buffer.from(b64, 'base64'), { useTArray: true });
  let sum = 0, n = 0;
  for (let i = 0; i < img.data.length; i += 4 * 7) { sum += 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2]; n++; }
  return sum / n / 255;
};

test('render-governor pixel-ratio steps never put an empty (white) canvas on screen', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop high-DPI governor path');
  test.setTimeout(300_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false, playerTimeoutMs: 180_000 });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 180_000 });
  expect(await page.evaluate(() => (window as any).canalRecallGame.vectorMap.map.getPixelRatio())).toBe(2);
  const cdp = await page.context().newCDPSession(page);
  const frames: Array<{ t: number; luma: number }> = [];
  cdp.on('Page.screencastFrame', (f: any) => {
    frames.push({ t: f.metadata.timestamp * 1000, luma: meanLuma(f.data) });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 30, maxWidth: 320, maxHeight: 200, everyNthFrame: 1 });
  await page.evaluate(() => {
    const w = window as any, map = w.canalRecallGame.vectorMap.map;
    w.canalRecallGame.maxAsksPerMinute = 0;
    w.__steps = [];
    const setPixelRatio = map.setPixelRatio.bind(map);
    map.setPixelRatio = (r: number) => { w.__steps.push({ t: Date.now(), r }); return setPixelRatio(r); };
    // ~32 ms frames: past the governor's 26 ms p75, so it steps once the 12 s settle period is over.
    map.on('render', () => { const s = performance.now(); while (performance.now() - s < 30) { /* slow GPU stand-in */ } });
  });
  await page.keyboard.down('ArrowUp');
  await expect.poll(() => page.evaluate(() => (window as any).__steps.length), { timeout: 90_000, intervals: [1000] }).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowUp');
  await cdp.send('Page.stopScreencast');
  const steps: Array<{ t: number; r: number }> = await page.evaluate(() => (window as any).__steps);
  expect(steps.map(s => s.r)).toEqual([1.5, 1.13]);
  const sorted = frames.map(f => f.luma).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  for (const step of steps) {
    const around = frames.filter(f => f.t > step.t - 500 && f.t < step.t + 500);
    expect(around.length, 'screencast frames around the step').toBeGreaterThan(3);
    const worst = Math.max(...around.map(f => f.luma));
    console.log(JSON.stringify({ step: step.r, frames: around.length, median: +median.toFixed(3), worst: +worst.toFixed(3) }));
    expect(worst, `a near-white frame within 500 ms of the step to ${step.r}x`).toBeLessThan(Math.min(0.85, median + 0.2));
  }
});
