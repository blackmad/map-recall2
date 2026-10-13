// Usage: node scripts/landmarks/overlay-images.mjs <photo> <render> <out.png> [alpha=0.5]
// Photo | render | 50% blend, all resized to the photo's size, side by side (for camera-matched comparisons).
import sharp from 'sharp';
const [photo, render, out, alpha = '0.5'] = process.argv.slice(2);
const m = await sharp(photo).metadata();
const W = m.width, H = m.height;
const p = await sharp(photo).resize(W, H).png().toBuffer();
const r = await sharp(render).resize(W, H, {fit: 'fill'}).ensureAlpha(+alpha).png().toBuffer();
const rr = await sharp(render).resize(W, H, {fit: 'fill'}).png().toBuffer();
const blend = await sharp(p).composite([{input: r}]).png().toBuffer();
await sharp({create: {width: W * 3, height: H, channels: 3, background: '#fff'}})
  .composite([{input: p, left: 0, top: 0}, {input: rr, left: W, top: 0}, {input: blend, left: 2 * W, top: 0}]).png().toFile(out);
console.log(out);
