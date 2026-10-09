/** Contact sheet: one row per pand with front | front-alt | thumb and a caption. artifacts/pand-reference/contact-<name>.png */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const CELL_H = 300, CELL_W = 215, HOUSE_COLS = 2;
const esc = (s: string) => s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!));

async function cell(file: string, label: string) {
  let img: Buffer;
  try { img = await sharp(file).resize({ width: CELL_W, height: CELL_H, fit: 'contain', background: '#202020' }).png().toBuffer(); }
  catch { img = await sharp({ create: { width: CELL_W, height: CELL_H, channels: 3, background: '#401818' } }).png().toBuffer(); label += ' (missing)'; }
  const tag = Buffer.from(`<svg width="${CELL_W}" height="18"><rect width="${CELL_W}" height="18" fill="#000" opacity=".6"/><text x="4" y="13" font-family="Helvetica" font-size="11" fill="#fff">${esc(label)}</text></svg>`);
  return sharp(img).composite([{ input: tag, top: 0, left: 0 }]).png().toBuffer();
}

export async function buildContactSheet(name: string, dir: string, bagIds: string[], _order = '') {
  const rows = Math.ceil(bagIds.length / HOUSE_COLS), cols = 3, pad = 6, groupW = cols * (CELL_W + pad) + 8;
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];
  for (let i = 0; i < bagIds.length; i++) {
    const r = i, gx = (i % HOUSE_COLS) * groupW, gy = Math.floor(i / HOUSE_COLS);
    const d = path.join(dir, bagIds[r]);
    let ref: any = {};
    try { ref = JSON.parse(await fs.readFile(path.join(d, 'reference.json'), 'utf8')); } catch { /* none */ }
    const cap = (k: string, p: any) => `${bagIds[r].slice(-6)} ${k} ${p ? `${p.missionYear} d${p.cameraDistM}m obl${p.obliquityDeg}` : ''}`;
    const items: Array<[string, string]> = [[path.join(d, 'front.jpg'), cap('front', ref.primary)], [path.join(d, 'front-alt.jpg'), cap('alt', ref.alt)], [path.join(d, 'thumb.jpg'), `${bagIds[r].slice(-6)} thumb`]];
    for (let c = 0; c < cols; c++) composites.push({ input: await cell(items[c][0], items[c][1]), left: gx + pad + c * (CELL_W + pad), top: pad + gy * (CELL_H + pad) });
  }
  const file = path.resolve('artifacts/pand-reference', `contact-${name}.png`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await sharp({ create: { width: pad + HOUSE_COLS * groupW, height: pad + rows * (CELL_H + pad), channels: 3, background: '#111' } }).composite(composites).png({ compressionLevel: 9, palette: true, colors: 128 }).toFile(file);
  console.log(`contact sheet ${file}`);
}
