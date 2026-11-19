// Broken-ground detector (feedback c57c04): one ranked list of places from the three existing measures
// (src/canalRecall/ownGround/groundDetector.ts). Each source is a JSON file its own script writes; run them first
// (or pass the ones you have):
//
//   node --import tsx scripts/own-ground/audit-ground.ts --cells=<keys> --no-tj --out artifacts/ground-detector/audit   (or --city)
//   npx tsx scripts/own-ground/probe-hole-junctions.ts --list --variants=after > artifacts/ground-detector/holes.jsonl
//   npx tsx scripts/own-ground/check-rail-joins.ts --print --json=artifacts/ground-detector/rail-joins.json
//   npx tsx scripts/own-ground/ground-detector.ts [--top 10] [--audit f] [--holes f] [--rails f] [--near lng,lat,radiusM]
//
// Writes artifacts/ground-detector/hits.json (every place, worst first) and prints the top N with coordinates.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { auditTileHits, holeJunctionHits, railJoinHits, rankHits, type DetectorHit } from '../../src/canalRecall/ownGround/groundDetector.ts';

const DIR = 'artifacts/ground-detector';
const arg = (k: string, d?: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const auditFile = arg('audit', `${DIR}/audit/cells.json`)!, holesFile = arg('holes', `${DIR}/holes.jsonl`)!, railsFile = arg('rails', `${DIR}/rail-joins.json`)!;
const hits: DetectorHit[] = [], used: string[] = [];
if (existsSync(auditFile)) {
  const a = JSON.parse(readFileSync(auditFile, 'utf8'));
  const tiles = a.tiles ?? a.tileTop?.map((t: any) => ({ ...t, tally: t })) ?? [];
  hits.push(...auditTileHits(tiles, (x, y) => fromLocal(x, y) as [number, number]));
  used.push(`audit ${auditFile} (${tiles.length} tiles)`);
}
if (existsSync(holesFile)) {
  const rows = readFileSync(holesFile, 'utf8').split('\n').filter(l => l.startsWith('{"id"')).map(l => JSON.parse(l));
  hits.push(...holeJunctionHits(rows));
  used.push(`hole junctions ${holesFile} (${rows.length} decks)`);
}
if (existsSync(railsFile)) {
  const r = JSON.parse(readFileSync(railsFile, 'utf8'));
  hits.push(...railJoinHits(r.failures ?? []));
  used.push(`rail joins ${railsFile} (${(r.failures ?? []).length} failures)`);
}
let ranked = rankHits(hits);
const near = arg('near');
if (near) {
  const [lng, lat, r] = near.split(',').map(Number), KX = 111320 * Math.cos(52.37 * Math.PI / 180), KY = 110540;
  ranked = ranked.filter(h => Math.hypot((h.lng - lng) * KX, (h.lat - lat) * KY) <= (r || 500));
}
mkdirSync(DIR, { recursive: true });
writeFileSync(`${DIR}/hits.json`, JSON.stringify({ sources: used, hits: ranked }, null, 1));
console.log(`sources: ${used.join('; ') || 'none (run the three scripts first)'}`);
const top = Number(arg('top', '10'));
ranked.slice(0, top).forEach((h, i) => console.log(`${String(i + 1).padStart(2)}. ${h.lat.toFixed(5)},${h.lng.toFixed(5)}  ${h.source}/${h.kind}  score ${h.score.toFixed(0)}  ${h.detail}${h.also?.length ? `  (+${h.also.length} nearby)` : ''}`));
