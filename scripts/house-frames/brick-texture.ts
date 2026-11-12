/**
 * Brick texture on the target wall, photo vs game (F1 S6c, #380). This measures why the blind critic reads the record
 * shader's brick as render ("brick vs render", F4 round 1).
 *
 * Per pair it resamples the wall plane at 1 cm in v, on 40 columns over 10-90 % of the wall length and from 2.5 m to 85 % of
 * the wall height (wallPoint, bilinear). Wall pixels are kept and openings, trim, glints and shadow dropped: a sample is
 * kept when its 0.25 m-smoothed luma lies in the 25-75 % quantile band of the column set. On those samples it reports:
 *   texture   std of (luma - its 0.25 m running mean) / mean luma: the fine detail a brick wall shows and a render does not;
 *   course    the luma amplitude at the coursing period (FR_COURSE 0.0625 m) over the mean, by a DFT on each kept run
 *             of at least 0.5 m: the mortar-line amplitude;
 *   ppm       pixels per metre vertically at the wall centre: the course period in pixels is 0.0625 x ppm.
 *
 *   node --import tsx scripts/house-frames/brick-texture.ts <frames dir> [--before <frames dir>] [--keys k1,k2] [--json out]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { frameFor, wallPoint, type FramePose, type WallQuad } from './pose.ts';

type Img = { width: number; height: number; data: Uint8Array };
export const COURSE_M = 0.0625;
const STEP_M = 0.01, SMOOTH_M = 0.25;

async function read(file: string, w?: number, h?: number): Promise<Img> {
  let s = sharp(file).removeAlpha();
  if (w && h) s = s.resize(w, h, { fit: 'fill' });
  const { data, info } = await s.raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}
function luma(img: Img, x: number, y: number): number {
  const x0 = Math.floor(x - 0.5), y0 = Math.floor(y - 0.5), fx = x - 0.5 - x0, fy = y - 0.5 - y0;
  const at = (xx: number, yy: number) => {
    const cx = Math.min(img.width - 1, Math.max(0, xx)), cy = Math.min(img.height - 1, Math.max(0, yy)), o = (cy * img.width + cx) * 3;
    return 0.299 * img.data[o] + 0.587 * img.data[o + 1] + 0.114 * img.data[o + 2];
  };
  return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
}
const quant = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

export type BrickTexture = { texture: number; course: number; ppm: number; n: number };
export function brickTexture(img: Img, pose: FramePose, wall: WallQuad): BrickTexture | null {
  const frame = frameFor(pose), len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  const v0 = 2.5, v1 = wall.heightM * 0.85;
  if (v1 - v0 < 1 || len < 2) return null;
  const nv = Math.floor((v1 - v0) / STEP_M), half = Math.round(SMOOTH_M / STEP_M / 2);
  const cols: { y: number[]; sm: number[]; ok: boolean[] }[] = [];
  for (let i = 0; i < 40; i++) {
    const u = len * (0.1 + 0.8 * (i + 0.5) / 40), y: number[] = [], ok: boolean[] = [];
    for (let k = 0; k < nv; k++) {
      const s = wallPoint(frame, pose, wall, u, v0 + k * STEP_M);
      const inside = s.depth > 0 && s.x >= 0 && s.y >= 0 && s.x < img.width && s.y < img.height;
      y.push(inside ? luma(img, s.x, s.y) : NaN); ok.push(inside);
    }
    const sm = y.map((_, k) => { let a = 0, n = 0; for (let j = k - half; j <= k + half; j++) if (j >= 0 && j < nv && Number.isFinite(y[j])) { a += y[j]; n++; } return n ? a / n : NaN; });
    cols.push({ y, sm, ok });
  }
  const all = cols.flatMap(c => c.sm.filter(Number.isFinite));
  if (all.length < 200) return null;
  const lo = quant(all, 0.25), hi = quant(all, 0.75);
  let sum = 0, sum2 = 0, n = 0, mean = 0, mn = 0;
  const amps: number[] = [];
  for (const c of cols) {
    let run: number[] = [];
    const flush = () => {
      if (run.length * STEP_M >= 0.5) {
        // DFT at the course frequency, Hann-windowed, on the detrended run: amplitude of a sinusoid.
        let re = 0, im = 0, w = 0;
        for (let k = 0; k < run.length; k++) { const h = 0.5 - 0.5 * Math.cos(2 * Math.PI * k / (run.length - 1)), ph = 2 * Math.PI * k * STEP_M / COURSE_M; re += run[k] * h * Math.cos(ph); im += run[k] * h * Math.sin(ph); w += h; }
        amps.push(2 * Math.hypot(re, im) / w);
      }
      run = [];
    };
    for (let k = 0; k < nv; k++) {
      const keep = c.ok[k] && Number.isFinite(c.sm[k]) && c.sm[k] >= lo && c.sm[k] <= hi;
      if (!keep) { flush(); continue; }
      const d = c.y[k] - c.sm[k];
      sum += d; sum2 += d * d; n++; mean += c.y[k]; mn++;
      run.push(d);
    }
    flush();
  }
  if (n < 200) return null;
  const m = mean / mn, sd = Math.sqrt(Math.max(0, sum2 / n - (sum / n) ** 2));
  const mid = wallPoint(frame, pose, wall, len / 2, (v0 + v1) / 2), up = wallPoint(frame, pose, wall, len / 2, (v0 + v1) / 2 + 1);
  return { texture: +(sd / m).toFixed(4), course: +((amps.length ? quant(amps, 0.5) : 0) / m).toFixed(4), ppm: +Math.hypot(up.x - mid.x, up.y - mid.y).toFixed(1), n };
}

async function main(argv: string[]) {
  const dir = argv[0], before = argv.includes('--before') ? argv[argv.indexOf('--before') + 1] : null;
  const keys = argv.includes('--keys') ? argv[argv.indexOf('--keys') + 1].split(',') : fs.readdirSync(dir).filter(k => fs.existsSync(path.join(dir, k, 'pose.json')));
  const out: Record<string, unknown>[] = [];
  for (const k of keys) {
    const pose = JSON.parse(fs.readFileSync(path.join(dir, k, 'pose.json'), 'utf8'));
    const P: FramePose = pose.pose, W: WallQuad = pose.wall;
    const game = await read(path.join(dir, k, 'game.png'));
    const photo = await read(path.join(dir, k, 'photo.jpg'), game.width, game.height);
    const row: Record<string, unknown> = { key: k, photo: brickTexture(photo, P, W), game: brickTexture(game, P, W) };
    if (before && fs.existsSync(path.join(before, k, 'game.png'))) row.before = brickTexture(await read(path.join(before, k, 'game.png'), game.width, game.height), P, W);
    out.push(row);
  }
  const j = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : null;
  if (j) fs.writeFileSync(j, JSON.stringify(out, null, 1));
  else for (const r of out) console.log(JSON.stringify(r));
}
if (import.meta.url === `file://${process.argv[1]}`) await main(process.argv.slice(2));
