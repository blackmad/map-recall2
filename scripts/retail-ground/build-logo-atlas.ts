// Paints the chain-logo atlas (lane retail-ground round 2): data/retail-ground/logos/<key>.png (Wikimedia Commons,
// provenance.json) fitted into retailLogos.ts's grid on each template's fascia colour, 512 px (the desktop-high layer;
// smaller tiers downsample at load). Stages data/retail-ground/retail-logos.png; `--publish` (the integrator's step)
// copies it and the provenance to public/canal-drive/materials/retail-logos/.
//   node --import tsx scripts/retail-ground/build-logo-atlas.ts [--publish]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { LOGOS, LOGO_ATLAS_PATH, logoBox } from '../../src/canalRecall/retailLogos.ts';
import { TEMPLATE_LOOKS } from '../../src/canalRecall/retailTemplates.ts';

const SIZE = 512, SRC = 'data/retail-ground/logos', OUT = 'data/retail-ground/retail-logos.png';
const provenance = JSON.parse(fs.readFileSync(path.join(SRC, 'provenance.json'), 'utf8'));
const layers: sharp.OverlayOptions[] = [];
const cells: string[] = [];
for (const [i, { key }] of LOGOS.entries()) {
  if (!provenance.logos[key]) throw new Error(`${key}: no provenance`);
  const b = logoBox(i), w = Math.round(b.w * SIZE), h = Math.round(b.h * SIZE);
  const cw = SIZE / 2, ch = SIZE / 4, cx = (i % 2) * cw, cy = Math.floor(i / 2) * ch;
  // The cell in the fascia colour (mip levels bleed the board, not another logo), the logo fitted on it.
  cells.push(`<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="${TEMPLATE_LOOKS[key].fascia}"/>`);
  const logo = await sharp(path.join(SRC, `${key}.png`)).resize(w, h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  layers.push({ input: logo, left: Math.round(b.x * SIZE), top: Math.round(b.y * SIZE) });
}
const board = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" fill="#ffffff"/>${cells.join('')}</svg>`);
const png = await sharp(board).composite(layers).png({ compressionLevel: 9 }).toBuffer();
fs.writeFileSync(OUT, png);
console.log(`${OUT}: ${LOGOS.length} logos, ${png.length} bytes, sha1 ${crypto.createHash('sha1').update(png).digest('hex')}`);
console.log(`GPU: one layer at the tier's size: 512 px ${(512 * 512 * 5 * 4 / 3 / 1048576).toFixed(2)} MB, 256 px ${(256 * 256 * 5 * 4 / 3 / 1048576).toFixed(2)} MB (RGBA + R8 mask, with mips)`);
if (process.argv.includes('--publish')) {
  const dir = path.join('public/canal-drive', path.dirname(LOGO_ATLAS_PATH));
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(OUT, path.join('public/canal-drive', LOGO_ATLAS_PATH));
  fs.copyFileSync(path.join(SRC, 'provenance.json'), path.join(dir, 'provenance.json'));
  console.log(`published to ${dir}`);
}
