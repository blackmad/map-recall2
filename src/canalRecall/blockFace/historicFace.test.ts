/**
 * Named regression: Oudezijds Achterburgwal 41-57 (block face `wallen-oza-41-57`, De Wallen, 17th/18th-c. fronts).
 *  - strip-measured eaves: 45 and 49 hide gabled roofs behind straight cornices, 3DBAG read their eaves 1.6-1.8 m low;
 *  - oblique party walls (~17 degrees): cornice/ornament overhang into the neighbour was 3-11 cm before `partyClip`;
 *  - 177915 footprint IoU 0.76 vs BAG: 3DBAG LoD2.2 itself misses a 12.5 m2 rear wedge (b3_opp_grond 40.28 vs BAG 52.77);
 *  - GLB-audit loops past the end of a shared footprint edge are party-plane trimming artefacts.
 *   node --import tsx --test src/canalRecall/blockFace/historicFace.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {houseIntents, validateBlockFace, type BlockFaceIntent} from './intent.ts';
import {compileBlockFace, decodePands, planFaceGround, surveyShortfall, type StripScale} from './compile.ts';
import {classifyPartyLoops, openEdges} from './partyLoops.ts';

const DIR = 'scripts/block-face/faces/wallen-oza-41-57';
const raw = JSON.parse(fs.readFileSync(`${DIR}/intent.json`, 'utf8'));
const discovery = JSON.parse(fs.readFileSync(`${DIR}/discovery.json`, 'utf8'));
const face: BlockFaceIntent = validateBlockFace(raw, discovery.members);
const facts = new Map<string, BuildingFacts>(face.houses.map(h => [h.pandId, JSON.parse(fs.readFileSync(`${DIR}/pands/${h.pandId}/facts.json`, 'utf8'))]));
const s = JSON.parse(fs.readFileSync(`${DIR}/strip.json`, 'utf8')), strip: StripScale = {heightPx: s.height, pixelsPerMetre: s.pixelsPerMetre, groundNAP: s.groundNAP};
const result = compileBlockFace(face, facts, 'face-wallen-test', {strip});

test('measured eaves: strip rows become metres above the shared street level, per front', () => {
  const plan = planFaceGround(face, face.houses.map(h => facts.get(h.pandId)!), undefined, strip);
  const at = (pand: string) => plan.measured![`03631000121${pand}`];
  assert.ok(Math.abs(at('77924').front0 - (778 - 200) / 40 - (strip.groundNAP - plan.sharedNapM)) < 0.011, '45: row 200 -> 14.45 m');
  const lift = strip.groundNAP - plan.sharedNapM;
  assert.ok(Math.abs(at('77943').a - (778 - 372) / 40 - lift) < 0.011 && Math.abs(at('77943').b - (778 - 203) / 40 - lift) < 0.011, '53 and 55 (one pand) keep their own eaves, 4.2 m apart');
  assert.throws(() => planFaceGround(face, face.houses.map(h => facts.get(h.pandId)!)), /needs the strip scale/);
  const bad = structuredClone(raw); bad.continuity.measuredEaves.push({pand: '0363100012177916', stripRow: 10, evidence: 'twice'});
  assert.throws(() => validateBlockFace(bad), /measured twice/);
});

test('partyClip on the face reaches every front', () => {
  assert.ok(houseIntents(face).every(i => i.fronts.every(f => f.partyClip === true)));
});

test('177915: the BAG/3DBAG footprint gap is a source limit, the model matches its survey', async () => {
  const r = await result, gate = r.gates.find(g => g.pand === '177915' && g.id === 'footprint-vs-bag')!;
  const short = surveyShortfall(facts.get('0363100012177915')!);
  assert.ok(short.fraction > 0.2 && Math.abs(short.bagM2 - short.surveyM2 - 12.5) < 0.3, `3DBAG misses ${short.bagM2 - short.surveyM2} m2`);
  assert.ok(gate.pass && (gate.value as any).bagIoU < 0.8 && (gate.value as any).surveyIoU >= 0.9, JSON.stringify(gate.value));
  // A full-footprint pand still has to match BAG.
  assert.ok(typeof r.gates.find(g => g.pand === '177916' && g.id === 'footprint-vs-bag')!.value === 'number');
});

test('face passes: gates, no detail overhang across the oblique party walls, eaves on the strip', async () => {
  const r = await result;
  assert.deepEqual(r.gates.filter(g => !g.pass).map(g => `${g.pand}/${g.id}`), []);
  for (const i of r.interference) {
    assert.ok(i.detailOverhangM.left <= 0.005 && i.detailOverhangM.right <= 0.005, `${i.left.slice(-6)}|${i.right.slice(-6)} overhang ${JSON.stringify(i.detailOverhangM)}`);
    assert.ok(i.pass, `${i.left.slice(-6)}|${i.right.slice(-6)}`);
  }
  const eaves = Object.fromEntries(r.perPand.map(p => [p.pand.slice(-6), p.eavesM]));
  assert.ok(Math.abs(eaves['177924'] - 14.48) < 0.05 && Math.abs(eaves['177923'] - 16.41) < 0.05, JSON.stringify(eaves));
});

test('audit loops past a shared edge on a party plane are trimming artefacts; an off-plane loop is not', async () => {
  const r = await result, tris = await decodePands(r.chunk.glb, face.houses.length);
  const contacts = [{a: 0, b: 1, ox: 0, oz: 0, dx: 0, dz: -1, s0: 0, s1: 5}];
  const plane: [number[], number[]][] = [[[0, 0, 0], [0, 3, -8]], [[0, 3, -8], [0, 0, -8]]], off: [number[], number[]][] = [[[2, 0, 0], [2, 3, -8]]];
  const box = {perimeter: 20, min: [-1, 0, -8], max: [1, 3, 0]};
  assert.equal(classifyPartyLoops([box], plane, contacts)[0].party, true, 'beyond s1=5 but on the plane');
  assert.equal(classifyPartyLoops([{...box, max: [3, 3, 0]}], [...plane, ...off], contacts)[0].party, false);
  assert.ok(openEdges(tris).length > 0);
});
