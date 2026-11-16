/**
 * Lane shop-interiors: blind A/B sheets from house:frames runs. Each sheet is the panorama cut | A | B, cropped to the
 * target wall's ground storey (pose.json's wall projected 0..4.5 m), A and B randomly the flag-off and flag-on frames.
 * The key goes to <out>/key.json (not in <out>/sheets, the folder the judge reads).
 *   node --import tsx scripts/shop-interiors/blind-ab.ts --before <dir> --after <dir>[,<dir>...] --out <dir> [--tag day,dusk]
 * Each --after dir is paired with --before (one sheet set per --after, tagged by --tag).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { frameFor, wallPoint, type FramePose, type WallQuad } from '../house-frames/pose.ts';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const before = arg('before')!, afters = arg('after')!.split(','), out = arg('out')!, tags = (arg('tag') ?? afters.map((_, i) => `set${i + 1}`).join(',')).split(',');
fs.mkdirSync(path.join(out, 'sheets'), { recursive: true });
const key: Record<string, { A: string; B: string; afterDir: string; crop: number[] }> = {};
const T = 460;

async function crop(file: string, box: { left: number; top: number; width: number; height: number }): Promise<Buffer> {
  return sharp(file).extract(box).resize({ height: T, width: Math.round(T * box.width / box.height) }).toBuffer();
}
const label = (w: number, text: string) => Buffer.from(`<svg width="${w}" height="30"><rect width="100%" height="100%" fill="#111"/><text x="8" y="21" font-size="18" font-family="sans-serif" fill="#fff">${text}</text></svg>`);

for (const [ai, after] of afters.entries()) {
  for (const k of fs.readdirSync(after).filter(d => fs.existsSync(path.join(after, d, 'game.png')))) {
    const poseFile = path.join(after, k, 'pose.json'), offFile = path.join(before, k, 'game.png'), photo = path.join(after, k, 'photo.jpg');
    if (!fs.existsSync(offFile) || !fs.existsSync(photo)) continue;
    const pj = JSON.parse(fs.readFileSync(poseFile, 'utf8')) as { pose: FramePose; wall: WallQuad; wallLenM?: number };
    const frame = frameFor(pj.pose), len = Math.hypot(pj.wall.b.x - pj.wall.a.x, pj.wall.b.y - pj.wall.a.y);
    const pts = [[0, 0], [len, 0], [0, 4.5], [len, 4.5]].map(([u, v]) => wallPoint(frame, pj.pose, pj.wall, u, v)).filter(p => p.depth > 0);
    const meta = await sharp(offFile).metadata(), W = meta.width!, H = meta.height!;
    if (pts.length < 2) continue;
    let x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
    const mx = (x1 - x0) * 0.12 + 20, my = (y1 - y0) * 0.15 + 20;
    x0 = Math.max(0, Math.floor(x0 - mx)); x1 = Math.min(W, Math.ceil(x1 + mx)); y0 = Math.max(0, Math.floor(y0 - my)); y1 = Math.min(H, Math.ceil(y1 + my));
    if (x1 - x0 < 60 || y1 - y0 < 60) continue;
    // Keep at most 2:1 so the shopfront is not a sliver.
    if ((x1 - x0) / (y1 - y0) > 2.2) { const c = (x0 + x1) / 2, hw = (y1 - y0) * 1.1; x0 = Math.max(0, Math.round(c - hw)); x1 = Math.min(W, Math.round(c + hw)); }
    const box = { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
    const flip = crypto.randomInt(2) === 1, id = `${tags[ai]}-${String(Object.keys(key).length + 1).padStart(2, '0')}`;
    const [p, a, b] = await Promise.all([crop(photo, box), crop(flip ? path.join(after, k, 'game.png') : offFile, box), crop(flip ? offFile : path.join(after, k, 'game.png'), box)]);
    const w = Math.round(T * box.width / box.height);
    await sharp({ create: { width: w * 3 + 16, height: T + 30, channels: 3, background: '#111' } })
      .composite([{ input: label(w, 'photo'), left: 0, top: 0 }, { input: label(w, 'A'), left: w + 8, top: 0 }, { input: label(w, 'B'), left: 2 * w + 16, top: 0 },
        { input: p, left: 0, top: 30 }, { input: a, left: w + 8, top: 30 }, { input: b, left: 2 * w + 16, top: 30 }])
      .jpeg({ quality: 88 }).toFile(path.join(out, 'sheets', `${id}.jpg`));
    key[id] = { A: flip ? 'on' : 'off', B: flip ? 'off' : 'on', afterDir: `${tags[ai]}:${k}`, crop: [x0, y0, x1, y1] };
  }
}
fs.writeFileSync(path.join(out, 'key.json'), JSON.stringify(key, null, 1));
console.log(`${Object.keys(key).length} sheets in ${out}/sheets; key ${out}/key.json`);
