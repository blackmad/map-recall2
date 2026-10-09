// Frame-time bench on the iPhone 13 device profile with CPU throttle. Usage: node bench.mjs [none|splat|impostor|glb]
import { chromium, devices } from '@playwright/test';
const port = process.env.PORT || 4401;
const modes = process.argv[2] ? [process.argv[2]] : ['none', 'splat', 'impostor', 'glb'];
const throttle = Number(process.env.THROTTLE || 4);
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const out = {};
for (const only of modes) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`http://localhost:${port}/sculpture-splat-demo.html?compare=1&bench=1&sync=1&only=${only}&dist=12`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.evaluate(() => { window.__frames.length = 0; window.__demo.state.auto = true; });
  await page.waitForTimeout(6000);
  const f = await page.evaluate(() => window.__frames.slice(5));
  f.sort((a, b) => a - b);
  const pick = (q) => f[Math.min(f.length - 1, Math.floor(f.length * q))];
  out[only] = { frames: f.length, medianMs: +pick(0.5).toFixed(2), p95Ms: +pick(0.95).toFixed(2), meanMs: +(f.reduce((a, b) => a + b, 0) / f.length).toFixed(2) };
  const t = await page.evaluate(() => Object.fromEntries(Object.entries(window.__demo.times).map(([k, a]) => { const b = [...a].sort((x, y) => x - y); return [k, b.length ? { n: b.length, medianMs: +b[b.length >> 1].toFixed(2), p95Ms: +b[Math.floor(b.length * .95)].toFixed(2) } : null]; })));
  out[only].syncedRenderMs = t;
  await ctx.close();
}
console.log(JSON.stringify({ throttle, device: 'iPhone 13 profile (chromium, Apple Metal ANGLE, headless)', ...out }, null, 1));
await browser.close();
