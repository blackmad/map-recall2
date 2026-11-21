/**
 * Blind triples for lane kit-batch-8504-20261121: photo | A | B, today and new randomised per pair.
 *
 *   node --import tsx scripts/data/kit-batch-8504-20261121/blind.ts --before=<dir> --after=<dir> --out=<dir> [--prefix=<house id>]
 *
 * Reads <dir>/<key>/{photo.jpg,game.png} from two house:frames runs of the same list; writes <out>/pairN.jpg and
 * <out>/key.json ({pairN: {key, A, B}}).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const before = arg('before')!, after = arg('after')!, out = arg('out')!, prefix = arg('prefix') ?? '';
fs.mkdirSync(out, {recursive: true});
const keys = fs.readdirSync(after).filter(k => k.startsWith(prefix) && fs.existsSync(path.join(after, k, 'game.png')) && fs.existsSync(path.join(before, k, 'game.png'))).sort();
const H = 600, key: Record<string, {key: string; A: string; B: string}> = {};
let n = 0;
for (const k of keys) {
  const flip = Math.random() < 0.5;
  const imgs = [path.join(after, k, 'photo.jpg'), path.join(flip ? after : before, k, 'game.png'), path.join(flip ? before : after, k, 'game.png')];
  const parts = await Promise.all(imgs.map(f => sharp(f).resize({height: H}).jpeg().toBuffer({resolveWithObject: true})));
  const W = parts.reduce((s, p) => s + p.info.width + 8, -8);
  let x = 0;
  const comp = parts.map(p => { const c = {input: p.data, left: x, top: 0}; x += p.info.width + 8; return c; });
  n++;
  await sharp({create: {width: W, height: H, channels: 3, background: '#000'}}).composite(comp).jpeg({quality: 82}).toFile(path.join(out, `pair${n}.jpg`));
  key[`pair${n}`] = {key: k, A: flip ? 'new' : 'today', B: flip ? 'today' : 'new'};
}
fs.writeFileSync(path.join(out, 'key.json'), JSON.stringify(key, null, 1) + '\n');
console.log(`${n} pairs -> ${out}`);
