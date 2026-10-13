// node scripts/pand-reference/walls-montage.mjs <out.jpg> <dir> [tags...]  (thumbs of all-walls.ts output, 3 columns)
import sharp from 'sharp';
import fs from 'node:fs';
const [, , out, dir, ...tags] = process.argv;
const S = 520, C = 3;
const list = tags.length ? tags : fs.readdirSync(dir).filter(f => f.endsWith('.thumb.jpg')).map(f => f.replace('.thumb.jpg', ''));
const comps = [];
for (let i = 0; i < list.length; i++) {
  const p = `${dir}/${list[i]}.thumb.jpg`;
  if (!fs.existsSync(p)) continue;
  comps.push({ input: await sharp(p).resize(S, S).toBuffer(), left: (i % C) * S, top: Math.floor(i / C) * S });
  comps.push({ input: Buffer.from(`<svg width="${S}" height="24"><rect width="${S}" height="24" fill="#000" opacity=".7"/><text x="4" y="17" font-size="16" fill="#fff" font-family="sans-serif">${list[i]}</text></svg>`), left: (i % C) * S, top: Math.floor(i / C) * S });
}
await sharp({ create: { width: S * C, height: S * Math.ceil(list.length / C), channels: 3, background: '#222' } }).composite(comps).jpeg({ quality: 82 }).toFile(out);
