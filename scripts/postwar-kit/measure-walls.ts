/**
 * Round 2: re-measure the wall colour of the post-1965 cluster members from brick-only patches.
 *
 *   node --import tsx scripts/postwar-kit/measure-walls.ts [--publish]
 *
 * Reads artifacts/postwar-kit/sample-all.json (sample-photos.ts --all: one aimed Gemeente Amsterdam panorama thumbnail per
 * member with a straight, clear capture, CC BY 4.0, and the wall's ends, heading, pitch and field of view). Projects the
 * wall's upper storeys (UPPER_FROM_M up to 0.8 m under the top, 8 % in from each end) into the thumbnail with a pinhole at
 * the panorama camera (CAMERA_Z_M over the street) and measures only those pixels (src/canalRecall/postwarKit/wallPatch.ts).
 *
 * Writes artifacts/postwar-kit/measured-walls.json (every row, with a validation against the 59 eye reads), and with
 * --publish the accepted walls to src/canalRecall/postwarKit/corrected-walls.json ({ walls: { pand: 'b|p' + hex } }).
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { calibrateThumb, measureWallPatch } from '../../src/canalRecall/postwarKit/wallPatch.ts';
import { median } from '../../src/canalRecall/buurtProfiles/exposure.ts';
import { familyOfHex } from '../../src/canalRecall/postwarKit/kit.ts';
import { MEASURED_FRONTS } from '../../src/canalRecall/postwarKit/facts.ts';

export const CAMERA_Z_M = 2.4;
export const UPPER_FROM_M = 4.2;
/** The thumbnail service's effective pitch over the requested one (fitted on the read fronts: at 1 the outline sat a storey and a half low on Bloemgracht 210-286). */
export const PITCH_SCALE = Number(process.env.PITCH_SCALE ?? 0.5);
const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'artifacts/postwar-kit');
const sample = JSON.parse(fs.readFileSync(path.join(OUT, 'sample-all.json'), 'utf8')) as Record<string, any>;

type V = [number, number, number];
/** Pixel of a camera-relative ENU point in a W x H rectilinear view (heading from north, pitch up, horizontal fov). */
export function project(p: V, headingDeg: number, pitchDeg: number, fovDeg: number, W: number, H: number): [number, number] | null {
  const h = headingDeg * Math.PI / 180, t = pitchDeg * Math.PI / 180;
  const f: V = [Math.sin(h) * Math.cos(t), Math.cos(h) * Math.cos(t), Math.sin(t)];
  const r: V = [Math.cos(h), -Math.sin(h), 0];
  const u: V = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const z = dot(p, f);
  if (z <= 0.1) return null;
  const k = (W / 2) / Math.tan(fovDeg * Math.PI / 360);
  return [W / 2 + dot(p, r) / z * k, H / 2 - dot(p, u) / z * k];
}
const inQuad = (x: number, y: number, q: Array<[number, number]>) => {
  let c = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) if ((q[i][1] > y) !== (q[j][1] > y) && x < (q[j][0] - q[i][0]) * (y - q[i][1]) / (q[j][1] - q[i][1]) + q[i][0]) c = !c;
  return c;
};

