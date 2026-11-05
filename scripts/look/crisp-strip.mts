// Lane R1-B (#224) strips: per spot, [orthophoto] | the user's shot | each variant's frozen frame
// (tests/e2e/crisp-textures.spec.ts output), then a row of 1:1 crops of each variant at the spot's `crop` (device px),
// with the sharpness numbers from <project>-results.json in the labels.
//   npx tsx scripts/look/crisp-strip.mts --dir=<crisp dir> [--project=desktop] [--variants=before,after]
//     [--spots=da-costakade,zuidas-rails] [--ortho=1] [--out=<dir>/strip-<project>.jpg]
import { existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { CRISP_SPOTS } from './crispSpots.ts';
import { toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { OrthoTiles, ORTHO_ATTRIBUTION } from '../own-ground/ortho.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const DIR = arg('dir', 'artifacts/crisp'), PROJECT = arg('project', 'desktop');
const VARIANTS = arg('variants', 'before,after').split(',');
const ONLY = arg('spots', '').split(',').filter(Boolean);
const ORTHO = arg('ortho', '1') !== '0';
const OUT = arg('out', `${DIR}/strip-${PROJECT}.jpg`);
const SHOTS = '/Users/blackmad/Code/map-recall2-screenshots/engine/2026-11-06-user-shots';
const W = 720, H = 450, GAP = 6, HEAD = 28, CROP = 480;
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const label = (w: number, h: number, t: string, size = 14) => Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#222"/><text x="8" y="${Math.round(h / 2 + size / 3)}" font-family="Helvetica" font-size="${size}" fill="#fff">${esc(t)}</text></svg>`);
const results = existsSync(`${DIR}/${PROJECT}-results.json`) ? JSON.parse(readFileSync(`${DIR}/${PROJECT}-results.json`, 'utf8')) : {};
const spots = CRISP_SPOTS.filter(s => (!ONLY.length || ONLY.includes(s.name)) && VARIANTS.some(v => existsSync(`${DIR}/${PROJECT}-${s.name}-${v}.png`)));
const ortho = ORTHO ? new OrthoTiles() : null;
const cols = (ORTHO ? 1 : 0) + 1 + VARIANTS.length;
const width = cols * W + (cols - 1) * GAP;
const parts: sharp.OverlayOptions[] = [];
let top = 0;
parts.push({ input: label(width, 30, `crisp textures + rails (lane R1-B #224), ${PROJECT}: ${ORTHO ? 'orthophoto | ' : ''}user shot (build 69d4c65) | ${VARIANTS.join(' | ')}; crops 1:1 device px${ORTHO ? ` · ${ORTHO_ATTRIBUTION}` : ''}`, 15), left: 0, top }); top += 30 + GAP;
for (const spot of spots) {
  const r = results[spot.name] ?? {};
  const txt = VARIANTS.map(v => r[v] ? `${v}: lapVar ${r[v].sharpness.laplacianVar} edge ${r[v].sharpness.edge} acut ${r[v].sharpness.acutance}, facades ${r[v].facadeTextureMB} MB, gpu ${r[v].gpuMs ?? '-'} ms` : `${v}: -`).join(' · ');
  parts.push({ input: label(width, HEAD, `${spot.name}: ${txt}`, 13), left: 0, top }); top += HEAD;
  let left = 0;
  if (ortho) {
    const [x, y] = toLocal(spot.center[0], spot.center[1]), half = 250, crop = await ortho.crop(x - half * 1.6, y - half, W, H, (2 * half) / H).catch(() => null);
    parts.push({ input: crop ? await sharp(Buffer.from(crop), { raw: { width: W, height: H, channels: 3 } }).png().toBuffer() : label(W, H, 'no orthophoto'), left, top });
    left += W + GAP;
  }
  const shot = spot.shot ? `${SHOTS}/${spot.shot}` : '';
  parts.push({ input: shot && existsSync(shot) ? await sharp(shot).resize(W, H, { fit: 'contain', background: '#222' }).png().toBuffer() : label(W, H, 'no user shot at this spot'), left, top });
  left += W + GAP;
  for (const v of VARIANTS) {
    const f = `${DIR}/${PROJECT}-${spot.name}-${v}.png`;
    parts.push({ input: existsSync(f) ? await sharp(f).resize(W, H, { fit: 'contain', background: '#222' }).png().toBuffer() : label(W, H, `${v}: missing`), left, top });
    left += W + GAP;
  }
  top += H + GAP;
  // 1:1 crops of the band's centre in every variant.
  left = 0;
  for (const v of VARIANTS) {
    const f = `${DIR}/${PROJECT}-${spot.name}-${v}.png`;
    if (!existsSync(f)) continue;
    const meta = await sharp(f).metadata(), cw = Math.min(CROP * 1.5, meta.width!), ch = Math.min(CROP, meta.height!);
    const cx = Math.round(((spot.crop?.x ?? (spot.band.x0 + spot.band.x1) / 2)) * meta.width! - cw / 2), cy = Math.round(((spot.crop?.y ?? (spot.band.y0 + spot.band.y1) / 2)) * meta.height! - ch / 2);
    const img = await sharp(f).extract({ left: Math.max(0, Math.min(meta.width! - cw, cx)), top: Math.max(0, Math.min(meta.height! - ch, cy)), width: cw, height: ch }).png().toBuffer();
    parts.push({ input: img, left, top });
    parts.push({ input: label(140, 22, v, 13), left, top });
    left += cw + GAP;
  }
  top += CROP + GAP;
}
const total = { w: Math.max(width, VARIANTS.length * (CROP * 1.5 + GAP)), h: top };
await sharp({ create: { width: Math.round(total.w), height: total.h, channels: 3, background: '#111' } }).composite(parts).jpeg({ quality: 86 }).toFile(OUT);
console.log(JSON.stringify({ out: OUT, size: [Math.round(total.w), total.h], spots: spots.map(s => s.name) }));
