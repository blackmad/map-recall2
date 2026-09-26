/**
 * Render the craft-loop gallery to `.tmp/postcard-roundN/` + contact sheet.
 * Requires a browser (Playwright). Used by the agentic loop in LARGE_LETTER_CRAFT.md.
 *
 *   npm run render:large-letter-craft -- --round=1
 *
 * Pixel P0 (top ink / cream ring / letter reach) runs only on the Jordaan card.
 */
import { chromium } from '@playwright/test';
import esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outBundle = path.join(root, '.tmp/large-letter.bundle.js');
const outPng = path.join(root, '.tmp/postcard-craft.png');

const roundArg = process.argv.find((a) => a.startsWith('--round='));
const ROUND = Number(roundArg?.slice('--round='.length) ?? process.env.POSTCARD_ROUND ?? '1');
const outDir = path.join(root, `.tmp/postcard-round${ROUND}`);

type GalleryCard = {
  id: string;
  name: string;
  cityName: string;
  provinceCaption?: string;
  style: string;
  images: 'many' | 'none';
};

const GALLERY: GalleryCard[] = [
  {
    id: 'jordaan-linen',
    name: 'Jordaan',
    cityName: 'Amsterdam',
    provinceCaption: 'Noord-Holland',
    style: 'linen-arch',
    images: 'many',
  },
  {
    id: 'noord-flat',
    name: 'Noord',
    cityName: 'Amsterdam',
    style: 'flat-block',
    images: 'many',
  },
  {
    id: 'ijburg-rise',
    name: 'IJburg',
    cityName: 'Amsterdam',
    provinceCaption: 'Noord-Holland',
    style: 'rise-coastal',
    images: 'many',
  },
  {
    id: 'oudwest-desert',
    name: 'Oud-West',
    cityName: 'Amsterdam',
    style: 'desert-warm',
    images: 'many',
  },
  {
    id: 'sloterdijk-long',
    name: 'Sloterdijk-Centrum',
    cityName: 'Amsterdam',
    style: 'linen-arch',
    images: 'many',
  },
  {
    id: 'depijp-fallback',
    name: 'De Pijp',
    cityName: 'Amsterdam',
    provinceCaption: 'Noord-Holland',
    style: 'linen-arch',
    images: 'none',
  },
];

