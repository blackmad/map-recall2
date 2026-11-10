// Lane P4 (#330): the luma contrast of a landmark against the sky in street-haze-shots.mjs stills, arm against arm.
//   node scripts/street-haze-contrast.mjs <dir> <tagA> <tagB> [...more tags]
// The landmark's projected box (poses-<tag>.json `rect`) bounds it; its upper half (the tower above the roofline) is
// scored. Sky luma: the median of a strip just above the box (or the frame's top rows when the box reaches the top).
// Landmark pixels: those in the box half that differ from the sky by > 12 luma in the FIRST tag's still (the same mask
// is used for every tag). Contrast: the mean |L - L_sky| over the mask, 0-255 luma (Rec. 709).
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const [dir, ...tags] = process.argv.slice(2);
const poses = JSON.parse(fs.readFileSync(path.join(dir, `poses-${tags[0]}.json`), 'utf8'));
const lumaOf = async file => {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const L = new Float32Array(info.width * info.height);
  for (let i = 0; i < L.length; i++) L[i] = 0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2];
  return { L, W: info.width, H: info.height };
};
const median = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const rows = [];
for (const p of poses) {
  if (!p.found) { rows.push({ pose: p.name, note: 'landmark not resident' }); continue; }
  const imgs = await Promise.all(tags.map(t => lumaOf(path.join(dir, `${p.name}-${t}.png`))));
  const { W, H } = imgs[0];
  let [x0, y0, x1, y1] = p.rect; x0 = Math.max(0, x0); x1 = Math.min(W - 1, x1); y0 = Math.max(0, y0); y1 = Math.min(H - 1, y1);
  if (x1 <= x0 || y1 <= y0) { rows.push({ pose: p.name, d: p.d, note: 'off screen' }); continue; }
  const yMid = Math.round((y0 + y1) / 2);
  const skyY0 = y0 > 14 ? y0 - 12 : 0, skyY1 = y0 > 14 ? y0 - 4 : 6;
  const res = { pose: p.name, d: p.d, rect: [x0, y0, x1, y1] };
  let mask = null;
  imgs.forEach((im, k) => {
    const sky = []; for (let y = skyY0; y <= skyY1; y++) for (let x = x0; x <= x1; x++) sky.push(im.L[y * W + x]);
    const Ls = median(sky);
    if (!mask) { mask = []; for (let y = y0; y <= yMid; y++) for (let x = x0; x <= x1; x++) if (Math.abs(im.L[y * W + x] - Ls) > 12) mask.push(y * W + x); }
    let sum = 0; for (const i of mask) sum += Math.abs(im.L[i] - Ls);
    res[tags[k]] = { sky: Math.round(Ls), contrast: mask.length ? +(sum / mask.length).toFixed(1) : 0, px: mask.length };
  });
  rows.push(res);
}
console.log(JSON.stringify(rows, null, 1));
fs.writeFileSync(path.join(dir, `contrast-${tags.join('-')}.json`), JSON.stringify(rows, null, 1));
