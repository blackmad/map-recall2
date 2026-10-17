// City-wide zebra crossing audit (src/canalRecall/ownGround/crossingAudit.ts) over every crossing the ground
// renderer draws in the roads-v1 cells (surveyMarkings.ts, built as groundCell.ts builds them).
//
//   npx tsx scripts/own-ground/audit-crossings.ts [cell,cell,…] [--out artifacts/zebra-crossings/audit.json] [--list 30] [--check]
//
// Prints the count per category and the worst flagged crossings (lng, lat, categories, notes); writes the full list.
// --check exits non-zero over the pinned ceilings (crossingAudit.ts CROSSING_AUDIT_MAX).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { GroundStore } from '../../src/canalRecall/ownGround/groundStore.ts';
import { CROSSING_AUDIT_MAX, type CrossingFinding } from '../../src/canalRecall/ownGround/crossingAudit.ts';
import { auditCity } from '../../src/canalRecall/ownGround/crossingCells.ts';

export const ROOT = 'public/data/extracts/amsterdam';
export const readExtract = async (path: string) => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };

const argOf = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const OUT = argOf('--out') ?? 'artifacts/zebra-crossings/audit.json', LIST = Number(argOf('--list') ?? 30);

if (process.argv[1]?.endsWith('audit-crossings.ts')) {
  const store = new GroundStore(readExtract, { roads: true });
  await store.init();
  const keys = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2].split(',') : [...store.roadCells].sort();
  const t0 = Date.now();
  const r = await auditCity(store, keys.filter(k => store.covers(k)), { log: process.argv.includes('--verbose') ? console.log : undefined });
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(r, null, 1));
  const sev = (f: CrossingFinding) => f.categories.length;
  for (const f of [...r.flagged].sort((a, b) => sev(b) - sev(a)).slice(0, LIST)) console.log(`  ${f.lngLat.join(',')} ${f.source} ${typeof f.ref === 'number' ? f.ref : ''} [${f.categories.join(' ')}] ${f.notes.join('; ')}`);
  const flagged = r.flagged.length;
  console.log(JSON.stringify({ cells: r.cells, crossings: r.crossings, flagged, counts: r.counts, plan: r.plan, s: Math.round((Date.now() - t0) / 1000) }));
  // --check: fail over the pinned ceilings (crossingAudit.ts CROSSING_AUDIT_MAX; cobbles is reported only).
  if (process.argv.includes('--check')) {
    const over = Object.entries(CROSSING_AUDIT_MAX).filter(([k, max]) => r.counts[k as keyof typeof r.counts] > max);
    if (over.length) { console.error(`crossing audit over its ceilings: ${over.map(([k, max]) => `${k} ${r.counts[k as keyof typeof r.counts]} > ${max}`).join(', ')}`); process.exit(1); }
    console.log('crossing audit within its ceilings');
  }
}
