// node sample.mjs img "label:x,y,w,h" ... -> median RGB hex per box (coords in the image's pixel space)
import sharp from 'sharp';
const [img, ...boxes] = process.argv.slice(2);
const {data, info} = await sharp(img).raw().toBuffer({resolveWithObject: true});
for (const b of boxes) {
  const [label, r] = b.split(':'); const [x, y, w, h] = r.split(',').map(Number);
  const ch = [[], [], []];
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { const k = (j * info.width + i) * info.channels; for (let c = 0; c < 3; c++) ch[c].push(data[k + c]); }
  const med = ch.map(a => a.sort((p, q) => p - q)[a.length >> 1]);
  console.log(label, '#' + med.map(v => v.toString(16).padStart(2, '0')).join(''), med.join(','));
}
