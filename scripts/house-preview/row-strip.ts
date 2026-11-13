/**
 * Row strip (lane 1, Haarlemmerdijk renderer): the block face's rectified photo strip over the same row drawn by the
 * game's own Node renderer (house:preview, one front elevation per pand, placed on the strip's own spans), both at the
 * strip's scale with a metre grid, so front tops, storey lines and crowns can be read across a whole row at once.
 *
 *   node --import tsx scripts/house-preview/row-strip.ts --face <face> --strip-jpg <strip.jpg> --out <file.jpg>
 *        [--from <pand>] [--to <pand>] [--work <dir>] [--label <text>] [--route generic]
 *
 * The renderer runs in a child process per pand with this process's environment, so a flag set here (e.g. ROW_FRONT=1)
 * reaches the mesher. Renders are cached in --work by pand and the environment's flag string.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

type Span = { pandId: string; x0M: number; x1M: number; px: [number, number] };
type Strip = { pixelsPerMetre: number; width: number; height: number; heightM: number; x0M: number; spans: Span[] };

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const face = arg('face'), stripJpg = arg('strip-jpg'), out = arg('out');
if (!face || !stripJpg || !out) { console.error('row-strip --face <face> --strip-jpg <jpg> --out <file.jpg> [--from id] [--to id] [--work dir] [--label text]'); process.exit(2); }
const strip = JSON.parse(fs.readFileSync(path.join('scripts/block-face/faces', face, 'strip.json'), 'utf8')) as Strip;
const ppm = strip.pixelsPerMetre;
const bare = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');
let spans = strip.spans;
const from = arg('from'), to = arg('to');
if (from) spans = spans.slice(spans.findIndex(s => bare(s.pandId).endsWith(from)));
if (to) spans = spans.slice(0, spans.findIndex(s => bare(s.pandId).endsWith(to)) + 1);
const flagEnv = Object.entries(process.env).filter(([k]) => /^(ROW_|SPEC_|HOUSE_SPEC|STOREY_|STRUCTURE_)/.test(k)).map(([k, v]) => `${k}=${v}`).sort().join(',') || 'default';
const work = arg('work') ?? path.join('artifacts/house-preview/row-strip', face, flagEnv.replace(/[^\w=,.-]/g, '_'));
fs.mkdirSync(work, { recursive: true });

const left = Math.min(...spans.map(s => s.px[0])), right = Math.max(...spans.map(s => s.px[1]));
const W = right - left, H = strip.height;
const renders: sharp.OverlayOptions[] = [];
const labels: string[] = [];
for (const s of spans) {
  const id = bare(s.pandId), dir = path.join(work, id);
  if (!fs.existsSync(path.join(dir, 'front.png'))) {
    const r = spawnSync('node', ['--import', 'tsx', 'scripts/house-preview/preview.ts', id, '--route', arg('route') ?? 'generic', '--ppm', String(ppm), '--out', dir], { encoding: 'utf8', env: process.env });
    if (r.status !== 0) { console.error(`${id}: preview failed\n${(r.stderr || r.stdout).slice(-600)}`); continue; }
  }
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'measure.json'), 'utf8')) as { heights?: { topM: number; eavesM: number }; layout?: { storeys?: number } };
  const topM = m.heights?.topM ?? 0;
  const w = Math.max(1, s.px[1] - s.px[0]), h = Math.max(1, Math.round(topM * ppm));
  const img = await sharp(path.join(dir, 'front.png')).resize(w, h, { fit: 'fill' }).png().toBuffer();
  renders.push({ input: img, left: s.px[0] - left, top: Math.max(0, H - h) });
  labels.push(`<text x="${s.px[0] - left + 4}" y="${H + 16}" font-size="13" fill="#ddd" font-family="Helvetica">${id.slice(-6)} · ${m.layout?.storeys ?? '?'} st · top ${(m.heights?.eavesM ?? 0).toFixed(1)}</text>`);
  console.log(`${id} storeys ${m.layout?.storeys ?? '?'} eaves ${m.heights?.eavesM?.toFixed(2)} top ${topM.toFixed(2)}`);
}
const grid = (h: number) => Array.from({ length: Math.floor(strip.heightM / 3) }, (_, i) => `<line x1="0" x2="${W}" y1="${h - (i + 1) * 3 * ppm}" y2="${h - (i + 1) * 3 * ppm}" stroke="#ff3355" stroke-opacity="0.45" stroke-width="1"/><text x="2" y="${h - (i + 1) * 3 * ppm - 2}" font-size="11" fill="#ff3355" font-family="Helvetica">${(i + 1) * 3} m</text>`).join('');
// A strip jpg can be narrower or shorter than strip.json says (cropped exports): extract what exists, pad the rest.
const meta = await sharp(stripJpg).metadata();
const pw = Math.max(1, Math.min(W, (meta.width ?? W) - left)), ph = Math.min(H, meta.height ?? H);
const photo = await sharp({ create: { width: W, height: H, channels: 3, background: '#333' } })
  .composite([{ input: await sharp(stripJpg).extract({ left, top: 0, width: pw, height: ph }).png().toBuffer(), left: 0, top: H - ph }]).png().toBuffer();
const sky = { r: 160, g: 180, b: 200 };
const rendered = await sharp({ create: { width: W, height: H, channels: 3, background: sky } }).composite(renders).png().toBuffer();
const head = 30, foot = 24;
const svg = (h: number, extra = '') => Buffer.from(`<svg width="${W}" height="${h}" xmlns="http://www.w3.org/2000/svg">${extra}</svg>`);
const label = arg('label') ?? `${face}: photo strip (top) | Node renderer, route ${arg('route') ?? 'generic'} (${flagEnv}) (bottom)`;
const sheet = await sharp({ create: { width: W, height: head + 2 * H + foot + 8, channels: 3, background: '#111' } }).composite([
  { input: svg(head, `<text x="6" y="20" font-size="16" fill="#eee" font-family="Helvetica">${label.replace(/&/g, '&amp;')}</text>`), left: 0, top: 0 },
  { input: photo, left: 0, top: head },
  { input: svg(H, grid(H)), left: 0, top: head },
  { input: rendered, left: 0, top: head + H + 8 },
  { input: svg(H, grid(H)), left: 0, top: head + H + 8 },
  { input: svg(foot + 4, labels.join('').replace(/y="\d+"/g, 'y="16"')), left: 0, top: head + 2 * H + 8 },
]).jpeg({ quality: 82 }).toBuffer();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, sheet);
console.log(out);
