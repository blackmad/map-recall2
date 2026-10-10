/**
 * Crop + upscale a region of an image, with an optional metre grid, for reading elevations by eye.
 *   node --import tsx scripts/haparandaweg/crop.ts <in> <out> x,y,w,h [scale=2] [--grid=50]   (grid = px spacing, labelled in source px)
 */
import sharp from 'sharp';

const [inp, out, box, sc] = process.argv.slice(2);
const [x, y, w, h] = box.split(',').map(Number), scale = Number(sc && !sc.startsWith('--') ? sc : '2');
const grid = Number(process.argv.find(a => a.startsWith('--grid='))?.slice(7) ?? 0);
let img = sharp(inp).extract({ left: x, top: y, width: w, height: h }).resize(Math.round(w * scale), Math.round(h * scale), { kernel: 'lanczos3' });
if (grid) {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}">`;
  for (let gx = Math.ceil(x / grid) * grid; gx < x + w; gx += grid) svg += `<line x1="${(gx - x) * scale}" y1="0" x2="${(gx - x) * scale}" y2="${h * scale}" stroke="#0f0" stroke-width="1" opacity="0.6"/><text x="${(gx - x) * scale + 2}" y="12" font-size="12" fill="#0f0">${gx}</text>`;
  for (let gy = Math.ceil(y / grid) * grid; gy < y + h; gy += grid) svg += `<line y1="${(gy - y) * scale}" x1="0" y2="${(gy - y) * scale}" x2="${w * scale}" stroke="#0ff" stroke-width="1" opacity="0.6"/><text y="${(gy - y) * scale - 2}" x="2" font-size="12" fill="#0ff">${gy}</text>`;
  svg += '</svg>';
  img = sharp(await img.png().toBuffer()).composite([{ input: Buffer.from(svg) }]);
}
await img.png().toFile(out);
console.log(out);
