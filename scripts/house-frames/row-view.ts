// Row view: one panorama cut that shows a whole run of fronts from across the street or canal, every pand outlined and
// labelled. A spec writer's reading sheet for a quay row (the crowns and the neighbours in one frame, head on), where
// house:crops' per-pand rectified crops are close-ups that cut the crown off. docs/house-line.md §7 "Row views".
import './env.ts';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { findPands, lngLatToRd, neighbourhood, type Footprint, type Rd } from '../pand-reference/core.ts';
import { listPanos, options, pickWall, type Wall } from '../pand-reference/select.ts';
import { bearingTo, frameFor, gridConvergenceDeg, projectRd, type FramePose } from './pose.ts';
import { cutPerspective, loadEquirect } from './photo.ts';

export const HELP = `node --import tsx scripts/house-frames/row-view.ts --pands <id,id,...> --out <file.jpg> [flags]

Cuts one panorama to show a run of fronts (a quay row) from across the street or canal, with each pand's BAG wall
outlined and labelled, for reading HouseSpecs (crowns, storeys, axes, neighbours) head on. Panoramas: within --max-dist
of the run's middle, standing off the run's line by at least --min-standoff (across the water), the view within 40 deg
of the run's normal; winter captures (Nov-Mar) first, then the straightest, then the newest.

  --pands <ids>        BAG pand ids of the run (16 digits, with or without NL.IMBAG.Pand.), in any order
  --labels <a,b,...>   one label per pand (house numbers), else the last six digits of the id
  --bearing <deg>      prefer the wall facing this bearing (+-50 deg) for every pand (pickWall preferBearing)
  --out <file.jpg>     the sheet (JPEG, 1600 px wide)
  --min-standoff <m>   default 14
  --max-dist <m>       default 60
  --pick <n>           take the n-th ranked panorama (0 = best; default 0)
  --year <yyyy>        only that capture year
  --any-season         do not put winter first
  --no-zoom            keep the whole frame (default: cut to the outlined run plus a margin, up to 2.2x)
  --help               this text

Prints the panorama, its date, distance and obliquity; writes <file>.json with the pose and the pand outlines (px).`;

const argv = process.argv.slice(2);
const arg = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
if (argv.includes('--help') || !arg('pands') || !arg('out')) { console.log(HELP); process.exit(argv.includes('--help') ? 0 : 2); }

const ids = arg('pands')!.split(',').map(s => s.trim()).filter(Boolean).map(s => /(\d{16})$/.exec(s)![1]);
const labels = arg('labels')?.split(',') ?? ids.map(i => i.slice(-6));
const minStandoff = Number(arg('min-standoff') ?? 14), maxDist = Number(arg('max-dist') ?? 60), pickN = Number(arg('pick') ?? 0);
const year = arg('year') ? Number(arg('year')) : null, winterFirst = !argv.includes('--any-season');
if (arg('bearing')) options.preferBearingDeg = Number(arg('bearing'));
const out = path.resolve(arg('out')!);

const found = await findPands(ids);
type Item = { id: string; label: string; fp: Footprint; wall: Wall };
const items: Item[] = [];
for (const [i, id] of ids.entries()) {
  const fp = found.get(`NL.IMBAG.Pand.${id}`);
  if (!fp) { console.log(`${id}: not in the building tiles`); continue; }
  const c = { x: fp.ring.reduce((s, p) => s + p.x, 0) / fp.ring.length, y: fp.ring.reduce((s, p) => s + p.y, 0) / fp.ring.length };
  const { wall, note } = await pickWall(fp, await neighbourhood(c));
  if (!wall) { console.log(`${id}: ${note}`); continue; }
  items.push({ id, label: labels[i] ?? id.slice(-6), fp, wall });
}
if (!items.length) { console.log('no walls'); process.exit(1); }

// The run's line: mean normal, ends = the extreme wall ends along the tangent.
let nx = 0, ny = 0;
for (const it of items) { nx += it.wall.nx * it.wall.len; ny += it.wall.ny * it.wall.len; }
const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
const tx = -ny, ty = nx;
const pts = items.flatMap(it => [it.wall.a, it.wall.b]);
const o = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
const ts = pts.map(p => (p.x - o.x) * tx + (p.y - o.y) * ty);
const t0 = Math.min(...ts), t1 = Math.max(...ts);
const A: Rd = { x: o.x + tx * t0, y: o.y + ty * t0 }, B: Rd = { x: o.x + tx * t1, y: o.y + ty * t1 };
const mid: Rd = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
const topM = Math.max(...items.map(it => it.fp.height || 12)) + 3;

const WINTER = new Set([11, 12, 1, 2, 3]);
const panos = (await listPanos(mid, Math.max(maxDist, 40))).filter((p: any) => p.surface_type !== 'W');
const ranked = panos.flatMap((p: any) => {
  const rd = lngLatToRd([p.geometry.coordinates[0], p.geometry.coordinates[1]]);
  const vx = rd.x - mid.x, vy = rd.y - mid.y, d = Math.hypot(vx, vy), standoff = vx * nx + vy * ny;
  if (d > maxDist || standoff < minStandoff) return [];
  const obl = Math.acos(Math.min(1, standoff / d)) * 180 / Math.PI;
  if (obl > 40) return [];
  const yr = Number(String(p.timestamp).slice(0, 4)), month = Number(String(p.timestamp).slice(5, 7));
  if (year && yr !== year) return [];
  return [{ p, d, obl, yr, winter: WINTER.has(month) }];
}).sort((a: any, b: any) => (winterFirst ? Number(b.winter) - Number(a.winter) : 0) || Math.round(a.obl / 10) - Math.round(b.obl / 10) || b.yr - a.yr);
if (!ranked.length) { console.log(`no panorama ${minStandoff}-${maxDist} m off the run within 40 deg`); process.exit(1); }
const pick = ranked[Math.min(pickN, ranked.length - 1)];
const ll: [number, number] = [pick.p.geometry.coordinates[0], pick.p.geometry.coordinates[1]];
const published = Number(pick.p.geometry.coordinates[2]);

