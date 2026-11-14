/**
 * Wall colour per front, measured on the block-face strip with the capture's exposure taken out (lane WC option (c),
 * houseSpec/wallExposure.ts on lane/wall-exposure-20261113: sample x target / sqrt(white x scene), in linear light).
 *
 *   node --import tsx scripts/front-records/measure-walls.ts --strips <dir holding <face>-strip.jpg> [--sheet <out.jpg>]
 *
 * Per pand of data/front-records/haarlemmerdijk-block.json: the wall sample is the spandrel bands between the measured
 * window rows (head + 0.15 m .. next sill - 0.15 m), else the band 5-9.5 m; the central 60 % of the front, shifted by the
 * face's measured strip registration; glass (the darkest 20 %) and frames/dressings (the brightest 15 %) dropped. The
 * capture's white is the 95th percentile Y of the whole front, its scene the median Y of the strip. Writes
 * data/front-records/haarlemmerdijk-walls.json; --sheet writes photo | swatch pairs for the review that marks a wall
 * `reviewed` in data/front-records/haarlemmerdijk-walls.review.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type {FrontFields, FrontRecordTable} from '../../src/canalRecall/houseLine/frontRecord.ts';
import {hexToOklab, oklabToHex} from '../../src/canalRecall/houseSpec/wallColour.ts';
import {STRIP_SHIFT_M} from './strip-shift.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const STRIPS = opt('strips') ?? '/Users/blackmad/Code/map-recall2-source-data/block-face-strips/haarlemmerbuurt-20261110/strips';
const TARGET = 0.23, GMIN = 0.8, GMAX = 3; // lane WC EXPOSURE.target / gainMin / gainMax
const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const unlin = (c: number) => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const hex = (rgb: number[]) => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

export interface WallMeasure {pandId: string; face: string; rawHex: string | null; hex: string | null; gain: number | null; white: number | null; scene: number;
  sample: 'spandrels' | 'band-5-9.5' | 'traced-wall' | null; fasciaHex?: string | null; pixels: number; L: number | null; chroma: number | null; finishGuess: 'brick' | 'plaster' | null; note: string | null}

const table: FrontRecordTable = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/front-records/haarlemmerdijk-block.json'), 'utf8'));
const out: WallMeasure[] = [];
const sheetTiles: {img: Buffer; label: string; sw: string}[] = [];
const faces = [...new Set(table.records.map(r => r.face))];
for (const face of faces) {
  const strip = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/block-face/faces', face, 'strip.json'), 'utf8'));
  const img = path.join(STRIPS, `${face}-strip.jpg`);
  const {data, info} = await sharp(img).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const W = info.width, H = info.height, ppm = strip.pixelsPerMetre;
  const Y = (x: number, y: number) => { const i = (y * W + x) * 3; return 0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]); };
  const all: number[] = []; for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) all.push(Y(x, y));
  const scene = q(all, 0.5);
  const shift = Math.round((STRIP_SHIFT_M[face] ?? 0) * ppm);
  const rowOf = (m: number) => Math.round(H - m * ppm);
  // Each record, and each sub-front of a multi-front pand as `<pandId>#<i>` over its own metres of the span.
  const targets: {key: string; rec: FrontFields; span: {px: [number, number]} | undefined; pandX0: number}[] = [];
  for (const rec of table.records.filter(r => r.face === face)) {
    const span = strip.spans.find((s: {pandId: string}) => s.pandId === rec.pandId);
    targets.push({key: rec.pandId, rec, span, pandX0: span?.px[0] ?? 0});
    rec.fronts?.forEach((f, i) => targets.push({key: `${rec.pandId}#${i}`, rec: f, span: span && {px: [Math.round(span.px[0] + f.from * ppm), Math.round(span.px[0] + f.to * ppm)]}, pandX0: span?.px[0] ?? 0}));
  }
  for (const {key, rec, span, pandX0} of targets) {
    const base: WallMeasure = {pandId: key, face, rawHex: null, hex: null, gain: null, white: null, scene: r3(scene), sample: null, pixels: 0, L: null, chroma: null, finishGuess: null, note: null};
    if (!span) { out.push({...base, note: 'no span on the strip'}); continue; }
    const [a, b] = span.px, w = b - a;
    const x0 = Math.max(0, Math.round(a + shift + 0.2 * w)), x1 = Math.min(W, Math.round(b + shift - 0.2 * w));
    const bands: [number, number][] = [];
    for (let i = 0; i + 1 < rec.rows.length; i++) { const lo = rec.rows[i].headM + 0.15, hi = rec.rows[i + 1].sillM - 0.15; if (hi - lo >= 0.2) bands.push([lo, hi]); }
    if (rec.rows.length && rec.frontTopM !== null) { const lo = rec.rows.at(-1)!.headM + 0.15, hi = Math.min(rec.frontTopM - 0.3, lo + 0.8); if (hi - lo >= 0.2 && rec.crown.family === 'straight-cornice') {/* cornice band: trim, skip */} else if (hi - lo >= 0.2) bands.push([lo, hi]); }
    let sample: WallMeasure['sample'] = bands.length ? 'spandrels' : 'band-5-9.5';
    if (!bands.length) bands.push([5, Math.min(9.5, (rec.frontTopM ?? 9.8) - 0.3)]);
    const px: [number, number, number, number][] = [];
    const tr = rec.trace && rec.trace.confidence !== 'low' && rec.frontTopM !== null ? rec.trace : null;
    if (tr) {
      // Traced front: every wall pixel between the shop band and the cornice (or front top), openings (grown 0.15 m) and
      // bands left out, over the front's full width less 0.15 m a side. Piers beside an oriel count; glass never does.
      sample = 'traced-wall';
      const holes = [...tr.storeys.flat().map(o => [o.x - 0.15, o.x + o.w + 0.15, o.y - 0.15, o.y + o.h + 0.15]), ...tr.bands.map(bd => [-1e9, 1e9, bd.bottomM - 0.05, bd.topM + 0.05])];
      const yLo = Math.max(3, (tr.shopBandTopM ?? rec.groundStoreyTopM ?? 4) + 0.3), yHi = Math.min(tr.corniceM ?? rec.frontTopM!, rec.frontTopM!) - 0.3;
      const fx0 = Math.round(a + shift + 0.15 * ppm), fx1 = Math.round(b + shift - 0.15 * ppm);
      for (let y = Math.max(0, rowOf(yHi)); y < Math.min(H, rowOf(yLo)); y++) for (let x = Math.max(0, fx0); x < Math.min(W, fx1); x++) {
        const mx = (x - shift - pandX0) / ppm, my = (H - y) / ppm;
        if (holes.some(([hx0, hx1, hy0, hy1]) => mx >= hx0 && mx < hx1 && my >= hy0 && my < hy1)) continue;
        const i = (y * W + x) * 3; px.push([data[i], data[i + 1], data[i + 2], Y(x, y)]);
      }
    } else for (const [lo, hi] of bands) for (let y = rowOf(hi); y < rowOf(lo); y++) for (let x = x0; x < x1; x++) {
      if (y < 0 || y >= H) continue; const i = (y * W + x) * 3; px.push([data[i], data[i + 1], data[i + 2], Y(x, y)]);
    }
    const front: number[] = []; const ftop = rowOf(Math.min(rec.frontTopM ?? 12, strip.heightM - 0.5)), fbot = rowOf(3);
    for (let y = Math.max(0, ftop); y < Math.min(H, fbot); y += 2) for (let x = x0; x < x1; x += 2) front.push(Y(x, y));
    if (px.length < 200 || !front.length) { out.push({...base, sample, pixels: px.length, note: 'too few wall pixels'}); continue; }
    const ys = px.map(p => p[3]), lo = q(ys, 0.2), hi = q(ys, 0.85);
    const kept = px.filter(p => p[3] >= lo && p[3] <= hi);
    const med = [0, 1, 2].map(c => q(kept.map(p => p[c]), 0.5));
    const white = q(front, 0.95);
    const gain = Math.min(GMAX, Math.max(GMIN, TARGET / Math.sqrt(Math.max(1e-4, white) * Math.max(1e-4, scene))));
    const exposed = med.map(c => unlin(Math.min(1, lin(c) * gain)));
    const h = hex(exposed), [L, A, B] = hexToOklab(h), chroma = Math.hypot(A, B);
    const finishGuess = L >= 0.66 && chroma < 0.06 ? 'plaster' : 'brick';
    // The shop fascia: the band just under the traced shop-band top, exposed like the wall, its chroma muted to 60 %.
    let fasciaHex: string | null = null;
    if (tr?.shopBandTopM) {
      const fp: number[][] = [];
      for (let y = Math.max(0, rowOf(tr.shopBandTopM - 0.05)); y < Math.min(H, rowOf(tr.shopBandTopM - 0.5)); y++) for (let x = Math.max(0, Math.round(a + shift + 0.1 * w)); x < Math.min(W, Math.round(b + shift - 0.1 * w)); x++) { const i = (y * W + x) * 3; fp.push([data[i], data[i + 1], data[i + 2]]); }
      if (fp.length > 50) {
        const fm = [0, 1, 2].map(c => q(fp.map(p => p[c]), 0.5)).map(c => unlin(Math.min(1, lin(c) * gain)));
        const [fl, fa, fb] = hexToOklab(hex(fm));
        fasciaHex = oklabToHex([fl, fa * 0.6, fb * 0.6]);
      }
    }
    out.push({...base, rawHex: hex(med), hex: h, gain: r3(gain), white: r3(white), sample, pixels: kept.length, L: r3(L), chroma: r3(chroma), finishGuess, fasciaHex});
    if (opt('sheet')) {
      const top = Math.max(0, rowOf(Math.min((rec.crown.topM ?? rec.frontTopM ?? 14) + 1, strip.heightM))), cx0 = Math.max(0, a + shift), cw = Math.min(W - cx0, w);
      const tile = await sharp(img).extract({left: cx0, top, width: cw, height: H - top}).resize(160, 300, {fit: 'contain', background: '#222'}).png().toBuffer();
      sheetTiles.push({img: tile, label: `${('address' in rec ? (rec as {address: string | null}).address ?? '' : key.slice(-8)).replace('Haarlemmerdijk ', 'HD').replace('Haarlemmerstraat ', 'HS')}`, sw: h});
    }
  }
}
fs.writeFileSync(path.join(ROOT, 'data/front-records/haarlemmerdijk-walls.json'), JSON.stringify({
  method: 'lane WC option (c) per-capture normalisation on the block-face strip: spandrel median (glass and dressings dropped) x clamp(0.23 / sqrt(white95 x sceneMedian), 0.8, 3) in linear light',
  strips: 'staging/block-face/<face>/strip.jpg (Gemeente Amsterdam panorama, CC BY 4.0), archived in map-recall2-source-data block-face-strips/haarlemmerbuurt-20261110/strips/<face>-strip.jpg',
  stripShiftM: STRIP_SHIFT_M, walls: out}, null, 1) + '\n');
console.log(`${out.filter(w => w.hex).length}/${out.length} walls measured`);
if (opt('sheet')) {
  const cols = 16, tw = 170, th = 360, rows = Math.ceil(sheetTiles.length / cols);
  const comps: sharp.OverlayOptions[] = [];
  sheetTiles.forEach((t, i) => {
    const x = (i % cols) * tw, y = Math.floor(i / cols) * th;
    comps.push({input: t.img, left: x + 5, top: y + 5});
    comps.push({input: Buffer.from(`<svg width="160" height="50" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="160" height="30" fill="${t.sw}"/><text x="2" y="46" font-size="13" fill="#eee" font-family="Helvetica">${t.label} ${t.sw}</text></svg>`), left: x + 5, top: y + 307});
  });
  await sharp({create: {width: cols * tw, height: rows * th, channels: 3, background: '#222'}}).composite(comps).jpeg({quality: 80}).toFile(opt('sheet')!);
  console.log(opt('sheet'));
}
