// Hand set v1 (lane H5h, #351): the user's spot-check sheet. Each tile is the panel a pand was read from (metre grid as on the
// reading sheet) with reader A's values under it (and reader B's where they differ); two sheets of six, <= 1600 px wide, JPEG q80.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { setPands } from './sources.ts';
import type { HandSet } from '../../../src/canalRecall/houseSpec/handSet.ts';

export const HELP = `hand-set contact: spot-check sheets (crop + readings) for the user.

  node --import tsx scripts/house-specs/hand-set/contact.ts --pands id,id,... --out <dir>   -> <dir>/contact-1.jpg, contact-2.jpg`;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function tile(id: string, A: HandSet, B: HandSet, W = 520, H = 640) {
  const p = A.pands.find(x => x.pandId === id)!, b = B.pands.find(x => x.pandId === id);
  const src = setPands().find(x => x.pandId === id)!.images.find(i => i.ref === p.fields.axes.ref)!;
  let img = sharp(src.file); if (src.px) { const m = await sharp(src.file).metadata(); img = sharp(await img.extract({ left: src.px[0], top: 0, width: src.px[1] - src.px[0], height: m.height! }).toBuffer()); }
  const buf = await img.resize({ width: W, height: H - 150, fit: 'contain', background: '#111' }).toBuffer();
  const f = p.fields, v = (r: any) => (r ? `${r.value ?? '?'}${r.value === null ? '' : ` (${r.confidence})`}` : '-');
  const flags = [f.souterrain && 'souterrain', f.entresol && 'entresol', f.atticInCrown && 'attic in crown'].filter(Boolean).join(', ');
  const lines = [`${id}  ${p.group}  panel ${src.label}`, `axes ${v(f.axes)}${f.axesPerStorey ? ` per storey ${f.axesPerStorey.join('/')}` : ''}   storeys ${v(f.storeys)}`, `gable ${v(f.gable)}   finish ${v(f.finish)}`, `wall ${v(f.wall)}   pui ${v(f.pui)}`, flags || ' '];
  if (b) { const d = (['axes', 'storeys', 'gable', 'finish', 'wall', 'pui'] as const).filter(k => (b.fields as any)[k]?.value !== (f as any)[k]?.value).map(k => `${k} ${(b.fields as any)[k]?.value}`); lines.push(d.length ? `reader B differs: ${d.join(', ')}` : 'reader B agrees on every field'); }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="150"><rect width="${W}" height="150" fill="#1d1d1d"/>${lines.map((l, i) => `<text x="8" y="${20 + i * 22}" font-size="${i ? 16 : 14}" font-family="Helvetica" fill="${i === 5 ? '#ffd27a' : '#fff'}">${esc(l)}</text>`).join('')}</svg>`;
  return sharp({ create: { width: W, height: H, channels: 3, background: '#111' } }).composite([{ input: buf, left: 0, top: 0 }, { input: Buffer.from(svg), left: 0, top: H - 150 }]).jpeg().toBuffer();
}

async function main() {
  const argv = process.argv.slice(2); if (argv.includes('--help')) { console.log(HELP); return; }
  const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const ids = opt('pands')!.split(','), out = path.resolve(opt('out')!); fs.mkdirSync(out, { recursive: true });
  const A: HandSet = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/house-line/hand-set-v1.json'), 'utf8'));
  const B: HandSet = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/house-line/hand-set-v1.reader-b.json'), 'utf8'));
  for (let s = 0; s * 6 < ids.length; s++) {
    const t = await Promise.all(ids.slice(s * 6, s * 6 + 6).map(id => tile(id, A, B)));
    const W = 3 * 530 + 10, H = 2 * 650 + 10;
    const jpg = await sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).composite(t.map((input, i) => ({ input, left: 10 + (i % 3) * 530, top: 10 + Math.floor(i / 3) * 650 }))).resize({ width: 1590 }).jpeg({ quality: 80 }).toBuffer();
    const f = path.join(out, `contact-${s + 1}.jpg`); fs.writeFileSync(f, jpg); console.log(`${f} ${(jpg.length / 1024).toFixed(0)} kB`);
  }
}
if (process.argv[1]?.endsWith('hand-set/contact.ts')) await main();
