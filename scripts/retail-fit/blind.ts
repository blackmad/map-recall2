// Lane retail-fit: blind sheets (photo | A | B, the two game renders in a seeded random order) from two node-frame runs
// of the same prepared poses (--frame game), and the key in a separate file the judge never sees.
//   npx tsx scripts/retail-fit/blind.ts --off=<dir> --fit=<dir> --out=<dir> [--seed=11] [--crop=x0,y0,x1,y1]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const OFF = arg('off')!, FIT = arg('fit')!, OUT = arg('out')!, W = 1200;
const crops: Record<string, number[]> = JSON.parse(arg('crops') ?? '{}');
let seed = Number(arg('seed') ?? 11);
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
fs.mkdirSync(OUT, { recursive: true });
const key: Record<string, { pose: string; A: string; B: string }> = {};
let i = 0;
const only = arg('only')?.split(',');
for (const k of fs.readdirSync(FIT).sort().filter(k => !only || only.includes(k))) {
  const photo = path.join(OFF, k, 'photo.jpg'), a = path.join(OFF, k, 'likeness.node.png'), b = path.join(FIT, k, 'likeness.node.png');
  if (![photo, a, b].every(f => fs.existsSync(f))) continue;
  const [x0, y0, x1, y1] = crops[k] ?? [0, 0.25, 1, 0.85];
  const cut = async (src: string) => {
    const full = await sharp(src).resize(1440, 900, { fit: 'fill' }).png().toBuffer();
    const ext = { left: Math.round(x0 * 1440), top: Math.round(y0 * 900), width: Math.round((x1 - x0) * 1440), height: Math.round((y1 - y0) * 900) };
    return sharp(full).extract(ext).resize(W).png().toBuffer();
  };
  const h = Math.round(W * (y1 - y0) * 900 / ((x1 - x0) * 1440));
  const order = rnd() < 0.5 ? [['today', a], ['fit', b]] : [['fit', b], ['today', a]];
  const label = (t: string) => Buffer.from(`<svg width="${W}" height="36"><rect width="100%" height="100%" fill="#111"/><text x="10" y="26" font-family="Helvetica" font-size="24" fill="#eee">${t}</text></svg>`);
  const parts = [{ t: 'PHOTO', img: await cut(photo) }, { t: 'A', img: await cut(order[0][1]) }, { t: 'B', img: await cut(order[1][1]) }];
  const tiles: sharp.OverlayOptions[] = []; let y = 0;
  for (const p of parts) { tiles.push({ input: label(p.t), left: 0, top: y }); y += 36; tiles.push({ input: p.img, left: 0, top: y }); y += h + 8; }
  const name = `pair-${String(++i).padStart(2, '0')}.jpg`;
  await sharp({ create: { width: W, height: y, channels: 3, background: '#222' } }).composite(tiles).jpeg({ quality: 88 }).toFile(path.join(OUT, name));
  key[name] = { pose: k, A: order[0][0], B: order[1][0] };
}
fs.writeFileSync(arg('key') ?? path.join(path.dirname(OUT), 'blind-key.json'), JSON.stringify(key, null, 1));
console.log(`${i} sheets -> ${OUT}`);
