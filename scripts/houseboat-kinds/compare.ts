// Side-by-side per review quay: orthophoto with the kinds drawn before photo facts (footprint
// classifier + hash split) and after, then the in-game frames before and after when present.
//   npx tsx scripts/houseboat-kinds/compare.ts -> artifacts/houseboat-kinds/compare/<quay>.png
import fs from 'node:fs';
import sharp from 'sharp';
import { QUAYS } from './quay.ts';

const D = 'artifacts/houseboat-kinds';
fs.mkdirSync(`${D}/compare`, { recursive: true });
const H = 640;
const label = (text: string, w: number) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="28"><rect width="100%" height="100%" fill="#111"/><text x="8" y="20" font-family="Helvetica" font-size="17" fill="#fff">${text}</text></svg>`);
for (const quay of Object.keys(QUAYS)) {
  const parts = [
    { file: `${D}/quays/${quay}-hash.png`, text: `${quay}: footprint + hash (red barge, yellow hullbox, cyan ark)` },
    { file: `${D}/quays/${quay}-after.png`, text: 'photo facts (dashed grey: empty berth, hidden)' },
    { file: `${D}/shots/hash/${quay}.png`, text: 'in game, footprint + hash' },
    { file: `${D}/shots/after/${quay}.png`, text: 'in game, photo facts' },
  ].filter(p => fs.existsSync(p.file));
  const imgs = await Promise.all(parts.map(async p => { const b = await sharp(p.file).resize({ height: H }).png().toBuffer(); const m = await sharp(b).metadata(); return { b, w: m.width!, text: p.text }; }));
  let x = 0;
  const comps: sharp.OverlayOptions[] = [];
  for (const im of imgs) { comps.push({ input: label(im.text, im.w), left: x, top: 0 }, { input: im.b, left: x, top: 28 }); x += im.w + 6; }
  await sharp({ create: { width: x, height: H + 28, channels: 3, background: '#111' } }).composite(comps).png().toFile(`${D}/compare/${quay}.png`);
}
console.log(`${D}/compare`);
