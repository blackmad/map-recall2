/**
 * Photo walls (buurt generators round 14): the photo reader's assembled reads (scripts/centrum-looks/photo-reads.ts
 * `assemble`, over scripts/buurt-generators/row-cuts.ts cuts) into the district's measured file as `photoWalls`, one per
 * generator row (the cut's pand's series row), the most confident of several reads of one pand (a retry from another
 * capture date). generate.ts wallHexOf uses a read at PHOTO_WALL_MIN, over the pixel samples.
 *
 *   node --import tsx scripts/buurt-generators/photo-walls.ts --district=de-pijp <photo-reads.json...>
 */
import fs from 'node:fs';

const district = process.argv.find(a => a.startsWith('--district='))?.slice(11) ?? 'de-pijp';
const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
const best = new Map<string, { finish: string; family: string; confidence: number }>();
for (const f of files) for (const [pid, r] of Object.entries<{ finish: string; family: string; confidence: number }>(JSON.parse(fs.readFileSync(f, 'utf8')).reads ?? {}))
  if (!best.has(pid) || r.confidence > best.get(pid)!.confidence) best.set(pid, r);
const recs = new Map((JSON.parse(fs.readFileSync(`artifacts/buurt-generators/${district}/row-front.json`, 'utf8')).records as any[]).map(r => [r.pandId, r]));
const out: Record<string, { finish: string; family: string; confidence: number; pandId: string }> = {};
let unplaced = 0;
for (const [pid, r] of best) {
  const row = recs.get(pid)?.series?.id?.split(':')[0];
  if (!row) { unplaced++; continue; }
  if (!out[row] || r.confidence > out[row].confidence) out[row] = { finish: r.finish, family: r.family, confidence: r.confidence, pandId: pid };
}
const file = `src/canalRecall/buurtGenerator/districts/measured/${district}.json`, m = JSON.parse(fs.readFileSync(file, 'utf8'));
m.photoWalls = Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
m.photoWallSource = 'opus colour-family reads (scripts/centrum-looks/photo-reader-prompt.md) of one rectified panorama cut per row (scripts/buurt-generators/row-cuts.ts; data.amsterdam.nl panoramas, CC BY 4.0)';
fs.writeFileSync(file, JSON.stringify(m, null, 2) + '\n');
const conf = Object.values(out).filter(r => r.confidence >= 0.7), tally: Record<string, number> = {};
for (const r of conf) tally[r.family] = (tally[r.family] ?? 0) + 1;
console.log(`${district}: ${Object.keys(out).length} rows read, ${conf.length} at >= 0.7, ${unplaced} reads off the staged rows`, JSON.stringify(tally));
