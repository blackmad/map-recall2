/**
 * Ground-storey tone (lane retail-look-20261114, round 2): the OKLab lightness of each pinned shop's ground storey
 * (0.3-2.9 m over the pavement, the inner 80 % of the pand's street wall) in the panorama cut and in each game run, read
 * on house:frames' wide pano-lens pair (photo.jpg and game.png share the pose). Also the upper wall (4-8 m) and the ratio
 * ground / upper, which cancels the photo's exposure: a shop front that reads darker than its own house in the photo
 * should in the game too.
 *
 *   node --import tsx scripts/retail-ground/ground-tone.ts --list=scripts/retail-ground/look-fronts.json \
 *     --runs=off:artifacts/retail-look/before-off,on:artifacts/retail-look/before-on,after:artifacts/retail-look/after-on
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { frameFor, wallPoint, type FramePose, type WallQuad } from '../house-frames/pose.ts';
import { rgbOklab } from '../house-frames/analyse.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const list = JSON.parse(fs.readFileSync(arg('list') ?? 'scripts/retail-ground/look-fronts.json', 'utf8')) as Array<{ key: string }>;
const runs = (arg('runs') ?? '').split(',').filter(Boolean).map(r => { const [label, dir] = r.split(':'); return { label, dir }; });

type Rgb8 = { width: number; height: number; data: Uint8Array };
async function read(file: string, w: number, h: number): Promise<Rgb8> {
  const { data, info } = await sharp(file).removeAlpha().resize(w, h, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}
/** Mean OKLab L over the wall band [v0, v1] m, inner 80 % of the length (null when under 40 samples land in frame). */
export function bandL(img: Rgb8, pose: FramePose, wall: WallQuad, v0: number, v1: number): number | null {
  const frame = frameFor(pose), len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  let sum = 0, n = 0;
  for (let i = 0; i < 32; i++) for (let j = 0; j < 12; j++) {
    const s = wallPoint(frame, pose, wall, len * (0.1 + 0.8 * (i + 0.5) / 32), v0 + (v1 - v0) * (j + 0.5) / 12);
    if (s.depth <= 0 || s.x < 0 || s.y < 0 || s.x >= img.width || s.y >= img.height) continue;
    const o = (Math.floor(s.y) * img.width + Math.floor(s.x)) * 3;
    sum += rgbOklab(img.data[o], img.data[o + 1], img.data[o + 2])[0]; n++;
  }
  return n >= 40 ? +(sum / n).toFixed(3) : null;
}

const rows: Array<Record<string, string | number | null>> = [];
for (const e of list) {
  const first = path.join(runs[0].dir, e.key, 'pose.json');
  if (!fs.existsSync(first)) continue;
  const { pose, wall } = JSON.parse(fs.readFileSync(first, 'utf8')) as { pose: FramePose; wall: WallQuad };
  const photo = await read(path.join(runs[0].dir, e.key, 'photo.jpg'), pose.width, pose.height);
  const row: Record<string, string | number | null> = { key: e.key };
  const g = (img: Rgb8) => bandL(img, pose, wall, 0.3, 2.9), u = (img: Rgb8) => bandL(img, pose, wall, 4, Math.min(8, wall.heightM - 0.5));
  const ratio = (a: number | null, b: number | null) => a !== null && b ? +(a / b).toFixed(2) : null;
  row.photo = g(photo); row['photo g/u'] = ratio(row.photo as number | null, u(photo));
  for (const r of runs) {
    const f = path.join(r.dir, e.key, 'game.png');
    if (!fs.existsSync(f)) continue;
    const img = await read(f, pose.width, pose.height);
    row[r.label] = g(img); row[`${r.label} g/u`] = ratio(row[r.label] as number | null, u(img));
  }
  rows.push(row);
}
console.table(rows);
const mean = (k: string) => { const v = rows.map(r => r[k]).filter((x): x is number => typeof x === 'number'); return v.length ? +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(3) : null; };
console.log(JSON.stringify(Object.fromEntries(Object.keys(rows[0] ?? {}).filter(k => k !== 'key').map(k => [k, mean(k)]))));
