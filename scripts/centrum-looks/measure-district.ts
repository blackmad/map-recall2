/**
 * Measure a district look's distributions (centrum-looks lane, 2026-11-15) from the district's own D1 reads and the
 * monument register, and write them into the district config's `measured` block; `--write-pitch` also sets `pitchM`.
 *
 *   node --import tsx scripts/centrum-looks/measure-district.ts --district=jordaan [--write] [--write-pitch]
 *
 * Storey pitch: the 3DBAG front top (frontTopM) over the read's storeys, on usable single-front reads without a gabled
 * crown. Band rule: min = p25 down to 0.1 m, max = p75 to 0.1 m (the belt's 3.2-4.3 m band sat between its p10 and p75 of
 * cut heights; 3DBAG front tops run lower than the cut walls, so the district band starts at its p25).
 * Per period (BAG year; register facade year when stated): the read crowns, finishes and grounds, and the register's gables.
 */
import fs from 'node:fs';
import { districtPands, namedStreets } from '../buurt-generators/generate.ts';
import { statedPands } from '../belt-look/generate.ts';
import { districtReads, loadLookDistrict } from './generate.ts';
import { GABLED_CROWNS } from '../../src/canalRecall/beltLook/donors.ts';
import { periodOf } from './feasibility.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const id = arg('district') ?? 'jordaan', file = `src/canalRecall/beltLook/districts/${id}.json`, look = loadLookDistrict(id);
const pands = districtPands({ buurten: look.buurten } as never), streets = namedStreets();
const { donors } = districtReads(look, pands, streets);
const stated = statedPands();
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(p * (s.length - 1))] : null; };
const pitches = donors.filter(d => !GABLED_CROWNS.has(String(d.answer.crown))).map(d => d.heightM / (d.answer.storeys as number));
const quant = Object.fromEntries([0.1, 0.25, 0.5, 0.75, 0.9].map(p => [`p${p * 100}`, +(q(pitches, p) ?? 0).toFixed(2)]));
const pitchM = { min: Math.floor((quant.p25 as number) * 10) / 10, max: Math.round((quant.p75 as number) * 10) / 10 };
const inc = (o: Record<string, Record<string, number>>, k: string, v: string) => { (o[k] ??= {})[v] = (o[k][v] ?? 0) + 1; };
const crown: Record<string, Record<string, number>> = {}, finish: Record<string, Record<string, number>> = {}, ground: Record<string, Record<string, number>> = {}, register: Record<string, Record<string, number>> = {};
for (const d of donors) { const per = periodOf(stated.get(d.pandId)?.year ?? d.year); inc(crown, per, String(d.answer.crown)); inc(finish, per, String(d.answer.finish)); inc(ground, per, String(d.answer.ground)); }
for (const p of pands) { const pid = p.id.replace(/^NL\.IMBAG\.Pand\./, ''), s = stated.get(pid); if (s?.crown) inc(register, periodOf(s.year ?? p.year), s.crown); }
const streetsRead: Record<string, number> = {};
for (const d of donors) streetsRead[d.street] = (streetsRead[d.street] ?? 0) + 1;
const measured = { at: new Date().toISOString().slice(0, 10), donors: donors.length, pitch: { n: pitches.length, ...quant, band: pitchM, rule: 'min p25 floor 0.1, max p75 round 0.1' }, readCrownByPeriod: crown, readFinishByPeriod: finish, readGroundByPeriod: ground, registerCrownByPeriod: register, readsByStreet: streetsRead };
console.log(JSON.stringify(measured, null, 1));
if (process.argv.includes('--write')) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  raw.measured = measured;
  if (process.argv.includes('--write-pitch')) raw.pitchM = pitchM;
  fs.writeFileSync(file, JSON.stringify(raw, null, 1) + '\n');
}
