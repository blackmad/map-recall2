/**
 * Photo features (buurt generators round 18, De Pijp #393): the features reader's lines (scripts/buurt-generators/
 * features-reader-prompt.md, one per member cut from row-cuts.ts --members) into the district's measured file as
 * `photoFeatures`, per pand: window heads, French balconies, crown and wall finish, each with its own confidence. The
 * generator reads them as a second reading (generate.ts paintedPandOf, photoGableOf, headsReadOf, photoBalconettesOf).
 *
 *   node --import tsx scripts/buurt-generators/photo-features.ts --district=de-pijp <readsDir...>
 *
 * A pand read twice keeps the read with the higher mean confidence. Only pands on staged rows are kept.
 */
import fs from 'node:fs';
import { parseFeaturesLine } from '../../src/canalRecall/buurtGenerator/generate.ts';

const district = process.argv.find(a => a.startsWith('--district='))?.slice(11) ?? 'de-pijp';
const dirs = process.argv.slice(2).filter(a => !a.startsWith('--'));
const staged = new Set((JSON.parse(fs.readFileSync(`artifacts/buurt-generators/${district}/row-front.json`, 'utf8')).records as Array<{ pandId: string }>).map(r => r.pandId));
const best = new Map<string, NonNullable<ReturnType<typeof parseFeaturesLine>>>();
const mean = (r: NonNullable<ReturnType<typeof parseFeaturesLine>>) => (r.hc + r.bc + r.cc + r.fc) / 4;
let lines = 0, bad = 0;
for (const d of dirs) for (const f of fs.readdirSync(d).filter(x => /^read-\d+\.txt$/.test(x)).sort())
  for (const line of fs.readFileSync(`${d}/${f}`, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    lines++;
    const r = parseFeaturesLine(line);
    if (!r) { bad++; console.error('unparsed:', line.slice(0, 120)); continue; }
    if (!best.has(r.pandId) || mean(r) > mean(best.get(r.pandId)!)) best.set(r.pandId, r);
  }
const file = `src/canalRecall/buurtGenerator/districts/measured/${district}.json`, m = JSON.parse(fs.readFileSync(file, 'utf8'));
m.photoFeatures = Object.fromEntries([...best].filter(([pid]) => staged.has(pid)).sort(([a], [b]) => (a < b ? -1 : 1)).map(([pid, { pandId: _, ...r }]) => [pid, r]));
m.photoFeaturesSource = 'opus features reads (scripts/buurt-generators/features-reader-prompt.md: heads, French balconies, crown, finish) of each member\'s rectified panorama cut (scripts/buurt-generators/row-cuts.ts --members; data.amsterdam.nl panoramas, CC BY 4.0)';
fs.writeFileSync(file, JSON.stringify(m, null, 2) + '\n');
const v = Object.values(m.photoFeatures) as any[];
console.log(`${district}: ${lines} lines, ${bad} unparsed, ${v.length} pands; balconettes >= 0.7: ${v.filter(r => r.balconette && r.bc >= 0.7).length}; heads >= 0.7: ${v.filter(r => r.hc >= 0.7).length}`);
