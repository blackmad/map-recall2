// Element screenshots of the three panels at a few azimuths -> <outPrefix>-<az>-{splat,impostor,glb}.png
import { chromium } from '@playwright/test';
const [, , prefix, azs = '40,130,220,310', dist = '10'] = process.argv;
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 760 }, deviceScaleFactor: 1 });
await page.goto(`http://localhost:${process.env.PORT || 4401}/sculpture-splat-demo.html?compare=1&auto=0&dist=${dist}`);
await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
await page.waitForTimeout(1500);
for (const az of azs.split(',')) {
  await page.evaluate((a) => window.__demo.setView(a * Math.PI / 180, 0.1, Number(new URLSearchParams(location.search).get('dist'))), Number(az));
  await page.waitForTimeout(1500);
  for (const [id, name] of [['c1', 'splat'], ['c2', 'impostor'], ['c3', 'glb']]) {
    await page.locator('#' + id).screenshot({ path: `${prefix}-${az}-${name}.png` });
  }
}
await browser.close();
