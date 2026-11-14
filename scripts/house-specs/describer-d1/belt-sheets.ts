// D1 belt row sheets (2026-11-14): one sheet set per street side, every pose of the side in house-number order, three
// columns photo | today | with the staged specs, from house:frames' rule-10 likeness frames (first person 72 deg, dpr 2)
// of two runs of the same list (today: ?world=live with the published extract; staged: the same with the staged house-specs
// extract served by HOUSE_FRAMES_SPECS_DIR). Each row is captioned with the house numbers the pose stands for and how many of
// them carry a staged spec or are held. The first page leads with the as-played frames (default chase camera) of both runs.
// Pages of --rows rows (default 6) at 2192 px wide: <out>/<side>-<n>.jpg, and <out>/index.json.
//
//   node --import tsx scripts/house-specs/describer-d1/belt-sheets.ts --dir artifacts/describer-d1/belt-20261114 --out <dir>
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const W = 720, GAP = 8, CAP = 54;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function panel(file: string, h: number): Promise<Buffer> {
  if (!fs.existsSync(file)) return sharp({ create: { width: W, height: h, channels: 3, background: '#333' } }).composite([{ input: Buffer.from(`<svg width="${W}" height="${h}"><text x="20" y="${h / 2}" font-size="22" fill="#ddd" font-family="Helvetica">no frame</text></svg>`) }]).png().toBuffer();
  return sharp(file).resize(W, h, { fit: 'cover', position: 'top' }).png().toBuffer();
}
const caption = (text: string, width: number) => Buffer.from(`<svg width="${width}" height="${CAP}"><rect width="100%" height="100%" fill="#111"/><text x="10" y="22" font-size="18" fill="#fff" font-family="Helvetica">${esc(text.split('\n')[0])}</text><text x="10" y="44" font-size="15" fill="#bbb" font-family="Helvetica">${esc(text.split('\n')[1] ?? '')}</text></svg>`);

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2), opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const dir = path.resolve(opt('dir')!), out = path.resolve(opt('out')!), per = Number(opt('rows') ?? 6);
  fs.mkdirSync(out, { recursive: true });
  const groups = JSON.parse(fs.readFileSync(path.join(dir, 'row-groups.json'), 'utf8')) as Record<string, Array<{ key: string; pands: Array<{ pandId: string; number: number; staged: boolean; held: string[] }> }>>;
  const index: Record<string, string[]> = {};
  const width = 3 * W + 4 * GAP;
  for (const [side, rows] of Object.entries(groups)) {
    const today = path.join(dir, 'frames/today', side), staged = path.join(dir, 'frames/staged', side);
    index[side] = [];
    for (let p = 0; p * per < rows.length; p++) {
      const parts: sharp.OverlayOptions[] = [];
      let y = 0;
      const head = `${side.replace('-', ' (')} side), page ${p + 1}: photo | today | with the staged D1 specs`;
      parts.push({ input: caption(`${head}\nfirst person 72 deg, 1440x900 at dpr 2, own engine, ?world=live (staged specs served from the staged extract), trees hidden`, width), left: 0, top: y }); y += CAP;
      if (p === 0) {
        const h = 450;
        parts.push({ input: caption('as played: default engine, default chase camera, dpr 2 (today | staged)', width), left: 0, top: y }); y += CAP;
        parts.push({ input: await panel(path.join(today, 'as-played.png'), h), left: GAP + W + GAP, top: y });
        parts.push({ input: await panel(path.join(staged, 'as-played.png'), h), left: GAP + 2 * (W + GAP), top: y });
        y += h + GAP;
      }
      for (const r of rows.slice(p * per, (p + 1) * per)) {
        const nums = r.pands.map(x => x.number), st = r.pands.filter(x => x.staged).length, held = r.pands.filter(x => x.held.length).length;
        parts.push({ input: caption(`${r.key}: numbers ${Math.min(...nums)}-${Math.max(...nums)} (${r.pands.length} pands, ${st} staged, ${held} held)\n${r.pands.map(x => `${x.number}${x.staged ? '' : x.held.length ? ' held' : ' -'}`).join('  ')}`, width), left: 0, top: y }); y += CAP;
        const h = 450, k = r.key;
        parts.push({ input: await panel(path.join(today, k, 'likeness-photo.jpg'), h), left: GAP, top: y });
        parts.push({ input: await panel(path.join(today, k, 'likeness.png'), h), left: GAP + W + GAP, top: y });
        parts.push({ input: await panel(path.join(staged, k, 'likeness.png'), h), left: GAP + 2 * (W + GAP), top: y });
        y += h + GAP;
      }
      const file = path.join(out, `${side}-${p + 1}.jpg`);
      await sharp({ create: { width, height: y, channels: 3, background: '#000' } }).composite(parts).jpeg({ quality: 82, mozjpeg: true }).toFile(file);
      index[side].push(path.basename(file));
    }
  }
  fs.writeFileSync(path.join(out, 'index.json'), `${JSON.stringify(index, null, 1)}\n`);
  console.log(JSON.stringify(index));
}
