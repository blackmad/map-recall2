/**
 * Publish the buurt generator's approved districts into the one front-record file the browser reads and the world
 * compile takes (public/data/front-records/row-front.json, houseLine/rowFront.ts ROW_FRONT_BROWSER_PATH). The
 * integrator runs it; lanes stop at the staged copy.
 *
 *   node --import tsx scripts/buurt-generators/publish.ts --districts=rivierenbuurt,apollo-stadion            dry run
 *   node --import tsx scripts/buurt-generators/publish.ts --districts=rivierenbuurt,apollo-stadion --write    write it
 *
 * Input: data/buurt-generators/<district>/row-front.json, the reviewed copy of the generator's staged output
 * (`scripts/buurt-generators/generate.ts --district=<d>` writes artifacts/buurt-generators/<d>/row-front.json;
 * `--stage-data` copies it here). Each record carries `buurtKit`, the generator's own field.
 *
 * 1. Records of other sources (signed-off house rows, lane 1's blocks) stay. This district's earlier buurt records
 *    (a record with `buurtKit` whose pand is in the district's staged list) are replaced.
 * 2. Any staged pand that is described at publish time (a published HouseSpec tile, a non-buurt row-front record, a
 *    model or building-type instance: generate.ts describedPands) is dropped and listed: what describes a pand wins.
 * 3. Records are written slim: `sources` keeps only its `record` line (the full provenance stays in the staged copy),
 *    which halves the file the browser fetches.
 *    --over-specs (the belt look, generated with scripts/belt-look/generate.ts --over-specs): a pand whose only
 *    description is a per-house HouseSpec is kept, as the generator drew it over that spec; a row record, model or
 *    building type still wins.
 * Then (the integrator): turn the kit on for these records (kitFlag.ts) and recompile the world (--no-policy --shell).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describedPands } from './generate.ts';
import { specOnlyPands } from '../belt-look/generate.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const districts = (arg('districts') ?? '').split(',').filter(Boolean);
const write = process.argv.includes('--write');
if (!districts.length) { console.error('publish --districts=<d>[,<d>] [--write]'); process.exit(2); }
const OUT = 'public/data/front-records/row-front.json';
type Rec = { pandId: string; sources?: Record<string, string>; buurtKit?: unknown; [k: string]: unknown };
const current = JSON.parse(fs.readFileSync(OUT, 'utf8')) as { schema: string; source: string[]; records: Rec[] };
const described = describedPands();
if (process.argv.includes('--over-specs')) for (const id of specOnlyPands()) described.delete(id);

let records = current.records, sources = current.source.filter(s => !districts.some(d => s.startsWith(`buurt-generator ${d} `)));
const report: string[] = [];
for (const d of districts) {
  const file = path.join('data/buurt-generators', d, 'row-front.json');
  if (!fs.existsSync(file)) throw new Error(`${d}: not staged (${file}); run generate.ts --district=${d} --stage-data`);
  const staged = JSON.parse(fs.readFileSync(file, 'utf8')) as { generatedAt: string; records: Rec[] };
  const ids = new Set(staged.records.map(r => r.pandId));
  const before = records.length;
  records = records.filter(r => !(r.buurtKit && ids.has(r.pandId)));
  const dropped = staged.records.filter(r => described.has(r.pandId));
  const add = staged.records.filter(r => !described.has(r.pandId)).map(r => ({ ...r, sources: { record: r.sources?.record ?? `buurt-generator ${d}` } }));
  records.push(...add);
  sources.push(`buurt-generator ${d} (staged ${staged.generatedAt}; approved by David on #390, "Looks good")`);
  report.push(`${d}: ${add.length} records (${before - (records.length - add.length)} earlier buurt records replaced), ${dropped.length} dropped as described now${dropped.length ? `: ${dropped.slice(0, 12).map(r => r.pandId).join(', ')}${dropped.length > 12 ? ', ...' : ''}` : ''}`);
}
const out = { schema: current.schema, source: sources, records };
const text = JSON.stringify(out);
console.log(report.join('\n'));
console.log(`${OUT}: ${current.records.length} -> ${records.length} records, ${(text.length / 1048576).toFixed(2)} MB${write ? '' : ' (dry run; --write to write)'}`);
if (write) fs.writeFileSync(OUT, text + '\n');
