/** J2 family 5: pairs of per-year crops of one pand (same-pand) and decoy pairs (two different pands in the same buurt, similar aspect). node scripts/jev/j2/build-pairs.mjs */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {CACHE, prepImage} from './lib.mjs';
const ARCH = '/Users/blackmad/Code/map-recall2-source-data-h5/pand-crops';
const labels = JSON.parse(await fs.readFile('scripts/house-crops/labels/AB07.json', 'utf8'));
const good = Object.keys(labels).filter(p => labels[p].label !== 'bad').sort();
const multi = [];
for (const p of good) { const ys = (await fs.readdir(path.join(ARCH, p, 'years')).catch(() => [])).filter(f => f.endsWith('.jpg')).sort(); if (ys.length >= 2) multi.push([p, ys]); }
const pairs = [];
for (const [i, [p, ys]] of multi.slice(0, 40).entries()) {
  if (pairs.filter(x => x.kind === 'same').length >= 14) break;
  const a = ys[0], b = ys[ys.length - 1];
  const fa = await prepImage(path.join(ARCH, p, 'years', a), path.join(CACHE, 'years', `${p}-${a}`)), fb = await prepImage(path.join(ARCH, p, 'years', b), path.join(CACHE, 'years', `${p}-${b}`));
  if (fa && fb) pairs.push({id: `same-${p}`, kind: 'same', pand: p, years: [a.slice(0, 4), b.slice(0, 4)], a: fa, b: fb});
}
const same = pairs.slice();
for (const [k, s] of same.entries()) { // decoy: this pand's first-year crop against another pand's crop
  const other = same[(k + 3) % same.length];
  if (other.pand === s.pand) continue;
  pairs.push({id: `decoy-${s.pand}-${other.pand}`, kind: 'decoy', pand: s.pand, other: other.pand, years: [s.years[0], other.years[1]], a: s.a, b: other.b});
}
await fs.writeFile(path.join(CACHE, 'pairs.json'), JSON.stringify(pairs, null, 1));
// sheet: each pair side by side, 4 per image
const CW = 330, CH = 520;
for (let s = 0; s * 4 < pairs.length; s++) {
  const comps = [];
  for (const [k, p] of pairs.slice(s * 4, s * 4 + 4).entries()) {
    const col = k % 2, row = Math.floor(k / 2);
    for (const [j, f] of [p.a, p.b].entries()) comps.push({input: await sharp(f).resize(CW - 6, CH - 34, {fit: 'inside', background: '#222'}).toBuffer(), left: col * CW * 2 + j * CW + 3, top: row * CH + 32});
    comps.push({input: Buffer.from(`<svg width="${CW * 2}" height="30"><text x="3" y="22" font-size="17" font-family="Helvetica" fill="#fff">P${s * 4 + k} ${p.years.join(' vs ')}</text></svg>`), left: col * CW * 2, top: row * CH});
  }
  await sharp({create: {width: CW * 4, height: CH * 2, channels: 3, background: '#222'}}).composite(comps).jpeg({quality: 80}).toFile(path.join(CACHE, 'sheets', `P-${String(s + 1).padStart(2, '0')}.jpg`));
}
console.log(pairs.length, pairs.filter(p => p.kind === 'same').length);
