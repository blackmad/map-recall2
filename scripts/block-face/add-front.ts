/**
 * Add a corner pand's second street front to its block-face facts (the face intake reads one street only).
 *
 *   node --import tsx scripts/block-face/add-front.ts --face=schuyt-7-15 --pand=0363100012159412 --street="Van Breestraat" [--write]
 *
 * Rebuilds the pand's facts from its cached 3dbag.json with both streets (buildingRecipe/facts.ts buildFacts, the same
 * terrain as the intake), checks that the face street's front is unchanged, and appends the new street's front to
 * pands/<pand>/facts.json. Without --write it prints the new front only. Precedent: Kinkerstraat 86-88 (233580), whose
 * Kinkerstraat front was copied in by hand on 2026-11-14 (commit a399a7d158); a corner face front left out draws as a
 * blank slab.
 */
import fs from 'node:fs';
import path from 'node:path';
import {buildFacts, type StreetPath} from '../../src/canalRecall/buildingRecipe/facts.ts';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';
import {sharedTerrain} from '../lib/terrainField.ts';
import {FACES} from './intake.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const face = arg('face'), pand = arg('pand'), street = arg('street');
if (!face || !pand || !street) throw Error('--face, --pand and --street are required');
const dir = path.join(FACES, face, 'pands', pand);
const facts = JSON.parse(fs.readFileSync(path.join(dir, 'facts.json'), 'utf8'));
if (facts.fronts.some((f: {street: string}) => f.street === street)) { console.log(`${pand} already has a ${street} front`); process.exit(0); }
const item = JSON.parse(fs.readFileSync(path.join(dir, '3dbag.json'), 'utf8'));
const streets: StreetPath[] = (JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as {name: string; path: [number, number][]; paths?: [number, number][][]}[]).map(s => ({name: s.name, paths: s.paths ?? [s.path]}));
const toRD = (p: [number, number]): [number, number] => { const r = lngLatToRd(p); return [r.x, r.y]; };
const rebuilt = buildFacts(pand, item, streets, [...facts.fronts.map((f: {street: string}) => f.street), street], toRD, facts.source, {terrainAt: sharedTerrain()});
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
for (const [k, f] of facts.fronts.entries()) if (!same(f, rebuilt.fronts[k])) throw Error(`front ${k} (${f.street}) differs from the intake's: the 3dbag.json or terrain changed; re-run the intake first`);
const added = rebuilt.fronts.at(-1)!;
console.log(added.topProfile.filter((_: unknown, i: number) => i % 8 === 0).map((p: {alongM: number; heightM: number}) => `${p.alongM.toFixed(1)}:${p.heightM.toFixed(1)}`).join(" "));
console.log(`${pand} ${street}: width ${added.widthM.toFixed(2)} m, street distance ${added.streetDistanceM.toFixed(1)} m, eaves ${added.eavesM?.toFixed?.(2)}`);
if (process.argv.includes('--write')) { facts.fronts.push(added); fs.writeFileSync(path.join(dir, 'facts.json'), JSON.stringify(facts, null, 1) + '\n'); console.log('wrote', path.join(dir, 'facts.json')); }