const ONLY = new Set((process.env.ONLY ?? "").split(",").filter(Boolean));
const DEBUG = new Set((process.env.QUADS ?? '').split(',').filter(Boolean));
const rows: Record<string, any> = {};
for (const [id, s] of Object.entries(sample)) {
  if (!s.photo || !s.wallEnds || (ONLY.size && !ONLY.has(id))) continue;
  const { data, info } = await sharp(path.join(OUT, s.photo)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const [cLng, cLat] = s.camera as [number, number];
  const enu = ([lng, lat]: [number, number]): [number, number] => [(lng - cLng) * 111_320 * Math.cos(cLat * Math.PI / 180), (lat - cLat) * 110_540];
  const [a, b] = (s.wallEnds as Array<[number, number]>).map(enu);
  const lerp = (t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const top = Math.max(UPPER_FROM_M + 1, s.heightM - 0.8), bottom = s.heightM >= 8 ? UPPER_FROM_M : 1.5;
  const corners = ([[0.08, bottom], [0.92, bottom], [0.92, top], [0.08, top]] as const).map(([t, z]) => { const p = lerp(t); return project([p[0], p[1], z - CAMERA_Z_M], s.headingDeg, s.pitchDeg * PITCH_SCALE, s.fovDeg, info.width, info.height); });
  if (corners.some(c => !c)) { rows[id] = { skip: 'wall behind camera' }; continue; }
  const q = corners as Array<[number, number]>;
  const x0 = Math.max(0, Math.floor(Math.min(...q.map(p => p[0])))), x1 = Math.min(info.width - 1, Math.ceil(Math.max(...q.map(p => p[0]))));
  const y0 = Math.max(0, Math.floor(Math.min(...q.map(p => p[1])))), y1 = Math.min(info.height - 1, Math.ceil(Math.max(...q.map(p => p[1]))));
  const px: number[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inQuad(x + 0.5, y + 0.5, q)) { const i = (y * info.width + x) * info.channels; px.push(data[i], data[i + 1], data[i + 2]); }
  const m = measureWallPatch(px);
  if (DEBUG.has(id)) {
    fs.mkdirSync(path.join(OUT, 'quads'), { recursive: true });
    const svg = `<svg width="${info.width}" height="${info.height}"><polygon points="${q.map(p => p.join(',')).join(' ')}" fill="none" stroke="#0f0" stroke-width="2"/><rect x="0" y="0" width="60" height="30" fill="${m?.hex ?? '#000'}"/></svg>`;
    await sharp(path.join(OUT, s.photo)).composite([{ input: Buffer.from(svg) }]).jpeg().toFile(path.join(OUT, 'quads', `${id}.jpg`));
  }
  rows[id] = m ? { ...m, cluster: s.cluster, address: s.address, pixels: px.length / 3 } : { skip: 'too few wall pixels', pixels: px.length / 3 };
}

// Calibration into today's frame (wallPatch.ts calibrateThumb); the paint cast is this run's painted median a/b.
const painted = Object.values(rows).filter(m => m.hex && m.painted);
const paintCast: [number, number] = painted.length >= 10 ? [median(painted.map(m => m.a)), median(painted.map(m => m.b))] : [0, 0];
for (const m of Object.values(rows)) if (m.hex) { m.raw = m.hex; m.hex = calibrateThumb(m.raw, m.painted, paintCast); m.family = familyOfHex(m.hex, m.painted); }
console.log('paint cast', paintCast);
// Validation against the eye reads (facts.ts): exact family and coarse family (warm brick | buff | grey/dark | paint).
const coarse = (f: string) => f === 'brick-red' || f === 'brick-brown' || f === 'brick-dark' ? 'warm' : f === 'brick-buff' ? 'buff' : f === 'brick-grey' ? 'grey' : 'paint';
let n = 0, exact = 0, near = 0;
const misses: string[] = [];
for (const r of MEASURED_FRONTS) {
  const m = rows[r.id];
  if (!m?.accepted) continue;
  n++;
  if (m.family === r.wall) exact++;
  if (coarse(m.family) === coarse(r.wall)) near++; else misses.push(`${r.address}: read ${r.wall}, measured ${m.family} ${m.hex}`);
}
const accepted = Object.entries(rows).filter(([, m]) => m.accepted);
const summary = { members: Object.keys(rows).length, accepted: accepted.length, validation: { reads: n, exactFamily: exact, coarseFamily: near, misses } };
fs.writeFileSync(path.join(OUT, 'measured-walls.json'), JSON.stringify({ summary, rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));
if (process.argv.includes('--publish')) {
  const walls = Object.fromEntries(accepted.sort(([p], [q]) => p.localeCompare(q)).map(([id, m]) => [id, `${m.painted ? 'p' : 'b'}${m.hex.slice(1)}`]));
  fs.writeFileSync(path.join(ROOT, 'src/canalRecall/postwarKit/corrected-walls.json'), JSON.stringify({ schemaVersion: 1, revision: 'postwar-walls/v2 2026-11-20',
    licence: 'measured from Gemeente Amsterdam panoramas, CC BY 4.0', method: 'scripts/postwar-kit/measure-walls.ts (brick-only patches of the projected upper-storey wall, postwarKit/wallPatch.ts)', walls }, null, 1) + '\n');
  console.log(`published ${Object.keys(walls).length} walls`);
}
