// Lane retail-fit: a strip of rectified per-bay crops (pand-reference all-walls output), the bottom `--h` metres of each,
// in the order given: one montage per front so a reader sees which arch holds which tenant.
//   npx tsx scripts/retail-fit/bay-strip.ts --dir=<all-walls pand dir> --tags=w17-322r,w08-323r --out=<png> [--h=7]
import sharp from 'sharp';
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const dir = arg('dir')!, tags = arg('tags')!.split(','), out = arg('out')!, hM = Number(arg('h') ?? 7), ppm = 50;
const parts = await Promise.all(tags.map(async t => {
  const img = sharp(`${dir}/${t}.jpg`), m = await img.metadata();
  const h = Math.min(m.height!, Math.round(hM * ppm));
  return { buf: await img.extract({ left: 0, top: m.height! - h, width: m.width!, height: h }).png().toBuffer(), w: m.width!, h };
}));
const H = Math.max(...parts.map(p => p.h)), W = parts.reduce((s, p) => s + p.w + 4, 0);
let x = 0;
await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
  .composite(parts.map(p => { const c = { input: p.buf, left: x, top: H - p.h }; x += p.w + 4; return c; })).png().toFile(out);
console.log(out, W, H);
