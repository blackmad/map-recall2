/**
 * Strips for the lane: per spot, panorama | before | after, labelled, at gallery size (each frame 960 px wide).
 *   node --import tsx scripts/newbuild/sheet.ts <spots.json> <panoDir> <beforeDir> <afterDir> <outDir>
 * Writes <outDir>/<slug>.png per spot and <outDir>/all.jpg.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [spotsFile, panoDir, beforeDir, afterDir, outDir] = process.argv.slice(2);
const spots = JSON.parse(fs.readFileSync(spotsFile, 'utf8')) as { slug: string; name: string }[];
fs.mkdirSync(outDir, { recursive: true });
const W = 960, H = 551, HEAD = 44;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const label = (t: string, w: number) => Buffer.from(`<svg width="${w}" height="${HEAD}"><rect width="${w}" height="${HEAD}" fill="#111"/><text x="12" y="29" font-size="22" font-family="sans-serif" fill="#fff">${esc(t)}</text></svg>`);
async function frame(file: string, caption: string): Promise<Buffer> {
  const img = fs.existsSync(file) ? await sharp(file).resize(W, H, { fit: 'cover' }).toBuffer() : await sharp({ create: { width: W, height: H, channels: 3, background: '#666' } }).png().toBuffer();
  return sharp({ create: { width: W, height: H + HEAD, channels: 3, background: '#000' } }).composite([{ input: label(caption, W), top: 0, left: 0 }, { input: img, top: HEAD, left: 0 }]).png().toBuffer();
}
const rows: Buffer[] = [];
for (const s of spots) {
  const cells = [await frame(path.join(panoDir, `${s.slug}.jpg`), `panorama: ${s.name}`), await frame(path.join(beforeDir, `${s.slug}.png`), 'before (storybook)'), await frame(path.join(afterDir, `${s.slug}.png`), 'after (storybook, newbuildFamily=1)')];
  const row = await sharp({ create: { width: W * 3, height: H + HEAD, channels: 3, background: '#000' } }).composite(cells.map((c, i) => ({ input: c, top: 0, left: i * W }))).png({ compressionLevel: 3 }).toBuffer();
  fs.writeFileSync(path.join(outDir, `${s.slug}.png`), row);
  rows.push(row);
}
await sharp({ create: { width: W * 3, height: (H + HEAD) * rows.length, channels: 3, background: '#000' } })
  .composite(rows.map((r, i) => ({ input: r, top: i * (H + HEAD), left: 0 }))).jpeg({ quality: 88 }).toFile(path.join(outDir, 'all.jpg'));
console.log('wrote', rows.length, 'strips to', outDir);
