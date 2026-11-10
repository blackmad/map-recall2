// Feedback triage evidence: BAG-tile footprints near a point as GeoJSON (for scripts/land-mask/ortho-overlay.py --layer).
//   tsx scripts/feedback/footprints-near.ts <lat> <lon> <radiusM> <out.geojson> [tileSet=bag-tiles]
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const [lat, lon, radius] = process.argv.slice(2, 5).map(Number);
const out = process.argv[5];
const tileSet = process.argv[6] ?? 'bag-tiles';
const dLat = radius / 111320, dLon = radius / (111320 * Math.cos(lat * Math.PI / 180));
const tile = (la: number, lo: number) => {
  const n = 2 ** 14, x = Math.floor((lo + 180) / 360 * n);
  const y = Math.floor((1 - Math.log(Math.tan(la * Math.PI / 180) + 1 / Math.cos(la * Math.PI / 180)) / Math.PI) / 2 * n);
  return [x, y] as const;
};
const [x0, y1] = tile(lat - dLat, lon - dLon), [x1, y0] = tile(lat + dLat, lon + dLon);
const features: unknown[] = [];
for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
  let data: Buffer;
  try { data = gunzipSync(readFileSync(`public/data/extracts/amsterdam/${tileSet}/14/${x}/${y}.geojson.gz`)); } catch { continue; }
  for (const f of JSON.parse(data.toString()).features) {
    const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
    if (ring.some((p: number[]) => Math.abs(p[1] - lat) < dLat && Math.abs(p[0] - lon) < dLon)) features.push(f);
  }
}
writeFileSync(out, JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`${features.length} footprints -> ${out}`);
