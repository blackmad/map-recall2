// Mean luminance (Rec. 709 weights on sRGB 0–255) of a frame and of named pixel rectangles.
//   node scripts/frame-luminance.mjs <png> name=x0,y0,x1,y1 ...   → JSON line { frame, regions }
// OVERLAY=<png> draws the rectangles on the frame. CROPS=<dir> also writes each region as <dir>/<png basename>-<name>.png (to check what a rectangle covers).
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const [file, ...specs] = process.argv.slice(2);
const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const luma = (x0, y0, x1, y1) => {
  let s = 0, n = 0;
  for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
    const i = (y * W + x) * 3;
    s += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; n++;
  }
  return n ? +(s / n).toFixed(1) : null;
};
const regions = {};
for (const spec of specs) {
  const [name, r] = spec.split('=');
  const [x0, y0, x1, y1] = r.split(',').map(Number);
  regions[name] = luma(x0, y0, x1, y1);
  if (process.env.CROPS) {
    fs.mkdirSync(process.env.CROPS, { recursive: true });
    await sharp(file).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }).toFile(path.join(process.env.CROPS, `${path.basename(path.dirname(file))}-${name}.png`));
  }
}
if (process.env.OVERLAY) {
  const rects = specs.map(s => { const [n, r] = s.split('='); const [a, b, c, d] = r.split(',').map(Number); return `<rect x="${a}" y="${b}" width="${c - a}" height="${d - b}" fill="none" stroke="magenta" stroke-width="3"/><text x="${a}" y="${b - 4}" fill="magenta" font-size="18">${n}</text>`; }).join('');
  await sharp(file).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${rects}</svg>`) }]).toFile(process.env.OVERLAY);
}
console.log(JSON.stringify({ file, frame: luma(0, 0, W, H), regions }));
