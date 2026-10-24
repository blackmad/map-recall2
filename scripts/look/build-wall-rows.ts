/**
 * Row seeds for the measured period walls (look/wallRows.ts, look/measuredWalls.ts), stamped into the building-facts
 * tiles as `rows: [[<row seed>, <index into Object.keys(buildings)>, ...], ...]` next to `buildings` (decodeWallRows).
 *
 *   node --import tsx scripts/look/build-wall-rows.ts [--publish]
 *
 * Reads every building-tiles z14 feature (outer ring) and the year the runtime stamps from building-facts; writes the
 * stamped tiles to public/data/extracts/amsterdam/staging/building-facts-rows/ and reports coverage, row sizes, year
 * spans and the byte cost; --publish copies them over building-facts/ (the tiles' other keys are kept as they are).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { partyWallPairs, rowSeedKey, wallRows } from '../../src/canalRecall/look/wallRows.ts';
const fullId = (short: string) => short.startsWith('P') ? `NL.IMBAG.Pand.${short.slice(1)}` : short;
import { EXTRACT, loadCity } from './cityIndex.ts';

const city = loadCity();
const t0 = Date.now();
const pairs = partyWallPairs(city);
const rows = wallRows(city, pairs);
console.log(`buildings ${city.length}; party-wall pairs ${pairs.length} (${Date.now() - t0} ms); in a row ${rows.size} (${(100 * rows.size / city.length).toFixed(1)} %)`);
// Row sizes and year spans.
const members = new Map<string, string[]>();
for (const [id, seed] of rows) (members.get(seed) ?? members.set(seed, []).get(seed)!).push(id);
const byId = new Map(city.map(b => [b.id, b]));
const sizes = [...members.values()].map(m => m.length).sort((a, b) => a - b);
const spans = [...members.values()].map(m => { const ys = m.map(id => byId.get(id)!.year!); return Math.max(...ys) - Math.min(...ys); }).sort((a, b) => a - b);
const pct = (v: number[], p: number) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
console.log(`rows ${members.size}: size p50 ${pct(sizes, 0.5)} p90 ${pct(sizes, 0.9)} p99 ${pct(sizes, 0.99)} max ${sizes[sizes.length - 1]}; year span p50 ${pct(spans, 0.5)} p90 ${pct(spans, 0.9)} max ${spans[spans.length - 1]}`);
const dated = city.filter(b => b.year !== null).length;
console.log(`dated buildings ${dated}; dated in a row ${[...rows.keys()].filter(id => byId.get(id)!.year !== null).length}`);

const factRoot = path.join(EXTRACT, 'building-facts/14'), staging = path.join(EXTRACT, 'staging/building-facts-rows/14');
let before = 0, after = 0, stamped = 0;
const seedKeys = new Map<string, string>();
for (const x of fs.readdirSync(factRoot)) for (const f of fs.readdirSync(path.join(factRoot, x))) {
  const file = path.join(factRoot, x, f), bytes = fs.readFileSync(file);
  const tile = JSON.parse((bytes[0] === 0x1f ? zlib.gunzipSync(bytes) : bytes).toString('utf8'));
  // Compact: [seed key, index into Object.keys(tile.buildings), ...] per row present in this tile.
  const keys = Object.keys(tile.buildings ?? {}), groups = new Map<string, number[]>();
  keys.forEach((short, index) => {
    const seed = rows.get(fullId(short));
    if (!seed) return;
    const key = seedKeys.get(seed) ?? seedKeys.set(seed, rowSeedKey(seed)).get(seed)!;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(index);
  });
  const out = [...groups].map(([key, idx]) => [key, ...idx]);
  const { rows: _old, ...rest } = tile;
  const next = out.length ? { ...rest, rows: out } : rest;
  stamped += out.reduce((n, r) => n + r.length - 1, 0);
  const gz = zlib.gzipSync(JSON.stringify(next), { level: 9 });
  before += bytes.length; after += gz.length;
  fs.mkdirSync(path.join(staging, x), { recursive: true });
  fs.writeFileSync(path.join(staging, x, f), gz);
}
console.log(`facts tiles stamped: ${stamped} row entries; bytes ${(before / 1e6).toFixed(2)} MB -> ${(after / 1e6).toFixed(2)} MB`);
if (process.argv.includes('--publish')) {
  for (const x of fs.readdirSync(staging)) for (const f of fs.readdirSync(path.join(staging, x))) fs.copyFileSync(path.join(staging, x, f), path.join(factRoot, x, f));
  console.log('published -> building-facts/');
}
