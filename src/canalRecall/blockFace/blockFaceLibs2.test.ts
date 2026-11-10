/**
 * Block-face type libraries round 2 (#113, 2026-11-09): the type match refuses what the first Jordaan batch placed.
 *  - a gable skyline (rise 2-5.5 m) vetoes the Jordaan cornice house, a cornice skyline vetoes the gable type
 *    (`match.crownStrict`); a skyline that is not sky-bounded (foliage) vetoes nothing;
 *  - a strip that reads grey render or near-black paint vetoes the brick Jordaan types (`match.materialVeto`);
 *  - the same evidence scores a Bellamy type exactly as before (no flag = byte-identical);
 *  - installVerdict refuses a run whose spans show no front (authored intents bypass the auto-place hold).
 *   node --import tsx --test src/canalRecall/blockFace/blockFaceLibs2.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scoreType, type MatchableType, type PandEvidence, type StripEvidence} from './autoPlace.ts';
import {defaultTypeLoader} from './typeLibrary.ts';
import {stripWallMaterial, materialVetoes} from './wallMaterial.ts';
import {installVerdict} from './batchInstall.ts';
import type {StripPalette} from './stripPalette.ts';

const neck = defaultTypeLoader('jordaan-1750-neck-gable') as MatchableType, cornice = defaultTypeLoader('jordaan-1850-cornice-house') as MatchableType;
const palette = (o: Partial<StripPalette> = {}): StripPalette => ({wall: '#7a4a3a', accent: '#e0e0e0', frame: '#e0e0e0', band: null, cornice: '#dddddd', fascia: '#333333', shares: {wall: 0.8, accent: 0.05, glass: 0.15}, stucco: false, bandRunsM: [], wallHsl: [14, 0.35, 0.36], pixels: 1000, ...o});
const sky = (crown: {riseM: number; topWidthM: number; widthM: number} | null) => ({eavesM: 9.4, eavesRow: 100, confidence: 1, crown: crown ? {...crown, centre: 0.5} : null}) as unknown as NonNullable<StripEvidence['skyline']>;
const strip = (o: Partial<StripEvidence> = {}): StripEvidence => ({date: '2024-12-16', px: [0, 220], palette: palette(), wall: '#7a4a3a', skyline: sky(null), voidShare: 0, foliageShare: 0, columns: 3, doorSide: 'left', ...o});
const pand = (o: Partial<PandEvidence> = {}): PandEvidence => ({pandId: '0363100012170001', address: 'Bloemgracht 99', builtYear: 1780, widthM: 5.2, eavesM: 9.4, roofMaxM: 13.8, storeys3dbag: 4, groundUses: ['woonfunctie'], osm: [], strip: strip(), ...o});
const GABLE = {riseM: 3.4, topWidthM: 0.5, widthM: 3.2};

test('crownStrict: a gable skyline vetoes the cornice house, a cornice skyline vetoes the gable type', () => {
  const gable = pand({strip: strip({skyline: sky(GABLE)})});
  assert.match(scoreType(cornice, gable).veto.join(), /fits no crown of the type/);
  assert.equal(scoreType(neck, gable).veto.length, 0);
  const flat = pand({strip: strip({skyline: sky(null)}), roofMaxM: 9.6});
  assert.match(scoreType(neck, flat).veto.join(), /fits no crown of the type/);
  assert.equal(scoreType(cornice, flat).veto.length, 0);
});

test('crownStrict: an unread or foliage-bounded skyline vetoes nothing', () => {
  const unread = pand({strip: strip({skyline: {...sky(GABLE), confidence: 0.3}})});
  assert.equal(scoreType(cornice, unread).veto.length, 0);
  const leafy = pand({strip: strip({skyline: sky(GABLE), skyBound: {leafTopShare: 0.6, spanM: 5.2}})});
  assert.equal(scoreType(cornice, leafy).veto.length, 0);
  // a crown top 5 m over the 3DBAG roof max is a tree or a building behind
  const over = pand({strip: strip({skyline: sky({riseM: 5.4, topWidthM: 0.5, widthM: 3})}), roofMaxM: 9.8});
  assert.equal(scoreType(cornice, over).veto.length, 0);
});

test('materialVeto: grey render and near-black paint veto the brick Jordaan types', () => {
  const render = pand({strip: strip({palette: palette({stucco: true}), wall: '#8a8a88'})});
  assert.match(scoreType(cornice, render).veto.join(), /painted\/render/);
  const black = pand({strip: strip({wall: '#1c1c1e'})});
  assert.match(scoreType(cornice, black).veto.join(), /near-black/);
  assert.equal(scoreType(cornice, pand()).veto.length, 0, 'a brick wall vetoes nothing');
  // dark brown brick under shade (Bloemgracht 210, #493c2c) is not black paint
  assert.equal(stripWallMaterial({stucco: false, wall: '#493c2c'})!.material, 'brick');
});

test('materialVeto: a rule without the flag is unchanged', () => {
  assert.deepEqual(materialVetoes({stucco: false}, {material: 'render', why: 'x'}), []);
  assert.deepEqual(materialVetoes({materialVeto: true, stucco: true}, {material: 'render', why: 'x'}), []);
  assert.equal(materialVetoes({materialVeto: true, blackPaint: true}, {material: 'black-paint', why: 'x'}).length, 0);
});

test('installVerdict: a run without a front on the strip does not install (authored intents bypass the auto-place hold)', () => {
  const ok = {strip: {bad: false, reasons: []}, compile: {gatesFailed: [], auditPassed: true}, likeness: [{pandId: 'a', ncc: 0.3}], stripOverDrawn: 1, brickPands: 1};
  assert.equal(installVerdict(ok).install, true);
  assert.equal(installVerdict({...ok, evidence: {pass: true, reasons: []}}).install, true);
  const v = installVerdict({...ok, evidence: {pass: false, reasons: ['170001: sky over the roof in 40 % of columns']}});
  assert.equal(v.install, false);
  assert.match(v.reasons.join(), /no-front: 170001/);
});
