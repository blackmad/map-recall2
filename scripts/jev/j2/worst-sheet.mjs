/**
 * J2 worst-ten sheet: node scripts/jev/j2/worst-sheet.mjs --family=white --question=bands [--out=.cache/jev-j2/worst]
 * Ten crops where both runs were wrong, ranked by Jev confidence, captioned "truth -> jev p". Image <= 1600 px wide.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {CACHE, arg} from './lib.mjs';
const fam = arg('family'), q = arg('question'), OUT = path.resolve(arg('out', path.join(CACHE, 'worst')));
const sc = JSON.parse(await fs.readFile(path.join(CACHE, 'scores.json'), 'utf8')).find(o => o.family === fam && o.question === q);
const sets = JSON.parse(await fs.readFile(path.join(CACHE, 'sets.json'), 'utf8'));
const idx = Object.fromEntries([...sets.A.map((p, i) => [p, `A${i}`]), ...sets.B.map((p, i) => [p, `B${i}`])]);
const J1 = '/Users/blackmad/Code/map-recall2/.cache/jev-facades';
const fileOf = id => id.length === 16 && idx[id] ? path.join(CACHE, 'img', `${id}.jpg`) : path.join(J1, 'crops', `${id}.jpg`);
const W = 310, H = 560, comps = [];
for (const [k, w] of sc.worst.entries()) {
  const buf = await sharp(fileOf(w.id)).resize(W - 6, H - 34, {fit: 'inside', background: '#222'}).toBuffer();
  const cap = Buffer.from(`<svg width="${W}" height="30"><text x="3" y="22" font-size="17" font-family="Helvetica" fill="#fff">${idx[w.id] ?? w.id.slice(-6)} ${w.truth} → ${w.jev} ${w.p}</text></svg>`);
  const x = (k % 5) * W, y = Math.floor(k / 5) * H;
  comps.push({input: buf, left: x + 3, top: y + 32}, {input: cap, left: x, top: y});
}
await fs.mkdir(OUT, {recursive: true});
const file = path.join(OUT, `${fam}-${q}.jpg`);
await sharp({create: {width: W * 5, height: H * 2, channels: 3, background: '#222'}}).composite(comps).jpeg({quality: 80}).toFile(file);
console.log(file);
