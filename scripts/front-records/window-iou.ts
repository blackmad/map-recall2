/**
 * Window correspondence of a drawn row against the traced fronts (src/canalRecall/houseLine/windowCorrespondence.ts).
 *
 *   node --import tsx scripts/front-records/window-iou.ts --face haarlemmerdijk-2-58 --render <image> [--sheet] \
 *        [--from 167821] [--to 176175] [--json <out.json>] [--overlay <out.jpg>] [--no-ground]
 *
 * --render is a drawn row at the strip's scale covering the spans from --from to --to (the left edge = the first span's
 * px[0]); with --sheet it is lane 1's two-row row-strip sheet (header 30, photo H, gap 8, renderer H, possibly
 * downscaled) and the renderer row is cut out of it. Drawn openings are the glass pixels of the render (blue-grey: b and
 * g above r, darker than the sky), closed over 3 px so glazing bars and frames do not split a window. Lane 1 can call
 * rowScore() with its own window boxes instead; this script is for a render alone.
 * Prints one line per traced front (IoU, measured and drawn m²) and the row aggregate (sum of intersections / sum of
 * unions); --overlay draws the measured rectangles (green) over the drawn glass (magenta) on the render.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type {FrontRecordTable} from '../../src/canalRecall/houseLine/frontRecord.ts';
import {rowScore, tracedFronts} from '../../src/canalRecall/houseLine/windowCorrespondence.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const face = arg('face'), render = arg('render');
if (!face || !render) { console.error('window-iou --face <face> --render <image> [--sheet] [--from id] [--to id] [--json out] [--overlay out.jpg]'); process.exit(2); }
const strip = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/block-face/faces', face, 'strip.json'), 'utf8')) as {pixelsPerMetre: number; height: number; spans: {pandId: string; px: [number, number]}[]};
const table = JSON.parse(fs.readFileSync(path.join(ROOT, arg('table') ?? 'data/front-records/haarlemmerdijk-block.json'), 'utf8')) as FrontRecordTable;
const ppm = strip.pixelsPerMetre, H = strip.height;
const bare = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');
let spans = strip.spans;
const from = arg('from'), to = arg('to');
if (from) spans = spans.slice(spans.findIndex(s => bare(s.pandId).endsWith(from)));
if (to) spans = spans.slice(0, spans.findIndex(s => bare(s.pandId).endsWith(to)) + 1);
const left = Math.min(...spans.map(s => s.px[0])), W = Math.max(...spans.map(s => s.px[1])) - left;

let img = sharp(render);
if (argv.includes('--sheet')) {
  const m = await sharp(render).metadata(), sc = m.width! / W;
  img = sharp(render).extract({left: 0, top: Math.round((30 + H + 8) * sc), width: m.width!, height: Math.round(H * sc)});
}
const rowBuf = await img.resize(W, H, {fit: 'fill'}).removeAlpha().png().toBuffer();
const {data} = await sharp(rowBuf).raw().toBuffer({resolveWithObject: true});
// Glass mask, then a 3 px closing (dilate, erode) to bridge glazing bars and thin frames.
let mask = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) {
  const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2], lum = (r + g + b) / 765;
  mask[i] = b - r >= 8 && g - r >= 6 && lum < 0.55 ? 1 : 0;
}
const morph = (m: Uint8Array, rad: number, grow: boolean) => {
  const o = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = grow ? 0 : 1;
    for (let dy = -rad; dy <= rad && (grow ? !v : v); dy++) for (let dx = -rad; dx <= rad; dx++) {
      const yy = y + dy, xx = x + dx; const s = yy < 0 || yy >= H || xx < 0 || xx >= W ? 0 : m[yy * W + xx];
      if (grow && s) { v = 1; break; } if (!grow && !s) { v = 0; break; }
    }
    o[y * W + x] = v;
  }
  return o;
};
mask = morph(morph(mask, 3, true), 3, false);
const spanOf = (pandId: string) => spans.find(s => bare(s.pandId) === pandId);
const score = rowScore(table, face, (key) => {
  const sp = spanOf(key.split('#')[0]);
  if (!sp) return null;
  return (x: number, y: number) => {
    const px = Math.floor(sp.px[0] - left + x * ppm), py = Math.floor(H - y * ppm);
    return px >= 0 && px < W && py >= 0 && py < H ? mask[py * W + px] === 1 : false;
  };
}, {ground: !argv.includes('--no-ground')});
for (const f of score.fronts) console.log(`${f.key.padEnd(20)} ${(f.address ?? '').padEnd(22)} IoU ${f.iou.toFixed(3)}  measured ${f.measuredM2.toFixed(1)} m²  drawn ${f.drawnM2.toFixed(1)} m²`);
console.log(`aggregate IoU ${score.aggregate.toFixed(3)} over ${score.frontsScored} traced fronts (${argv.includes('--no-ground') ? 'upper storeys' : 'all storeys'})`);
if (arg('json')) fs.writeFileSync(arg('json')!, JSON.stringify({face, render, ground: !argv.includes('--no-ground'), ...score}, null, 1) + '\n');
if (arg('overlay')) {
  const ov = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) if (mask[i]) { ov[i * 4] = 255; ov[i * 4 + 2] = 255; ov[i * 4 + 3] = 110; }
  const rects: string[] = [], labels: string[] = [];
  for (const t of tracedFronts(table, face)) {
    const sp = spanOf(t.record.pandId); if (!sp) continue;
    const x0 = sp.px[0] - left;
    for (const o of t.openings) rects.push(`<rect x="${(x0 + o.x * ppm).toFixed(1)}" y="${(H - (o.y + o.h) * ppm).toFixed(1)}" width="${(o.w * ppm).toFixed(1)}" height="${(o.h * ppm).toFixed(1)}" fill="none" stroke="#00ff66" stroke-width="2"/>`);
    const s = score.fronts.find(f => f.key === t.key);
    if (s) labels.push(`<text x="${(x0 + t.box.x0 * ppm + 3).toFixed(0)}" y="${H - 6}" font-size="16" fill="#fff" stroke="#000" stroke-width="0.6" font-family="Helvetica">IoU ${s.iou.toFixed(2)}</text>`);
  }
  const svg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${rects.join('')}${labels.join('')}</svg>`);
  await sharp(rowBuf).composite([{input: ov, raw: {width: W, height: H, channels: 4}}, {input: svg}]).jpeg({quality: 84}).toFile(arg('overlay')!);
  console.log(arg('overlay'));
}
