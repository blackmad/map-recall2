// Usage: node --import tsx scripts/buurt-generators/audit-steps.ts rivierenbuurt apollo-stadion (reads the staged rows.json).
// Round 10 audit: adjacent series in one row, same build period, whose lines step by more than ROW_EAVES_STEP_M while
// AHN4 at the street front does not (each side's members' median front height within the step of the other's).
import fs from 'node:fs';
import { ROW_EAVES_STEP_M } from '../../src/canalRecall/buurtGenerator/rows.ts';
const YEAR = 5;
for (const d of process.argv.slice(2)) {
  const rows = JSON.parse(fs.readFileSync(`artifacts/buurt-generators/${d}/rows.json`, 'utf8')).rows as any[];
  const roofs = JSON.parse(fs.readFileSync(`src/canalRecall/buurtGenerator/districts/measured/${d}.json`, 'utf8')).roofs as Record<string, any>;
  const built = new Map<string, number>(); for (const r of rows) for (const m of r.members) built.set(m.pandId, m.built);
  const med = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };
  let pairs = 0, unsupported = 0, supported = 0, unread = 0; const ex: string[] = []; const rowsHit = new Set<string>();
  for (const r of rows) for (let i = 1; i < r.series.length; i++) {
    const a = r.series[i - 1], b = r.series[i], la = a.design.corniceTopM.value, lb = b.design.corniceTopM.value;
    const ya = med(a.fronts.map((f: string) => built.get(f) ?? 0)), yb = med(b.fronts.map((f: string) => built.get(f) ?? 0));
    if (la == null || lb == null || Math.abs(la - lb) <= ROW_EAVES_STEP_M || ya == null || yb == null || Math.abs(ya - yb) > YEAR) continue;
    pairs++;
    const ha = med(a.fronts.flatMap((f: string) => roofs[f]?.form !== 'unclear' && roofs[f]?.eavesM > 2 ? [roofs[f].eavesM] : [])), hb = med(b.fronts.flatMap((f: string) => roofs[f]?.form !== 'unclear' && roofs[f]?.eavesM > 2 ? [roofs[f].eavesM] : []));
    if (ha == null || hb == null) { unread++; continue; }
    if (Math.abs(ha - hb) <= ROW_EAVES_STEP_M) { unsupported++; rowsHit.add(r.id); if (ex.length < 8) ex.push(`${r.id}: lines ${la}/${lb} m, AHN front ${ha}/${hb} m`); } else supported++;
  }
  console.log(`${d}: ${rows.length} rows; ${pairs} same-period steps over ${ROW_EAVES_STEP_M} m; AHN unsupported ${unsupported} (in ${rowsHit.size} rows), AHN-supported ${supported}, unread ${unread}`);
  for (const e of ex) console.log('  ', e);
}
