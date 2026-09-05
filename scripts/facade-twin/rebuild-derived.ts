/**
 * Rebuild derived records from the cached raw responses, offline.
 *
 * The cache holds two different kinds of thing and they have very different
 * value. Raw source responses — 3DBAG attributes, BAG footprints, panorama
 * metadata and the 7 GB of panorama JPEGs — are slow to obtain, rate-limited,
 * served by other people's infrastructure, and in the imagery's case a moving
 * target: a mission is re-flown and the old frames go. Derived records are
 * cheap arithmetic over those bytes.
 *
 * So a mapping bug must never cost a re-download. `b3_h_nok` was read as a
 * ridge height when it is not one, which put the ridge below the eaves on 198
 * of 2,892 buildings, and the fix landed in a pure function over attributes
 * this project already had on disk. This script applies such a fix without a
 * single request.
 *
 * It never deletes. The previous derived file is kept beside the new one with
 * its retrieval timestamp, so a measurement made against the old numbers can
 * still be explained.
 *
 * Usage: npx tsx scripts/facade-twin/rebuild-derived.ts [--area=…] [--dry-run]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST as DEFAULT_AREA } from '../../src/canalRecall/facade/areas.ts';
import { massingFromAttributes } from '../../src/canalRecall/facade/sources/netherlands.ts';

const CACHE = path.resolve('.cache/facade-twin');
const arg = (n: string) => process.argv.find(v => v.startsWith(`--${n}=`))?.slice(n.length + 3);
const areaId = arg('area') ?? DEFAULT_AREA.areaId;
const dryRun = process.argv.includes('--dry-run');

const rawFile = path.join(CACHE, '3dbag-attributes.json');
const derivedFile = path.join(CACHE, `${areaId}-massing.json`);
if (!existsSync(rawFile)) throw new Error(`no cached 3DBAG attributes at ${rawFile}`);
if (!existsSync(derivedFile)) throw new Error(`no derived massing at ${derivedFile}`);

const raw = JSON.parse(await readFile(rawFile, 'utf8'));
const previous = JSON.parse(await readFile(derivedFile, 'utf8'));
const before: any[] = previous.data;

const rebuilt = massingFromAttributes(raw.attributes);
// The cached derived file is scoped to the area; the raw attributes are not.
const wanted = new Set(before.map(r => r.buildingId));
const next = rebuilt.filter(r => wanted.has(r.buildingId));

const byId = new Map(before.map(r => [r.buildingId, r]));
const changes: Array<{ id: string; field: string; from: number | null; to: number | null }> = [];
for (const record of next) {
  const old = byId.get(record.buildingId);
  if (!old) continue;
  for (const field of ['groundLevel', 'eavesHeight', 'ridgeHeight'] as const) {
    const a = old[field], b = (record as any)[field];
    if (a === b) continue;
    if (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 0.005) continue;
    changes.push({ id: record.buildingId, field, from: a, to: b });
  }
}
const inverted = (rs: any[]) => rs.filter(r =>
  Number.isFinite(r.ridgeHeight) && Number.isFinite(r.eavesHeight) && r.ridgeHeight < r.eavesHeight).length;

console.log(`${areaId}: ${before.length} cached records, ${next.length} rebuilt from ${Object.keys(raw.attributes).length} raw attributes`);
console.log(`  raw retrieved ${raw.retrieved ?? 'unknown'}, derived ${previous.retrieved ?? 'unknown'}`);
console.log(`  ridge below its own eaves: ${inverted(before)} → ${inverted(next)}`);
console.log(`  height fields changed: ${changes.length}`);
for (const field of ['groundLevel', 'eavesHeight', 'ridgeHeight']) {
  const these = changes.filter(c => c.field === field);
  if (!these.length) continue;
  const deltas = these.map(c => (c.to ?? 0) - (c.from ?? 0)).sort((a, b) => a - b);
  const q = (p: number) => deltas[Math.floor(p * (deltas.length - 1))];
  console.log(`    ${field.padEnd(13)} ${String(these.length).padStart(5)}  median ${q(0.5).toFixed(2)} m  p05 ${q(0.05).toFixed(2)}  p95 ${q(0.95).toFixed(2)}`);
}

if (dryRun) { console.log('\n--dry-run: nothing written'); process.exit(0); }

// Keep the superseded file rather than overwrite it.
const stamp = (previous.retrieved ?? new Date().toISOString()).replace(/[:.]/g, '-').slice(0, 19);
const kept = path.join(CACHE, `${areaId}-massing.superseded-${stamp}.json`);
if (!existsSync(kept)) await writeFile(kept, JSON.stringify(previous));
await writeFile(derivedFile, JSON.stringify({
  retrieved: previous.retrieved,
  rederivedAt: new Date().toISOString(),
  rederivedFrom: '3dbag-attributes.json',
  rederivedBy: 'scripts/facade-twin/rebuild-derived.ts',
  note: 'Derived records recomputed offline from the cached raw 3DBAG attributes. '
    + `The records this replaced are kept at ${path.basename(kept)}.`,
  data: next,
}));
console.log(`\nrewrote ${path.relative(process.cwd(), derivedFile)}`);
console.log(`kept    ${path.relative(process.cwd(), kept)}`);
console.log(`Now re-run: npx tsx scripts/facade-twin/recon.ts --area=${areaId}   (offline; it reads this cache)`);
