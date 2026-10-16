/**
 * Append the staged register-gap fills (scripts/data/bag-gaps/bag-gaps-supplement.geojson, from
 * survey-bag-gaps.ts --heights) to the z14 city tiles: building-tiles (drawing keys
 * only) and bag-tiles (with year/eaves/ridge). Idempotent and disjoint
 * (bagGaps.ts appendSupplement): an id already present, or a footprint already
 * >= 50% drawn, is skipped, so a later 3DBAG release that reconstructs the pand wins.
 * Re-run after any full tile rebuild (build-lod1-city.ts drops these pands; see bagGaps.ts).
 *
 * Usage: node --import tsx scripts/publish-bag-gaps.ts [--write] [--root=<dir holding building-tiles/ and bag-tiles/>]
 *   dry run by default; --root writes a copy elsewhere (default: public/data/extracts/amsterdam).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { tileFor, tileKey } from '../src/canalRecall/slippyTiles';
import { appendSupplement, forBuildingTiles, type SupplementFeature } from '../src/canalRecall/bagGaps';
import type { LngLat, Ring } from '../src/canalRecall/landmarks/osmUnderModels';

const ROOT = path.resolve(import.meta.dirname, '..');
const flag = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const write = process.argv.includes('--write');
const extract = path.join(ROOT, 'public/data/extracts/amsterdam');
const outRoot = path.resolve(flag('root') ?? extract);
const supplementFile = path.join(ROOT, 'scripts/data/bag-gaps/bag-gaps-supplement.geojson');
const supplement = (JSON.parse(fs.readFileSync(supplementFile, 'utf8')) as { features: SupplementFeature[] }).features;
const ringsOf = (g: unknown): Ring[] => {
  const geom = g as { type: string; coordinates: unknown } | null;
  return !geom ? [] : geom.type === 'Polygon' ? [(geom.coordinates as LngLat[][])[0]] : geom.type === 'MultiPolygon' ? (geom.coordinates as LngLat[][][]).map(p => p[0]) : [];
};
const byTile = new Map<string, SupplementFeature[]>();
for (const f of supplement) {
  const r = ringsOf(f.geometry)[0], c = r.reduce((a, p) => [a[0] + p[0] / r.length, a[1] + p[1] / r.length], [0, 0]);
  const key = tileKey(tileFor(c[0], c[1], 14));
  byTile.set(key, [...(byTile.get(key) ?? []), f]);
}
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const summary: Record<string, { added: number; skipped: number; tiles: number }> = {};
for (const dir of ['building-tiles', 'bag-tiles'] as const) {
  const srcIndex = path.join(extract, dir, 'index-z14.json');
  const index = JSON.parse(fs.readFileSync(srcIndex, 'utf8')) as { features: number; tileList: string[]; tiles: number; totalBytes?: number; totalGzipBytes?: number; bagGapSupplement?: unknown };
  let added = 0, skipped = 0;
  const changed: { tile: string; before: string; after: string; added: string[] }[] = [];
  for (const [key, adds] of byTile) {
    const src = path.join(extract, dir, `${key}.geojson.gz`);
    const raw = fs.existsSync(src) ? fs.readFileSync(src) : null;
    const fc = raw ? JSON.parse(zlib.gunzipSync(raw).toString()) : { type: 'FeatureCollection', features: [] };
    const res = appendSupplement(fc.features, dir === 'building-tiles' ? adds.map(forBuildingTiles) : adds, ringsOf);
    added += res.added.length; skipped += res.skipped.length;
    if (!res.added.length) continue;
    const gz = zlib.gzipSync(`${JSON.stringify({ ...fc, features: res.features })}\n`);
    changed.push({ tile: key, before: raw ? sha(raw) : '', after: sha(gz), added: res.added });
    if (write) { const out = path.join(outRoot, dir, `${key}.geojson.gz`); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, gz); }
    if (!index.tileList.includes(key)) index.tileList.push(key);
  }
  summary[dir] = { added, skipped, tiles: changed.length };
  if (write && changed.length) {
    index.features += added; index.tileList.sort(); index.tiles = index.tileList.length;
    if (index.totalBytes !== undefined) {
      let total = 0, gzip = 0;
      for (const key of index.tileList) { const p = [path.join(outRoot, dir, `${key}.geojson.gz`), path.join(extract, dir, `${key}.geojson.gz`)].find(fs.existsSync)!; const b = fs.readFileSync(p); gzip += b.length; total += zlib.gunzipSync(b).length; }
      index.totalBytes = total; index.totalGzipBytes = gzip;
    }
    const prior = (index.bagGapSupplement as { features?: number } | undefined)?.features ?? 0;
    index.bagGapSupplement = { version: 'bag-gaps-v1', source: 'scripts/data/bag-gaps/bag-gaps-supplement.geojson (BAG WFS footprint, AHN dsm/dtm 05m height)', features: prior + added };
    fs.mkdirSync(path.join(outRoot, dir), { recursive: true });
    fs.writeFileSync(path.join(outRoot, dir, 'index-z14.json'), `${JSON.stringify(index, null, 2)}\n`);
  }
  if (process.argv.includes('--verbose')) for (const c of changed) console.log(dir, c.tile, c.added.length, c.before.slice(0, 12), '->', c.after.slice(0, 12));
}
console.log(JSON.stringify({ mode: write ? 'write' : 'dry-run', root: path.relative(ROOT, outRoot) || '.', supplement: supplement.length, ...summary }));
