#!/usr/bin/env node
/**
 * Contact sheet of the highlight styles (default a) against the old yellow (tests/e2e/highlight-shots.spec.ts output).
 *
 *   node scripts/highlight-contact-sheet.mjs artifacts/highlight-redesign/shots [--styles=yellow,a,b,c] [--width=480]
 *
 * Writes `<dir>/sheet-<frame>-<view>.jpg` (rows: spots, columns: styles) and `<dir>/contact-sheet.jpg` (all four
 * stacked), with each tile's accent pixel share from the spec's JSON under it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const dir = process.argv[2];
if (!dir) { console.error('usage: highlight-contact-sheet.mjs <shots dir> [--styles=…] [--width=…]'); process.exit(1); }
const arg = (name, fallback) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const styles = arg('styles', 'yellow,a,b,c').split(',');
const width = Number(arg('width', 480)), height = Math.round(width * 800 / 1280), label = 26, header = 44, gutter = 8;
const spots = ['westermarkt', 'westerkerk', 'rijksmuseum', 'oudwest-terrace'];
const frames = ['default', 'shared'], views = ['chase', 'saddle'];
const names = { yellow: 'yellow (comparison)', a0: 'a) before the small-target boost', a: 'a) default: outline + ring + beacon + small-target boost', b: 'b) rim + pulse + ring', c: 'c) desaturate rest + ring', 'a-hud': 'a) with HUD accent' };

const text = (s, w, h, size = 18, weight = 600, fill = '#1d1d1d', bg = '#f4f1ea') => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${bg}"/><text x="8" y="${Math.round(h * 0.7)}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);

function shares(frame, style) {
  const file = join(dir, `${frame}-${style}.json`);
  if (!existsSync(file)) return {};
  return Object.fromEntries(JSON.parse(readFileSync(file, 'utf8')).records.map(r => [`${r.spot}-${r.view}`, r.share]));
}

async function sheet(frame, view) {
  const cols = styles.length, rows = spots.length;
  const W = 150 + cols * (width + gutter), H = header + label + rows * (height + label + gutter);
  const layers = [{ input: text(`${frame === 'shared' ? 'shared frame (?sharedFrame=1)' : 'default frame'} — ${view === 'saddle' ? 'from the saddle' : 'chase view'}`, W, header, 24, 700), left: 0, top: 0 }];
  styles.forEach((s, c) => layers.push({ input: text(names[s] ?? s, width, label, 17, 700), left: 150 + c * (width + gutter), top: header }));
  for (let r = 0; r < rows; r++) {
    const top = header + label + r * (height + label + gutter);
    layers.push({ input: text(spots[r], 150, label, 15, 600), left: 0, top: top + height / 2 });
    for (let c = 0; c < cols; c++) {
      const file = join(dir, `${frame}-${styles[c]}-${spots[r]}-${view}.png`), left = 150 + c * (width + gutter);
      if (existsSync(file)) layers.push({ input: await sharp(file).resize(width, height).toBuffer(), left, top });
      else layers.push({ input: text('missing', width, height, 16, 400, '#999', '#ddd'), left, top });
      const share = shares(frame, styles[c])[`${spots[r]}-${view}`];
      layers.push({ input: text(share === undefined ? '' : `accent pixels ${(share * 100).toFixed(2)} %`, width, label, 13, 400, '#555'), left, top: top + height });
    }
  }
  const out = join(dir, `sheet-${frame}-${view}.jpg`);
  await sharp({ create: { width: W, height: H, channels: 3, background: '#f4f1ea' } }).composite(layers).jpeg({ quality: 82 }).toFile(out);
  return { out, W, H };
}

const made = [];
for (const frame of frames) for (const view of views) made.push(await sheet(frame, view));
const W = Math.max(...made.map(m => m.W)), H = made.reduce((a, m) => a + m.H, 0);
let top = 0;
const layers = made.map(m => { const l = { input: m.out, left: 0, top }; top += m.H; return l; });
await sharp({ create: { width: W, height: H, channels: 3, background: '#f4f1ea' } }).composite(layers).jpeg({ quality: 80 }).toFile(join(dir, 'contact-sheet.jpg'));
console.log(made.map(m => m.out).join('\n'));
console.log(join(dir, 'contact-sheet.jpg'));
