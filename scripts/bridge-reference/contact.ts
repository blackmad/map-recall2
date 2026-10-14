// Contact sheet of rectified faces for hand review: both sides of each bridge stacked, labelled.
//   npx tsx scripts/bridge-reference/contact.ts out.jpg BRU0031 BRU0032 …
import { existsSync } from 'node:fs';
import sharp from 'sharp';

const [out, ...ids] = process.argv.slice(2);
const W = 1000, rows: { input: Buffer; top: number; left: number }[] = [];
let y = 0;
for (const id of ids) for (const tag of ['m', 'p']) {
  const f = `artifacts/bridges/${id}/photo-${tag}.jpg`;
  if (!existsSync(f)) continue;
  const img = await sharp(f).resize({ width: W - 120, height: 170, fit: 'inside' }).toBuffer({ resolveWithObject: true });
  const label = Buffer.from(`<svg width="120" height="${img.info.height}"><rect width="120" height="${img.info.height}" fill="#222"/><text x="6" y="22" font-size="18" fill="#fff" font-family="sans-serif">${id.slice(3)} ${tag}</text></svg>`);
  rows.push({ input: label, top: y, left: 0 }, { input: img.data, top: y, left: 120 });
  y += img.info.height + 4;
}
await sharp({ create: { width: W, height: Math.max(1, y), channels: 3, background: '#000' } }).composite(rows).jpeg({ quality: 80 }).toFile(out);
console.log(out, y);
