// Panorama | before | after strips for the industrial kit (lane industrial-kit 2026-11-10).
//   npx tsx scripts/industrial/strip.ts <out.png> <title> <pano.jpg> <before.png> <after.png> [--crop=x,y,w,h]
// Each panel is 1000 x 625 (the game frames are cropped to the centre 16:10 band, `--crop` in game-frame pixels
// overrides), labelled; written as PNG at gallery size.
import sharp from 'sharp';

const [out, title, pano, before, after, ...flags] = process.argv.slice(2);
if (!after) throw new Error('usage: strip.ts <out.png> <title> <pano.jpg> <before.png> <after.png> [--crop=x,y,w,h]');
const crop = flags.find(f => f.startsWith('--crop='))?.slice(7).split(',').map(Number);
const W = 1000, H = 625, HEAD = 56;
const label = (text: string) => Buffer.from(`<svg width="${W}" height="${HEAD}"><rect width="100%" height="100%" fill="#1d1f21"/><text x="16" y="37" font-family="Helvetica, Arial" font-size="26" fill="#f2f2f0">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
async function panel(file: string, cut?: number[]) {
  let img = sharp(file);
  if (cut) img = img.extract({ left: cut[0], top: cut[1], width: cut[2], height: cut[3] });
  return img.resize(W, H, { fit: 'cover' }).png().toBuffer();
}
const panels = [await panel(pano), await panel(before, crop), await panel(after, crop)];
const names = ['Panorama (data.amsterdam.nl)', 'Before (main today)', 'After (industrial kit)'];
const titleBar = Buffer.from(`<svg width="${W * 3}" height="${HEAD}"><rect width="100%" height="100%" fill="#2b2e31"/><text x="16" y="38" font-family="Helvetica, Arial" font-size="28" font-weight="bold" fill="#ffffff">${title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
await sharp({ create: { width: W * 3, height: H + HEAD * 2, channels: 3, background: '#000' } })
  .composite([{ input: titleBar, left: 0, top: 0 }, ...panels.flatMap((p, i) => [{ input: label(names[i]), left: i * W, top: HEAD }, { input: p, left: i * W, top: HEAD * 2 }])])
  .png({ compressionLevel: 6 }).toFile(out);
console.log(out);
