/**
 * Kit/ordinary parity: for each front record, the kit row (the recipe compiler's canal-house intent from the record,
 * `house:preview --recipe l2-<pand>`) against the ordinary row (the same intent applied to the generic chunk,
 * `house:preview --intent`), both rendered at 40 px/m on the same footprint wall (`--wall face`). Scored at hand-over
 * density: HANDOVER_PPM, the pixels per metre of a 720 px tall frame with the ride's 72 degree vertical field of view
 * (engine/fpsCamera.ts FPS_FOV_DEG) at 50 m: 720 / (2 * 50 * tan 36 deg) = 9.9 px/m.
 *
 *   node --import tsx scripts/front-records/kit-parity.ts --face <face> --renders <dir holding kit/<pand>/ and ord/<pand>/> \
 *        --strip-jpg <photo strip> [--out <sheet.jpg>] [--json <out.json>]
 *
 * Per pand:
 *  - wall dE: OKLab distance x 100 between the two rows' wall colours, each the median of the dominant colour bin of the
 *    upper storeys' non-glass, non-sky pixels at 40 px/m (the wall is a material, so it is read at full scale); near-white
 *    bins (frames, surrounds) vote only when they are most of the band;
 *  - crown: the silhouette at hand-over density classed flat (rise under 0.7 m over the 25th-percentile top), gable (the
 *    raised part covers >= 30 % of the width) or dormer (a narrower raise), kit class against ordinary class; also the
 *    silhouette IoU (non-sky pixels). A roof visible above a cornice counts as raise: what the eye sees at 50 m;
 *  - window IoU: the two rows' glass masks (blue-grey: b and g above r, not sky) over the upper storeys at hand-over
 *    density, in metres from the ground on the shared wall frame;
 *  - parity P = mean(max(0, 1 - dE / 10), crown match 0/1, window IoU).
 * The sheet: photo strip, ordinary row, kit row, all three resampled to hand-over density and back up to 40 px/m, with
 * the score under each house. The renders stand on the street (ground at the strip's bottom) and fill their span.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type {FrontRecord, FrontRecordTable} from '../../src/canalRecall/houseLine/frontRecord.ts';
import {hexToOklab} from '../../src/canalRecall/houseSpec/wallColour.ts';
import {shiftFor} from './strip-shift.ts';

export const HANDOVER_PPM = 720 / (2 * 50 * Math.tan(36 * Math.PI / 180));
const RPPM = 40, SKY: [number, number, number] = [159, 184, 207];
const ROOT = path.resolve(import.meta.dirname, '../..');

export interface Img {w: number; h: number; d: Buffer}
export const load = async (file: string, scale = 1): Promise<Img> => {
  let s = sharp(file).removeAlpha();
  if (scale !== 1) { const m = await sharp(file).metadata(); s = s.resize(Math.max(1, Math.round(m.width! * scale)), Math.max(1, Math.round(m.height! * scale)), {kernel: 'cubic'}); }
  const {data, info} = await s.raw().toBuffer({resolveWithObject: true});
  return {w: info.width, h: info.height, d: data};
};
/** Sky: pixels near the render's sky colour connected to the top edge. */
export function skyMask(im: Img, tol = 14): Uint8Array {
  const m = new Uint8Array(im.w * im.h), near = (i: number) => Math.abs(im.d[i * 3] - SKY[0]) + Math.abs(im.d[i * 3 + 1] - SKY[1]) + Math.abs(im.d[i * 3 + 2] - SKY[2]) <= tol;
  const st: number[] = [];
  for (let x = 0; x < im.w; x++) if (near(x)) { m[x] = 1; st.push(x); }
  while (st.length) {
    const i = st.pop()!, x = i % im.w, y = (i - x) / im.w;
    for (const j of [x > 0 ? i - 1 : -1, x < im.w - 1 ? i + 1 : -1, y > 0 ? i - im.w : -1, y < im.h - 1 ? i + im.w : -1]) if (j >= 0 && !m[j] && near(j)) { m[j] = 1; st.push(j); }
  }
  return m;
}
const isGlass = (im: Img, i: number) => { const r = im.d[i * 3], g = im.d[i * 3 + 1], b = im.d[i * 3 + 2]; return b - r >= 8 && g - r >= 6 && (r + g + b) / 765 < 0.75; };
const hex = (c: number[]) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

