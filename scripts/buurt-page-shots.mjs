// Screenshots of generated neighbourhood pages at desktop and phone width, for review.
//   PORT=4493 node scripts/buurt-page-shots.mjs <outDir> <slug> [slug…]   (slug "index" is the index page)
import { chromium } from 'playwright';
import fs from 'node:fs';
const [out, ...slugs] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const sizes = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
for (const [device, opts] of Object.entries(sizes)) {
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const slug of slugs) {
    await page.goto(`http://127.0.0.1:${process.env.PORT || 4493}/canal-drive/buurt/${slug}.html`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.screenshot({ path: `${out}/${slug}-${device}.png`, fullPage: true });
    console.log(device, slug, 'overflowX', overflow, 'errors', errors.length);
  }
  await context.close();
}
await browser.close();
