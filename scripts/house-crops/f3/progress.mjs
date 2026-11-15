// Aggregates experiments/f3-centrum-*/<buurt>/summary.json of the source-data worktree into one markdown progress table.
//   node scripts/house-crops/f3/progress.mjs <source-data worktree> [tag]
import fs from 'node:fs';
import path from 'node:path';
const root = path.join(process.argv[2], 'experiments', process.argv[3] ?? 'f3-centrum-20261112');
const rows = fs.readdirSync(root).filter(d => fs.existsSync(path.join(root, d, 'summary.json'))).map(d => JSON.parse(fs.readFileSync(path.join(root, d, 'summary.json'), 'utf8')));
const sum = k => rows.reduce((a, r) => a + (r[k] ?? 0), 0), fields = {}, st = {};
for (const r of rows) { for (const [k, v] of Object.entries(r.fields ?? {})) fields[k] = (fields[k] ?? 0) + v; for (const [k, v] of Object.entries(r.statuses ?? {})) st[k] = (st[k] ?? 0) + v; }
console.log(`${rows.length} buurten done (${rows.map(r => r.code).join(' ')}).`);
console.log(`pands ${sum('buurtPands')} (${Object.entries(st).map(([k, v]) => `${k} ${v}`).join(', ')}); crops ${sum('crops')}; gate pass ${sum('gatePass')}, fail ${sum('gateFail')} (gated out), not gated ${sum('notGated')}; re-cuts kept ${sum('recuts')}; specs described ${sum('specs')}; staged ${sum('staged')}.`);
console.log(`fetch ${(sum('bytes') / 1e9).toFixed(2)} GB in ${sum('requests')} requests (${(sum('bytes') / Math.max(1, sum('crops')) / 1e6).toFixed(2)} MB per crop); ${(sum('seconds') / 3600).toFixed(2)} worker-hours.`);
console.log('fields stored: ' + Object.entries(fields).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
