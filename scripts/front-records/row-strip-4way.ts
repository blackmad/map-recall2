/**
 * Row strip with the answer key, in lane 1's row-strip layout (scripts/house-preview/row-strip.ts): the rectified photo
 * strip, lane 1's renderer row, and the answer key: each front skinned with its own strip segment cut at the record's
 * skyline. Same pixels per metre and spans as the strip. The answer key is a review aid only and never ships.
 *
 *   node --import tsx scripts/front-records/row-strip-4way.ts --face haarlemmerdijk-2-58 --strip-jpg <strip.jpg> \
 *        --out <file.jpg> [--from 167821] [--to 176175] [--lane1 <lane 1 sheet jpg> --lane1-label <text>] \
 *        [--kit <dir of <pand>/front.png + measure.json>]
 *
 * Three rows by default (photo | renderer | answer key); --kit adds the recipe-compiler row (route C, dropped from the
 * strips 2026-11-13) above the answer key.
 * --lane1 takes lane 1's published two-row sheet (header 30, photo H, gap 8, renderer H, footer 24 at native scale,
 * possibly downscaled) and cuts its renderer row back out, rescaled to this strip's width; without it the row is blank.
 * The skyline (magenta) is the record's, per front: a pand with `fronts` steps at each split. Within a front: the full
 * width to frontTopM, then for a gable the crown narrowing from the shoulder (or the front top) to the neck/cap width up
 * to crown.topM (a point gable as a triangle); a raised dormer, ornament or crown top over a cornice adds a centred band.
 * Fronts without a measured front top are left as sky and labelled.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type {FrontFields, FrontRecordTable} from '../../src/canalRecall/houseLine/frontRecord.ts';
import {STRIP_SHIFT_M, shiftFor} from './strip-shift.ts';
import {outlineOf} from '../../src/canalRecall/houseLine/frontOutline.ts';

type Span = {pandId: string; px: [number, number]};
type Strip = {pixelsPerMetre: number; width: number; height: number; heightM: number; spans: Span[]};
const ROOT = path.resolve(import.meta.dirname, '../..');
const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const face = arg('face'), stripJpg = arg('strip-jpg'), out = arg('out'), kitDir = arg('kit');
if (!face || !stripJpg || !out) { console.error('row-strip-4way --face <face> --strip-jpg <jpg> --out <jpg> [--lane1 <jpg>] [--kit <dir>]'); process.exit(2); }
const strip = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/block-face/faces', face, 'strip.json'), 'utf8')) as Strip;
const table = JSON.parse(fs.readFileSync(path.join(ROOT, arg('table') ?? 'data/front-records/haarlemmerdijk-block.json'), 'utf8')) as FrontRecordTable;
const ppm = strip.pixelsPerMetre, H = strip.height;
const bare = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');
let spans = strip.spans;
const from = arg('from'), to = arg('to');
if (from) spans = spans.slice(spans.findIndex(s => bare(s.pandId).endsWith(from)));
if (to) spans = spans.slice(0, spans.findIndex(s => bare(s.pandId).endsWith(to)) + 1);
const left = Math.min(...spans.map(s => s.px[0])), right = Math.max(...spans.map(s => s.px[1])), W = right - left;
const recOf = (id: string) => table.records.find(r => r.face === face && r.pandId === id);
const Y = (m: number) => H - m * ppm;

/** Skyline polygon of one front in row pixels (x relative to the row's left edge): the traced outline when there is one,
 * else the record's (frontOutline.ts). `spanX0` is the pand span's left edge in row pixels. */
function skyline(f: FrontFields, spanX0: number, a: number, b: number): [number, number][] | null {
  const o = f.trace?.outline ?? outlineOf(f, (a - spanX0) / ppm, (b - spanX0) / ppm);
  return o ? o.map(([x, y]) => [spanX0 + x * ppm, Y(y)]) : null;
}