/** Median colour of the dominant 16-level bin (with its neighbours) over the band [y0, y1] metres, glass and sky out. */
export function wallColour(im: Img, sky: Uint8Array, ppm: number, y0: number, y1: number): string | null {
  const bins = new Map<number, number>(), keep: number[] = [];
  for (let y = Math.max(0, Math.round(im.h - y1 * ppm)); y < Math.min(im.h, Math.round(im.h - y0 * ppm)); y++) for (let x = 0; x < im.w; x++) {
    const i = y * im.w + x;
    if (sky[i] || isGlass(im, i)) continue;
    const k = (im.d[i * 3] >> 4) * 256 + (im.d[i * 3 + 1] >> 4) * 16 + (im.d[i * 3 + 2] >> 4);
    bins.set(k, (bins.get(k) ?? 0) + 1); keep.push(i);
  }
  if (!keep.length) return null;
  // White frames, surrounds and cornices: out of the vote unless they are most of the band (a white-rendered front).
  const white = (k: number) => (k >> 8) >= 13 && ((k >> 4) & 15) >= 13 && (k & 15) >= 12;
  const whites = [...bins].filter(([k]) => white(k)).reduce((s, [, n]) => s + n, 0);
  if (whites < keep.length / 2) for (const k of [...bins.keys()]) if (white(k)) bins.delete(k);
  const top = [...bins].sort((a, b) => b[1] - a[1])[0][0], [br, bg, bb] = [top >> 8, (top >> 4) & 15, top & 15];
  const px = keep.filter(i => Math.abs((im.d[i * 3] >> 4) - br) <= 1 && Math.abs((im.d[i * 3 + 1] >> 4) - bg) <= 1 && Math.abs((im.d[i * 3 + 2] >> 4) - bb) <= 1);
  const med = (c: number) => { const v = px.map(i => im.d[i * 3 + c]).sort((a, b) => a - b); return v[v.length >> 1]; };
  return hex([med(0), med(1), med(2)]);
}
export const dE = (a: string, b: string) => { const p = hexToOklab(a), q = hexToOklab(b); return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };

/** Column tops in metres, the crown class and the raise. */
export function crownOf(im: Img, sky: Uint8Array, ppm: number): {cls: 'flat' | 'gable' | 'dormer'; baseM: number; peakM: number; raisedFrac: number} {
  const tops: number[] = [];
  const a = Math.floor(im.w * 0.1), b = Math.ceil(im.w * 0.9);
  for (let x = a; x < b; x++) { let y = 0; while (y < im.h && sky[y * im.w + x]) y++; tops.push((im.h - y) / ppm); }
  const s = [...tops].sort((p, q) => p - q), base = s[Math.floor(s.length * 0.25)], peak = s[s.length - 1];
  const raisedFrac = tops.filter(t => t > base + 0.5).length / tops.length;
  return {cls: peak - base < 0.7 ? 'flat' : raisedFrac >= 0.3 ? 'gable' : 'dormer', baseM: +base.toFixed(2), peakM: +peak.toFixed(2), raisedFrac: +raisedFrac.toFixed(2)};
}
/** IoU of two predicates over a metre grid. */
function iouM(w: number, h: number, a: (x: number, y: number) => boolean, b: (x: number, y: number) => boolean, res: number, y0 = 0, y1 = h): number {
  let i = 0, u = 0;
  for (let y = y0 + res / 2; y < y1; y += res) for (let x = res / 2; x < w; x += res) { const p = a(x, y), q = b(x, y); if (p && q) i++; if (p || q) u++; }
  return u ? i / u : 1;
}
const at = (im: Img, m: Uint8Array | ((i: number) => boolean), ppm: number) => (x: number, y: number) => {
  const px = Math.floor(x * ppm * im.w / Math.max(1, im.w)), py = Math.floor(im.h - y * ppm);
  if (px < 0 || px >= im.w || py < 0 || py >= im.h) return false;
  const i = py * im.w + px; return typeof m === 'function' ? m(i) : m[i] === 1;
};

export interface Parity {pandId: string; address: string | null; wall: {ord: string | null; kit: string | null; dE: number | null}; crown: {ord: string; kit: string; match: boolean; ordPeakM: number; kitPeakM: number; silhouetteIoU: number}; windowIoU: number; P: number}

