// The worst disagreements of a buurt as contact sheets (house line H5): per row the crop the writers read, the preview render of the
// MERGED spec (house:preview, the generic path with the spec's overrides), and both values with their sources.
//
//   node --import tsx scripts/house-specs/worst-sheet.ts --buurt AB07 [--archive <source-data>] [--n 12] [--per-sheet 6] [--out artifacts/house-describe]
//
// Reads scripts/house-specs/generated/<code>/ and the hand intents (agreement.ts `worst`); writes <out>/<code>-worst-<k>.jpg.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { handSpecs, worst } from './agreement.ts';
import type { Envelope } from './describe.ts';

const argv = process.argv.slice(2), opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const code = opt('buurt'); if (!code) { console.error('--buurt <code> required'); process.exit(2); }
const archive = opt('archive') ?? process.env.HOUSE_CROPS_ARCHIVE ?? path.join(process.env.HOME ?? '', 'Code/map-recall2-source-data-h5');
const out = opt('out') ?? 'artifacts/house-describe', n = Number(opt('n') ?? 12), per = Number(opt('per-sheet') ?? 6);
const dir = path.resolve('scripts/house-specs/generated', code);
const envs: Envelope[] = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const hands = handSpecs(new Set(envs.map(e => e.pandId)));
const list = worst(envs, hands, n);
const H = 330, W = 1100, esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const label = (lines: string[], w: number, h: number) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#f4f1ea"/>${lines.map((l, i) => `<text x="12" y="${26 + i * 22}" font-family="Helvetica,Arial,sans-serif" font-size="${i === 0 ? 17 : 14.5}" font-weight="${i === 0 ? 700 : 400}" fill="#222">${esc(l)}</text>`).join('')}</svg>`);

const rows: Buffer[] = [];
for (const x of list) {
  const e = envs.find(v => v.pandId === x.pandId)!;
  const specFile = path.resolve(out, 'specs', `${x.pandId}.json`), prevDir = path.resolve(out, 'preview', x.pandId);
  fs.mkdirSync(path.dirname(specFile), { recursive: true });
  fs.writeFileSync(specFile, JSON.stringify(e.spec, null, 1));
  spawnSync('node', ['--import', 'tsx', 'scripts/house-preview/preview.ts', specFile, '--out', prevDir], { stdio: 'ignore' });
  const crop = e.crop?.file ? path.join(archive, 'pand-crops', x.pandId, e.crop.file) : null;
  const panel = async (file: string | null, w: number) => file && fs.existsSync(file) ? sharp(file).resize({ height: H - 8, width: w, fit: 'contain', background: '#f4f1ea' }).jpeg({ quality: 82 }).toBuffer() : sharp(label(['(no image)'], w, H - 8)).jpeg().toBuffer();
  const cropBuf = await panel(crop, 360), renderBuf = await panel(path.join(prevDir, 'front.png'), 360);
  const prov = (p: string) => { const pr = e.spec?.provenance[p]; return pr ? `${pr.source} ${pr.confidence}` : ''; };
  const text = x.kind === 'hand'
    ? [`${x.pandId}  ${x.field}`, `hand: ${JSON.stringify(x.hand)}`, `merged: ${JSON.stringify(x.merged)}  (${prov(x.field === 'bays' ? 'fronts/0/bays' : x.field === 'gable' ? 'fronts/0/gable' : x.field === 'wall' ? 'palette/brick' : x.field === 'storeys' ? 'fronts/0/storeys' : x.field === 'finish' ? 'palette/wallMaterial' : 'facts/pui')})`, `hand kind: ${(hands.get(x.pandId) as any)?.handKind}`, `crop tier: ${e.crop?.tier}, q ${e.crop?.quality ?? '-'}, year ${e.crop?.year ?? '-'}`]
    : [`${x.pandId}  ${x.field}`, ...x.values!.map(v => `${v.writer}: ${JSON.stringify(v.value)}  (${v.source} ${v.confidence})`), `crop tier: ${e.crop?.tier}, q ${e.crop?.quality ?? '-'}, year ${e.crop?.year ?? '-'}`];
  rows.push(await sharp({ create: { width: W, height: H, channels: 3, background: '#f4f1ea' } }).composite([{ input: cropBuf, left: 4, top: 4 }, { input: renderBuf, left: 372, top: 4 }, { input: label(text, W - 740, H - 8), left: 740, top: 4 }]).png().toBuffer());
}
fs.mkdirSync(out, { recursive: true });
for (let k = 0; k * per < rows.length; k++) {
  const chunk = rows.slice(k * per, (k + 1) * per), file = path.join(out, `${code}-worst-${k + 1}.jpg`);
  await sharp({ create: { width: W, height: H * chunk.length, channels: 3, background: '#f4f1ea' } }).composite(chunk.map((input, i) => ({ input, left: 0, top: i * H }))).jpeg({ quality: 80 }).toFile(file);
  console.log(file, `${(fs.statSync(file).size / 1024).toFixed(0)} kB`);
}
