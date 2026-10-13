// Usage: node scripts/landmarks/big-median.mjs <img> <x0,y0,x1,y1> [more boxes...] : per-channel median colour (hex) of each pixel box.
import sharp from 'sharp';
const [file, ...boxes] = process.argv.slice(2);
const {data, info} = await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject: true});
for (const b of boxes) {
  const [x0, y0, x1, y1] = b.split(',').map(Number), ch = [[], [], []];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * info.width + x) * 3; for (let k = 0; k < 3; k++) ch[k].push(data[i + k]); }
  const med = ch.map(a => a.sort((p, q) => p - q)[a.length >> 1]);
  console.log(b, '#' + med.map(v => v.toString(16).padStart(2, '0')).join(''));
}
