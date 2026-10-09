// Usage: node scripts/landmarks/pathe-de-munt-contact.mjs <out.png> <label=path[@left,top,width,height]>...
// Labelled horizontal contact sheet, every cell scaled to the same height (optional source crop).
import sharp from 'sharp';
const [out, ...items] = process.argv.slice(2);
const H = 560, LABEL = 34, cells = [];
for (const item of items) {
  const i = item.indexOf('='), label = item.slice(0, i), [file, crop] = item.slice(i + 1).split('@');
  let img = sharp(file);
  if (crop) { const [left, top, width, height] = crop.split(',').map(Number); img = img.extract({left, top, width, height}); }
  const buf = await img.resize({height: H}).png().toBuffer(), {width} = await sharp(buf).metadata();
  const text = Buffer.from(`<svg width="${width}" height="${LABEL}"><rect width="100%" height="100%" fill="#111"/><text x="10" y="23" font-family="Helvetica, Arial" font-size="18" fill="#eee">${label}</text></svg>`);
  cells.push({buf, width, text});
}
let x = 0;
const comp = cells.flatMap(c => { const l = x; x += c.width + 6; return [{input: c.buf, left: l, top: LABEL}, {input: c.text, left: l, top: 0}]; });
await sharp({create: {width: x - 6, height: H + LABEL, channels: 3, background: '#222'}}).composite(comp).png().toFile(out);
console.log(out, x - 6, H + LABEL);
