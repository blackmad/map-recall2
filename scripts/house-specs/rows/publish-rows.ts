/**
 * Publish the signed-off house rows (lane D, round 1 of docs/handoffs/house-rows-plan-20261114.md). The integrator runs it.
 *
 *   npm run house:rows-publish                 dry run: what would be written
 *   npm run house:rows-publish -- --write      write it
 *
 * For each row in scripts/house-specs/rows/signed-off.json, from its staged record (run `npm run house:rows -- <row>`
 * first; artifacts/house-rows/staging/<row>.json and <row>/<pandId>.json):
 * 1. the row's front records, joined to their series (houseLine/rowSeries.ts rowFrontsWithSeries), go into
 *    public/data/front-records/row-front.json, the one file the browser reads (houseLine/rowFront.ts
 *    ROW_FRONT_BROWSER_PATH) and the world compile takes as ROW_FRONT_RECORDS. Records of other sources (lane 1's
 *    Haarlemmerdijk block) stay; this row's pands are replaced. `--rows-only` writes the house rows alone.
 * 2. each member's HouseSpec is copied to scripts/house-specs/specs/<pandId>.json (replacing a batch-1 D1 spec of the
 *    same pand), except a wall-only member (its pand is a face chunk's; the row draws only its wall).
 * Then: `npm run house:specs` and `npm run house:specs -- --publish` (the extract tiles), the world compile.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from './rowDefs.ts';
import { rowFrontsWithSeries } from '../../../src/canalRecall/houseLine/rowSeries.ts';
import { ROW_FRONT_BROWSER_PATH, type RowFrontRecord } from '../../../src/canalRecall/houseLine/rowFront.ts';
import type { RowRecord } from '../../../src/canalRecall/houseSpec/row/types.ts';

const argv = process.argv.slice(2), write = argv.includes('--write'), rowsOnly = argv.includes('--rows-only');
const STAGING = path.join(REPO, 'artifacts/house-rows/staging');
const OUT = path.join(REPO, 'public', ROW_FRONT_BROWSER_PATH), SPECS = path.join(REPO, 'scripts/house-specs/specs');
const signed = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/house-specs/rows/signed-off.json'), 'utf8')) as { rows: Record<string, { ref: string; at: string }> };
const current = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) as { schema: string; source: string[]; records: RowFrontRecord[] } : { schema: 'row-front-v1', source: [], records: [] };

const records: RowFrontRecord[] = [], sources: string[] = [], specCopies: Array<{ from: string; to: string; replaces: boolean }> = [], skipped: string[] = [];
for (const [rowId, s] of Object.entries(signed.rows)) {
  const file = path.join(STAGING, `${rowId}.json`);
  if (!fs.existsSync(file)) throw new Error(`${rowId}: not staged (${path.relative(REPO, file)}); run npm run house:rows -- ${rowId}`);
  const row = (JSON.parse(fs.readFileSync(file, 'utf8')) as { row: RowRecord }).row;
  records.push(...rowFrontsWithSeries(row));
  sources.push(`house-rows ${rowId} (signed off ${s.at}: ${s.ref})`);
  for (const m of row.members) {
    if (m.wallOnly) { skipped.push(`${m.pandId} (${rowId}): wall-only, its spec stays with ${m.wallOnly.chunk}`); continue; }
    const from = path.join(STAGING, rowId, `${m.pandId}.json`), to = path.join(SPECS, `${m.pandId}.json`);
    if (!fs.existsSync(from)) { skipped.push(`${m.pandId} (${rowId}): no staged spec`); continue; }
    specCopies.push({ from, to, replaces: fs.existsSync(to) });
  }
}
const mine = new Set(records.map(r => String(r.pandId).slice(-16)));
const kept = rowsOnly ? [] : current.records.filter(r => !mine.has(String(r.pandId).slice(-16)) && !String((r as { sources?: { record?: string } }).sources?.record ?? '').startsWith('house-rows '));
const out = { schema: current.schema ?? 'row-front-v1', source: [...(rowsOnly ? [] : current.source.filter(x => !x.startsWith('house-rows '))), ...sources], records: [...kept, ...records] };

console.log(`${path.relative(REPO, OUT)}: ${kept.length} records kept (${rowsOnly ? 'none: --rows-only' : 'other sources'}) + ${records.length} house-row fronts (${Object.keys(signed.rows).join(', ')})`);
for (const c of specCopies) console.log(`  spec ${path.relative(REPO, c.from)} -> ${path.relative(REPO, c.to)}${c.replaces ? ' (replaces the batch-1 spec)' : ' (new)'}`);
for (const k of skipped) console.log(`  skipped ${k}`);
if (!write) { console.log('dry run: --write to publish'); process.exit(0); }
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out) + '\n');
for (const c of specCopies) fs.copyFileSync(c.from, c.to);
console.log(`wrote ${path.relative(REPO, OUT)} and ${specCopies.length} specs; next: npm run house:specs && npm run house:specs -- --publish`);
