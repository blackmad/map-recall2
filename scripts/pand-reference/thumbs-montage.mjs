import sharp from 'sharp';
import fs from 'fs';
const [,, out, ...ids] = process.argv;
const S = 320, C = 5;
const comps = [];
for (let i = 0; i < ids.length; i++) {
  const p = `staging/pand-reference/${ids[i]}/thumb.jpg`;
  if (!fs.existsSync(p)) continue;
  const b = await sharp(p).resize(S, S).toBuffer();
  const label = Buffer.from(`<svg width="${S}" height="22"><rect width="${S}" height="22" fill="#000" opacity=".7"/><text x="4" y="16" font-size="15" fill="#fff" font-family="sans-serif">${ids[i].slice(-6)}</text></svg>`);
  comps.push({ input: b, left: (i % C) * S, top: Math.floor(i / C) * S }, { input: label, left: (i % C) * S, top: Math.floor(i / C) * S });
}
const rows = Math.ceil(ids.length / C);
await sharp({ create: { width: S * C, height: S * rows, channels: 3, background: '#222' } }).composite(comps).jpeg({ quality: 80 }).toFile(out);
