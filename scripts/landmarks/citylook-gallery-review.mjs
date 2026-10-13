// City look gallery review (docs/handoffs/lane-citylook-review-20261013.md deliverable 3).
//
//   node scripts/landmarks/citylook-gallery-review.mjs [--out=artifacts/citylook-review/gallery] [--years=artifacts/citylook-review/landmark-bag-years.json] [--only=id,id]
//
// Renders every landmark GLB in public/canal-drive/models (not lod1) with src/canalRecall/look/galleryReview.ts:
// flag off (shared rig, own materials) beside flag on (`?cityLook=1&sharedFrame=1`: inferred slots, era brick),
// from the sun side and the shade side, at gallery-card size (320×240). Writes per-model PNGs, `review.json`
// (luma, colour, material table per model) and contact sheets of 30 models (`sheet-NN.png`: per row, flag off
// sun | flag on sun | flag off shade | flag on shade).
import {chromium} from '@playwright/test';
import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const out = path.resolve(ROOT, arg('out') ?? 'artifacts/citylook-review/gallery');
const yearsFile = path.resolve(ROOT, arg('years') ?? 'artifacts/citylook-review/landmark-bag-years.json');
const only = arg('only')?.split(',');
const perSheet = Number(arg('per-sheet') ?? 30);
const PUBLIC = path.join(ROOT, 'public/canal-drive');
fs.mkdirSync(path.join(out, 'tiles'), {recursive: true});

const years = fs.existsSync(yearsFile) ? JSON.parse(fs.readFileSync(yearsFile, 'utf8')).models : {};
const ids = fs.readdirSync(path.join(PUBLIC, 'models')).filter(f => f.endsWith('.glb') && !f.endsWith('.lod1.glb')).map(f => f.slice(0, -4)).sort()
  .filter(id => !only || only.includes(id));

const bundle = await build({entryPoints: [path.join(ROOT, 'src/canalRecall/look/galleryReview.ts')], bundle: true, format: 'iife', globalName: 'GalleryReview', write: false, logLevel: 'error'});
const browser = await chromium.launch({args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=metal']});
const page = await browser.newPage({viewport: {width: 400, height: 300}});
page.on('pageerror', e => console.log('pageerror', e.message));
const types = {'.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.js': 'application/javascript', '.html': 'text/html'};
await page.route('http://review.local/**', route => {
  const p = decodeURIComponent(new URL(route.request().url()).pathname);
  if (p === '/__review.js') return route.fulfill({body: bundle.outputFiles[0].text, contentType: 'application/javascript'});
  if (p === '/') return route.fulfill({body: '<!doctype html><meta charset="utf-8"><body style="margin:0"><script src="/__review.js"></script>', contentType: 'text/html'});
  const file = path.join(PUBLIC, p);
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) return route.fulfill({status: 404, body: ''});
  route.fulfill({body: fs.readFileSync(file), contentType: types[path.extname(file)] ?? 'application/octet-stream'});
});
await page.goto('http://review.local/');

const results = [];
const t0 = Date.now();
for (const [i, id] of ids.entries()) {
  try {
    const r = await page.evaluate(o => window.GalleryReview.reviewModel(o), {id, url: `/models/${id}.glb`, year: years[id]?.year ?? null, brickUrl: '/materials/ambientcg/Bricks057/colour.jpg'});
    for (const [key, url] of Object.entries(r.images)) fs.writeFileSync(path.join(out, 'tiles', `${id}--${key}.png`), Buffer.from(url.split(',')[1], 'base64'));
    delete r.images;
    results.push(r);
  } catch (e) {
    console.log(`${id}: ${e.message}`);
    results.push({id, error: e.message});
  }
  if (i % 20 === 0) console.log(`${i + 1}/${ids.length} ${id} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
await browser.close();
fs.writeFileSync(path.join(out, 'review.json'), JSON.stringify(results, null, 1));

// Contact sheets: one row per model, a label strip on the left.
const font = ['/System/Library/Fonts/Supplemental/Arial.ttf', '/Library/Fonts/Arial.ttf'].find(f => fs.existsSync(f));
const ok = results.filter(r => !r.error);
for (let s = 0; s * perSheet < ok.length; s++) {
  const rows = [];
  for (const r of ok.slice(s * perSheet, (s + 1) * perSheet)) {
    const row = path.join(out, 'tiles', `${r.id}--row.png`);
    const tiles = ['legacy-sun', 'city-sun', 'legacy-shade', 'city-shade'].map(k => path.join(out, 'tiles', `${r.id}--${k}.png`));
    const dl = r.luma['legacy-sun'] ? Math.round((r.luma['city-sun'] / r.luma['legacy-sun'] - 1) * 100) : 0;
    const label = `${r.id}\n${r.year ?? 'no year'}\nsun ${r.luma['legacy-sun']} -> ${r.luma['city-sun']} (${dl >= 0 ? '+' : ''}${dl}%)`;
    execFileSync('magick', [
      '(', '-size', '220x240', 'xc:#f4f1ea', ...(font ? ['-font', font] : []), '-pointsize', '15', '-fill', '#222', '-annotate', '+8+28', label, ')',
      ...tiles.flatMap(t => ['(', '-size', '320x240', 'xc:#b9c9d6', t, '-composite', ')']),
      '+append', row]);
    rows.push(row);
  }
  execFileSync('magick', [...rows, '-append', path.join(out, `sheet-${String(s + 1).padStart(2, '0')}.png`)]);
}
console.log(`${ok.length} models reviewed, ${results.length - ok.length} failed; ${Math.ceil(ok.length / perSheet)} sheets in ${path.relative(ROOT, out)} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
