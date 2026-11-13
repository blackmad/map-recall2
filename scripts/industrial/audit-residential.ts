// Which pands tagged works/shed in industrial-buildings.json are mainly residential (lane FD, 2026-11-13).
//   npx tsx scripts/industrial/fetch-bag-housing.ts     (once; PDOK BAG WFS, cached under .cache/industrial)
//   npx tsx scripts/industrial/audit-residential.ts [--out=artifacts/industrial/audit/residential-tags.json] [--list=40]
import fs from 'node:fs';
import path from 'node:path';
import { loadBuurtLocator, loadPands, EXTRACT, ROOT } from '../street-faces/loadCity.ts';
import { auditRow, summarise, type TaggedPand } from '../../src/canalRecall/industrial/industrialAudit.ts';
import type { IndustrialKind } from '../../src/canalRecall/industrial/industrialClass.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const out = path.resolve(ROOT, arg('out') ?? 'artifacts/industrial/audit/residential-tags.json');
const listN = Number(arg('list') ?? 40);
const table = JSON.parse(fs.readFileSync(path.join(EXTRACT, 'industrial-buildings.json'), 'utf8')) as { ids: Record<string, string> };
const housingFile = path.join(ROOT, '.cache/industrial/bag-housing.json');
if (!fs.existsSync(housingFile)) throw new Error('run scripts/industrial/fetch-bag-housing.ts first');
const housing = JSON.parse(fs.readFileSync(housingFile, 'utf8')).pands as Record<string, { vbos: number; woonVbos: number; area: Record<string, number> }>;
const { pands } = loadPands();
const { locate } = loadBuurtLocator();
const rows = [];
for (const [id, kind] of Object.entries(table.ids)) {
  if (kind !== 'works' && kind !== 'shed') continue;
  const p = pands.get(id);
  const h = housing[id.slice(14)];
  const t: TaggedPand = { id, kind: kind as IndustrialKind, stadsdeel: p ? locate(p.centroid)?.stadsdeel ?? 'outside' : 'no-tile', areaM2: Math.round(p?.areaM2 ?? 0), heightM: p?.heightM ?? 0, year: p?.year ?? null, uses: h?.area, vbos: h?.vbos, woonVbos: h?.woonVbos };
  rows.push(auditRow(t));
}
const summary = summarise(rows);
const risky = rows.filter(r => r.housing === 'mainly-residential').sort((a, b) => b.areaM2 - a.areaM2);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), summary, mainlyResidential: risky, mixed: rows.filter(r => r.housing === 'mixed-residential') }));
console.log(JSON.stringify(summary, null, 1));
console.log(`housing veto (>= 10 % homes) on the full use list: ${rows.filter(r => r.revisedKind === null).length} of ${rows.length} tags would go (${risky.length} mainly residential, ${rows.filter(r => r.housing === 'mixed-residential').length} mixed 10-50 %)`);
for (const id of ['NL.IMBAG.Pand.0363100012091500', 'NL.IMBAG.Pand.0363100012150234']) {
  const r = rows.find(x => x.id === id);
  console.log('regression', id, r ? `${r.kind} ${r.housing} woon ${(r.woonShare * 100).toFixed(0)} % (${r.woonVbos}/${r.vbos} VBOs) year ${r.year} area ${r.areaM2} -> ${r.revisedKind}` : 'NOT TAGGED');
}
console.log(`largest ${listN} mainly-residential tags (id kind stadsdeel year area woonVBOs/VBOs):`);
for (const r of risky.slice(0, listN)) console.log(`  ${r.id.slice(14)} ${r.kind} ${r.stadsdeel} ${r.year} ${r.areaM2}m2 ${r.woonVbos}/${r.vbos}`);
console.log(`wrote ${out}`);
