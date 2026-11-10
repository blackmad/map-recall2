/**
 * Hand placement of block-face runs from a reviewer's reading of the strip (the canal-belt lanes, 2026-11-10): where the
 * auto-place scores cannot read a mixed row (BAG build years of restorations, skylines that read a tile saddle behind a
 * cornice as a bell gable, 2.6-3.5 m storey pitches in one row), the lane names per pand the type, crown, storey count,
 * mirror and ground, and this script writes the run face exactly as auto-place would (run directory with the cropped
 * strip, measured wall per pand, BAG/OSM ground use and shop fronts), but with the reviewer's choices. Never installs.
 *
 *   node --import tsx scripts/block-face/hand-place.ts --buurt=bloemgrachtbuurt --district=jordaan [--only=<run>,...]
 *
 * Reads scripts/block-face/buurten/<buurt>-hand-runs.json:
 *   {note, runs: [{id, face, reason, houses: [{pand, type, crown?, storeys, mirror?, shop?, ground?, overrides?,
 *                  paletteOverrides?, wall?: false, why}]}]}
 *   pand: the last 6 digits or the full BAG id; storeys: full storeys incl. ground (counted on the strip);
 *   shop: true = the auto shop front from BAG/OSM (default: a shop when BAG/OSM says trading); false = never;
 *   wall: false = keep the type palette (no measured wall, e.g. a strip wall reading the shade);
 *   roof: {material, evidence} when the strip shows another covering than the type's;
 *   eavesM: the cornice line read on the strip (continuity.measuredEaves) when 3DBAG's eaves is another line.
 * Writes scripts/block-face/faces/<run>/{intent.json,strip.json,uses.json,discovery.json,pands/*} and the cropped strip.
 * Then: compile.ts --face=<run>, review.ts --face=<run>; install with compile.ts --install after the sheet is judged.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {autoShopfront, groundUse, runIntent, type Placed} from '../../src/canalRecall/blockFace/autoPlace.ts';
import type {HousePlacement, HouseTypeIntent} from '../../src/canalRecall/blockFace/houseType.ts';
import {TYPE_LIBRARY_DIR} from '../../src/canalRecall/blockFace/typeLibrary.ts';
import {handRunProblems, type HandRun} from '../../src/canalRecall/blockFace/handPlace.ts';
import {faceEvidence, writeRunFace} from './auto-place.ts';
import {FACES} from './intake.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const readJson = async (f: string) => JSON.parse(await fs.readFile(f, 'utf8'));

async function main() {
  const buurt = arg('buurt'), district = arg('district');
  if (!buurt || !district) throw Error('--buurt and --district are required');
  const only = arg('only')?.split(',');
  const spec: {runs: HandRun[]} = await readJson(path.join('scripts/block-face/buurten', `${buurt}-hand-runs.json`));
  const dir = path.join(TYPE_LIBRARY_DIR, district);
  const types: HouseTypeIntent[] = await Promise.all((await fs.readdir(dir)).filter(f => f.endsWith('.json')).sort().map(f => readJson(path.join(dir, f))));
  for (const run of spec.runs.filter(r => !only || only.includes(r.id))) {
    const {discovery, strip, uses, evs} = await faceEvidence(run.face);
    const problems = handRunProblems(run, discovery.members, types);
    if (problems.length) throw Error(problems.join('\n'));
    const placed: Placed[] = run.houses.map(h => {
      const ev = evs.find(e => e.pandId.endsWith(h.pand))!, t = types.find(x => x.id === h.type)!, s = ev.strip;
      const use = groundUse(ev, strip.date), trading = !['residential', 'office', 'vacant'].includes(use.use);
      const placement: HousePlacement = {type: t.id};
      if (h.storeys !== t.body.storeys) placement.storeys = h.storeys;
      if (h.crown && h.crown !== Object.keys(t.crowns)[0]) placement.crown = h.crown;
      if (h.mirror) placement.mirror = true;
      if (h.shop ?? trading) placement.ground = {shopfront: autoShopfront(ev, use)};
      else if (h.ground) placement.ground = h.ground;
      if (h.overrides) placement.overrides = h.overrides;
      if (h.paletteOverrides) placement.paletteOverrides = h.paletteOverrides;
      if (h.roof) placement.roof = h.roof;
      if (h.wall !== false && s?.wall && !s.palette.stucco) placement.measuredPalette = {brick: s.wall, evidence: `strip ${s.date} span ${s.px.join('-')}: trim-normalised wall (buildingRecipe/measureFacade.ts)`};
      const slug = `${run.face.split('-')[0]}-${ev.pandId.slice(-6)}`;
      return {pandId: ev.pandId, typeId: t.id, score: 1, notes: [`hand: ${h.why}`],
        house: {pandId: ev.pandId, slug, address: ev.address, type: placement, groundFloor: use, rhythm: {citation: `hand placement (${buurt}-hand-runs.json): ${h.why}; strip ${strip.date}`} as any}};
    });
    const ids = placed.map(p => p.pandId);
    await writeRunFace(run.face, run.id, ids, strip, uses, discovery);
    const intent = runIntent({id: run.id, street: discovery.street ?? run.face, stripDate: strip.date, stripImage: path.join('staging/block-face', run.id, 'strip.jpg'),
      types: [...new Set(placed.map(p => p.typeId))], run: placed, note: `hand placement by the lane from the strip: ${run.reason}`});
    const measured = run.houses.filter(h => h.eavesM !== undefined).map(h => ({pand: placed.find(p => p.pandId.endsWith(h.pand))!.pandId,
      stripRow: Math.round(strip.height - h.eavesM! * strip.pixelsPerMetre), evidence: `hand placement: cornice top read at ${h.eavesM} m on the strip ${strip.date}`}));
    if (measured.length) intent.continuity = {...intent.continuity, measuredEaves: measured};
    intent.authoring = {author: 'lane hand placement (scripts/block-face/hand-place.ts)', passes: 1, note: `${run.reason}; spec scripts/block-face/buurten/${buurt}-hand-runs.json`} as any;
    await fs.writeFile(path.join(FACES, run.id, 'intent.json'), JSON.stringify(intent, null, 1) + '\n');
    console.log(`${run.id}: ${placed.length} houses (${placed.map(p => `${p.pandId.slice(-6)} ${p.typeId}${p.house.type?.crown ? `/${p.house.type.crown}` : ''} x${p.house.type?.storeys ?? '-'}`).join(', ')})`);
  }
}

if (process.argv[1]?.endsWith('block-face/hand-place.ts')) await main();