export async function parityOf(rec: FrontRecord, dir: string): Promise<Parity | null> {
  const k = path.join(dir, 'kit', rec.pandId, 'front.png'), o = path.join(dir, 'ord', rec.pandId, 'front.png');
  if (!fs.existsSync(k) || !fs.existsSync(o)) return null;
  const ground = rec.groundStoreyTopM ?? rec.fronts?.find(f => f.groundStoreyTopM)?.groundStoreyTopM ?? 4;
  const top = rec.frontTopM ?? Math.max(...(rec.fronts ?? []).map(f => f.frontTopM ?? 0));
  const [K, O] = await Promise.all([load(k), load(o)]);
  const wk = wallColour(K, skyMask(K), RPPM, ground + 0.3, top - 0.3), wo = wallColour(O, skyMask(O), RPPM, ground + 0.3, top - 0.3);
  const sc = HANDOVER_PPM / RPPM, [Kh, Oh] = await Promise.all([load(k, sc), load(o, sc)]);
  const ks = skyMask(Kh), os = skyMask(Oh), ck = crownOf(Kh, ks, HANDOVER_PPM), co = crownOf(Oh, os, HANDOVER_PPM);
  const wM = K.w / RPPM, hM = Math.max(K.h, O.h) / RPPM, res = 1 / HANDOVER_PPM;
  const sil = iouM(wM, hM, at(Kh, i => !ks[i], HANDOVER_PPM), at(Oh, i => !os[i], HANDOVER_PPM), res);
  const win = iouM(wM, hM, at(Kh, i => !ks[i] && isGlass(Kh, i), HANDOVER_PPM), at(Oh, i => !os[i] && isGlass(Oh, i), HANDOVER_PPM), res, ground, top);
  const d = wk && wo ? dE(wk, wo) : null;
  const P = ((d === null ? 0 : Math.max(0, 1 - d / 10)) + (ck.cls === co.cls ? 1 : 0) + win) / 3;
  return {pandId: rec.pandId, address: rec.address, wall: {ord: wo, kit: wk, dE: d === null ? null : +d.toFixed(1)}, crown: {ord: co.cls, kit: ck.cls, match: ck.cls === co.cls, ordPeakM: co.peakM, kitPeakM: ck.peakM, silhouetteIoU: +sil.toFixed(2)}, windowIoU: +win.toFixed(2), P: +P.toFixed(2)};
}

