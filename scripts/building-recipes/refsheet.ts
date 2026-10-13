/**
 * Reference sheet for drafting: side-by-side rectified front crops (or frontAlt) for a few Pand ids.
 *   node --import tsx scripts/building-recipes/refsheet.ts --pands=079721,080336 --out=artifacts/recipe-street/ref-1.png [--alt] [--height=900]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const pands = (arg('pands') ?? '').split(',').filter(Boolean).map(p => p.length === 6 ? `0363100012${p}` : p);
const out = arg('out') ?? 'artifacts/recipe-street/ref.png', H = Number(arg('height') ?? 900), alt = process.argv.includes('--alt');
const tiles: {input: Buffer; width: number}[] = [];
for (const p of pands) {
  const file = path.join('staging/pand-reference', p, alt ? 'front-alt.jpg' : 'front.jpg');
  const img = await sharp(await fs.readFile(file)).resize({height: H}).jpeg({quality: 88}).toBuffer({resolveWithObject: true});
  const label = Buffer.from(`<svg width="${img.info.width}" height="26"><rect width="100%" height="100%" fill="#111"/><text x="4" y="19" font-size="18" fill="#fff" font-family="Helvetica">${p.slice(-6)}</text></svg>`);
  tiles.push({input: await sharp({create: {width: img.info.width, height: H + 26, channels: 3, background: '#111'}}).composite([{input: label, top: 0, left: 0}, {input: img.data, top: 26, left: 0}]).png().toBuffer(), width: img.info.width});
}
let x = 0;
const composite = tiles.map(t => { const c = {input: t.input, left: x, top: 0}; x += t.width + 6; return c; });
await fs.mkdir(path.dirname(out), {recursive: true});
await sharp({create: {width: x, height: H + 26, channels: 3, background: '#333'}}).composite(composite).png().toFile(out);
console.log(out, x, 'x', H + 26);
