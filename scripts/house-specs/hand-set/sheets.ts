// Hand set v1 (lane H5h, #351): one reading sheet per pand. Every archived image of the pand side by side, each at >= native size
// (a short crop is enlarged to about 1000 px tall) under a metre grid: a thin line every metre along the wall and up from the ground,
// a heavier one every 3 m, labelled. No writer value, label or register fact is drawn: the sheet is all a reader sees.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { setPands, type Image, type SetPand } from './sources.ts';

export const HELP = `hand-set sheets: reading sheets (crops on a metre grid) for the hand set.

  node --import tsx scripts/house-specs/hand-set/sheets.ts [--out artifacts/hand-set/sheets] [--pand id,id] [--max-panels 3]

Writes <out>/<pandId>.jpg and <out>/index.json (pand -> panel refs, in panel order A, B, C).`;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');

async function panel(img: Image, tag: string): Promise<{ buf: Buffer; w: number; h: number }> {
  let s = sharp(img.file);
  if (img.px) { const m = await sharp(img.file).metadata(); s = sharp(await s.extract({ left: img.px[0], top: 0, width: img.px[1] - img.px[0], height: m.height! }).toBuffer()); }
  const src = await s.toBuffer({ resolveWithObject: true });
  const w0 = src.info.width, h0 = src.info.height;
  const k = Math.min(2.5, Math.max(1, 1000 / h0)); const w = Math.round(w0 * k), h = Math.round(h0 * k), ppm = img.ppm * k;
  const head = 34, left = 34, foot = 22, W = w + left, H = h + head + foot;
  const lines: string[] = [];
  for (let m = 0; m * ppm <= h; m++) { const y = head + h - m * ppm, major = m % 3 === 0; lines.push(`<line x1="${left}" y1="${y}" x2="${W}" y2="${y}" stroke="${major ? '#00e5ff' : '#00e5ff'}" stroke-opacity="${major ? 0.75 : 0.35}" stroke-width="${major ? 1.6 : 0.8}"/>`, `<text x="${left - 4}" y="${y + 4}" text-anchor="end" font-size="12" fill="#fff">${m}</text>`); }
  for (let m = 0; m * ppm <= w; m++) { const x = left + m * ppm, major = m % 3 === 0; lines.push(`<line x1="${x}" y1="${head}" x2="${x}" y2="${head + h}" stroke="#ffd400" stroke-opacity="${major ? 0.6 : 0.25}" stroke-width="${major ? 1.4 : 0.7}"/>`, `<text x="${x}" y="${H - 6}" text-anchor="middle" font-size="12" fill="#fff">${m}</text>`); }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${head}" fill="#222"/><text x="4" y="22" font-size="17" font-family="Helvetica" fill="#fff">${tag}</text>${lines.join('')}</svg>`;
  const scaled = await sharp(src.data).resize(w, h).toBuffer();
  const buf = await sharp({ create: { width: W, height: H, channels: 3, background: '#111' } }).composite([{ input: scaled, left, top: head }, { input: Buffer.from(svg), left: 0, top: 0 }]).jpeg({ quality: 85 }).toBuffer();
  return { buf, w: W, h: H };
}

export async function sheet(p: SetPand, maxPanels = 3): Promise<{ jpg: Buffer; panels: string[] }> {
  const imgs = p.images.slice(0, maxPanels), tags = 'ABCDE';
  const ps = []; for (let i = 0; i < imgs.length; i++) ps.push(await panel(imgs[i], `${tags[i]}  ${p.pandId.slice(-6)}`));
  const gap = 12, W = ps.reduce((a, x) => a + x.w + gap, gap), H = Math.max(...ps.map(x => x.h)) + 2 * gap;
  let x = gap; const comp = ps.map(pp => { const c = { input: pp.buf, left: x, top: gap }; x += pp.w + gap; return c; });
  let img = sharp({ create: { width: W, height: H, channels: 3, background: '#000' } }).composite(comp);
  let jpg = await img.jpeg({ quality: 82 }).toBuffer();
  if (W > 2400) jpg = await sharp(jpg).resize({ width: 2400 }).jpeg({ quality: 82 }).toBuffer();
  return { jpg, panels: imgs.map(i => i.ref) };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) { console.log(HELP); return; }
  const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const out = path.resolve(opt('out') ?? path.join(ROOT, 'artifacts/hand-set/sheets')); fs.mkdirSync(out, { recursive: true });
  const only = opt('pand')?.split(','); const maxPanels = Number(opt('max-panels') ?? 3);
  const index: Record<string, string[]> = {};
  for (const p of setPands()) {
    if (only && !only.includes(p.pandId)) continue;
    if (!p.images.length) { console.log(`${p.pandId}: no image`); continue; }
    const s = await sheet(p, maxPanels); fs.writeFileSync(path.join(out, `${p.pandId}.jpg`), s.jpg); index[p.pandId] = s.panels;
  }
  fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(index, null, 1) + '\n');
  console.log(`${Object.keys(index).length} sheets -> ${out}`);
}
if (process.argv[1]?.endsWith('hand-set/sheets.ts')) await main();