if (import.meta.main ?? process.argv[1]?.endsWith('kit-parity.ts')) {
  const argv = process.argv.slice(2), arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const face = arg('face')!, dir = arg('renders')!, stripJpg = arg('strip-jpg'), out = arg('out');
  const table = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/front-records/haarlemmerdijk-block.json'), 'utf8')) as FrontRecordTable;
  const strip = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/block-face/faces', face, 'strip.json'), 'utf8')) as {height: number; spans: {pandId: string; px: [number, number]}[]};
  const bare = (id: string) => id.replace(/^NL\.IMBAG\.Pand\./, '');
  const spans = strip.spans.filter(s => fs.existsSync(path.join(dir, 'kit', bare(s.pandId), 'front.png')) || fs.existsSync(path.join(dir, 'ord', bare(s.pandId), 'front.png')));
  const rows: (Parity & {px: [number, number]})[] = [];
  for (const s of spans) {
    const rec = table.records.find(r => r.face === face && r.pandId === bare(s.pandId));
    const p = rec && await parityOf(rec, dir);
    if (p) rows.push({...p, px: s.px});
  }
  const tag = (a: string | null) => (a ?? '').replace('Haarlemmerdijk ', 'HD').replace('Haarlemmerstraat ', 'HS');
  for (const r of rows) console.log(`${tag(r.address).padEnd(8)} ${r.pandId.slice(-6)}  wall dE ${String(r.wall.dE ?? '-').padStart(5)} (ord ${r.wall.ord} kit ${r.wall.kit})  crown ${r.crown.ord}/${r.crown.kit} ${r.crown.match ? 'match' : 'MISS '} sil ${r.crown.silhouetteIoU.toFixed(2)}  win IoU ${r.windowIoU.toFixed(2)}  P ${r.P.toFixed(2)}`);
  const mean = (f: (r: Parity) => number) => rows.length ? rows.reduce((a, r) => a + f(r), 0) / rows.length : 0;
  console.log(`${face}: ${rows.length} pands, mean wall dE ${mean(r => r.wall.dE ?? 0).toFixed(1)}, crown match ${rows.filter(r => r.crown.match).length}/${rows.length}, mean window IoU ${mean(r => r.windowIoU).toFixed(2)}, mean P ${mean(r => r.P).toFixed(2)} (hand-over ${HANDOVER_PPM.toFixed(1)} px/m)`);
  if (arg('json')) fs.writeFileSync(arg('json')!, JSON.stringify({face, handoverPpm: +HANDOVER_PPM.toFixed(2), rows: rows.map(({px, ...r}) => r)}, null, 1) + '\n');
  if (out && stripJpg && rows.length) {
    const left = Math.min(...rows.map(r => r.px[0])), W = Math.max(...rows.map(r => r.px[1])) - left, H = strip.height, sc = HANDOVER_PPM / RPPM;
    const handover = async (b: Buffer, w: number, h: number) => sharp(await sharp(b).resize(Math.max(1, Math.round(w * sc)), Math.max(1, Math.round(h * sc)), {kernel: 'cubic'}).png().toBuffer()).resize(w, h, {kernel: 'nearest'}).png().toBuffer();
    const row = async (which: 'ord' | 'kit') => {
      const comps: sharp.OverlayOptions[] = [];
      for (const r of rows) {
        const f = path.join(dir, which, r.pandId, 'front.png');
        if (!fs.existsSync(f)) continue;
        const m = await sharp(f).metadata(), w = r.px[1] - r.px[0], h = Math.min(H, m.height!);
        const img = await sharp(f).resize(w, m.height!, {fit: 'fill'}).extract({left: 0, top: m.height! - h, width: w, height: h}).png().toBuffer();
        comps.push({input: img, left: r.px[0] - left, top: H - h});
      }
      const b = await sharp({create: {width: W, height: H, channels: 3, background: {r: SKY[0], g: SKY[1], b: SKY[2]}}}).composite(comps).png().toBuffer();
      return handover(b, W, H);
    };
    const shift = Math.round(shiftFor(face, '') * RPPM);
    const meta = await sharp(stripJpg).metadata();
    const pw = Math.min(W, meta.width!), photoRaw = await sharp(stripJpg).extract({left: Math.max(0, Math.min(meta.width! - pw, left + shift)), top: 0, width: pw, height: Math.min(H, meta.height!)}).png().toBuffer();
    const photo = await handover(photoRaw, pw, Math.min(H, meta.height!));
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const svg = (w: number, h: number, body: string) => Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
    const cap = 24, scoreH = 92, head = 34;
    const titles = [`photo strip (Gemeente Amsterdam panorama, CC BY 4.0)`, 'ordinary row: the record intent on the generic chunk (house:preview --intent, lit city look)', 'kit row: the recipe compiler on the same intent (house:preview --recipe, flat game colours)'];
    const imgs = [photo, await row('ord'), await row('kit')];
    const comps: sharp.OverlayOptions[] = [{input: svg(W, head, `<text x="8" y="24" font-size="19" fill="#eee" font-family="Helvetica">${face}: kit/ordinary parity at hand-over density (${HANDOVER_PPM.toFixed(1)} px/m: 50 m in a 720 px frame at 72 deg), shown at 40 px/m</text>`), left: 0, top: 0}];
    let y = head;
    imgs.forEach((im, i) => { comps.push({input: svg(W, cap, `<text x="8" y="17" font-size="15" fill="#cfc" font-family="Helvetica">${i + 1}. ${esc(titles[i])}</text>`), left: 0, top: y}); y += cap; comps.push({input: im, left: 0, top: y}); y += H + 4; });
    const score = rows.map(r => {
      const x = r.px[0] - left + 4, col = r.P >= 0.67 ? '#8f8' : r.P >= 0.4 ? '#fd6' : '#f77';
      const sw = (c: string | null, dx: number) => c ? `<rect x="${x + dx}" y="70" width="22" height="16" fill="${c}" stroke="#fff" stroke-width="0.5"/>` : '';
      return `<text x="${x}" y="16" font-size="14" fill="#eee" font-family="Helvetica">${esc(tag(r.address))}</text>`
        + `<text x="${x}" y="33" font-size="13" fill="${col}" font-family="Helvetica">P ${r.P.toFixed(2)}  win ${r.windowIoU.toFixed(2)}</text>`
        + `<text x="${x}" y="49" font-size="13" fill="${r.crown.match ? '#8f8' : '#f77'}" font-family="Helvetica">${r.crown.ord}/${r.crown.kit}</text>`
        + `<text x="${x}" y="65" font-size="13" fill="#ddd" font-family="Helvetica">dE ${r.wall.dE ?? '-'}</text>` + sw(r.wall.ord, 0) + sw(r.wall.kit, 26)
        + `<line x1="${r.px[0] - left}" x2="${r.px[0] - left}" y1="0" y2="${scoreH}" stroke="#555"/>`;
    }).join('');
    comps.push({input: svg(W, scoreH, score), left: 0, top: y});
    y += scoreH;
    const sheet = await sharp({create: {width: W, height: y, channels: 3, background: '#111'}}).composite(comps).jpeg({quality: 84}).toBuffer();
    fs.writeFileSync(out, sheet);
    console.log(out, W, y);
  }
}
