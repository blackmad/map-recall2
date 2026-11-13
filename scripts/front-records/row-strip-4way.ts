/**
 * Four-row strip for one block face, in lane 1's row-strip layout (scripts/house-preview/row-strip.ts): the rectified
 * photo strip, lane 1's renderer row, the recipe compiler (route C's builder) drawn from the front records, and each
 * front skinned with its own strip segment cut at the measured skyline. Same pixels per metre and spans as the strip.
 *
 *   node --import tsx scripts/front-records/row-strip-4way.ts --face haarlemmerdijk-2-58 --strip-jpg <strip.jpg> \
 *        --kit <dir of <pand>/front.png + measure.json> --out <file.jpg> [--from 167821] [--to 176175] \
 *        [--lane1 <lane 1 sheet jpg> --lane1-label <text>]
 *
 * --lane1 takes lane 1's published two-row sheet (header 30, photo H, gap 8, renderer H, footer 24 at native scale,
 * possibly downscaled) and cuts its renderer row back out, rescaled to this strip's width; without it the row is blank.
 * The skyline (magenta) is the record's: the full front to frontTopM, then for a gable the crown narrowing from the
 * shoulder (or the front top) to the neck/cap width up to crown.topM; a raised dormer, ornament or crown top over a
 * cornice adds a centred band. Fronts without a measured front top are left as sky and labelled.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type {FrontRecord, FrontRecordTable} from '../../src/canalRecall/houseLine/frontRecord.ts';
import {STRIP_SHIFT_M} from './strip-shift.ts';

type Span = {pandId: string; px: [number, number]};
type Strip = {pixelsPerMetre: number; width: number; height: number; heightM: number; spans: Span[]};
const ROOT = path.resolve(import.meta.dirname, '../..');
const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const face = arg('face'), stripJpg = arg('strip-jpg'), out = arg('out'), kitDir = arg('kit');
if (!face || !stripJpg || !out || !kitDir) { console.error('row-strip-4way --face <face> --strip-jpg <jpg> --kit <dir> --out <jpg>'); process.exit(2); }
const strip = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/block-face/faces', face, 'strip.json'), 'utf8')) as Strip;
const table = JSON.parse(fs.readFileSync(path.join(ROOT, arg('table') ?? 'data/front-records/haarlemmerdijk-block.json'), 'utf8')) as FrontRecordTable;
const ppm = strip.pixelsPerMetre, H = strip.height;
const bare = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');
let spans = strip.spans;
const from = arg('from'), to = arg('to');
if (from) spans = spans.slice(spans.findIndex(s => bare(s.pandId).endsWith(from)));
if (to) spans = spans.slice(0, spans.findIndex(s => bare(s.pandId).endsWith(to)) + 1);
const left = Math.min(...spans.map(s => s.px[0])), right = Math.max(...spans.map(s => s.px[1])), W = right - left;
const shift = Math.round((STRIP_SHIFT_M[face] ?? 0) * ppm);
const recOf = (id: string) => table.records.find(r => r.face === face && r.pandId === id);
const Y = (m: number) => H - m * ppm;

/** Skyline polygon of one front in row pixels (x relative to the row's left edge). */
function skyline(rec: FrontRecord, x0: number, x1: number): [number, number][] | null {
  if (rec.frontTopM === null) return null;
  const top = rec.frontTopM, c = rec.crown, mid = (x0 + x1) / 2, w = x1 - x0;
  const pts: [number, number][] = [[x0, H], [x0, Y(top)]];
  const gable = c.family !== null && ['neck', 'bell', 'point', 'step', 'spout'].includes(c.family) && c.topM !== null && c.topM > top;
  if (gable && c.family === 'point') pts.push([mid, Y(c.topM!)]);
  else if (gable) {
    const cap = (c.neckWidthM ?? c.widthM ?? 0.4 * w / ppm) * ppm;
    const sh = Math.max(top, Math.min(c.shoulderM ?? top, c.topM! - 0.3));
    pts.push([mid - cap / 2, Y(sh)], [mid - cap / 2, Y(c.topM!)], [mid + cap / 2, Y(c.topM!)], [mid + cap / 2, Y(sh)]);
  } else {
    const d = c.dormer;
    const band = d && d.topM !== null && d.topM > top ? {t: d.topM, w: 0.35 * w}
      : c.ornamentTopM !== null && c.ornamentTopM > top ? {t: c.ornamentTopM, w: 0.25 * w}
      : c.topM !== null && c.topM > top + 0.2 ? {t: c.topM, w: (c.widthM ?? 0.35 * w / ppm) * ppm} : null;
    if (band) pts.push([mid - band.w / 2, Y(top)], [mid - band.w / 2, Y(band.t)], [mid + band.w / 2, Y(band.t)], [mid + band.w / 2, Y(top)]);
  }
  pts.push([x1, Y(top)], [x1, H]);
  return pts;
}

