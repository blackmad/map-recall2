// Usage: node scripts/landmarks/big-stitch.mjs <out.jpg> <dropLeftPx,...> <tile1.jpg> <tile2.jpg> ... : stitches rectified tiles left to right (same height),
// dropping the given number of pixels from the left edge of each tile (overlap between neighbouring rectifications).
import sharp from 'sharp';
const [out, drops, ...files] = process.argv.slice(2);
const d = drops.split(',').map(Number);
const parts = [];
let x = 0, h = 0;
for (let i = 0; i < files.length; i++) {
  const m = await sharp(files[i]).metadata();
  h = Math.max(h, m.height);
  const buf = await sharp(files[i]).extract({left: d[i] ?? 0, top: 0, width: m.width - (d[i] ?? 0), height: m.height}).toBuffer();
  parts.push({input: buf, left: x, top: 0});
  x += m.width - (d[i] ?? 0);
}
await sharp({create: {width: x, height: h, channels: 3, background: '#808080'}}).composite(parts).jpeg({quality: 90}).toFile(out);
console.log(out, x, h);
