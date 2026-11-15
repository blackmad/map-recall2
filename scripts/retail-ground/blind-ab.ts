/**
 * Blind A/B pairs (lane retail-look round 5): per sheet front, the photo crop over two game crops (look-sheet.ts crops),
 * the runs assigned to A and B by a seeded shuffle; the key goes to a separate file the judge never sees.
 *   node --import tsx scripts/retail-ground/blind-ab.ts --list=scripts/retail-ground/look-fronts.json \
 *     --runs=off:<dir>,r5:<dir> --out=<dir> --seed=5
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const list = JSON.parse(fs.readFileSync(arg('list')!, 'utf8')) as Array<{ key: string; crop?: [number, number, number, number]; frame?: 'likeness' | 'game' }>;
const runs = arg('runs')!.split(',').map(r => { const [label, dir] = r.split(':'); return { label, dir }; });
const OUT = arg('out')!, W = 1200;
let seed = Number(arg('seed') ?? 5);
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
fs.mkdirSync(OUT, { recursive: true });
const key: Record<string, Record<string, string>> = {};
let i = 0;
for (const e of list) {
  const frame = e.frame ?? 'likeness';
  const photo = path.join(runs[0].dir, e.key, frame === 'likeness' ? 'likeness-photo.jpg' : 'photo.jpg');
  if (!fs.existsSync(photo)) continue;
  const meta = await sharp(photo).metadata();
  const [x0, y0, x1, y1] = e.crop ?? [0, 0.5, 1, 1];
  const ext = { left: Math.round(x0 * meta.width!), top: Math.round(y0 * meta.height!), width: Math.round((x1 - x0) * meta.width!), height: Math.round((y1 - y0) * meta.height!) };
  const h = Math.round(W * ext.height / ext.width);
  const cut = async (src: string) => sharp(await sharp(await sharp(src).resize(meta.width, meta.height, { fit: 'fill' }).png().toBuffer()).extract(ext).png().toBuffer()).resize(W, h).png().toBuffer();
  const order = rnd() < 0.5 ? [runs[0], runs[1]] : [runs[1], runs[0]];
  const label = (t: string) => Buffer.from(`<svg width="${W}" height="36"><rect width="100%" height="100%" fill="#111"/><text x="10" y="26" font-family="Helvetica" font-size="24" fill="#eee">${t}</text></svg>`);
  const parts = [{ t: 'PHOTO', img: await cut(photo) }, ...await Promise.all(order.map(async (r, j) => ({ t: j ? 'B' : 'A', img: await cut(path.join(r.dir, e.key, frame === 'likeness' ? 'likeness.png' : 'game.png')) })))];
  const tiles: sharp.OverlayOptions[] = []; let y = 0;
  for (const p of parts) { tiles.push({ input: label(p.t), left: 0, top: y }); y += 36; tiles.push({ input: p.img, left: 0, top: y }); y += h + 8; }
  const name = `front-${String(++i).padStart(2, '0')}.jpg`;
  await sharp({ create: { width: W, height: y, channels: 3, background: '#222' } }).composite(tiles).jpeg({ quality: 88 }).toFile(path.join(OUT, name));
  key[name] = { front: e.key, A: order[0].label, B: order[1].label };
}
fs.writeFileSync(arg('key') ?? path.join(path.dirname(OUT), 'blind-ab-key.json'), JSON.stringify(key, null, 1));
console.log(`${i} pairs -> ${OUT}`);
