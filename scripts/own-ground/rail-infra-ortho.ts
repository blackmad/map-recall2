// Rail infrastructure pands on the orthophoto (lane rail-look round 3): PDOK orthophoto around a point with the
// building outlines the rail-infra report judged (red: viaduct, dropped; cyan: canopy source; yellow: canopy pieces
// drawn; white: kept, with the reason in the report), and the rail-v1 tracks and platforms.
//
//   npx tsx scripts/own-ground/rail-infra-ortho.ts <lng> <lat> [halfM=150] [out.png]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import sharp from 'sharp';
import { toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { OrthoTiles } from './ortho.ts';

const [lng, lat, halfArg] = process.argv.slice(2).map(Number);
const half = halfArg || 150, out = process.argv[5] ?? `artifacts/rail-look/r3/infra-${lng}-${lat}.png`, PX = 900, res = (2 * half) / PX;
const [cx, cy] = toLocal(lng, lat), x0 = cx - half, y0 = cy - half;
const report = JSON.parse(readFileSync('artifacts/own-ground/staging/rail-infra/report.json', 'utf8')).report as { id: string; kind: string | null }[];
const table = JSON.parse(readFileSync('artifacts/own-ground/staging/rail-infra/rail-infra-buildings.json', 'utf8'));
const verdict = new Map(report.map(r => [r.id, r.kind ?? 'kept']));
const px = ([x, y]: number[]) => `${((x - x0) / res).toFixed(1)},${((y0 + 2 * half - y) / res).toFixed(1)}`;
const ringPath = (ring: number[][]) => `M${ring.map(([a, b]) => px(toLocal(a, b))).join('L')}Z`;
const paths: string[] = [];
const dir = 'public/data/extracts/amsterdam/building-tiles/14', seen = new Set<string>();
for (const x of readdirSync(dir)) for (const f of readdirSync(join(dir, x))) {
  for (const feat of JSON.parse(gunzipSync(readFileSync(join(dir, x, f))).toString()).features ?? []) {
    const id = String(feat.properties.id), v = verdict.get(id);
    if (!v || seen.has(id)) continue; seen.add(id);
    const polys = feat.geometry.type === 'Polygon' ? [feat.geometry.coordinates] : feat.geometry.coordinates;
    const col = v === 'viaduct' ? '#ff3030' : v === 'canopy' ? '#20e0ff' : '#ffffff';
    for (const poly of polys) paths.push(`<path d="${ringPath(poly[0])}" fill="${col}" fill-opacity="0.18" stroke="${col}" stroke-width="2"/>`);
  }
}
for (const pieces of Object.values(table.canopies) as { ring: number[][] }[][]) for (const p of pieces) paths.push(`<path d="${ringPath(p.ring)}" fill="#ffe000" fill-opacity="0.35" stroke="#ffe000" stroke-width="1.5"/>`);
const o = new OrthoTiles(), crop = await o.crop(x0, y0, PX, PX, res);
const svg = `<svg width="${PX}" height="${PX}" xmlns="http://www.w3.org/2000/svg">${paths.join('')}</svg>`;
await sharp(Buffer.from(crop), { raw: { width: PX, height: PX, channels: 3 } }).composite([{ input: Buffer.from(svg) }]).png().toFile(out);
console.log(JSON.stringify({ out }));
