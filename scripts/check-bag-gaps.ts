/**
 * Gate: register pands that stand but that the city tiles did not draw (bagGaps.ts).
 * Offline: reads the committed survey (scripts/data/bag-gaps/bag-gaps.json), its fills
 * (scripts/data/bag-gaps/bag-gaps-supplement.geojson) and the published tiles.
 *
 * Fails when
 *   - a named regression is not in the survey as a filled hole with a plausible height
 *     (the survey was regenerated without it, or AHN/BAG changed under it), or
 *   - a fill is missing from building-tiles or bag-tiles (run publish-bag-gaps.ts --write).
 *
 * Named regressions:
 *   Prinsengracht 221-227, NL.IMBAG.Pand.0363100012169308 (1939, 53 dwellings): absent from
 *   3DBAG v20250903, so the game drew an empty paved lot between the Prinsengracht 211-217
 *   warehouses and the Leliegracht corner (user report 2026-10-16, seen across the canal from
 *   the Jordaan quay with De Rode Hoed as destination).
 *
 * Usage: node --import tsx scripts/check-bag-gaps.ts [--root=<dir with building-tiles/ and bag-tiles/>]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { tileFor, tileKey } from '../src/canalRecall/slippyTiles';
import type { SupplementFeature } from '../src/canalRecall/bagGaps';

const ROOT = path.resolve(import.meta.dirname, '..');
const extract = path.join(ROOT, 'public/data/extracts/amsterdam');
const root = path.resolve(process.argv.find(a => a.startsWith('--root='))?.slice(7) ?? extract);
const NAMED: { id: string; place: string; minHeight: number; maxHeight: number }[] = [
  { id: 'NL.IMBAG.Pand.0363100012169308', place: 'Prinsengracht 221-227 (empty lot, 2026-10-16)', minHeight: 12, maxHeight: 20 },
];
const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/data/bag-gaps/bag-gaps.json'), 'utf8')) as { holes: number; filled: number; holeList: { id: string }[] };
const fills = (JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/data/bag-gaps/bag-gaps-supplement.geojson'), 'utf8')) as { features: SupplementFeature[] }).features;
const fillById = new Map(fills.map(f => [f.properties.id, f]));
const problems: string[] = [];
for (const n of NAMED) {
  const f = fillById.get(n.id);
  if (!report.holeList.some(h => h.id === n.id)) problems.push(`${n.place}: ${n.id} is not in the survey's holes`);
  if (!f) problems.push(`${n.place}: ${n.id} has no fill`);
  else if (f.properties.height < n.minHeight || f.properties.height > n.maxHeight) problems.push(`${n.place}: fill height ${f.properties.height} m outside ${n.minHeight}-${n.maxHeight} m`);
}
const tileCache = new Map<string, Set<string>>();
const idsIn = (dir: string, key: string): Set<string> => {
  const k = `${dir}/${key}`;
  let ids = tileCache.get(k);
  if (!ids) {
    const file = [path.join(root, dir, `${key}.geojson.gz`), path.join(extract, dir, `${key}.geojson.gz`)].find(fs.existsSync);
    ids = new Set(file ? (JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString()).features as { properties: { id?: string } }[]).map(f => String(f.properties.id ?? '')) : []);
    tileCache.set(k, ids);
  }
  return ids;
};
const missing: Record<string, string[]> = { 'building-tiles': [], 'bag-tiles': [] };
for (const f of fills) {
  const r = (f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]) as number[][];
  const c = r.reduce((a, p) => [a[0] + p[0] / r.length, a[1] + p[1] / r.length], [0, 0]);
  const key = tileKey(tileFor(c[0], c[1], 14));
  for (const dir of Object.keys(missing)) if (!idsIn(dir, key).has(f.properties.id)) missing[dir].push(f.properties.id);
}
for (const [dir, ids] of Object.entries(missing)) if (ids.length) problems.push(`${ids.length}/${fills.length} fills not in ${dir} (${ids.slice(0, 4).join(', ')}${ids.length > 4 ? ', ...' : ''}): run \`node --import tsx scripts/publish-bag-gaps.ts --write\``);
console.log(`bag-gaps: survey ${report.holes} holes, ${fills.length} fills; named ${NAMED.length}; ${problems.length} problems`);
for (const p of problems) console.log(`  FAIL ${p}`);
process.exit(problems.length ? 1 : 0);
