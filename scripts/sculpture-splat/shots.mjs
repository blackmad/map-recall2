// Screenshot the demo page at several azimuths. Usage: node shots.mjs <outPrefix> [query] [azList]
import { chromium } from '@playwright/test';
const [, , prefix, query = '', azs = '0,90,180,270'] = process.argv;
const port = process.env.PORT || 4401;
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
page.on('console', (m) => console.log('console', m.type(), m.text().slice(0,300))); page.on('requestfailed', (r) => console.log('reqfail', r.url(), r.failure()?.errorText)); page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://localhost:${port}/sculpture-splat-demo.html?${query}`);
await page.waitForFunction(() => window.__ready, null, { timeout: 30000 });
await page.waitForTimeout(1500);
console.log('err:', await page.textContent('#err'));
for (const az of azs.split(',')) {
  await page.evaluate((a) => window.__demo.setView(a * Math.PI / 180, 0.15, Number(new URLSearchParams(location.search).get('dist') || 9)), Number(az));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${prefix}-${az}.png` });
}
console.log(await page.textContent('#splatinfo'));
await browser.close();
