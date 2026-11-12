// Lane G1 (#376): one sheet per named ground place: the PDOK orthophoto (north up, 120 m) beside the before and after
// frames from tests/e2e/ground-g1.spec.ts (low aerial and ride), as JPEG under 400 kB for the screenshots repo.
//   node --import tsx scripts/own-ground/g1-strip.ts <frames dir with before/ and after/> <out dir>
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { GROUND_SPOTS } from '../../src/canalRecall/ownGround/groundRegressions.ts';
import { OrthoTiles, ORTHO_ATTRIBUTION } from './ortho.ts';

const [dir, out] = process.argv.slice(2);
if (!dir || !out) { console.log('usage: g1-strip.ts <frames dir> <out dir>'); process.exit(0); }
mkdirSync(out, { recursive: true });
const W = 520, H = 325, ORTHO_M = 120, ORTHO_PX = 325;
const label = (text: string, w: number) => Buffer.from(`<svg width="${w}" height="26"><rect width="100%" height="100%" fill="#000" opacity="0.6"/><text x="8" y="18" font-family="Helvetica" font-size="15" fill="#fff">${text}</text></svg>`);
async function tile(file: string, text: string, w = W, h = H): Promise<sharp.OverlayOptions['input']> {
  const base = existsSync(file) ? sharp(file).resize(w, h, { fit: 'cover' }) : sharp({ create: { width: w, height: h, channels: 3, background: '#444' } });
  return base.composite([{ input: label(existsSync(file) ? text : `${text} (missing)`, w), top: 0, left: 0 }]).png().toBuffer();
}
async function main() {
  const ortho = new OrthoTiles();
  for (const s of GROUND_SPOTS) {
    const [x, y] = toLocal(s.lng, s.lat), res = ORTHO_M / ORTHO_PX;
    const rgb = await ortho.crop(x - ORTHO_M / 2, y - ORTHO_M / 2, ORTHO_PX, ORTHO_PX, res);
    const o = await sharp(Buffer.from(rgb), { raw: { width: ORTHO_PX, height: ORTHO_PX, channels: 3 } }).composite([{ input: label('PDOK 2025 orthophoto, north up, 120 m', ORTHO_PX), top: 0, left: 0 }]).png().toBuffer();
    const f = (when: string, kind: string) => join(dir, when, `desktop-${s.id}-${kind}.png`);
    const parts = [
      { input: o, top: 0, left: 0 },
      { input: await tile(f('before', 'air'), 'before: aerial (G1 fixes off)'), top: 0, left: ORTHO_PX },
      { input: await tile(f('after', 'air'), 'after: aerial (G1)'), top: 0, left: ORTHO_PX + W },
      { input: label(`${s.id}: ${s.what}`.slice(0, 120), ORTHO_PX + 2 * W), top: H, left: 0 },
      { input: await tile(f('before', 'ride'), 'before: ride'), top: H + 26, left: ORTHO_PX },
      { input: await tile(f('after', 'ride'), 'after: ride'), top: H + 26, left: ORTHO_PX + W },
      { input: label(ORTHO_ATTRIBUTION, ORTHO_PX), top: H + 26, left: 0 },
    ];
    const file = join(out, `${s.id}.jpg`);
    let q = 82;
    for (;;) {
      const buf = await sharp({ create: { width: ORTHO_PX + 2 * W, height: 2 * H + 26, channels: 3, background: '#222' } }).composite(parts as sharp.OverlayOptions[]).jpeg({ quality: q }).toBuffer();
      if (buf.length <= 400_000 || q <= 50) { await sharp(buf).toFile(file); console.log(`${file} ${(buf.length / 1024).toFixed(0)} kB q${q}`); break; }
      q -= 8;
    }
  }
}
void main();
