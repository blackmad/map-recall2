// One tile per spec-built storefront (render | reference), for the gallery page.
//   node scripts/storefronts/gallery-tiles.mjs <outDir> slug...   (dev server on :4388)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
const [out, ...slugs] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1200, height: 380 } });
let done = 0;
for (const slug of slugs) {
  const file = path.join(out, `${slug}.jpg`);
  if (fs.existsSync(file)) { done++; continue; }
  try {
    await page.goto(`http://127.0.0.1:4388/canal-drive/facade-compare.html?storefront=${slug}&el=4`);
    await page.waitForFunction(() => document.title === 'ready', null, { timeout: 40000 });
    await page.waitForTimeout(250);
    const shot = await page.screenshot({ clip: { x: 400, y: 0, width: 800, height: 380 } });
    await sharp(shot).resize(640, 304).jpeg({ quality: 72 }).toFile(file);
    done++;
  } catch (e) { console.warn(`${slug}: ${e.message.split('\n')[0]}`); }
}
await b.close();
console.log(`${done}/${slugs.length} tiles`);