await esbuild.build({
  entryPoints: [path.join(root, 'src/canalRecall/largeLetterPostcard.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'CanalRecallLargeLetter',
  outfile: outBundle,
});

const galleryJson = JSON.stringify(GALLERY);
const harness = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Pacifico&display=swap" rel="stylesheet"/>
<style>
  body { margin: 0; background: #1a1e24; }
  #gallery { display: flex; flex-wrap: wrap; gap: 16px; padding: 16px; }
  .card { display: flex; flex-direction: column; gap: 6px; }
  .card span { color: #c8d0d8; font: 12px/1.2 ui-sans-serif, system-ui; }
</style>
</head><body>
<div id="gallery"></div>
<script src="/tmp/large-letter.bundle.js"></script>
<script>
(async () => {
  const LL = window.CanalRecallLargeLetter;
  const GALLERY = ${galleryJson};
  await document.fonts.load('400 64px "Archivo Black"');
  await document.fonts.load('400 32px "Pacifico"');
  const otFont = await LL.loadLargeLetterFont('/public/canal-drive/fonts/ArchivoBlack-Regular.ttf');
  async function load(src) {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
  }
  const pool = await Promise.all([
    load('/stories/canal-drive/fixtures/amsterdam-canal.jpg'),
    load('/stories/canal-drive/fixtures/amsterdam-houses.jpg'),
    load('/stories/canal-drive/fixtures/amsterdam-bridge.jpg'),
    load('/stories/canal-drive/fixtures/amsterdam-park.jpg'),
    load('/stories/canal-drive/fixtures/amsterdam-anne.jpg'),
    load('/stories/canal-drive/fixtures/amsterdam-westermarkt.jpg'),
    load('/stories/canal-drive/fixtures/amsterdam-canalhouses.jpg'),
  ]);
  const host = document.getElementById('gallery');
  const measureFor = (canvas) => (t, f) => {
    const x = canvas.getContext('2d');
    x.font = f;
    return x.measureText(t).width;
  };
  const metas = [];
  for (const spec of GALLERY) {
    const wrap = document.createElement('div');
    wrap.className = 'card';
    const canvas = document.createElement('canvas');
    canvas.dataset.id = spec.id;
    const label = document.createElement('span');
    label.textContent = spec.id;
    wrap.appendChild(canvas);
    wrap.appendChild(label);
    host.appendChild(wrap);
    const images = spec.images === 'none' ? [] : pool.slice(0, 7);
    const layout = LL.measureLargeLetterPostcard({
      name: spec.name,
      cityName: spec.cityName,
      provinceCaption: spec.provinceCaption,
      style: spec.style,
      imageCount: images.length,
    }, measureFor(canvas), { font: otFont, pathWarp: true });
    canvas.width = layout.width;
    canvas.height = layout.height;
    LL.drawLargeLetterPostcard(canvas.getContext('2d'), layout, images, { font: otFont });
    const painted = LL.measurePaintedLetterBounds(layout);
    metas.push({
      id: spec.id,
      font: layout.nameFontSize,
      stretch: layout.horizontalScale.toFixed(2),
      paintSx: layout.paintScaleX.toFixed(2),
      paintSy: layout.paintScaleY.toFixed(2),
      facePullY: layout.facePullY.toFixed(2),
      depth: Math.round(layout.extrusionSteps * Math.abs(layout.extrusionDy)),
      greet: Number(/(\\d+)px/.exec(layout.greetingFont)?.[1] || 0),
      painted: {
        minX: Math.round(painted.minX),
        maxX: Math.round(painted.maxX),
        minY: Math.round(painted.minY),
        maxY: Math.round(painted.maxY),
      },
    });
  }
  document.body.dataset.meta = JSON.stringify(metas);
  document.body.dataset.ready = '1';
})();
</script>
</body></html>`;

mkdirSync(path.join(root, '.tmp'), { recursive: true });
const harnessPath = path.join(root, '.tmp/craft-harness.html');
await writeFile(harnessPath, harness);

const server = createServer((req, res) => {
  const url = req.url || '/';
  let file = url === '/' || url.startsWith('/craft') ? harnessPath
    : url.startsWith('/tmp/') ? path.join(root, '.tmp', url.slice(5))
      : path.join(root, url.replace(/^\//, ''));
  if (!existsSync(file)) {
    res.writeHead(404); res.end('missing'); return;
  }
  const data = readFileSync(file);
  const type = file.endsWith('.js') ? 'text/javascript'
    : file.endsWith('.html') ? 'text/html'
      : file.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  res.end(data);
});

await new Promise<void>((resolve) => server.listen(8770, resolve));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2048, height: 1200 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto('http://127.0.0.1:8770/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 45000 });
const metas = JSON.parse(await page.evaluate(() => document.body.dataset.meta || '[]')) as Array<{
  id: string;
  font: number;
  stretch: string;
  paintSx: string;
  paintSy: string;
  facePullY: string;
  depth: number;
  greet: number;
  painted: { minX: number; maxX: number; minY: number; maxY: number };
}>;

mkdirSync(outDir, { recursive: true });
const cardPaths: Array<{ id: string; file: string }> = [];
for (const spec of GALLERY) {
  const dest = path.join(outDir, `${spec.id}.png`);
  await page.locator(`canvas[data-id="${spec.id}"]`).screenshot({ path: dest });
  cardPaths.push({ id: spec.id, file: dest });
  if (spec.id === 'jordaan-linen') {
    await page.locator(`canvas[data-id="${spec.id}"]`).screenshot({ path: outPng });
  }
}
await browser.close();
server.close();

const sharp = (await import('sharp')).default;

{
  const { data, info } = await sharp(outPng).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const at = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]] as const;
  };
  let inkOnTop = 0;
  for (let x = 0; x < w; x++) {
    const [r, g, b] = at(x, 0);
    if (r + g + b < 500 && !(r > 200 && g > 190 && b > 170)) inkOnTop++;
  }
  if (inkOnTop > w * 0.02) {
    throw new Error(`TOP CLIP pixel fail: ${inkOnTop} ink pixels on y=0`);
  }
  let leftCream = 0;
  for (let x = 0; x < w; x++) {
    const [r, g, b] = at(x, (h / 2) | 0);
    if (r > 215 && g > 205 && b > 185 && Math.abs(r - g) < 30) leftCream++;
    else break;
  }
  if (leftCream > 14) {
    throw new Error(`BORDER TOO THICK pixel fail: left cream ring ${leftCream}px > 14`);
  }
  const rowInk = new Array(h).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 10; x < w - 10; x++) {
      const [r, g, b] = at(x, y);
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      const lum = (r + g + b) / 3;
      const yellow = r > 130 && g > 80 && b < 160 && r >= g - 15 && r > b + 20;
      const blue = b > r + 12 && b > g + 8;
      if (((sat > 55 && lum < 200) || blue) && !yellow) rowInk[y]++;
    }
  }
  let letterFirst = -1;
  let letterLast = 0;
  let gap = 0;
  const inkFloor = Math.max(28, Math.round(w * 0.08));
  const yCap = Math.round(h * 0.82);
  for (let y = 0; y < yCap; y++) {
    if (rowInk[y] > inkFloor) {
      if (letterFirst < 0) letterFirst = y;
      letterLast = y;
      gap = 0;
    } else if (letterFirst >= 0) {
      gap += 1;
      if (gap > 8) break;
    }
  }
  const letterReach = letterLast / h;
  const letterSpan = letterFirst >= 0 ? (letterLast - letterFirst) / h : 0;
  if (letterReach < 0.58) {
    throw new Error(
      `LETTER FILL pixel fail: colorful letter ink ends at ${(letterReach * 100).toFixed(0)}%H (need ≥58%)`,
    );
  }
  if (letterReach > 0.84) {
    throw new Error(
      `LETTER FILL pixel fail: colorful letter ink ends at ${(letterReach * 100).toFixed(0)}%H (need ≤84% — too big)`,
    );
  }
  if (letterSpan > 0.72) {
    throw new Error(
      `LETTER SPAN pixel fail: ink spans ${(letterSpan * 100).toFixed(0)}%H (need ≤72% — too big)`,
    );
  }
  console.log(`pixel P0 ok: topInk=${inkOnTop} leftCream=${leftCream}px letterReach=${(letterReach * 100).toFixed(0)}% span=${(letterSpan * 100).toFixed(0)}%`);
}

{
  const gap = 18;
  const labelH = 22;
  const cols = 3;
  const rows = 2;
  const cardW = 640;
  const cardH = 400;
  const sheetW = cols * cardW + (cols + 1) * gap;
  const sheetH = rows * (cardH + labelH) + (rows + 1) * gap;
  const composites: Array<{ input: Buffer; top: number; left: number }> = [];
  for (let i = 0; i < cardPaths.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const left = gap + col * (cardW + gap);
    const top = gap + row * (cardH + labelH + gap);
    const meta = metas.find((m) => m.id === cardPaths[i].id);
    const caption = `${cardPaths[i].id}  depth=${meta?.depth ?? '?'}px  font=${meta?.font ?? '?'}`;
    const label = await sharp({
      create: { width: cardW, height: labelH, channels: 3, background: '#1a1e24' },
    }).png().toBuffer();
    const labeled = await sharp(label)
      .composite([{
        input: Buffer.from(
          `<svg width="${cardW}" height="${labelH}"><text x="0" y="16" fill="#c8d0d8" font-size="14" font-family="ui-sans-serif,system-ui">${caption}</text></svg>`,
        ),
        top: 0,
        left: 0,
      }])
      .png()
      .toBuffer();
    composites.push({ input: await sharp(cardPaths[i].file).png().toBuffer(), top, left });
    composites.push({ input: labeled, top: top + cardH, left });
  }
  const sheetPath = path.join(outDir, 'contact-sheet.png');
  await sharp({
    create: { width: sheetW, height: sheetH, channels: 3, background: '#1a1e24' },
  }).composite(composites).png().toFile(sheetPath);
  console.log('wrote contact sheet', sheetPath);
}

console.log('wrote gallery', outDir);
console.log('wrote', outPng);
for (const m of metas) {
  console.log(
    `${m.id}: font=${m.font} stretch=${m.stretch} sx=${m.paintSx} sy=${m.paintSy} pullY=${m.facePullY} depth=${m.depth} greet=${m.greet} painted=${JSON.stringify(m.painted)}`,
  );
}
console.log(`round ${ROUND}: vision-critique against LARGE_LETTER_CRAFT.md checklist`);
