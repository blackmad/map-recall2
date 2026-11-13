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
import type {FrontRecordTable} from '../../src/canalRecall/houseLine/frontRecord.ts';
import {hexToOklab} from '../../src/canalRecall/houseSpec/wallColour.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const argv = process.argv.slice(2);
const opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const STRIPS = opt('strips') ?? '/Users/blackmad/Code/map-recall2-source-data/block-face-strips/haarlemmerbuurt-20261110/strips';
/** Measured registration of each strip against its BAG splits (metres, + = the photo front stands right of its span). */
export const STRIP_SHIFT_M: Record<string, number> = {'haarlemmerdijk-117-143': -1.2, 'haarlemmerdijk-2-58': 0.6, 'haarlemmerdijk-13-45': -0.9};
const TARGET = 0.23, GMIN = 0.8, GMAX = 3; // lane WC EXPOSURE.target / gainMin / gainMax
const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const unlin = (c: number) => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const hex = (rgb: number[]) => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

export interface WallMeasure {pandId: string; face: string; rawHex: string | null; hex: string | null; gain: number | null; white: number | null; scene: number;
  sample: 'spandrels' | 'band-5-9.5' | null; pixels: number; L: number | null; chroma: number | null; finishGuess: 'brick' | 'plaster' | null; note: string | null}

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
  for (const rec of table.records.filter(r => r.face === face)) {
    const span = strip.spans.find((s: {pandId: string}) => s.pandId === rec.pandId);
    const base: WallMeasure = {pandId: rec.pandId, face, rawHex: null, hex: null, gain: null, white: null, scene: r3(scene), sample: null, pixels: 0, L: null, chroma: null, finishGuess: null, note: null};
    if (!span) { out.push({...base, note: 'no span on the strip'}); continue; }
    const [a, b] = span.px, w = b - a;
    const x0 = Math.max(0, Math.round(a + shift + 0.2 * w)), x1 = Math.min(W, Math.round(b + shift - 0.2 * w));
    const bands: [number, number][] = [];
    for (let i = 0; i + 1 < rec.rows.length; i++) { const lo = rec.rows[i].headM + 0.15, hi = rec.rows[i + 1].sillM - 0.15; if (hi - lo >= 0.2) bands.push([lo, hi]); }
    if (rec.rows.length && rec.frontTopM !== null) { const lo = rec.rows.at(-1)!.headM + 0.15, hi = Math.min(rec.frontTopM - 0.3, lo + 0.8); if (hi - lo >= 0.2 && rec.crown.family === 'straight-cornice') {/* cornice band: trim, skip */} else if (hi - lo >= 0.2) bands.push([lo, hi]); }
    const sample: 'spandrels' | 'band-5-9.5' = bands.length ? 'spandrels' : 'band-5-9.5';
    if (!bands.length) bands.push([5, Math.min(9.5, (rec.frontTopM ?? 9.8) - 0.3)]);
    const px: [number, number, number, number][] = [];
    for (const [lo, hi] of bands) for (let y = rowOf(hi); y < rowOf(lo); y++) for (let x = x0; x < x1; x++) {
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
    out.push({...base, rawHex: hex(med), hex: h, gain: r3(gain), white: r3(white), sample, pixels: kept.length, L: r3(L), chroma: r3(chroma), finishGuess});
    if (opt('sheet')) {
      const top = Math.max(0, rowOf(Math.min((rec.crown.topM ?? rec.frontTopM ?? 14) + 1, strip.heightM))), cx0 = Math.max(0, a + shift), cw = Math.min(W - cx0, w);
      const tile = await sharp(img).extract({left: cx0, top, width: cw, height: H - top}).resize(160, 300, {fit: 'contain', background: '#222'}).png().toBuffer();
      sheetTiles.push({img: tile, label: `${(rec.address ?? '').replace('Haarlemmerdijk ', 'HD').replace('Haarlemmerstraat ', 'HS')}`, sw: h});
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
