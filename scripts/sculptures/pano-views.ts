/**
 * Aimed pinhole views of a statue from every Gemeente Amsterdam panorama (CC BY 4.0) within a radius, all years,
 * for multi-view reconstruction (Object Capture, COLMAP).
 *
 *   node --import tsx scripts/sculptures/pano-views.ts --id=<id> --lnglat=<lng,lat> --height=<m> --out=<empty dir>
 *        [--radius=25] [--fov=40] [--upscale=1] [--list]
 *
 * --upscale=k renders k times the native pixel count per side (bilinear, no new detail): a narrow --fov crop that
 * fills the frame with the statue, at a size Object Capture accepts.
 *
 * The panoramas are world-aligned equirectangulars (north at the image centre, AMSTERDAM_WORLD_ALIGNED in
 * src/canalRecall/facade/rectify.ts), so a view is a plain pinhole resampling: yaw = bearing camera -> statue,
 * pitch = elevation of the statue's mid-height, roll 0. The output keeps the panorama's native angular resolution
 * at the image centre (width = 2 tan(fov/2) * W / 2pi). Every view is aimed at the statue centre, so the cameras'
 * optical axes meet there: objcap_post.py uses that to find the statue, gravity and metric scale in a
 * reconstruction (the camera positions in RD metres are in source.json).
 *
 * Panoramas come through scripts/pand-reference/core.ts (disk cache .cache/pand-reference, rate limited).
 * Writes <out>/images/p###.jpg (with EXIF FocalLengthIn35mmFilm) and <out>/source.json (pano id, capture time,
 * camera RD/NAP, distance, bearing, licence per view).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { lensFor } from '../da-costa-block/neighbourhood-core.ts';
import { lngLatToRd } from '../pand-reference/core.ts';
import { loadPano } from '../pand-reference/rectify.ts';
import { listPanos, type PanoPick } from '../pand-reference/select.ts';

const arg = (k: string, d = '') => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const id = arg('id'), out = arg('out');
const [lng, lat] = arg('lnglat').split(',').map(Number);
const heightM = Number(arg('height', '3')), radius = Number(arg('radius', '25')), fovDeg = Number(arg('fov', '40'));
const upscale = Number(arg('upscale', '1'));
const listOnly = process.argv.includes('--list');
if (!id || !out || !Number.isFinite(lng)) throw new Error('usage: pano-views.ts --id= --lnglat=lng,lat --height= --out=<dir>');

const statue = lngLatToRd([lng, lat]);
const panos = (await listPanos(statue, radius + 5)).map((p: any) => {
  const rd = lngLatToRd([p.geometry.coordinates[0], p.geometry.coordinates[1]]);
  const dx = statue.x - rd.x, dy = statue.y - rd.y;
  return { p, rd, distM: Math.hypot(dx, dy), bearingDeg: (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360 };
}).filter(r => r.distM <= radius).sort((a, b) => String(a.p.timestamp).localeCompare(String(b.p.timestamp)));

const byYear: Record<string, number> = {};
for (const r of panos) byYear[String(r.p.timestamp).slice(0, 4)] = (byYear[String(r.p.timestamp).slice(0, 4)] ?? 0) + 1;
console.log(JSON.stringify({ id, statue, radius, panoramas: panos.length, byYear, nearestM: panos.map(r => +r.distM.toFixed(1)).sort((a, b) => a - b).slice(0, 10) }));
if (listOnly) process.exit(0);

await fs.mkdir(path.join(out, 'images'), { recursive: true });
const views: any[] = [];
const fov = fovDeg * Math.PI / 180, tanH = Math.tan(fov / 2);
for (const [i, r] of panos.entries()) {
  const pick = { panoId: r.p.pano_id, record: r.p } as PanoPick;
  const loaded = await loadPano(pick);
  if (!loaded) { views.push({ panoId: r.p.pano_id, skipped: 'no equirectangular' }); continue; }
  const { img } = loaded;
  // Camera height: published NAP (minus the 43.5 m datum offset) when plausible, else street level + 2.44 m.
  const lens = lensFor(r.p, undefined) ?? lensFor(r.p, 0.4)!;
  let camZ = lens.pose.z, ground = camZ - 2.44, groundSource = 'published camera height - 2.44 m';
  if (ground < -2.5 || ground > 3) { ground = 0.4; camZ = ground + 2.44; groundSource = 'published height implausible; assumed ground 0.4 m NAP'; }
  const target = ground + heightM / 2;
  const pitch = Math.atan2(target - camZ, r.distM), yaw = r.bearingDeg * Math.PI / 180;
  const W = Math.round(upscale * 2 * tanH * img.width / (2 * Math.PI)), H = Math.round(W * 4 / 3);
  const f = W / 2 / tanH;
  // Camera basis in world (x east, y north, z up): forward, right, up (roll 0).
  const fw = [Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch)];
  const rt = [Math.cos(yaw), -Math.sin(yaw), 0];
  const up = [rt[1] * fw[2] - rt[2] * fw[1], rt[2] * fw[0] - rt[0] * fw[2], rt[0] * fw[1] - rt[1] * fw[0]];
  const rgb = Buffer.alloc(W * H * 3);
  const sw = img.width, sh = img.height, src = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x + 0.5 - W / 2) / f, v = (H / 2 - y - 0.5) / f;
    const d0 = fw[0] + u * rt[0] + v * up[0], d1 = fw[1] + u * rt[1] + v * up[1], d2 = fw[2] + u * rt[2] + v * up[2];
    const az = Math.atan2(d0, d1), el = Math.atan2(d2, Math.hypot(d0, d1));
    let px = ((az / (2 * Math.PI) + 0.5) % 1 + 1) % 1 * sw - 0.5, py = (0.5 - el / Math.PI) * sh - 0.5;
    py = Math.max(0, Math.min(sh - 1.001, py));
    const x0 = Math.floor(px), y0 = Math.floor(py), ax = px - x0, ay = py - y0;
    const xa = ((x0 % sw) + sw) % sw, xb = (xa + 1) % sw;
    for (let c = 0; c < 3; c++) {
      const p00 = src[(y0 * sw + xa) * 4 + c], p10 = src[(y0 * sw + xb) * 4 + c], p01 = src[((y0 + 1) * sw + xa) * 4 + c], p11 = src[((y0 + 1) * sw + xb) * 4 + c];
      rgb[(y * W + x) * 3 + c] = Math.round((p00 * (1 - ax) + p10 * ax) * (1 - ay) + (p01 * (1 - ax) + p11 * ax) * ay);
    }
  }
  const name = `p${String(i).padStart(3, '0')}.jpg`;
  const focal35 = Math.round(18 / tanH);
  await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
    .withExif({ IFD0: { Make: 'Gemeente Amsterdam panorama (resampled)', Model: 'pinhole' }, IFD2: { FocalLengthIn35mmFilm: String(focal35), FocalLength: `${focal35}/1` } })
    .jpeg({ quality: 93 }).toFile(path.join(out, 'images', name));
  // Statue mid-height projects to the image centre by construction; record the statue's image height for review.
  const statuePx = Math.round(f * (Math.tan(Math.atan2(ground + heightM - camZ, r.distM) - pitch) - Math.tan(Math.atan2(ground - camZ, r.distM) - pitch)));
  views.push({
    file: `images/${name}`, panoId: r.p.pano_id, timestamp: r.p.timestamp, missionType: r.p.mission_type, missionYear: r.p.mission_year,
    equirectangular: loaded.resolution, equirectangularSize: [img.width, img.height],
    cameraRd: [+r.rd.x.toFixed(3), +r.rd.y.toFixed(3), +camZ.toFixed(3)], groundNap: +ground.toFixed(2), groundSource,
    distM: +r.distM.toFixed(2), bearingDeg: +r.bearingDeg.toFixed(1), pitchDeg: +(pitch * 180 / Math.PI).toFixed(2),
    fovDeg, upscale, size: [W, H], focalPx: +f.toFixed(1), statueHeightPx: statuePx,
    licence: 'CC BY 4.0', author: 'Gemeente Amsterdam', sourceUrl: r.p._links?.equirectangular_full?.href ?? r.p._links?.self?.href,
  });
  console.log(name, r.p.timestamp, `${r.distM.toFixed(1)} m`, `bearing ${r.bearingDeg.toFixed(0)}`, `statue ${statuePx}px`);
}
await fs.writeFile(path.join(out, 'source.json'), JSON.stringify({
  id, statueLngLat: [lng, lat], statueRd: statue, heightM, radiusM: radius, fovDeg, byYear,
  method: 'pinhole resampling of the world-aligned equirectangular (north at centre), yaw/pitch aimed at the statue mid-height, roll 0, bilinear, native angular resolution at the centre',
  licence: 'CC BY 4.0, Gemeente Amsterdam (panorama API api.data.amsterdam.nl/panorama)', views,
}, null, 1) + '\n');
