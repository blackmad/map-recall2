// The rail-look strip (lane rail-look 2026-10-31): per RAIL_SPOTS place, PDOK orthophoto | before (rail-v1 without
// railProfile.ts levels and floor) | after | the player's screenshot. The views are rail-view.ts's offline renders
// (flat colours, no textures), not game frames.
//
//   npx tsx scripts/own-ground/rail-strip.ts [--out=artifacts/rail-look/strip-rail-look.jpg]
import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { RAIL_SPOTS } from '../../src/canalRecall/ownGround/railRegressions.ts';
import { OrthoTiles, ORTHO_ATTRIBUTION } from './ortho.ts';
import { railCells } from './probe-rails.ts';
import { renderView } from './rail-view.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = arg('out', 'artifacts/rail-look/strip-rail-look.jpg');
// Camera per spot (target, bearing, distance, height, LOD) near the player's view, and the player's screenshot.
const VIEWS: Record<string, { at: [number, number]; bearing: number; dist: number; height: number; lod: 0 | 1; shot: string }> = {
  'rail-kattenburgerstraat': { at: [4.9212, 52.3760], bearing: 105, dist: 45, height: 20, lod: 1, shot: 'artifacts/rail-look/5d3fb497-20e5-41a5-9cf3-edd70031d603.jpg' },
  'rail-club-panama': { at: [4.9305, 52.3738], bearing: 135, dist: 70, height: 35, lod: 1, shot: 'artifacts/rail-look/d49a15b0-50f0-4df3-b56e-da3b3c9e9ca1.jpg' },
  'rail-oostertoegang': { at: [4.9036, 52.3772], bearing: 250, dist: 70, height: 32, lod: 0, shot: 'artifacts/rail-look/5d5b56c4-6799-4ccd-87ef-6caf47824cd4.jpg' },
};
const W = 640, H = 360, GAP = 6, HEAD = 30;
const label = (w: number, h: number, t: string, size = 16) => Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#222"/><text x="8" y="${Math.round(h / 2 + size / 3)}" font-family="Helvetica" font-size="${size}" fill="#fff">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);

async function main(): Promise<void> {
  const o = new OrthoTiles(), rows = RAIL_SPOTS.filter(s => VIEWS[s.id]);
  const total = { w: H + 3 * W + 3 * GAP, h: rows.length * (H + HEAD + GAP) + 34 };
  const parts: sharp.OverlayOptions[] = [{ input: label(total.w, 34, `rail look: orthophoto | before (rail-v1, build 04e3c88) | after (lane rail-look) | player screenshot · offline renders, not game frames · ${ORTHO_ATTRIBUTION}`, 15), left: 0, top: 0 }];
  let top = 34;
  for (const spot of rows) {
    const v = VIEWS[spot.id], [x, y] = toLocal(v.at[0], v.at[1]);
    parts.push({ input: label(total.w, HEAD, `${spot.id}: ${spot.label} (LOD ${v.lod}) · note: “${spot.note}”`, 14), left: 0, top });
    top += HEAD;
    const half = 120, res = (2 * half) / H, crop = await o.crop(x - half, y - half, H, H, res).catch(() => null);
    parts.push({ input: crop ? await sharp(Buffer.from(crop), { raw: { width: H, height: H, channels: 3 } }).png().toBuffer() : label(H, H, 'no orthophoto'), left: 0, top });
    let left = H + GAP;
    for (const before of [true, false]) {
      const { cells } = await railCells(v.at[0], v.at[1], 220, v.lod, before ? { railLevels: false } : {});
      const img = renderView(cells, [x, y], { lng: v.at[0], lat: v.at[1], bearing: v.bearing, dist: v.dist, height: v.height, w: W, h: H }, 2);
      parts.push({ input: await sharp(Buffer.from(img), { raw: { width: W, height: H, channels: 3 } }).png().toBuffer(), left, top });
      left += W + GAP;
    }
    if (existsSync(v.shot)) parts.push({ input: await sharp(v.shot).resize(W, H, { fit: 'contain', background: '#222' }).png().toBuffer(), left, top });
    top += H + GAP;
  }
  await sharp({ create: { width: total.w, height: total.h, channels: 3, background: '#111' } }).composite(parts).jpeg({ quality: 88 }).toFile(OUT);
  console.log(JSON.stringify({ out: OUT, size: [total.w, total.h] }));
}

main().catch(e => { console.error(e); process.exit(1); });
