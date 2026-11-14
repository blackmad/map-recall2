// Wall sample v2 row sheets (lane d1-wall-colour, 2026-11-14): photo | today | D1 staged | D1 staged + wall sample v2, the
// rule-10 likeness frames (first person 72 deg, 1440x900, dpr 2) of three house:frames runs of the same lists, one sheet per
// page (pages.json: page -> row keys), each row captioned with the row's mean W1 wall L and C per panel (row-lab.ts output).
//
//   node --import tsx scripts/house-specs/wall-sample/sheets.ts --frames <dir with today/ staged/ v2/> --groups <row-groups.json>
//        --pages <pages.json> --lab <rows-lab.json> --out <dir>
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const W = 720, H = 450, GAP = 8, CAP = 54, COLS = ['photo', 'today', 'staged', 'v2'] as const;
const LABEL: Record<string, string> = { photo: 'photo', today: 'today', staged: 'D1 staged', v2: 'D1 staged + wall sample v2' };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function panel(file: string, label: string): Promise<Buffer> {
  const tag = Buffer.from(`<svg width="${W}" height="30"><rect width="100%" height="100%" fill="#000" fill-opacity="0.6"/><text x="8" y="21" font-size="17" fill="#fff" font-family="Helvetica">${esc(label)}</text></svg>`);
  const base = fs.existsSync(file) ? await sharp(file).resize(W, H, { fit: 'cover', position: 'top' }).png().toBuffer()
    : await sharp({ create: { width: W, height: H, channels: 3, background: '#333' } }).png().toBuffer();
  return sharp(base).composite([{ input: tag, left: 0, top: H - 30 }]).png().toBuffer();
}
const caption = (a: string, b: string, width: number) => Buffer.from(`<svg width="${width}" height="${CAP}"><rect width="100%" height="100%" fill="#111"/><text x="10" y="22" font-size="18" fill="#fff" font-family="Helvetica">${esc(a)}</text><text x="10" y="44" font-size="15" fill="#bbb" font-family="Helvetica">${esc(b)}</text></svg>`);

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2), opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const frames = path.resolve(opt('frames')!), out = path.resolve(opt('out')!);
  const groups = JSON.parse(fs.readFileSync(opt('groups')!, 'utf8')) as Record<string, Array<{ key: string; pands: Array<{ number: number }> }>>;
  const pages = JSON.parse(fs.readFileSync(opt('pages')!, 'utf8')) as Record<string, string[]>;
  const lab = JSON.parse(fs.readFileSync(opt('lab')!, 'utf8')) as Record<string, { n: number; mean: Record<string, { L: number | null; C: number | null }> }>;
  fs.mkdirSync(out, { recursive: true });
  const width = COLS.length * W + (COLS.length + 1) * GAP, made: string[] = [];
  for (const [page, keys] of Object.entries(pages)) {
    const parts: sharp.OverlayOptions[] = [];
    let y = 0;
    parts.push({ input: caption(`${page}: photo | today | D1 staged | D1 staged + wall sample v2 (WALL_SAMPLE=2)`, 'rule-10 likeness frames: first person 72 deg, 1440x900 at dpr 2, own engine, ?world=live (staged specs served from staged extracts), trees hidden; L/C = mean W1 wallLab over the row\'s BAG walls', width), left: 0, top: y }); y += CAP;
    for (const key of keys) {
      const side = Object.entries(groups).find(([, rows]) => rows.some(r => r.key === key))?.[0];
      if (!side) continue;
      const r = groups[side].find(x => x.key === key)!, nums = r.pands.map(p => p.number), m = lab[key]?.mean ?? {};
      const lc = (c: string) => m[c]?.L == null ? 'no read' : `L ${m[c].L!.toFixed(3)} C ${m[c].C!.toFixed(3)}`;
      parts.push({ input: caption(`${key}: numbers ${Math.min(...nums)}-${Math.max(...nums)} (${r.pands.length} pands; ${lab[key]?.n ?? 0} read in every panel)`, COLS.map(c => `${LABEL[c]} ${lc(c)}`).join('   |   '), width), left: 0, top: y }); y += CAP;
      for (const [i, c] of COLS.entries()) {
        const file = c === 'photo' ? path.join(frames, 'today', side, key, 'likeness-photo.jpg') : path.join(frames, c, side, key, 'likeness.png');
        parts.push({ input: await panel(file, `${LABEL[c]}  ${lc(c)}`), left: GAP + i * (W + GAP), top: y });
      }
      y += H + GAP;
    }
    const file = path.join(out, `${page}.jpg`);
    await sharp({ create: { width, height: y, channels: 3, background: '#000' } }).composite(parts).jpeg({ quality: 82, mozjpeg: true }).toFile(file);
    made.push(file);
  }
  console.log(made.join('\n'));
}
