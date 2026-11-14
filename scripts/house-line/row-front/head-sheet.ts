/**
 * House rows (lane R): a close-up sheet of the window-head grammar (src/canalRecall/houseLine/headGrammar.ts), each head
 * kind D states drawn over a window at 120 px/m beside the photo crop it is read from (P's row sheets' blind photo strips).
 *
 *   npm run -s house:head-sheet [-- --out artifacts/house-rows/head-sheet]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { headGrammarOf, headPieces, type HeadTone } from '../../../src/canalRecall/houseLine/headGrammar.ts';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const argv = process.argv.slice(2);
const out = path.resolve(REPO, argv[argv.indexOf('--out') + 1] && argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'artifacts/house-rows/head-sheet');
const PPM = 120, W = 420, H = 300, WALL = '#6b3a2c';
const TONE: Record<HeadTone, string> = { white: '#f2efe6', brick: '#55291f', stone: '#d9d2c3', glass: '#3d4955' };
const sheets = (row: string) => path.join(REPO, 'artifacts/house-rows/sheets', row, 'blind/photo.jpg');
/** Each kind: the dressing D states, its window shape, and the photo crop (blind strip pixels) it was read from. */
const KINDS = [
  { dressing: 'jack-blocks', shape: undefined, label: 'jack-blocks (Weteringschans 168042, 169016)', photo: sheets('weteringschans-168096-171218'), crop: { left: 290, top: 440, width: 210, height: 80 } },
  { dressing: 'keystone', shape: undefined, label: 'keystone (Kinkerstraat 98, 96)', photo: sheets('kinkerstraat-86-110'), crop: { left: 1160, top: 380, width: 180, height: 70 } },
  { dressing: 'segmental-tympanum', shape: 'segmental', label: 'segmental-tympanum (Kinkerstraat 90, 92)', photo: sheets('kinkerstraat-86-110'), crop: { left: 1940, top: 370, width: 150, height: 70 } },
  { dressing: 'block-surround', shape: undefined, label: 'block-surround (Kinkerstraat 100)', photo: sheets('kinkerstraat-86-110'), crop: { left: 955, top: 370, width: 175, height: 120 } },
  { dressing: 'arch-ring', shape: 'round', label: 'arch-ring (Weteringschans 171218 top)', photo: sheets('weteringschans-168096-171218'), crop: { left: 820, top: 370, width: 190, height: 80 } },
] as const;

function headSvg(dressing: string, shape: string | undefined): string {
  const g = headGrammarOf(dressing, shape)!, wx0 = 1.2, wx1 = 2.3, z = 1.0, sill = 0.1;
  const X = (x: number) => (x * PPM).toFixed(1), Y = (zz: number) => (H - zz * PPM).toFixed(1);
  const polys = headPieces(g, wx0, wx1, z, sill).sort((a, b) => a.out - b.out)
    .map(p => `<polygon points="${p.pts.map(([x, zz]) => `${X(x)},${Y(zz)}`).join(' ')}" fill="${TONE[p.tone]}" stroke="#00000033" stroke-width="0.6"/>`).join('');
  const win = `<rect x="${X(wx0)}" y="${Y(z)}" width="${(wx1 - wx0) * PPM}" height="${(z - sill) * PPM}" fill="${TONE.glass}" stroke="#f2efe6" stroke-width="5"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${WALL}"/>${win}${polys}</svg>`;
}

const label = (t: string, w: number) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="28"><rect width="${w}" height="28" fill="#111"/><text x="8" y="19" font-family="Helvetica" font-size="15" fill="#fff">${t.replace(/&/g, '&amp;')}</text></svg>`);
fs.mkdirSync(out, { recursive: true });
const rows: Buffer[] = [];
for (const k of KINDS) {
  const photo = await sharp(k.photo).extract(k.crop).resize({ width: W, height: H, fit: 'contain', background: '#222' }).png().toBuffer();
  const drawn = await sharp(Buffer.from(headSvg(k.dressing, k.shape))).png().toBuffer();
  rows.push(await sharp({ create: { width: W * 2 + 10, height: H + 28, channels: 3, background: '#222' } })
    .composite([{ input: label(k.label, W * 2 + 10), left: 0, top: 0 }, { input: photo, left: 0, top: 28 }, { input: drawn, left: W + 10, top: 28 }]).png().toBuffer());
}
const head = label('photo crop (row sheet strip, upscaled)  |  drawn: head grammar at 120 px/m (headGrammar.ts)', W * 2 + 10);
const sheet = await sharp({ create: { width: W * 2 + 10, height: 28 + rows.length * (H + 38), channels: 3, background: '#222' } })
  .composite([{ input: head, left: 0, top: 0 }, ...rows.map((r, i) => ({ input: r, left: 0, top: 28 + i * (H + 38) + 10 }))]).jpeg({ quality: 88 }).toFile(path.join(out, 'heads.jpg'));
console.log(path.join(out, 'heads.jpg'), sheet.width, sheet.height);
