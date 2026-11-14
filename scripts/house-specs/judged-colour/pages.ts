/**
 * One sheet per page for the judged-colour review (lane d1-colour-judged, 2026-11-14): stacks a page's house:frames rule-10
 * sheets (<frames>/judged/<page>/rule10-N.jpg: photo | today | judged, the as-played pair first) into <out>/<page>.jpg,
 * with a header naming the judged fronts of each pose and their families. Long edge kept at `--width` (default 1600).
 *
 *   node --import tsx scripts/house-specs/judged-colour/pages.ts [--dir artifacts/d1-colour-judged] [--out <dir>] [--width 1600]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { JUDGED_PALETTE, type JudgedFamily } from '../../../src/canalRecall/houseSpec/judgedColour.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function main() {
  const argv = process.argv.slice(2), opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const dir = path.resolve(ROOT, opt('dir') ?? 'artifacts/d1-colour-judged'), out = path.resolve(ROOT, opt('out') ?? path.join(dir, 'sheets')), width = Number(opt('width') ?? 1600);
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'lists/index.json'), 'utf8')) as Array<{ page: string; set: string; keys: Record<string, string[]> }>;
  const judged = JSON.parse(fs.readFileSync(path.join(dir, 'judged.json'), 'utf8')).pands as Record<string, { family: JudgedFamily; by: string; hex: string | null; deferredTo?: string }>;
  fs.mkdirSync(out, { recursive: true });
  const made: string[] = [];
  for (const p of index) {
    const fdir = path.join(dir, 'frames/judged', p.page);
    const sheets = fs.existsSync(fdir) ? fs.readdirSync(fdir).filter(f => /^rule10-\d+\.jpg$/.test(f)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0])) : [];
    if (!sheets.length) { console.log(`${p.page}: no rule-10 sheets`); continue; }
    const lines = Object.entries(p.keys).map(([key, ids]) => `${key}: ${ids.map(id => { const j = judged[id]; return j ? `${id.slice(-6)} ${j.deferredTo ? `kept (${j.deferredTo})` : JUDGED_PALETTE[j.family].label}` : `${id.slice(-6)} -`; }).join(', ')}`);
    const headH = 34 + 20 * lines.length;
    const head = Buffer.from(`<svg width="${width}" height="${headH}"><rect width="100%" height="100%" fill="#111"/><text x="10" y="24" font-size="19" fill="#fff" font-family="Helvetica">${esc(`${p.page} (${p.set}): photo | today | judged wall colour (D1 shapes), rule 10`)}</text>${lines.map((l, i) => `<text x="10" y="${48 + 20 * i}" font-size="13" fill="#bbb" font-family="Helvetica">${esc(l)}</text>`).join('')}</svg>`);
    const parts: sharp.OverlayOptions[] = [{ input: head, left: 0, top: 0 }];
    let y = headH;
    for (const s of sheets) {
      const buf = await sharp(path.join(fdir, s)).resize({ width }).jpeg({ quality: 82 }).toBuffer();
      const h = (await sharp(buf).metadata()).height!;
      parts.push({ input: buf, left: 0, top: y }); y += h;
    }
    const file = path.join(out, `${p.page}.jpg`);
    await sharp({ create: { width, height: y, channels: 3, background: '#111' } }).composite(parts).jpeg({ quality: 80 }).toFile(file);
    made.push(file);
  }
  console.log(`${made.length} page sheets in ${out}`);
}
if (import.meta.url === `file://${process.argv[1]}`) await main();
