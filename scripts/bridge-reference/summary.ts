// One line per read bridge (artifacts/bridges/<id>/reading.json): views, openings, shape, family, parapet.
//   npx tsx scripts/bridge-reference/summary.ts [BRU0009 …]
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync('artifacts/bridges').filter(d => /^BRU/.test(d));
for (const id of ids) {
  const f = `artifacts/bridges/${id}/reading.json`;
  if (!existsSync(f)) { console.log(id, 'no reading'); continue; }
  const r = JSON.parse(readFileSync(f, 'utf8'));
  console.log(id, String(r.name).slice(0, 22).padEnd(22), (r.views as any[]).map(v => `${v.side > 0 ? 'p' : 'm'} ${v.year} ${Math.round(v.distM)}m ${Math.round(v.obliquityDeg)}° n${v.reading.openings.length} ${v.reading.shape} ${v.reading.family} ${v.reading.parapet} cov${v.reading.coverage.toFixed(2)} dz${v.reading.dz}`).join(' | ') || 'no views');
}
