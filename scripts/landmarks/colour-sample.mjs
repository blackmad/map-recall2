// node colour-sample.mjs <image> x,y,r [x,y,r ...]
// Median RGB (ignores mortar/shadow outliers) of square patches of a reference photo, for choosing palette colours.
import sharp from 'sharp';
const [file, ...patches] = process.argv.slice(2);
const {data, info} = await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject: true});
for (const p of patches) {
  const [x, y, r] = p.split(',').map(Number);
  const ch = [[], [], []];
  for (let j = Math.max(0, y - r); j < Math.min(info.height, y + r); j++) for (let i = Math.max(0, x - r); i < Math.min(info.width, x + r); i++) for (let k = 0; k < 3; k++) ch[k].push(data[(j * info.width + i) * 3 + k]);
  const m = ch.map(a => a.sort((u, v) => u - v)[a.length >> 1]);
  console.log(p, '#' + m.map(v => v.toString(16).padStart(2, '0')).join(''), `rgb(${m.join(',')})`);
}
