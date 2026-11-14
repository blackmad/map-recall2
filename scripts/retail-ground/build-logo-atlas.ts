// Paints the chain-logo atlas (lane retail-ground round 2): data/retail-ground/logos/<key>.png (Wikimedia Commons,
// provenance.json) fitted into retailLogos.ts's grid on each template's fascia colour, 512 px (the desktop-high layer;
// smaller tiers downsample at load). Stages data/retail-ground/retail-logos.png; `--publish` (the integrator's step)
// copies it and the provenance to public/canal-drive/materials/retail-logos/.
//   node --import tsx scripts/retail-ground/build-logo-atlas.ts [--publish]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { GLYPH_CHARS, GLYPH_FONT, GLYPH_GRID, GLYPH_INK, LOGOS, LOGO_ATLAS_PATH, glyphCellBox, logoBox } from '../../src/canalRecall/retailLogos.ts';
import { TEMPLATE_LOOKS } from '../../src/canalRecall/retailTemplates.ts';

const SIZE = 512, SRC = 'data/retail-ground/logos', OUT = 'data/retail-ground/retail-logos.png';
const provenance = JSON.parse(fs.readFileSync(path.join(SRC, 'provenance.json'), 'utf8'));
const layers: sharp.OverlayOptions[] = [];
const cells: string[] = [];
const aspects: Record<string, number> = {};
for (const [i, { key, aspect }] of LOGOS.entries()) {
  if (!provenance.logos[key]) throw new Error(`${key}: no provenance`);
  // The Commons renders carry transparent margins; the atlas holds the trimmed mark, so retailLogos.ts LOGOS keeps
  // the trimmed aspect (checked here).
  const t = await sharp(await sharp(path.join(SRC, `${key}.png`)).trim().toBuffer()).metadata();
  aspects[key] = +(t.width! / t.height!).toFixed(3);
  if (Math.abs(aspects[key] - aspect) > 0.01) throw new Error(`${key}: retailLogos.ts aspect ${aspect.toFixed(3)}, trimmed ${aspects[key]}`);
  const b = logoBox(i), w = Math.round(b.w * SIZE), h = Math.round(b.h * SIZE);
  const cw = SIZE / 2, ch = SIZE / 4, cx = (i % 2) * cw, cy = Math.floor(i / 2) * ch;
  // The cell in the fascia colour (mip levels bleed the board, not another logo), the logo fitted on it.
  cells.push(`<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="${TEMPLATE_LOOKS[key].fascia}"/>`);
  const logo = await sharp(await sharp(path.join(SRC, `${key}.png`)).trim().toBuffer()).resize(w, h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  layers.push({ input: logo, left: Math.round(b.x * SIZE), top: Math.round(b.y * SIZE) });
}
// Round 3c: the fascia lettering cell (retailLogos.ts GLYPH_*): white bold sans on black; paintLookAtlas turns it into
// mask channels. Each glyph's ink is checked against GLYPH_INK at 8x.
const FONT = 'Helvetica Neue, Helvetica, Arial, sans-serif';
const gb = glyphCellBox(), gw = gb.w * SIZE / GLYPH_GRID.cols, gh = gb.h * SIZE / GLYPH_GRID.rows;
const glyphSvg = (ch: string, x: number, y: number, k: number) => `<text x="${(x + gw / 2) * k}" y="${(y + gh * GLYPH_FONT.baseline) * k}" font-family="${FONT}" font-weight="bold" font-size="${gh * GLYPH_FONT.size * k}" text-anchor="middle" fill="#ffffff">${ch}</text>`;
cells.push(`<rect x="${gb.x * SIZE}" y="${gb.y * SIZE}" width="${gb.w * SIZE}" height="${gb.h * SIZE}" fill="#000000"/>`);
for (const [i, ch] of [...GLYPH_CHARS].entries()) {
  const x = gb.x * SIZE + (i % GLYPH_GRID.cols) * gw, y = gb.y * SIZE + Math.floor(i / GLYPH_GRID.cols) * gh;
  cells.push(glyphSvg(ch, x, y, 1));
  const k = 8, one = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(gw * k)}" height="${gh * k}"><rect width="100%" height="100%" fill="#000"/>${glyphSvg(ch, 0, 0, k)}</svg>`);
  const { data, info } = await sharp(one).greyscale().raw().toBuffer({ resolveWithObject: true });
  let x0 = Infinity, x1 = -1;
  for (let yy = 0; yy < info.height; yy++) for (let xx = 0; xx < info.width; xx++) if (data[yy * info.width + xx] > 64) { x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); }
  const ink = [x0 / info.width, (x1 + 1) / info.width], want = GLYPH_INK[ch];
  if (!want || Math.abs(ink[0] - want[0]) > 0.012 || Math.abs(ink[1] - want[1]) > 0.012) throw new Error(`glyph ${ch}: ink ${ink.map(v => v.toFixed(3))}, retailLogos.ts GLYPH_INK ${want}`);
}
const board = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" fill="#ffffff"/>${cells.join('')}</svg>`);
const png = await sharp(board).composite(layers).png({ compressionLevel: 9 }).toBuffer();
fs.writeFileSync(OUT, png);
fs.writeFileSync(OUT.replace(/\.png$/, '.json'), JSON.stringify({ size: SIZE, logos: LOGOS.map(l => ({ key: l.key, aspect: aspects[l.key], source: provenance.logos[l.key].file, licence: provenance.logos[l.key].licence })) }, null, 1));
console.log(`${OUT}: ${LOGOS.length} logos, ${GLYPH_CHARS.length} glyphs, ${png.length} bytes, sha1 ${crypto.createHash('sha1').update(png).digest('hex')}`);
console.log(`GPU: one layer at the tier's size: 512 px ${(512 * 512 * 5 * 4 / 3 / 1048576).toFixed(2)} MB, 256 px ${(256 * 256 * 5 * 4 / 3 / 1048576).toFixed(2)} MB (RGBA + R8 mask, with mips)`);
if (process.argv.includes('--publish')) {
  const dir = path.join('public/canal-drive', path.dirname(LOGO_ATLAS_PATH));
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(OUT, path.join('public/canal-drive', LOGO_ATLAS_PATH));
  fs.copyFileSync(path.join(SRC, 'provenance.json'), path.join(dir, 'provenance.json'));
  console.log(`published to ${dir}`);
}