// Pose: heading at the run's middle, the narrowest lens (vertical, 30-110 deg) that fits the run and topM.
const W = 1600, H = 1000;
const camRd = lngLatToRd(ll);
const heading = bearingTo(ll, mid);
const dist = Math.hypot(mid.x - camRd.x, mid.y - camRd.y);
const eye = 2.44, lookDown = Math.max(5, Math.min(30, -(Math.atan2(topM - eye, dist) + Math.atan2(-eye, dist)) * 90 / Math.PI));
const poseAt = (vfov: number): FramePose => ({ rd: camRd, lngLat: ll, eyeHeightM: eye, cameraNap: published > 0 ? published - 43.5 : null, headingDeg: heading, lookDownDeg: lookDown, vfovDeg: vfov, width: W, height: H, clipped: [] });
const fits = (v: number) => {
  const pose = poseAt(v), f = frameFor(pose);
  return [A, B, mid].every(p => [0, topM].every(z => { const s = projectRd(f, pose, p, z); return s.depth > 0 && s.x > 10 && s.x < W - 10 && s.y > 10 && s.y < H - 10; }));
};
let vfov = 110;
for (let v = 30; v <= 110; v += 2) if (fits(v)) { vfov = v; break; }
const pose = poseAt(vfov), frame = frameFor(pose);
const img = await loadEquirect(pick.p.record ?? pick.p, 'full');
if (!img) { console.log('panorama did not load'); process.exit(1); }
const cut = cutPerspective(img, frame, gridConvergenceDeg(ll));

const outlines = items.map(it => {
  const q = [[it.wall.a, 0], [it.wall.b, 0], [it.wall.b, it.fp.height || 10], [it.wall.a, it.fp.height || 10]].map(([p, z]) => projectRd(frame, pose, p as Rd, z as number));
  return { id: it.id, label: it.label, px: q.map(s => [Math.round(s.x), Math.round(s.y)]), wallLenM: +it.wall.len.toFixed(2), heightM: it.fp.height };
});
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${outlines.map((o, i) => {
  const col = ['#00e5ff', '#ffd400'][i % 2];
  const bx = (o.px[0][0] + o.px[1][0]) / 2, by = Math.max(o.px[0][1], o.px[1][1]) + 22;
  return `<polygon points="${o.px.map(p => p.join(',')).join(' ')}" fill="none" stroke="${col}" stroke-width="2"/><rect x="${bx - 24}" y="${by - 17}" width="48" height="22" fill="#000" opacity="0.7"/><text x="${bx}" y="${by}" fill="${col}" font-size="17" font-family="sans-serif" text-anchor="middle">${esc(o.label)}</text>`;
}).join('')}<rect x="0" y="0" width="${W}" height="26" fill="#000" opacity="0.7"/><text x="8" y="19" fill="#fff" font-size="16" font-family="sans-serif">${esc(`${pick.p.pano_id} ${String(pick.p.timestamp).slice(0, 10)}  ${pick.d.toFixed(1)} m, obliquity ${pick.obl.toFixed(0)} deg, vfov ${vfov}`)}</text></svg>`;
fs.mkdirSync(path.dirname(out), { recursive: true });
// Zoom: the outlines (and topM over the run) plus a margin, scaled back up to the sheet width.
const xs = outlines.flatMap(o => o.px.map(p => p[0])), ys = [...outlines.flatMap(o => o.px.map(p => p[1])), ...[A, B].map(p => projectRd(frame, pose, p, topM).y)];
const padX = 0.12 * (Math.max(...xs) - Math.min(...xs)) + 40, padY = 60;
const left = Math.max(0, Math.round(Math.min(...xs) - padX)), right = Math.min(W, Math.round(Math.max(...xs) + padX));
const top = Math.max(0, Math.round(Math.min(...ys) - padY)), bottom = Math.min(H, Math.round(Math.max(...ys) + padY));
const full = await sharp(Buffer.from(cut.data), { raw: { width: cut.width, height: cut.height, channels: 3 } }).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
const zoomed = argv.includes('--no-zoom') ? sharp(full) : sharp(full).extract({ left, top, width: right - left, height: bottom - top }).resize({ width: Math.min(W, Math.round((right - left) * 2.2)) });
await zoomed.jpeg({ quality: 82 }).toFile(out);
fs.writeFileSync(out.replace(/\.jpe?g$/, '') + '.json', JSON.stringify({ pano: pick.p.pano_id, timestamp: pick.p.timestamp, distM: pick.d, obliquityDeg: pick.obl, pose, outlines, candidates: ranked.length }, null, 1));
console.log(`${out}: ${pick.p.pano_id} ${String(pick.p.timestamp).slice(0, 10)} ${pick.d.toFixed(1)} m obl ${pick.obl.toFixed(0)} vfov ${vfov} (${ranked.length} candidates)`);
