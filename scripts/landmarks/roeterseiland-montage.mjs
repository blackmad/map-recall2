import sharp from 'sharp';
import fs from 'fs';
const dir = 'staging/pand-reference-walls/0363100012185420/';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.thumb.jpg')).sort();
const S = 500, C = 3, comps = [];
for (let i = 0; i < files.length; i++) {
  const b = await sharp(dir + files[i]).resize(S, S).toBuffer();
  const l = Buffer.from(`<svg width="${S}" height="24"><rect width="${S}" height="24" fill="#000" opacity=".7"/><text x="4" y="17" font-size="16" fill="#fff">${files[i]}</text></svg>`);
  comps.push({input: b, left: (i % C) * S, top: Math.floor(i / C) * S}, {input: l, left: (i % C) * S, top: Math.floor(i / C) * S});
}
await sharp({create: {width: S * C, height: S * Math.ceil(files.length / C), channels: 3, background: '#222'}}).composite(comps).jpeg({quality: 85}).toFile(process.argv[2]);
