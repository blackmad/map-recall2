// Bake a multi-view impostor atlas from a splat through the demo page.
// Usage: node bake.mjs <splat url relative to canal-drive> <outDir> [sideViews=12] [tilePx=256] [extentM=5] [elevDeg=8]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [, , splat, outDir, sv = '12', tp = '256', ext = '5', el = '8'] = process.argv;
const port = process.env.PORT || 4401;
const side = Number(sv), tile = Number(tp), extent = Number(ext), elev = Number(el) * Math.PI / 180;
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://localhost:${port}/sculpture-splat-demo.html?bake=1&splat=${encodeURIComponent(splat)}`);
await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
await page.waitForTimeout(1500);
const total = side + 1, cols = Math.ceil(Math.sqrt(total)), rows = Math.ceil(total / cols);
const t0 = Date.now();
const dataUrl = await page.evaluate(async ({ side, tile, extent, elev, cols, rows }) => {
  const atlas = document.createElement('canvas'); atlas.width = cols * tile; atlas.height = rows * tile;
  const g = atlas.getContext('2d');
  const draw = async (i, url) => {
    const img = new Image(); img.src = url; await img.decode();
    g.drawImage(img, (i % cols) * tile, Math.floor(i / cols) * tile, tile, tile);
  };
  for (let i = 0; i < side; i++) await draw(i, await window.__demo.bakeTile(i / side * Math.PI * 2, elev, extent, tile));
  await draw(side, await window.__demo.bakeTile(0, Math.PI / 2 - 0.001, 2.2, tile));
  return atlas.toDataURL('image/png');
}, { side, tile, extent, elev, cols, rows });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(`${outDir}/dokwerker-impostor.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));
fs.writeFileSync(`${outDir}/dokwerker-impostor.json`, JSON.stringify({ sideViews: side, cols, rows, tilePx: tile, atlasPx: [cols * tile, rows * tile][0],
  extentM: extent, centreY: 4.2 * 0.5, elevationDeg: Number(el), topExtentM: 2.2 }, null, 1));
console.log('baked', total, 'tiles in', Date.now() - t0, 'ms');
await browser.close();
