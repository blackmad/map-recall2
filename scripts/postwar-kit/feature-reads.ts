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
const sample = JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts/postwar-kit/sample-all.json'), 'utf8')) as Record<string, any>;
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
  // Round 2b: the bearing (deg from north) of the wall the read was made on; the kit draws the read's features there only.
  if (Object.keys(f).length) out[r.id] = { ...f, bearing: sample[r.id]?.bearingDeg };
}
// 2024-2025 captures only: a read made on an older capture stands only as confirmed on a 2024-2025 one (recent-photos.ts,
// confirm-sheets.ts; one fresh reader, artifacts/postwar-kit/confirm.json). 'no' and 'unclear' drop the feature, 'partly'
// takes the confirmed kind or tone (CORRECT) or drops it; a pand with no clear 2024-2025 capture keeps nothing.
const confirm = new Map((JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts/postwar-kit/confirm.json'), 'utf8')) as any[]).map(r => [r.id, r]));
const CORRECT: Record<string, Record<string, unknown>> = {
  '0363100012067983': { balconyTone: 'glass' }, '0363100012075138': { balconyTone: 'dark' }, '0363100012082890': { balconyTone: 'dark' },
  '0363100012096427': { balcony: 'projecting', balconyTone: 'dark' }, '0363100012111453': { balconyTone: 'white' }, '0363100012146061': { balcony: 'projecting' },
  '0363100012165002': { balconyTone: 'dark' }, '0363100012171628': { balconyTone: 'dark' }, '0363100012241618': { balcony: 'round' }, '0363100012249108': { balconyTone: 'dark' },
  '0363100012073607': { erkerPlan: 'round' }, '0363100012080820': { erkerPlan: 'round', erkerCount: 1 },
};
const KEEP_PARTLY = new Set(Object.keys(CORRECT));
let dropped = 0;
for (const [id, f] of Object.entries(out) as Array<[string, Record<string, unknown>]>) {
  if ((sample[id]?.panoDate ?? '') >= '2024') continue;
  const c = confirm.get(id);
  if (!c) { delete out[id]; dropped++; continue; }
  for (const [k, keys] of [['balcony', ['balcony', 'balconyTone']], ['stair', ['stair', 'stairCount']], ['erker', ['erker', 'erkerPlan', 'erkerCount']]] as const) {
    if (!f[k]) continue;
    const v = c[k];
    if (v === 'yes') continue;
    if (v === 'partly' && KEEP_PARTLY.has(id) && keys.some(x => x in CORRECT[id])) { for (const x of keys) if (x in CORRECT[id]) f[x] = CORRECT[id][x]; continue; }
    for (const x of keys) delete f[x];
    dropped++;
  }
  if (Object.keys(f).every(k => k === 'bearing')) delete out[id];
}
console.log(Object.keys(out).length, 'pands with features;', none.length, 'read with no balcony;', dropped, 'features dropped by the 2024-2025 check');
fs.writeFileSync(path.join(ROOT, 'artifacts/postwar-kit/read-none.json'), JSON.stringify(none));
if (process.argv.includes('--publish')) fs.writeFileSync(path.join(ROOT, 'src/canalRecall/postwarKit/feature-reads.json'), JSON.stringify({ schemaVersion: 1, revision: 'postwar-features/v1 2026-11-21',
  licence: 'read by eye from Gemeente Amsterdam panoramas, CC BY 4.0', method: 'scripts/postwar-kit/feature-sheets.ts + feature-reads.ts (usable, high-confidence reads only)', features: out }, null, 1) + '\n');
