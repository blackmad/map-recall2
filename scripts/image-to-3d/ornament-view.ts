/**
 * One aimed pinhole view of a facade ornament from one Gemeente Amsterdam panorama (CC BY 4.0), the input for the
 * image-to-3D ornament trial (docs/reports/image-to-3d-belt-20261121.md).
 *
 *   node --import tsx scripts/image-to-3d/ornament-view.ts --pano=<pano id> --lnglat=<lng,lat> --up=<m above ground>
 *        --fov=<deg> --out=<file.jpg> [--offset=<m along the wall, + to the right as seen>] [--bearing=<wall normal deg>]
 *        [--upscale=1] [--aspect=1]
 *
 * The target is the wall point at lnglat (+ offset along the wall), up metres above the ground under the camera.
 * Same resampling as scripts/sculptures/pano-views.ts (world-aligned equirectangular, north at the centre column).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { lensFor } from '../da-costa-block/neighbourhood-core.ts';
import { lngLatToRd } from '../pand-reference/core.ts';
import { loadPano } from '../pand-reference/rectify.ts';
import { listPanos, type PanoPick } from '../pand-reference/select.ts';

const arg = (k: string, d = '') => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const panoId = arg('pano'), out = arg('out');
const [lng, lat] = arg('lnglat').split(',').map(Number);
const up = Number(arg('up', '5')), fovDeg = Number(arg('fov', '30')), upscale = Number(arg('upscale', '1'));
const offset = Number(arg('offset', '0')), normal = Number(arg('bearing', 'NaN')), aspect = Number(arg('aspect', '1'));
if (!Number.isFinite(lng)) throw new Error('usage: --pano= --lnglat= --up= --fov= --out= (or --list)');

let t = lngLatToRd([lng, lat]);
if (offset && Number.isFinite(normal)) {
  // Seen from the street (looking along -normal), "right" is the normal rotated +90 deg clockwise... i.e. bearing normal-90.
  const r = (normal - 90) * Math.PI / 180;
  t = { ...t, x: t.x + offset * Math.sin(r), y: t.y + offset * Math.cos(r) };
}
if (process.argv.includes('--list')) {
  // Every panorama within 40 m: id, date, distance and bearing camera -> target (pick one facing the wall).
  for (const p of await listPanos(t, 40)) {
    const c = lngLatToRd([p.geometry.coordinates[0], p.geometry.coordinates[1]]);
    console.log(p.pano_id, String(p.timestamp).slice(0, 10), Math.hypot(t.x - c.x, t.y - c.y).toFixed(1), ((Math.atan2(t.x - c.x, t.y - c.y) * 180 / Math.PI + 360) % 360).toFixed(0));
  }
  process.exit(0);
}
if (!panoId || !out) throw new Error('--pano= and --out= required');
const rec = (await listPanos(t, 60)).find((p: any) => p.pano_id === panoId || String(p.pano_id).endsWith(panoId));
if (!rec) throw new Error(`pano ${panoId} not within 60 m`);
const loaded = await loadPano({ panoId: rec.pano_id, record: rec } as PanoPick);
if (!loaded) throw new Error('no equirectangular');
const { img } = loaded;
const rd = lngLatToRd([rec.geometry.coordinates[0], rec.geometry.coordinates[1]]);
const lens = lensFor(rec, undefined) ?? lensFor(rec, 0.4)!;
let camZ = lens.pose.z, ground = camZ - 2.44;
if (ground < -2.5 || ground > 3) { ground = 0.4; camZ = ground + 2.44; }
const dx = t.x - rd.x, dy = t.y - rd.y, distM = Math.hypot(dx, dy);
const yaw = Math.atan2(dx, dy), pitch = Math.atan2(ground + up - camZ, distM);
const tanH = Math.tan(fovDeg * Math.PI / 360);
const W = Math.round(upscale * 2 * tanH * img.width / (2 * Math.PI)), H = Math.round(W * aspect), f = W / 2 / tanH;
const fw = [Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch)];
const rt = [Math.cos(yaw), -Math.sin(yaw), 0];
const upv = [rt[1] * fw[2] - rt[2] * fw[1], rt[2] * fw[0] - rt[0] * fw[2], rt[0] * fw[1] - rt[1] * fw[0]];
const rgb = Buffer.alloc(W * H * 3), sw = img.width, sh = img.height, src = img.data;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const u = (x + 0.5 - W / 2) / f, v = (H / 2 - y - 0.5) / f;
  const d0 = fw[0] + u * rt[0] + v * upv[0], d1 = fw[1] + u * rt[1] + v * upv[1], d2 = fw[2] + u * rt[2] + v * upv[2];
  const az = Math.atan2(d0, d1), el = Math.atan2(d2, Math.hypot(d0, d1));
  const px = ((az / (2 * Math.PI) + 0.5) % 1 + 1) % 1 * sw - 0.5;
  const py = Math.max(0, Math.min(sh - 1.001, (0.5 - el / Math.PI) * sh - 0.5));
  const x0 = Math.floor(px), y0 = Math.floor(py), ax = px - x0, ay = py - y0;
  const xa = ((x0 % sw) + sw) % sw, xb = (xa + 1) % sw;
  for (let c = 0; c < 3; c++) {
    const p00 = src[(y0 * sw + xa) * 4 + c], p10 = src[(y0 * sw + xb) * 4 + c], p01 = src[((y0 + 1) * sw + xa) * 4 + c], p11 = src[((y0 + 1) * sw + xb) * 4 + c];
    rgb[(y * W + x) * 3 + c] = Math.round((p00 * (1 - ax) + p10 * ax) * (1 - ay) + (p01 * (1 - ax) + p11 * ax) * ay);
  }
}
await fs.mkdir(path.dirname(out), { recursive: true });
await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 93 }).toFile(out);
const meta = { panoId: rec.pano_id, timestamp: rec.timestamp, distM: +distM.toFixed(2), bearingDeg: +((yaw * 180 / Math.PI + 360) % 360).toFixed(1),
  pitchDeg: +(pitch * 180 / Math.PI).toFixed(2), fovDeg, size: [W, H], mPerPx: +(distM * 2 * tanH / W).toFixed(4), licence: 'CC BY 4.0, Gemeente Amsterdam', source: rec._links?.equirectangular_full?.href };
await fs.writeFile(out.replace(/\.jpg$/, '.json'), JSON.stringify(meta, null, 1) + '\n');
console.log(JSON.stringify(meta));