const sky = {r: 160, g: 180, b: 200};
const meta = await sharp(stripJpg).metadata();
const kitComps: sharp.OverlayOptions[] = [], skinComps: sharp.OverlayOptions[] = [];
const lines: string[] = [], photoLines: string[] = [], labels: string[] = [];
let nLabel = 0;
const ly = () => (nLabel++ % 2 ? 29 : 13);
const tagOf = (a: string | null | undefined) => (a ?? '').replace('Haarlemmerdijk ', 'HD').replace('Haarlemmerstraat ', 'HS');
for (const s of spans) {
  const id = bare(s.pandId), x0 = s.px[0] - left, x1 = s.px[1] - left, w = Math.max(1, x1 - x0);
  const rec = recOf(id);
  const shift = Math.round(shiftFor(face, id) * ppm);
  // The fronts to draw: each sub-front of a split pand over its own metres, else the record itself.
  const parts = rec?.fronts?.length
    ? rec.fronts.map(f => ({f, a: x0 + f.from * ppm, b: Math.min(x1, x0 + f.to * ppm), tag: f.addresses.length ? tagOf(f.addresses[0]) : `${tagOf(rec.address)}*`}))
    : rec ? [{f: rec as FrontFields, a: x0, b: x1, tag: tagOf(rec.address)}] : [];
  if (!parts.length) labels.push(`<text x="${x0 + 4}" y="${ly()}" font-size="12" fill="#f88" font-family="Helvetica">${id.slice(-6)} · no record</text>`);
  const polys: [number, number][][] = [];
  for (const {f, a, b, tag} of parts) {
    const sk = skyline(f, x0, a, b);
    if (!sk) { labels.push(`<text x="${a + 4}" y="${ly()}" font-size="12" fill="#f88" font-family="Helvetica">${id.slice(-6)} ${tag} · no front top</text>`); continue; }
    polys.push(sk);
    const pl = (dx: number) => `<polyline points="${sk.map(([x, y]) => `${(x + dx).toFixed(1)},${y.toFixed(1)}`).join(' ')}" fill="none" stroke="#ff00ff" stroke-width="2"/>`;
    lines.push(pl(0)); photoLines.push(pl(shift)); // on the photo the skyline follows the face's registration
    labels.push(`<text x="${a + 4}" y="${ly()}" font-size="12" fill="#ddd" font-family="Helvetica">${id.slice(-6)} ${tag} · ${f.storeys ?? '?'} st · top ${f.frontTopM} · ${f.crown.family ?? '-'} · ${f.confidence}</text>`);
  }
  // kit row (optional): the recipe preview at the strip's scale, standing on the street (as lane 1 places its renders)
  const kp = kitDir ? path.join(kitDir, id, 'front.png') : '';
  if (kitDir && fs.existsSync(kp)) {
    const m = JSON.parse(fs.readFileSync(path.join(kitDir, id, 'measure.json'), 'utf8')) as {heights?: {topM: number}};
    const h = Math.max(1, Math.round((m.heights?.topM ?? 0) * ppm));
    kitComps.push({input: await sharp(kp).resize(w, h, {fit: 'fill'}).png().toBuffer(), left: x0, top: Math.max(0, H - h)});
  }
  if (!polys.length) continue;
  // answer key: the pand's own strip segment (shifted by the face's registration), masked by its fronts' skylines
  const sx = Math.max(0, Math.min((meta.width ?? 0) - w, s.px[0] + shift));
  const seg = await sharp(stripJpg).extract({left: sx, top: 0, width: w, height: H}).ensureAlpha().png().toBuffer();
  const mask = Buffer.from(`<svg width="${w}" height="${H}" xmlns="http://www.w3.org/2000/svg">${polys.map(sk => `<polygon points="${sk.map(([x, y]) => `${(x - x0).toFixed(1)},${y.toFixed(1)}`).join(' ')}" fill="#fff"/>`).join('')}</svg>`);
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
const rowsOut: {title: string; img: Buffer; lines: string}[] = [
  {title: 'photo strip (Gemeente Amsterdam panorama, CC BY 4.0); magenta = the front records\' skylines, per front', img: photo, lines: photoLines.join('')},
  {title: arg('lane1-label') ?? 'lane 1 renderer', img: lane1, lines: ''},
];
if (kitDir) rowsOut.push({title: 'recipe compiler (route C builder) on the front records', img: await row(kitComps), lines: lines.join('')});
rowsOut.push({title: `answer key, never shipped: each front's own strip segment (registration ${STRIP_SHIFT_M[face] ?? 0} m), cut at its record's skyline`, img: await row(skinComps), lines: lines.join('')});
const head = 30, cap = 22, foot = 36, gap = 8;
const comps: sharp.OverlayOptions[] = [{input: svg(head, `<text x="6" y="21" font-size="17" fill="#eee" font-family="Helvetica">${face}: ${esc(rowsOut.map(r => r.title.split(/[ (:;,]/)[0]).join(' | '))} (${ppm} px/m, 3 m grid)</text>`), left: 0, top: 0}];
let y = head;
rowsOut.forEach((r, i) => {
  comps.push({input: svg(cap, `<text x="6" y="16" font-size="14" fill="#cfc" font-family="Helvetica">${i + 1}. ${esc(r.title)}</text>`), left: 0, top: y});
  y += cap;
  comps.push({input: r.img, left: 0, top: y}, {input: svg(H, grid + r.lines), left: 0, top: y});
  y += H + gap;
});
comps.push({input: svg(foot, labels.join('')), left: 0, top: y});
const sheet = await sharp({create: {width: W, height: y + foot, channels: 3, background: '#111'}}).composite(comps).jpeg({quality: 84}).toBuffer();
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, sheet);
console.log(out, W, y + foot);
