// Coverage of the street-furniture extract (lane #170):
//
//   npx tsx scripts/street-furniture/coverage.ts [--dir=public/data/extracts/amsterdam/street-furniture] [--check]
//
// Prints counts per kind/subtype, rejected rows and why, and the gzip bytes of the ride's centre tiles. --check exits 1
// when the index disagrees with its tiles, a record is malformed or outside the city box, a centre tile is missing or
// heavier than 64 KB, or a kind falls under its floor (a broken or partial pull).
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { CITY_BOX, FURNITURE_KINDS, insideBox, tileKeyOf, type FurnitureRecord } from '../../src/canalRecall/streetFurniture/extract.ts';

const arg = (n: string, d: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
/** The ride's centre (Dam, Westerkerk/Prinsengracht, Leidseplein, Pijp): these tiles must exist and stay light. */
export const CENTRE_SPOTS: Record<string, [number, number]> = { Dam: [4.8926, 52.3731], Prinsengracht: [4.8840, 52.3740], Leidseplein: [4.8820, 52.3640], Pijp: [4.8930, 52.3560], Noordermarkt: [4.8872, 52.3796] };
/** Floors per kind (half of the 2026-11-01 pull) and the centre tile byte cap. */
export const FLOORS: Record<string, number> = { container: 6500, lamp: 60000, abri: 550, 'ad-column': 120, 'bike-rack': 50 };
export const CENTRE_TILE_MAX_BYTES = 64 * 1024;

function main(): void {
  const dir = arg('dir', 'public/data/extracts/amsterdam/street-furniture'), check = process.argv.includes('--check');
  const problems: string[] = [];
  if (!existsSync(`${dir}/index.json`)) { console.error(`${dir}/index.json missing`); process.exit(1); }
  const index = JSON.parse(readFileSync(`${dir}/index.json`, 'utf8'));
  const counts: Record<string, Record<string, number>> = {};
  let total = 0;
  const kinds = new Set<string>(FURNITURE_KINDS), ids = new Set<string>();
  for (const t of index.tiles) {
    const tile = JSON.parse(gunzipSync(readFileSync(`${dir}/${t.url}`)).toString());
    if (tile.version !== 1 || tile.key !== t.key) problems.push(`${t.key}: bad tile header`);
    if (tile.items.length !== t.count) problems.push(`${t.key}: index says ${t.count}, tile holds ${tile.items.length}`);
    for (const r of tile.items as FurnitureRecord[]) {
      total++;
      if (!kinds.has(r.kind) || !r.subtype || !Number.isFinite(r.lng) || !Number.isFinite(r.lat)) { problems.push(`${r.id}: malformed`); continue; }
      if (!insideBox(r.lng, r.lat)) problems.push(`${r.id}: outside the city box ${CITY_BOX.join(',')}`);
      if (tileKeyOf(r.lng, r.lat) !== t.key) problems.push(`${r.id}: in tile ${t.key}, belongs to ${tileKeyOf(r.lng, r.lat)}`);
      if (ids.has(r.id)) problems.push(`${r.id}: duplicate`); ids.add(r.id);
      const k = counts[r.kind] ??= {}; k[r.subtype] = (k[r.subtype] ?? 0) + 1;
    }
  }
  if (total !== index.total) problems.push(`index total ${index.total}, tiles hold ${total}`);
  if (JSON.stringify(counts, Object.keys(counts).sort()) !== JSON.stringify(index.counts, Object.keys(counts).sort())) {
    for (const k of Object.keys(counts)) for (const s of Object.keys(counts[k])) if (index.counts?.[k]?.[s] !== counts[k][s]) problems.push(`count ${k}/${s}: index ${index.counts?.[k]?.[s]}, tiles ${counts[k][s]}`);
  }
  for (const [kind, floor] of Object.entries(FLOORS)) { const n = Object.values(counts[kind] ?? {}).reduce((s, v) => s + v, 0); if (n < floor) problems.push(`${kind}: ${n} under the floor ${floor}`); }
  const meta = new Map<string, any>(index.tiles.map((t: any) => [t.key, t]));
  console.log(`street furniture: ${total} records in ${index.tiles.length} tiles, ${(index.tiles.reduce((s: number, t: any) => s + t.bytes, 0) / 1024).toFixed(0)} KB gzip; retrieved ${index.retrievedAt}`);
  for (const [kind, subs] of Object.entries(counts)) console.log(`  ${kind.padEnd(10)} ${String(Object.values(subs).reduce((s, v) => s + v, 0)).padStart(7)}  ${Object.entries(subs).map(([s, n]) => `${s} ${n}`).join(', ')}`);
  console.log('rejected:'); for (const [why, n] of Object.entries(index.rejected ?? {})) console.log(`  ${String(n).padStart(6)}  ${why}`);
  console.log('centre tiles (gzip):');
  for (const [name, [lng, lat]] of Object.entries(CENTRE_SPOTS)) {
    const t = meta.get(tileKeyOf(lng, lat));
    if (!t) { problems.push(`centre tile for ${name} missing`); continue; }
    console.log(`  ${name.padEnd(13)} ${t.key}  ${String(t.count).padStart(5)} records  ${(t.bytes / 1024).toFixed(1)} KB`);
    if (t.bytes > CENTRE_TILE_MAX_BYTES) problems.push(`${name} tile ${t.bytes} B over ${CENTRE_TILE_MAX_BYTES}`);
  }
  if (problems.length) { console.log(`${problems.length} problems:\n  ${problems.slice(0, 30).join('\n  ')}`); if (check) process.exit(1); }
  else console.log('coverage ok');
}
main();
