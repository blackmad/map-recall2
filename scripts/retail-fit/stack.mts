// Lane retail-fit: stack images vertically with a label each (contact sheets for reads).
//   npx tsx scripts/retail-fit/stack.mts <out.jpg> <width> <label=path> ...
import sharp from 'sharp';
const [out, w, ...items] = process.argv.slice(2), W = Number(w);
const tiles: sharp.OverlayOptions[] = []; let y = 0;
for (const it of items) {
  const [label, file] = it.split('=');
  const img = await sharp(file).resize({ width: W, height: 300, fit: 'inside' }).png().toBuffer(), m = await sharp(img).metadata();
  tiles.push({ input: Buffer.from(`<svg width="${W}" height="26"><rect width="100%" height="100%" fill="#111"/><text x="6" y="19" font-family="Helvetica" font-size="17" fill="#eee">${label}</text></svg>`), left: 0, top: y }); y += 26;
  tiles.push({ input: img, left: 0, top: y }); y += m.height! + 4;
}
await sharp({ create: { width: W, height: y, channels: 3, background: '#222' } }).composite(tiles).jpeg({ quality: 85 }).toFile(out);
