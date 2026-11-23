/**
 * Accent marks in the lettering cell (lane shopfront-feedback-20261123, David's note fd607d78 "Café Bonjour: missing
 * the é"). Paints retailLogos.ts accentGlyphSvg's acute and diaeresis into the lettering cell's two free slots
 * (ACCENT_SLOTS) of the published atlas and of its staged copy, touching no other pixel: a full build-logo-atlas.ts run
 * no longer reproduces the published atlas byte for byte, so this patches it in place. Refuses when a slot holds ink.
 *   node --import tsx scripts/retail-real/add-accent-glyphs.ts [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ACCENT_SLOTS, GLYPH_GRID, LOGO_ATLAS_PATH, accentGlyphSvg, glyphCellBox } from '../../src/canalRecall/retailLogos.ts';

const SIZE = 512, gb = glyphCellBox(), gw = gb.w * SIZE / GLYPH_GRID.cols, gh = gb.h * SIZE / GLYPH_GRID.rows;
const files = [path.join('public/canal-drive', LOGO_ATLAS_PATH), 'data/retail-ground/retail-logos.png'];
for (const file of files) {
  const img = sharp(fs.readFileSync(file)), meta = await img.metadata();
  if (meta.width !== SIZE || meta.height !== SIZE) throw new Error(`${file}: ${meta.width} x ${meta.height}, want ${SIZE}`);
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const marks: string[] = [];
  for (const [kind, i] of Object.entries(ACCENT_SLOTS)) {
    const x = gb.x * SIZE + (i % GLYPH_GRID.cols) * gw, y = gb.y * SIZE + Math.floor(i / GLYPH_GRID.cols) * gh;
    // The slot's whole-pixel interior must be the cell's black (or already this mark).
    let ink = 0;
    for (let yy = Math.ceil(y) + 1; yy < Math.floor(y + gh) - 1; yy++) for (let xx = Math.ceil(x) + 1; xx < Math.floor(x + gw) - 1; xx++) if (data[(yy * info.width + xx) * 4] > 40) ink++;
    marks.push(accentGlyphSvg(kind as keyof typeof ACCENT_SLOTS, x, y, gw, gh));
    console.log(`${file} slot ${i} (${kind}): ${ink} lit px before`);
  }
  if (process.argv.includes('--check')) continue;
  // Draw black slots then the marks, composited only over the two slots' rect.
  const x0 = Math.floor(gb.x * SIZE + (ACCENT_SLOTS.acute % GLYPH_GRID.cols) * gw), y0 = Math.floor(gb.y * SIZE + Math.floor(ACCENT_SLOTS.acute / GLYPH_GRID.cols) * gh);
  const x1 = Math.ceil(gb.x * SIZE + (ACCENT_SLOTS.diaeresis % GLYPH_GRID.cols + 1) * gw), y1 = Math.ceil(y0 + gh);
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="#000000"/>${marks.join('')}</svg>`);
  const overlay = await sharp(svg).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }).png().toBuffer();
  const out = await sharp(fs.readFileSync(file)).composite([{ input: overlay, left: x0, top: y0 }]).png({ compressionLevel: 9 }).toBuffer();
  // Every pixel outside the slots' rect is unchanged.
  const a = await sharp(fs.readFileSync(file)).ensureAlpha().raw().toBuffer(), b = await sharp(out).ensureAlpha().raw().toBuffer();
  for (let p = 0; p < SIZE * SIZE; p++) {
    const xx = p % SIZE, yy = Math.floor(p / SIZE);
    if (xx >= x0 && xx < x1 && yy >= y0 && yy < y1) continue;
    for (let c = 0; c < 4; c++) if (a[p * 4 + c] !== b[p * 4 + c]) throw new Error(`${file}: pixel ${xx},${yy} changed outside the slots`);
  }
  fs.writeFileSync(file, out);
  console.log(`${file}: marks painted in [${x0}, ${x1}) x [${y0}, ${y1})`);
}
