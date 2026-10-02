/**
 * Storefront candidates: the notable businesses worth a hand-made storefront, with the
 * building (pand) their pin sits in.
 *
 *   npx tsx scripts/storefronts/candidates.ts [--limit=400] > tmp/storefronts/candidates.tsv
 *
 * Order: the businesses the game labels on the map, by orientation score, then chains.
 * Skips businesses that already have a front (landmarkFrontData.ts) and pins in no building.
 * Columns: slug, name, kind, lng, lat, pand.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import { FRONT_LIST } from '../../src/canalRecall/landmarkFrontData.ts';
import { KIT_PART_IDS, KITS } from '../../src/canalRecall/landmarkKits.ts';

const limit = Number(process.argv.find(a => a.startsWith('--limit='))?.slice(8) ?? 400);
const labelled = (JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/branded-pois.json', 'utf8')) as any[])
  .filter(p => p.kind === 'local-food').sort((a, b) => b.orientationScore - a.orientationScore);
// Already modelled: fronts, and every part of a landmark kit (a restaurant inside the Rijksmuseum).
const done = new Set([...FRONT_LIST.flatMap(f => f.ids), ...KIT_PART_IDS, ...KITS.flatMap(k => k.body ?? [])]);
const tileCache = new Map<string, any[]>();
const tileOf = (lng: number, lat: number) => { const n = 2 ** 14, r = lat * Math.PI / 180; return `${Math.floor(((lng + 180) / 360) * n)}/${Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)}`; };
function pandAt(lng: number, lat: number): string | null {
  const key = tileOf(lng, lat), file = `public/data/extracts/amsterdam/building-tiles/14/${key}.geojson.gz`;
  if (!tileCache.has(key)) tileCache.set(key, fs.existsSync(file) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString()).features : []);
  for (const f of tileCache.get(key)!) {
    if (Number(f.properties.minHeight) > 2) continue;
    const g = f.geometry, ring = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0];
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside; }
    if (inside) return String(f.properties.id);
  }
  return null;
}
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const seen = new Set<string>(), out: string[] = [];
for (const p of labelled) {
  if (out.length >= limit) break;
  const [lat, lng] = p.center, pand = pandAt(lng, lat);
  if (!pand || done.has(pand) || seen.has(pand)) continue;
  seen.add(pand);
  out.push([`${slug(p.name)}-${pand.slice(-5)}`, p.name, p.amenity ?? p.shop ?? '', lng, lat, pand].join('\t'));
}
console.log(out.join('\n'));
console.error(`${out.length} candidates`);
