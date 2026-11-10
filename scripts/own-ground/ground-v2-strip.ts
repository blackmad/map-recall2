// Before/after strips for ground v2 (lane G2a #372): per named place (groundV2Places.ts), the PDOK orthophoto crop beside
// the ride frame and the aerial frame, before (worker-built surface) and after (`?groundV2=1`, the baked surface).
//
//   npx tsx scripts/own-ground/ground-v2-strip.ts [--before=dir] [--after=dir] [--project=desktop|iphone] [--out=dir]
//
// Frames from tests/e2e/ground-v2-frames.spec.ts (<project>-<place>-ride.png, -air.png). One JPEG per place and view.
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { GROUND_V2_PLACES } from '../../src/canalRecall/ownGround/groundV2Places.ts';
import { OrthoTiles, ORTHO_ATTRIBUTION } from './ortho.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const BEFORE = arg('before', 'artifacts/ground-v2/frames/before'), AFTER = arg('after', 'artifacts/ground-v2/frames/after');
const PROJECT = arg('project', 'desktop'), OUT = arg('out', 'artifacts/ground-v2/strips');
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const label = (w: number, h: number, t: string) => Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#222"/><text x="8" y="${Math.round(h / 2 + 5)}" font-family="Helvetica" font-size="15" fill="#fff">${esc(t)}</text></svg>`);

mkdirSync(OUT, { recursive: true });
const ortho = new OrthoTiles();
for (const p of GROUND_V2_PLACES) {
  const H = PROJECT === 'iphone' ? 640 : 450, R = 0.2, S = 160;
  const [cx, cy] = toLocal(p.at[0], p.at[1]), n = Math.round(S / R);
  const marked = await sharp(Buffer.from(await ortho.crop(cx - S / 2, cy - S / 2, n, n, R)), { raw: { width: n, height: n, channels: 3 } })
    .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}"><circle cx="${n / 2}" cy="${n / 2}" r="10" fill="none" stroke="#ff00ff" stroke-width="3"/></svg>`) }])
    .png().toBuffer();
  const o = await sharp(marked).resize(H, H).png().toBuffer();
  for (const view of ['ride', 'air']) {
    const files = [join(BEFORE, `${PROJECT}-${p.id}-${view}.png`), join(AFTER, `${PROJECT}-${p.id}-${view}.png`)];
    if (!files.every(existsSync)) { console.warn(`${p.id} ${view}: frames missing`); continue; }
    const frames = await Promise.all(files.map(f => sharp(f).resize({ height: H }).png().toBuffer({ resolveWithObject: true })));
    const W = H + frames.reduce((s, f) => s + f.info.width, 0) + 8, head = 28;
    const parts: sharp.OverlayOptions[] = [
      { input: label(W, head, `${p.label} | ${PROJECT} ${view}: orthophoto 160 m (${ORTHO_ATTRIBUTION}) | before (worker surface) | after (?groundV2=1, baked)`), left: 0, top: 0 },
      { input: o, left: 0, top: head },
    ];
    let left = H + 4;
    for (const f of frames) { parts.push({ input: f.data, left, top: head }); left += f.info.width + 4; }
    const out = join(OUT, `${PROJECT}-${p.id}-${view}.jpg`);
    await sharp({ create: { width: W, height: H + head, channels: 3, background: '#111' } }).composite(parts).jpeg({ quality: 78 }).toFile(out);
    console.log(out);
  }
}
