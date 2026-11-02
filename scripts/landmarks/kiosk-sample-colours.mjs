// Median colour of small boxes in a photo: node scripts/landmarks/kiosk-sample-colours.mjs <img> name:x,y,w,h ...
// Used by the kiosk lane (#180) to measure tints (frames, panels, roof, awning) from Gemeente Amsterdam panoramas.
import sharp from 'sharp';
const [img, ...boxes] = process.argv.slice(2);
const {data, info} = await sharp(img).raw().toBuffer({resolveWithObject: true});
for (const b of boxes) {
  const [name, rect] = b.split(':'), [x, y, w, h] = rect.split(',').map(Number);
  const ch = [[], [], []];
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) for (let k = 0; k < 3; k++) ch[k].push(data[(j * info.width + i) * info.channels + k]);
  const med = ch.map(c => c.sort((p, q) => p - q)[c.length >> 1]);
  console.log(name.padEnd(14), '#' + med.map(v => v.toString(16).padStart(2, '0')).join(''));
}