const sky = {r: 160, g: 180, b: 200};
const meta = await sharp(stripJpg).metadata();
const kitComps: sharp.OverlayOptions[] = [], skinComps: sharp.OverlayOptions[] = [];
const lines: string[] = [], photoLines: string[] = [], labels: string[] = [];
let nLabel = 0;
const ly = () => (nLabel++ % 2 ? 29 : 13);
for (const s of spans) {
  const id = bare(s.pandId), x0 = s.px[0] - left, x1 = s.px[1] - left, w = Math.max(1, x1 - x0);
  const rec = recOf(id);
  const sk = rec ? skyline(rec, x0, x1) : null;
  const tag = rec?.address?.replace('Haarlemmerdijk ', 'HD') ?? '';
  if (!rec || !sk) { labels.push(`<text x="${x0 + 4}" y="${ly()}" font-size="12" fill="#f88" font-family="Helvetica">${id.slice(-6)} ${tag} · no front top</text>`); continue; }
  const pl = (dx: number) => `<polyline points="${sk.map(([x, y]) => `${(x + dx).toFixed(1)},${y.toFixed(1)}`).join(' ')}" fill="none" stroke="#ff00ff" stroke-width="2"/>`;
  lines.push(pl(0)); photoLines.push(pl(shift)); // on the photo the skyline follows the face's registration
  labels.push(`<text x="${x0 + 4}" y="${ly()}" font-size="12" fill="#ddd" font-family="Helvetica">${id.slice(-6)} ${tag} · ${rec.storeys ?? '?'} st · top ${rec.frontTopM} · ${rec.crown.family ?? '-'} · ${rec.confidence}</text>`);
  // kit row: the recipe preview at the strip's scale, standing on the street (as lane 1 places its renders)
  const kp = path.join(kitDir, id, 'front.png');
  if (fs.existsSync(kp)) {
    const m = JSON.parse(fs.readFileSync(path.join(kitDir, id, 'measure.json'), 'utf8')) as {heights?: {topM: number}};
    const h = Math.max(1, Math.round((m.heights?.topM ?? 0) * ppm));
    kitComps.push({input: await sharp(kp).resize(w, h, {fit: 'fill'}).png().toBuffer(), left: x0, top: Math.max(0, H - h)});
  }
  // skin row: the front's own strip segment (shifted by the face's registration), masked by its skyline
  const sx = Math.max(0, Math.min((meta.width ?? 0) - w, s.px[0] + shift));
  const seg = await sharp(stripJpg).extract({left: sx, top: 0, width: w, height: H}).ensureAlpha().png().toBuffer();
  const mask = Buffer.from(`<svg width="${w}" height="${H}" xmlns="http://www.w3.org/2000/svg"><polygon points="${sk.map(([x, y]) => `${(x - x0).toFixed(1)},${y.toFixed(1)}`).join(' ')}" fill="#fff"/></svg>`);
  skinComps.push({input: await sharp(seg).composite([{input: mask, blend: 'dest-in'}]).png().toBuffer(), left: x0, top: 0});
}
const grid = Array.from({length: Math.floor(strip.heightM / 3)}, (_, i) => `<line x1="0" x2="${W}" y1="${Y((i + 1) * 3)}" y2="${Y((i + 1) * 3)}" stroke="#ff3355" stroke-opacity="0.45" stroke-width="1"/><text x="2" y="${Y((i + 1) * 3) - 2}" font-size="11" fill="#ff3355" font-family="Helvetica">${(i + 1) * 3} m</text>`).join('');
const svg = (h: number, body: string) => Buffer.from(`<svg width="${W}" height="${h}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
const row = async (comps: sharp.OverlayOptions[]) => sharp({create: {width: W, height: H, channels: 3, background: sky}}).composite(comps).png().toBuffer();
const photo = await sharp(stripJpg).extract({left, top: 0, width: W, height: H}).png().toBuffer();
let lane1: Buffer;
const l1 = arg('lane1');
if (l1) {
  const lm = await sharp(l1).metadata(), sc = (lm.width ?? 1) / W;
  lane1 = await sharp(l1).extract({left: 0, top: Math.round((30 + H + 8) * sc), width: lm.width!, height: Math.round(H * sc)}).resize(W, H, {fit: 'fill'}).png().toBuffer();
} else lane1 = await row([{input: svg(H, `<text x="20" y="${H / 2}" font-size="28" fill="#333" font-family="Helvetica">lane 1 renderer row not supplied</text>`), left: 0, top: 0}]);
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const titles = ['photo strip (Gemeente Amsterdam panorama, CC BY 4.0); magenta = the front record\'s skyline', arg('lane1-label') ?? 'lane 1 renderer',
  'recipe compiler (route C builder) on the front records: measured front top, rows, bays, crown, exposure-corrected wall',
  `each front skinned with its own strip segment (registration ${STRIP_SHIFT_M[face] ?? 0} m), cut at the record's skyline`];
const rows = [photo, lane1, await row(kitComps), await row(skinComps)];
const head = 30, cap = 22, foot = 36, gap = 8;
const comps: sharp.OverlayOptions[] = [{input: svg(head, `<text x="6" y="21" font-size="17" fill="#eee" font-family="Helvetica">${face}: photo | lane 1 renderer | kit on front records | photo-skinned fronts (${ppm} px/m, 3 m grid)</text>`), left: 0, top: 0}];
let y = head;
for (let i = 0; i < rows.length; i++) {
  comps.push({input: svg(cap, `<text x="6" y="16" font-size="14" fill="#cfc" font-family="Helvetica">${i + 1}. ${esc(titles[i])}</text>`), left: 0, top: y});
  y += cap;
  comps.push({input: rows[i], left: 0, top: y}, {input: svg(H, grid + (i === 0 ? photoLines.join('') : i === 1 ? '' : lines.join(''))), left: 0, top: y});
  y += H + gap;
}
comps.push({input: svg(foot, labels.join('')), left: 0, top: y});
const sheet = await sharp({create: {width: W, height: y + foot, channels: 3, background: '#111'}}).composite(comps).jpeg({quality: 84}).toBuffer();
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, sheet);
console.log(out, W, y + foot);
