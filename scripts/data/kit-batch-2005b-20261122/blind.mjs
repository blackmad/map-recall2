// Blind triples for a fresh judge (lane kit-batch-2005b-20261122, from kit-batch-2005-20261121): photo | A | B, today and
// new in an order drawn from a seeded RNG (mulberry32), so the sheets are reproducible; the key goes to <keyFile>, kept
// outside <outDir> so a judge handed <outDir> never sees it.
//   node scripts/data/kit-batch-2005b-20261122/blind.mjs <todayDir> <newDir> <outDir> <keyFile> <seed> <key>[,<key>...]
// <todayDir>/<key>/{photo.jpg,game.png} and <newDir>/<key>/game.png come from house:frames runs of the same list
// (--reuse-photos, so the pose and the photo cut are the same). Writes <outDir>/<key>.jpg and <outDir>/key.json.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const [, , todayDir, newDir, outDir, keyFile, seedArg, keys] = process.argv;
let seed = Number(seedArg) >>> 0;
const rand = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
fs.mkdirSync(outDir, {recursive: true});
const key = fs.existsSync(keyFile) ? JSON.parse(fs.readFileSync(keyFile, 'utf8')) : {};
const H = 560, GAP = 10;
const label = (text, w) => Buffer.from(`<svg width="${w}" height="34" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#222"/><text x="10" y="24" fill="#fff" font-size="22" font-family="Helvetica">${text}</text></svg>`);
for (const k of keys.split(',')) {
  const flip = rand() < 0.5;
  const sides = flip ? ['new', 'today'] : ['today', 'new'];
  const src = {photo: path.join(todayDir, k, 'photo.jpg'), today: path.join(todayDir, k, 'game.png'), new: path.join(newDir, k, 'game.png')};
  const imgs = await Promise.all(['photo', ...sides].map(s => sharp(src[s]).resize({height: H}).toBuffer({resolveWithObject: true})));
  const W = imgs.reduce((s, i) => s + i.info.width, 0) + GAP * 2;
  const comp = [];
  let x = 0;
  ['PHOTO', 'A', 'B'].forEach((t, i) => {
    comp.push({input: imgs[i].data, left: x, top: 34});
    comp.push({input: label(t, imgs[i].info.width), left: x, top: 0});
    x += imgs[i].info.width + GAP;
  });
  await sharp({create: {width: W, height: H + 34, channels: 3, background: '#fff'}}).composite(comp).jpeg({quality: 84}).toFile(path.join(outDir, `${k}.jpg`));
  key[k] = {A: sides[0], B: sides[1], seed: Number(seedArg)};
}
fs.writeFileSync(keyFile, JSON.stringify(key, null, 1) + '\n');
console.log(`${keys.split(',').length} sheets in ${outDir}; key in ${keyFile}`);
