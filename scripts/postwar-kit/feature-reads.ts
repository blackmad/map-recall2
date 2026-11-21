/**
 * Round 2 (lane postwar-kit-r2-20261121): publish the by-eye feature reads of the 438 sampled members
 * (artifacts/postwar-kit/feature-reads/part-*.json, read from feature-sheets.ts' panorama sheets by four fresh readers)
 * as src/canalRecall/postwarKit/feature-reads.json. Kept: usable, high-confidence reads with a drawable feature
 * (projecting, round or band balconies; a glazed stair strip or tower; a dark-glass, white-glass or brick erker).
 *   node --import tsx scripts/postwar-kit/feature-reads.ts [--publish]
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '../..');
const DIR = path.join(ROOT, 'artifacts/postwar-kit/feature-reads');
const rows = [1, 2, 3, 4].flatMap(i => JSON.parse(fs.readFileSync(path.join(DIR, `part-${i}.json`), 'utf8')) as any[]);
const BAL = new Set(['projecting', 'round', 'band']);
const out: Record<string, unknown> = {};
const none: string[] = [];
for (const r of rows.sort((a, b) => a.id.localeCompare(b.id))) {
  if (!r.usable) continue;
  if (r.balcony === 'none' && r.confidence === 'high') none.push(r.id);
  if (r.confidence !== 'high') continue;
  const f: Record<string, unknown> = {};
  // A brick balustrade ('wall') has no colour to draw before the wall is known: left out.
  if (BAL.has(r.balcony) && r.balconyTone !== 'wall') { f.balcony = r.balcony; f.balconyTone = r.balconyTone ?? 'white'; }
  if (r.stair && r.stair !== 'none') { f.stair = r.stair; f.stairCount = Math.max(1, Math.min(4, r.stairCount || 1)); }
  if (r.erker && r.erker !== 'none') { f.erker = r.erker; f.erkerPlan = r.erkerPlan ?? 'box'; f.erkerCount = Math.max(1, Math.min(4, r.erkerCount || 1)); }
  if (Object.keys(f).length) out[r.id] = f;
}
console.log(Object.keys(out).length, 'pands with features;', none.length, 'read with no balcony');
fs.writeFileSync(path.join(ROOT, 'artifacts/postwar-kit/read-none.json'), JSON.stringify(none));
if (process.argv.includes('--publish')) fs.writeFileSync(path.join(ROOT, 'src/canalRecall/postwarKit/feature-reads.json'), JSON.stringify({ schemaVersion: 1, revision: 'postwar-features/v1 2026-11-21',
  licence: 'read by eye from Gemeente Amsterdam panoramas, CC BY 4.0', method: 'scripts/postwar-kit/feature-sheets.ts + feature-reads.ts (usable, high-confidence reads only)', features: out }, null, 1) + '\n');
