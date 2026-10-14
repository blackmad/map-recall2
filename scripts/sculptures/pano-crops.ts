/**
 * Perspective crops aimed at a statue from every municipal panorama near it (multi-view input for
 * reconstruction trials, docs/multiview-reconstruction-survey-20261014.md).
 *
 * Panoramas: Gemeente Amsterdam equirectangular panoramas, CC BY 4.0, world-aligned (north at the
 * centre column, AMSTERDAM_WORLD_ALIGNED), fetched through the shared pand-reference disk cache.
 * The camera is taken as 2.44 m above the ground at the statue (the published heights are not
 * reliable, see scripts/pand-reference/rectify.ts).
 *
 *   node --experimental-strip-types scripts/sculptures/pano-crops.ts --id=de-dokwerker \
 *     --lng=4.9050146 --lat=52.3671957 --height=4.13 --radius=40 --out=artifacts/sculpture-reconstruction/de-dokwerker/pano
 *
 * Writes, per panorama, `<pano>-fov50.jpg` (50° pinhole, 1024 px, as the brief) and `<pano>-tight.jpg`
 * (a crop whose vertical field is 2.2x the statue's angular height, 768 px), plus `views.json`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import sharp from 'sharp';
import { cachedBytes, cachedJson } from '../pand-reference/core.ts';

const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const id = arg('id')!, lng0 = Number(arg('lng')), lat0 = Number(arg('lat'));
const heightM = Number(arg('height', '3')), radius = Number(arg('radius', '25')), out = arg('out')!;
const maxPerYear = Number(arg('per-year', '4'));
const CAM_H = 2.44;

type Pano = { pano_id: string; timestamp: string; geometry: { coordinates: number[] }; _links: Record<string, { href: string }> };

function enu(lng: number, lat: number) {
  return { x: (lng - lng0) * 111320 * Math.cos(lat0 * Math.PI / 180), y: (lat - lat0) * 110540 };
}

/** Pinhole render: forward = bearing/elevation towards target, square output. */
function pinhole(img: { width: number; height: number; data: Uint8Array }, bearingDeg: number, elevDeg: number, fovDeg: number, size: number) {
  const outBuf = Buffer.alloc(size * size * 3);
  const b = bearingDeg * Math.PI / 180, e = elevDeg * Math.PI / 180;
  const fwd = [Math.sin(b) * Math.cos(e), Math.cos(b) * Math.cos(e), Math.sin(e)];
  const right = [Math.cos(b), -Math.sin(b), 0];
  const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]]; // right x fwd
  const f = (size / 2) / Math.tan(fovDeg * Math.PI / 360);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const px = (i + 0.5 - size / 2) / f, py = -(j + 0.5 - size / 2) / f;
    const d = [fwd[0] + px * right[0] + py * up[0], fwd[1] + px * right[1] + py * up[1], fwd[2] + px * right[2] + py * up[2]];
    const len = Math.hypot(d[0], d[1], d[2]);
    const az = Math.atan2(d[0], d[1]), el = Math.asin(d[2] / len);
    const u = (((az / (2 * Math.PI) + 0.5) % 1 + 1) % 1) * img.width, v = (0.5 - el / Math.PI) * img.height;
    const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
    const xa = ((x0 % img.width) + img.width) % img.width, xb = (xa + 1) % img.width;
    const ya = Math.max(0, Math.min(img.height - 1, y0)), yb = Math.max(0, Math.min(img.height - 1, y0 + 1));
    for (let c = 0; c < 3; c++) {
      const p = (yy: number, xx: number) => img.data[(yy * img.width + xx) * 4 + c];
      outBuf[(j * size + i) * 3 + c] = p(ya, xa) * (1 - fx) * (1 - fy) + p(ya, xb) * fx * (1 - fy) + p(yb, xa) * (1 - fx) * fy + p(yb, xb) * fx * fy;
    }
  }
  return { f, buf: outBuf };
}

const list = await cachedJson<any>(`https://api.data.amsterdam.nl/panorama/panoramas/?near=${lng0.toFixed(7)},${lat0.toFixed(7)}&radius=${radius}&srid=4326&page_size=500`);
const panos: Pano[] = list._embedded?.panoramas ?? [];
const withD = panos.map(p => { const q = enu(p.geometry.coordinates[0], p.geometry.coordinates[1]); return { p, q, d: Math.hypot(q.x, q.y) }; })
  .sort((a, b) => a.d - b.d);
// Nearest few per capture year: consecutive 5 m frames of one drive are near-duplicates.
const perYear = new Map<string, number>();
const picked = withD.filter(r => { const y = r.p.timestamp.slice(0, 4); const n = perYear.get(y) ?? 0; if (n >= maxPerYear) return false; perYear.set(y, n + 1); return true; });
await fs.mkdir(out, { recursive: true });
const views: any[] = [];
for (const r of picked) {
  const href = r.p._links.equirectangular_full?.href;
  if (!href) continue;
  const d = jpeg.decode(await cachedBytes(href, '.jpg'), { useTArray: true, maxMemoryUsageInMB: 2048 });
  const img = { width: d.width, height: d.height, data: d.data as Uint8Array };
  const bearing = (Math.atan2(-r.q.x, -r.q.y) * 180 / Math.PI + 360) % 360; // camera -> statue
  const elev = Math.atan2(heightM / 2 - CAM_H, r.d) * 180 / Math.PI;
  const angH = (Math.atan2(heightM - CAM_H, r.d) - Math.atan2(-CAM_H, r.d)) * 180 / Math.PI;
  const tightFov = Math.max(8, angH * 2.2);
  const base = r.p.pano_id;
  for (const [suffix, fov, size] of [['fov50', 50, 1024], ['tight', tightFov, 768]] as const) {
    const { f, buf } = pinhole(img, bearing, elev, fov, size);
    await sharp(buf, { raw: { width: size, height: size, channels: 3 } }).jpeg({ quality: 92 }).toFile(path.join(out, `${base}-${suffix}.jpg`));
    views.push({ file: `${base}-${suffix}.jpg`, panoId: base, date: r.p.timestamp, distanceM: +r.d.toFixed(2), camEnuM: [+r.q.x.toFixed(2), +r.q.y.toFixed(2), CAM_H],
      bearingDeg: +bearing.toFixed(2), azimuthFromStatueDeg: +((bearing + 180) % 360).toFixed(1), elevDeg: +elev.toFixed(2), fovDeg: +fov.toFixed(2), focalPx: +f.toFixed(1), size,
      statuePx: +(angH / fov * size).toFixed(0), source: href, licence: 'CC BY 4.0 Gemeente Amsterdam' });
  }
  console.log(base, r.p.timestamp.slice(0, 10), r.d.toFixed(1), 'm, bearing', bearing.toFixed(0), 'statue', (angH / 50 * 1024).toFixed(0), 'px @50°');
}
await fs.writeFile(path.join(out, 'views.json'), JSON.stringify({ id, anchor: [lng0, lat0], heightM, radius, cameraHeightAboveGroundM: CAM_H, totalInRadius: panos.length, views }, null, 1));
console.log(`${panos.length} panoramas within ${radius} m, ${picked.length} rendered`);
