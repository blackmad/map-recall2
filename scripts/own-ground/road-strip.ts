// User strips for the roads lanes (lane roads-lanes 2026-10-23).
//
//   npx tsx scripts/own-ground/road-strip.ts frames  [--before=dir] [--after=dir] [--out=artifacts/roads/strip-before-after.jpg]
//   npx tsx scripts/own-ground/road-strip.ts tones   [--out=artifacts/roads/strip-tones.jpg]
//
// frames: one row per ROAD_SPOTS entry: PDOK orthophoto | game frame before | game frame after (desktop-<id>.png from
// tests/e2e/own-ground-roads.spec.ts runs). tones: at the Spiegelgracht and the Kinkerstraat, orthophoto | own ground
// top-down in today's palette | candidate tone sets A, B, C (klinker, brick, cycle red; proposals, not committed).
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import type { GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import { ROAD_SPOTS, type RoadSpot } from '../../src/canalRecall/ownGround/roadRegressions.ts';
import { rasterTopDown } from './render-topdown.ts';
import { paletteColours } from './road-look-v2.ts';
import { probeSpot } from './probe-doubled-lanes.ts';
import { OrthoTiles, ORTHO_ATTRIBUTION } from './ortho.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const ROOT = 'public/data/extracts/amsterdam';
const bytes = async (path: string) => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const label = (w: number, h: number, t: string, size = 15) => Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#222"/><text x="8" y="${Math.round(h / 2 + size / 3)}" font-family="Helvetica" font-size="${size}" fill="#fff">${esc(t)}</text></svg>`);
const blank = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: '#333' } }).png().toBuffer();
const res = 0.1;

async function orthoTile(o: OrthoTiles, s: RoadSpot, px: number): Promise<Buffer> {
  const [x, y] = toLocal(s.at[0], s.at[1]), w = Math.round(2 * s.halfM / res);
  return sharp(Buffer.from(await o.crop(x - s.halfM, y - s.halfM, w, w, res)), { raw: { width: w, height: w, channels: 3 } }).resize(px, px).png().toBuffer();
}

async function frames(): Promise<void> {
  const before = arg('before', 'artifacts/roads/frames-before'), after = arg('after', 'artifacts/roads/frames-after'), out = arg('out', 'artifacts/roads/strip-before-after.jpg');
  // --project=desktop|iphone (the frame files' prefix); --only=id,id; --title=… (the header's before/after names).
  const project = arg('project', 'desktop'), only = arg('only', '').split(',').filter(Boolean), title = arg('title', 'game frame before (main 17f55eb01) | after (lane roads-lanes)');
  const phone = project === 'iphone', o = new OrthoTiles(), H = phone ? 640 : 360, FW = phone ? 296 : 576, gap = 4, head = 26, W = H + 2 * FW + 2 * gap;
  const parts: sharp.OverlayOptions[] = [{ input: label(W, 30, `${project}: orthophoto | ${title} · ${ORTHO_ATTRIBUTION}`, 16), left: 0, top: 0 }];
  let top = 30;
  for (const s of ROAD_SPOTS) {
    if (only.length && !only.includes(s.id)) continue;
    parts.push({ input: label(W, head, `${s.id}: ${s.label}`), left: 0, top });
    top += head;
    const f = async (dir: string) => { const p = join(dir, `${project}-${s.id}.png`); return existsSync(p) ? sharp(p).resize(FW, H, { fit: 'cover' }).png().toBuffer() : blank(FW, H); };
    parts.push({ input: await orthoTile(o, s, H), left: 0, top }, { input: await f(before), left: H + gap, top }, { input: await f(after), left: H + FW + 2 * gap, top });
    top += H + gap;
  }
  mkdirSync(dirname(out), { recursive: true });
  await sharp({ create: { width: W, height: top, channels: 3, background: '#222' } }).composite(parts).jpeg({ quality: 82 }).toFile(out);
  console.log(out);
}

/** Candidate tone sets (measured: measure-spot-tones.ts; sun medians dehazed, carriage klinker 154,142,133, parking
 * klinker 163,159,153, fietspad 181,163,150). Proposals for the user, not the committed look. */
export const TONE_CANDIDATES: { id: string; note: string; tones: Partial<Record<GroundLayer, readonly number[]>> }[] = [
  { id: 'A photo', note: 'the sunlit photo medians at the bright look\'s exposure (×0.89)', tones: { klinker: [137, 126, 118], brick: [145, 141, 136], cycle: [161, 145, 134] } },
  { id: 'B middle', note: 'half-way between today and A', tones: { klinker: [142, 118, 104], brick: [157, 149, 141], cycle: [183, 126, 120] } },
  { id: 'C legible', note: 'photo klinker/brick, cycle red kept readable', tones: { klinker: [140, 124, 112], brick: [150, 144, 137], cycle: [192, 118, 110] } },
];

async function tones(): Promise<void> {
  const out = arg('out', 'artifacts/roads/strip-tones.jpg');
  const store = new GroundStore(bytes, { roads: true });
  await store.init();
  const o = new OrthoTiles(), T = 400, gap = 4, head = 26, cols = 2 + TONE_CANDIDATES.length, W = cols * (T + gap);
  const base = paletteColours() as Partial<Record<GroundLayer, readonly number[]>>;
  const rgb = (c?: readonly number[]) => (c ? c.join(',') : '-');
  const sets = [{ id: 'today', note: 'bright look', tones: {} }, ...TONE_CANDIDATES];
  const parts: sharp.OverlayOptions[] = [{ input: label(W, 30, `orthophoto | today | ${TONE_CANDIDATES.map(c => c.id).join(' | ')}  (klinker / brick / cycle)`, 16), left: 0, top: 0 }];
  let top = 30;
  for (const id of ['spiegelgracht-prinsengracht', 'kinkerstraat-bilderdijkstraat']) {
    const s = ROAD_SPOTS.find(q => q.id === id)!, cells = (await probeSpot(store, s)).cells;
    const [x, y] = toLocal(s.at[0], s.at[1]), w = Math.round(2 * s.halfM / res);
    parts.push({ input: label(W, head, `${s.id}`), left: 0, top }); top += head;
    parts.push({ input: await orthoTile(o, s, T), left: 0, top });
    for (const [i, set] of sets.entries()) {
      const colours = { ...base, ...set.tones };
      const raw = rasterTopDown(cells, x - s.halfM, y - s.halfM, w, w, res, colours);
      parts.push({ input: await sharp(Buffer.from(raw), { raw: { width: w, height: w, channels: 3 } }).resize(T, T).png().toBuffer(), left: (i + 1) * (T + gap), top });
      parts.push({ input: label(T, 22, `${set.id}: ${rgb(colours.klinker)} / ${rgb(colours.brick)} / ${rgb(colours.cycle)}`, 12), left: (i + 1) * (T + gap), top: top + T });
    }
    top += T + 22 + gap;
  }
  mkdirSync(dirname(out), { recursive: true });
  await sharp({ create: { width: W, height: top, channels: 3, background: '#222' } }).composite(parts).jpeg({ quality: 85 }).toFile(out);
  console.log(out);
}

const mode = process.argv[2];
(mode === 'tones' ? tones() : frames()).catch(e => { console.error(e); process.exit(1); });
