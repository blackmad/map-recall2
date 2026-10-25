import sharp from 'sharp';
const [file, ...rects] = process.argv.slice(2);
const img = sharp(file); const {data, info} = await img.raw().toBuffer({resolveWithObject: true});
for (const r of rects) {
  const [x, y, w, h] = r.split(',').map(Number); const R = [], G = [], B = [];
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { const k = (j * info.width + i) * info.channels; R.push(data[k]); G.push(data[k + 1]); B.push(data[k + 2]); }
  const med = a => a.sort((p, q) => p - q)[a.length >> 1];
  const hex = [med(R), med(G), med(B)].map(v => v.toString(16).padStart(2, '0')).join('');
  console.log(r, '#' + hex);
}
