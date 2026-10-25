/**
 * Close-up montage of cached survey crops (made by camera-sheets.ts --survey) so a classification can be checked at
 * 2 x 2 or 3 x 2 size instead of the 4 x 3 survey tiles.
 *
 *   node --import tsx scripts/building-types/montage.ts --out=.cache/building-types/zoom.jpg --cols=2 0363100012126541 0363100012130946 ...
 *
 * Positional arguments are pand ids (the full 16 digits, or the last 7 digits when unambiguous in the cache).
 */
import fs from 'node:fs';
import sharp from 'sharp';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const out = arg('out', '.cache/building-types/zoom.jpg'), cols = Number(arg('cols', '2')), tileW = Number(arg('w', '800'));
// --dir=<folder of crops> (e.g. a --months re-shoot's crops)
const dir = process.argv.find(a => a.startsWith('--dir='))?.slice(6) ?? '.cache/building-types/crops', files = fs.readdirSync(dir);
const ids = process.argv.slice(2).filter(a => !a.startsWith('--'));
const tileH = Math.round(tileW * 0.75);
const tiles = await Promise.all(ids.map(async (id, i) => {
  const f = files.find(n => n === `${id}.jpg`) ?? files.find(n => n.endsWith(`${id}.jpg`));
  if (!f) throw new Error(`no crop for ${id}`);
  const img = await sharp(`${dir}/${f}`).resize(tileW, tileH).toBuffer();
  const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tileW}" height="24"><rect width="${tileW}" height="24" fill="#111"/><text x="8" y="17" font-family="Helvetica" font-size="14" fill="#fff">${f.replace('.jpg', '')}</text></svg>`);
  return [{input: img, left: (i % cols) * tileW, top: Math.floor(i / cols) * (tileH + 24)}, {input: label, left: (i % cols) * tileW, top: Math.floor(i / cols) * (tileH + 24) + tileH}];
}));
const rows = Math.ceil(ids.length / cols);
fs.writeFileSync(out, await sharp({create: {width: cols * tileW, height: rows * (tileH + 24), channels: 3, background: '#000'}}).composite(tiles.flat()).jpeg({quality: 85}).toBuffer());
console.log('wrote', out);
