/**
 * Shopfront sheet (lane retail-pass-20261119): per pand of a house:frames --likeness run, the ground storey of its street
 * wall cut from the likeness frames (photo and each run), side by side: photo | run A | run B ... The cut is the pand's
 * wall projected with the likeness pose (base -0.3 m to 4.6 m, 1.2 m either side), so it frames the shop at the
 * detail a rider sees from the panorama's spot. `--blind` writes randomised A/B pairs and a key instead (photo | A | B).
 *
 *   node --import tsx scripts/shop-props/front-sheet.ts --runs=today:artifacts/retail-pass/today,pass:artifacts/retail-pass/pass \
 *     --out=artifacts/retail-pass/sheet.jpg [--blind=<dir>] [--seed=1]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { frameFor, projectRd } from '../house-frames/pose.js';

const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const runs = (arg('runs') ?? '').split(',').filter(Boolean).map(s => { const [label, dir] = s.split(':'); return { label, dir }; });
const out = arg('out') ?? 'artifacts/retail-pass/sheet.jpg', blind = arg('blind');
if (!runs.length) throw new Error('--runs=label:dir,...');

type Rect = { left: number; top: number; width: number; height: number };
function cutFor(pose: any): Rect | null {
  const lp = pose.rule10?.likeness?.lp;
  if (!lp) return null;
  const frame = frameFor(lp.pose), w = pose.wall, len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y), ux = (w.b.x - w.a.x) / len, uy = (w.b.y - w.a.y) / len;
  const pts: Array<{ x: number; y: number }> = [];
  for (const t of [-1.2, len + 1.2]) for (const z of [-0.3, 4.6]) {
    const q = projectRd(frame, lp.pose, { x: w.a.x + ux * t, y: w.a.y + uy * t }, z - 0);
    if (q.depth > 0) pts.push(q);
  }
  if (pts.length < 4) return null;
  // The likeness window is the top `window.height` rows of the tall shift-lens frame, at dpr 2.
  const dpr = 2, W = lp.window.width * dpr, H = lp.window.height * dpr;
  const x0 = Math.max(0, Math.min(...pts.map(p => p.x)) * dpr), x1 = Math.min(W, Math.max(...pts.map(p => p.x)) * dpr);
  const y0 = Math.max(0, Math.min(...pts.map(p => p.y)) * dpr), y1 = Math.min(H, Math.max(...pts.map(p => p.y)) * dpr);
  if (x1 - x0 < 20 || y1 - y0 < 20) return null;
  return { left: Math.round(x0), top: Math.round(y0), width: Math.round(x1 - x0), height: Math.round(y1 - y0) };
}

const TILE_H = 420;
async function tile(file: string, r: Rect): Promise<Buffer> {
  const meta = await sharp(file).metadata(), sx = (meta.width ?? 2880) / 2880;
  const rr = { left: Math.round(r.left * sx), top: Math.round(r.top * sx), width: Math.round(r.width * sx), height: Math.round(r.height * sx) };
  rr.width = Math.min(rr.width, (meta.width ?? 0) - rr.left); rr.height = Math.min(rr.height, (meta.height ?? 0) - rr.top);
  return sharp(file).extract(rr).resize({ height: TILE_H }).jpeg({ quality: 88 }).toBuffer();
}
async function row(bufs: Buffer[], gap = 8): Promise<Buffer> {
  const ms = await Promise.all(bufs.map(b => sharp(b).metadata()));
  const width = ms.reduce((t, m) => t + (m.width ?? 0) + gap, -gap);
  let x = 0;
  const composite = bufs.map((b, i) => { const c = { input: b, left: x, top: 0 }; x += (ms[i].width ?? 0) + gap; return c; });
  return sharp({ create: { width, height: TILE_H, channels: 3, background: '#111' } }).composite(composite).jpeg({ quality: 88 }).toBuffer();
}

const keys = fs.readdirSync(runs[0].dir).filter(k => fs.existsSync(path.join(runs[0].dir, k, 'pose.json'))).sort();
const rows: Buffer[] = [], key: Record<string, Record<string, string>> = {};
let seed = Number(arg('seed') ?? 1);
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
for (const [i, k] of keys.entries()) {
  const pose = JSON.parse(fs.readFileSync(path.join(runs[0].dir, k, 'pose.json'), 'utf8')), r = cutFor(pose);
  if (!r) { console.warn(`${k}: no likeness cut`); continue; }
  const photo = await tile(path.join(runs[0].dir, k, 'likeness-photo.jpg'), r);
  const games = await Promise.all(runs.map(run => tile(path.join(run.dir, k, 'likeness.png'), r)));
  if (blind) {
    const flip = rand() < 0.5, [a, b] = flip ? [games[1], games[0]] : [games[0], games[1]];
    fs.mkdirSync(blind, { recursive: true });
    const name = `pair-${String(i + 1).padStart(2, '0')}.jpg`;
    fs.writeFileSync(path.join(blind, name), await row([photo, a, b]));
    key[name] = { case: k, A: flip ? runs[1].label : runs[0].label, B: flip ? runs[0].label : runs[1].label };
  } else rows.push(await row([photo, ...games]));
  console.log(`${k}: cut ${r.width}x${r.height} at ${r.left},${r.top}`);
}
if (blind) { fs.writeFileSync(path.join(blind, 'key.json'), JSON.stringify(key, null, 1)); console.log(`wrote ${Object.keys(key).length} blind pairs to ${blind}`); }
else {
  const ms = await Promise.all(rows.map(b => sharp(b).metadata())), width = Math.max(...ms.map(m => m.width ?? 0));
  let y = 0;
  const composite = rows.map((b, i) => { const c = { input: b, left: 0, top: y }; y += (ms[i].height ?? 0) + 8; return c; });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp({ create: { width, height: Math.max(1, y - 8), channels: 3, background: '#111' } }).composite(composite).jpeg({ quality: 85 }).toFile(out);
  console.log(`wrote ${out} (${rows.length} fronts: photo | ${runs.map(r => r.label).join(' | ')})`);
}
