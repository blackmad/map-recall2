// Orthophoto crops with the BGT plaza pieces drawn over them, for the coverage report and the review of the rule
// (lane bgt-plazas-20261110).
//
//   npx tsx scripts/routing/bgt-plaza-crops.ts --at 52.38597,4.83250 --radius 60 --out /tmp/asc.jpg [--title "ASC SDW"]
//
// Ortho: PDOK Luchtfoto RGB (Beeldmateriaal Nederland, CC BY 4.0), layer Actueel_orthoHR, via WMS. Green: connected
// plaza pieces (the published extract). Orange: pieces above the area floor that no corridor reaches (not published).
// Blue: routing corridors at their playable half-width. Red: BGT walls and fences that cut plazas. Cross: --at.
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { loadRoutingFeatures } from '../lib/routingFeatures.ts';
import { readScheidingCell } from './fetch-bgt-barriers.ts';
import { PLAZA_CUTTING_SCHEIDING } from '../../src/canalRecall/routing/bgtPlazas.ts';
import { readdirSync } from 'node:fs';

const STAGING = 'public/data/extracts/amsterdam/staging/bgt-plazas-v1';
const HALF_PX: Record<string, number> = {
  primary: 30, secondary: 26, tertiary: 21, residential: 18, unclassified: 17, living_street: 16, service: 13, busway: 18,
  cycleway: 9, pedestrian: 14, footway: 7, path: 8,
};

export interface CropOptions { at: [number, number]; radius: number; out: string; title?: string; metresPerPixel?: number }

let piecesCache: Array<{ polygons: [number, number][][][]; connected: boolean }> | null = null;
let routingCache: Array<{ highway?: string; path?: [number, number][]; paths?: [number, number][][] }> | null = null;

export async function crop({ at, radius, out, title, metresPerPixel = 0.2 }: CropOptions): Promise<void> {
  const [lat, lon] = at;
  const ky = 111_320, kx = 111_320 * Math.cos(lat * Math.PI / 180);
  const dLat = radius / ky, dLon = radius / kx;
  const size = Math.round(2 * radius / metresPerPixel);
  const url = `https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0?service=WMS&version=1.3.0&request=GetMap&layers=Actueel_orthoHR&styles=&crs=EPSG:4326&bbox=${lat - dLat},${lon - dLon},${lat + dLat},${lon + dLon}&width=${size}&height=${size}&format=image/jpeg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ortho ${res.status}`);
  const ortho = Buffer.from(await res.arrayBuffer());
  const px = (la: number, lo: number) => [((lo - (lon - dLon)) / (2 * dLon)) * size, ((lat + dLat - la) / (2 * dLat)) * size];
  const inView = (la: number, lo: number) => Math.abs(la - lat) < dLat * 1.5 && Math.abs(lo - lon) < dLon * 1.5;
  piecesCache ??= JSON.parse(readFileSync(`${STAGING}/pieces-all.json`, 'utf8'));
  routingCache ??= await loadRoutingFeatures();
  const parts: string[] = [];
  for (const f of routingCache!) {
    const half = (HALF_PX[f.highway ?? 'residential'] ?? 32) / 3;
    for (const p of f.paths ?? (f.path ? [f.path] : [])) {
      if (!p.some(([la, lo]) => inView(la, lo))) continue;
      if (p.length > 3 && p[0][0] === p.at(-1)![0] && p[0][1] === p.at(-1)![1]) continue;
      parts.push(`<polyline points="${p.map(([la, lo]) => px(la, lo).map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#1e6fff" stroke-opacity="0.35" stroke-width="${(2 * half / metresPerPixel).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
  }
  for (const piece of piecesCache!) {
    if (!piece.polygons.some(poly => poly[0].some(([la, lo]) => inView(la, lo)))) continue;
    const colour = piece.connected ? '#22dd44' : '#ff9900';
    for (const poly of piece.polygons) {
      const d = poly.map(ring => 'M' + ring.map(([la, lo]) => px(la, lo).map(v => v.toFixed(1)).join(',')).join('L') + 'Z').join(' ');
      parts.push(`<path d="${d}" fill="${colour}" fill-opacity="0.25" fill-rule="evenodd" stroke="${colour}" stroke-width="2"/>`);
    }
  }
  for (const file of readdirSync('artifacts/own-ground/raw/bgt-roads/scheiding')) {
    const cell = readScheidingCell(file.replace('.json.gz', ''));
    if (!cell) continue;
    const [x0, y0, x1, y1] = cell.bbox;
    if (lon + dLon < x0 || lon - dLon > x1 || lat + dLat < y0 || lat - dLat > y1) continue;
    for (const f of cell.features) {
      if (f.h !== 0 || !PLAZA_CUTTING_SCHEIDING.has(f.type)) continue;
      for (const line of f.lines) {
        if (!line.some(([lo, la]) => inView(la, lo))) continue;
        parts.push(`<polyline points="${line.map(([lo, la]) => px(la, lo).map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#ff2020" stroke-width="2"/>`);
      }
    }
  }
  const [cx, cy] = px(lat, lon);
  parts.push(`<path d="M${cx - 12},${cy}L${cx + 12},${cy}M${cx},${cy - 12}L${cx},${cy + 12}" stroke="#ff00ff" stroke-width="3"/>`);
  if (title) parts.push(`<rect x="0" y="0" width="${size}" height="30" fill="#000" fill-opacity="0.6"/><text x="8" y="21" font-family="Helvetica" font-size="17" fill="#fff">${title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${parts.join('')}</svg>`;
  const image = await sharp(ortho).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg({ quality: 82 }).toBuffer();
  writeFileSync(out, image);
}

async function main() {
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const at = arg('--at')!.split(',').map(Number) as [number, number];
  await crop({ at, radius: Number(arg('--radius') ?? 60), out: arg('--out')!, title: arg('--title') });
}

if (process.argv[1]?.endsWith('bgt-plaza-crops.ts')) main().catch(e => { console.error(e); process.exit(1); });
