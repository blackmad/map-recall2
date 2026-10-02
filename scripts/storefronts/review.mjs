// Review sheet: each spec-built storefront rendered next to its reference crop, 6 per image.
//   node scripts/storefronts/review.mjs <out.jpg> slug1 slug2 ...   (dev server on :4388)
import { chromium } from 'playwright';
import sharp from 'sharp';
const [out, ...slugs] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1200, height: 380 } });
const tiles = [];
for (const slug of slugs) {
  await page.goto(`http://127.0.0.1:4388/canal-drive/facade-compare.html?storefront=${slug}&r=17&el=4`);
  try { await page.waitForFunction(() => document.title === 'ready', null, { timeout: 40000 }); } catch { continue; }
  await page.waitForTimeout(300);
  const shot = await page.screenshot({ clip: { x: 400, y: 0, width: 800, height: 380 } });
  const label = Buffer.from(`<svg width="800" height="380"><rect width="800" height="26" fill="#111"/><text x="8" y="19" font-size="16" fill="#fff" font-family="sans-serif">${slug}</text></svg>`);
  tiles.push(await sharp(shot).composite([{ input: label, top: 0, left: 0 }]).png().toBuffer());
}
await b.close();
const cols = 2, rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: 800 * cols, height: 380 * rows, channels: 3, background: '#000' } }).composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * 800, top: Math.floor(i / cols) * 380 }))).jpeg({ quality: 80 }).toFile(out);
console.log(`${tiles.length} storefronts -> ${out}`);
