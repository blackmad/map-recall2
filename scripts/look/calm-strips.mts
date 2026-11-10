// Gallery-size strips for the calm frame review: `tsx scripts/look/calm-strips.mts <out-dir> label=a.png,b.png,c.png ...`
// is too loose; usage is by column dirs: `tsx scripts/look/calm-strips.mts <out> <dirA>:<variantA> <dirB>:<variantB> ...`
// e.g. `artifacts/calm/base:default artifacts/calm/all:world artifacts/calm/toonfr:world` writes one strip per AB spot
// (columns left to right, 560 px wide each) from the world-v1-ab fixed-camera frames.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { AB_SPOTS } from '../world/abSpots.ts';

const [out, ...columns] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const W = 560;
for (const spot of AB_SPOTS) {
  const tiles = await Promise.all(columns.map(async c => {
    const [dir, variant] = c.split(':');
    return sharp(`${dir}/${spot.name}-${variant}.png`).resize({ width: W }).png().toBuffer({ resolveWithObject: true });
  }));
  const h = Math.max(...tiles.map(t => t.info.height));
  await sharp({ create: { width: W * tiles.length + 8 * (tiles.length - 1), height: h, channels: 3, background: '#ffffff' } })
    .composite(tiles.map((t, i) => ({ input: t.data, left: i * (W + 8), top: 0 }))).png().toFile(`${out}/${spot.name}.png`);
  console.log(`${out}/${spot.name}.png`);
}
