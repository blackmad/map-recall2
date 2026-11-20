// Lane retail-fit: median sRGB of a rectified wall crop (all-walls, 50 px/m, bottom = ground) inside a box in metres,
// split into dark (< L 110: glass and interior) and light (>= L 150: curtains, frames) pixels.
//   npx tsx scripts/retail-fit/region-tone.ts --crop=<jpg> --box=u0,v0,u1,v1   (u from the crop's left, v above ground)
import sharp from 'sharp';
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const [u0, v0, u1, v1] = arg('box')!.split(',').map(Number);
const { data, info } = await sharp(arg('crop')!).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const hex = (c: number[]) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const groups: Record<string, number[][]> = { dark: [[], [], []], light: [[], [], []], all: [[], [], []] };
for (let y = Math.round(info.height - v1 * 50); y < info.height - v0 * 50; y++) for (let x = Math.round(u0 * 50); x < Math.min(info.width, u1 * 50); x++) {
  const i = (y * info.width + x) * 3, L = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  for (const g of ['all', ...(L < 110 ? ['dark'] : L >= 150 ? ['light'] : [])]) for (let c = 0; c < 3; c++) groups[g][c].push(data[i + c]);
}
for (const [g, ch] of Object.entries(groups)) if (ch[0].length) console.log(`${g}\t${hex(ch.map(a => a.sort((p, q) => p - q)[a.length >> 1]))}\t${ch[0].length} px`);
