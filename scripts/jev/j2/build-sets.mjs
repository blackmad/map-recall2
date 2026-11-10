/**
 * J2: stage prepared crops and numbered contact sheets for hand labelling.
 *   node scripts/jev/j2/build-sets.mjs --archive=/Users/blackmad/Code/map-recall2-source-data-h5 --n=48
 * Set A = first N AB07 'good' pands (sorted by id); Set B = 24 marginal/bad pands (occlusion). Writes .cache/jev-j2/{sets.json,img/,sheets/}.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {CACHE, arg, prepImage} from './lib.mjs';
const ARCH = arg('archive', '/Users/blackmad/Code/map-recall2-source-data-h5'), N = +arg('n', '48');
const labels = JSON.parse(await fs.readFile('scripts/house-crops/labels/AB07.json', 'utf8'));
const ids = l => Object.keys(labels).filter(p => labels[p].label === l).sort();
const A = ids('good').slice(0, N), B = [...ids('marginal').slice(0, 12), ...ids('bad').slice(0, 12)];
const sets = {A, B};
await fs.mkdir(path.join(CACHE, 'sheets'), {recursive: true});
for (const [name, list] of Object.entries(sets)) {
  const cells = [];
  for (const [i, p] of list.entries()) {
    const src = path.join(ARCH, 'pand-crops', p, 'front.jpg');
    const out = await prepImage(src, path.join(CACHE, 'img', `${p}.jpg`));
    const m = await sharp(src).metadata();
    cells.push({i, p, file: src, w: m.width, h: m.height, ok: !!out});
  }
  const PER = 6, CW = 480, CH = 640;
  for (let s = 0; s * PER < cells.length; s++) {
    const part = cells.slice(s * PER, s * PER + PER);
    const comps = [];
    for (const [k, c] of part.entries()) {
      const buf = await sharp(c.file).resize(CW - 8, CH - 30, {fit: 'inside', background: '#222'}).toBuffer();
      const lab = Buffer.from(`<svg width="${CW}" height="26"><text x="4" y="20" font-size="20" font-family="Helvetica" fill="#fff">#${c.i} ${c.p.slice(-6)}  ${c.w}x${c.h}</text></svg>`);
      comps.push({input: buf, left: (k % 3) * CW + 4, top: Math.floor(k / 3) * CH + 28}, {input: lab, left: (k % 3) * CW, top: Math.floor(k / 3) * CH});
    }
    await sharp({create: {width: CW * 3, height: CH * 2, channels: 3, background: '#222'}}).composite(comps).jpeg({quality: 80}).toFile(path.join(CACHE, 'sheets', `${name}-${String(s + 1).padStart(2, '0')}.jpg`));
  }
}
await fs.writeFile(path.join(CACHE, 'sets.json'), JSON.stringify(sets, null, 1));
console.log(Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.length])));
