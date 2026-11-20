// Lane retail-fit: cut each pose's photo to a crop (front-crop.ts fractions) and stack them for reading.
//   npx tsx scripts/retail-fit/crop-photos.mts <frames dir> <crops.json> <out.jpg> [width]
import fs from 'node:fs';
import sharp from 'sharp';
const [dir, cropsF, out, wS] = process.argv.slice(2), crops = JSON.parse(fs.readFileSync(cropsF, 'utf8')) as Record<string, number[]>, W = Number(wS ?? 700);
const parts: Buffer[] = [];
for (const [k, [x0, y0, x1, y1]] of Object.entries(crops)) {
  const f = `${dir}/${k}/photo.jpg`; if (!fs.existsSync(f)) continue;
  const m = await sharp(f).metadata(), w = m.width!, h = m.height!;
  const img = await sharp(f).extract({ left: Math.round(x0 * w), top: Math.round(y0 * h), width: Math.max(8, Math.round((x1 - x0) * w)), height: Math.max(8, Math.round((y1 - y0) * h)) }).resize({ width: W }).toBuffer();
  const lab = Buffer.from(`<svg width="${W}" height="28"><rect width="100%" height="100%" fill="#111"/><text x="6" y="20" font-size="18" fill="#fff" font-family="sans-serif">${k}</text></svg>`);
  parts.push(await sharp(lab).png().toBuffer(), img);
}
const metas = await Promise.all(parts.map(p => sharp(p).metadata()));
let y = 0; const comp = parts.map((p, i) => { const r = { input: p, top: y, left: 0 }; y += metas[i].height!; return r; });
await sharp({ create: { width: W, height: y, channels: 3, background: '#222' } }).composite(comp).jpeg({ quality: 88 }).toFile(out);
