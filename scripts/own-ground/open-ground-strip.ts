// Before/after strips for the open-ground lane (lane open-ground-look 2026-11-10): per spot, the PDOK orthophoto crop
// beside the game's ride frame and aerial frame, before (`?openGround=0` / main) and after.
//
//   npx tsx scripts/own-ground/open-ground-strip.ts [--before=dir] [--after=dir] [--project=desktop|iphone] [--out=dir]
//
// Frames from tests/e2e/open-ground-frames.spec.ts (<project>-<spot>-ride.png, -air.png). One JPEG per spot and view.
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { OPEN_GROUND_SPOTS } from '../../src/canalRecall/ownGround/openGroundRegressions.ts';
import { OrthoTiles, ORTHO_ATTRIBUTION } from './ortho.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const BEFORE = arg('before', 'artifacts/own-ground/open-ground-frames/before'), AFTER = arg('after', 'artifacts/own-ground/open-ground-frames/after');
const PROJECT = arg('project', 'desktop'), OUT = arg('out', 'artifacts/own-ground/open-ground-strips');
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const label = (w: number, h: number, t: string) => Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#222"/><text x="8" y="${Math.round(h / 2 + 5)}" font-family="Helvetica" font-size="15" fill="#fff">${esc(t)}</text></svg>`);

mkdirSync(OUT, { recursive: true });
const ortho = new OrthoTiles();
for (const spot of OPEN_GROUND_SPOTS) {
  const H = PROJECT === 'iphone' ? 640 : 450, R = 0.2, S = 160;
  const [cx, cy] = toLocal(spot.lng, spot.lat), n = Math.round(S / R);
  // sharp resizes before it composites: mark the centre at full size, then scale.
  const marked = await sharp(Buffer.from(await ortho.crop(cx - S / 2, cy - S / 2, n, n, R)), { raw: { width: n, height: n, channels: 3 } })
    .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${n}" height="${n}"><circle cx="${n / 2}" cy="${n / 2}" r="10" fill="none" stroke="#ff00ff" stroke-width="3"/></svg>`) }])
    .png().toBuffer();
  const o = await sharp(marked).resize(H, H).png().toBuffer();
  for (const view of ['ride', 'air']) {
    const files = [join(BEFORE, `${PROJECT}-${spot.name}-${view}.png`), join(AFTER, `${PROJECT}-${spot.name}-${view}.png`)];
    if (!files.every(existsSync)) { console.warn(`${spot.name} ${view}: frames missing`); continue; }
    const frames = await Promise.all(files.map(f => sharp(f).resize({ height: H }).png().toBuffer({ resolveWithObject: true })));
    const W = H + frames.reduce((s, f) => s + f.info.width, 0) + 8, head = 28;
    const parts: sharp.OverlayOptions[] = [
      { input: label(W, head, `${spot.name}${spot.feedback ? ` (${spot.feedback})` : ''} ${PROJECT} ${view}: orthophoto 160 m (${ORTHO_ATTRIBUTION}) | before (open ground off) | after (open-ground-v1)`), left: 0, top: 0 },
      { input: o, left: 0, top: head },
    ];
    let left = H + 4;
    for (const f of frames) { parts.push({ input: f.data, left, top: head }); left += f.info.width + 4; }
    const out = join(OUT, `${PROJECT}-${spot.name}-${view}.jpg`);
    await sharp({ create: { width: W, height: H + head, channels: 3, background: '#111' } }).composite(parts).jpeg({ quality: 82 }).toFile(out);
    console.log(out);
  }
}
