/**
 * Nieuwmarkt/Lastage (2026-11-10, AF04/AF05/AF08/AF09). Named regressions: the BAG year 1905 is a placeholder on 109 of
 * the 748 pands (17th-18th c. gables and cornice houses with no known date), so a type may list it in
 * `match.unknownYears`: the year then neither vetoes nor passes. Absent = every year is a date (byte-identical).
 *   node --import tsx --test src/canalRecall/blockFace/nieuwmarktLastage.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scoreType, type MatchableType} from './autoPlace.ts';
import {defaultTypeLoader} from './typeLibrary.ts';

const ev = (builtYear: number | null) => ({pandId: 'p', address: 'a', builtYear, widthM: 5.6, eavesM: 12.4, roofMaxM: 15.8, storeys3dbag: 4, groundUses: [], osm: [], strip: null}) as never;
const yearVeto = (t: MatchableType, y: number | null) => scoreType(t, ev(y)).veto.filter(v => /built|build year/.test(v));

test('unknownYears: a placeholder year skips the year veto; absent keeps the veto (byte-identical)', () => {
  const base = defaultTypeLoader('jordaan-1850-cornice-house') as MatchableType;
  assert.equal(base.match!.unknownYears, undefined);
  assert.deepEqual(yearVeto(base, 1905), []);
  assert.equal(yearVeto(base, 1985).length, 1);
  const old = {...base, match: {...base.match!, years: [1600, 1800] as [number, number]}} as MatchableType;
  assert.equal(yearVeto(old, 1905).length, 1, 'without the list 1905 is a date and vetoes a pre-1800 type');
  const guarded = {...old, match: {...old.match!, unknownYears: [1905]}} as MatchableType;
  assert.deepEqual(yearVeto(guarded, 1905), []);
  assert.equal(yearVeto(guarded, 1906).length, 1, 'only the listed year is a placeholder');
  assert.deepEqual(yearVeto(guarded, null), ['no build year'], 'a missing year still vetoes');
  assert.deepEqual(scoreType(old, ev(1700)), scoreType(guarded, ev(1700)), 'a real year scores the same with or without the list');
});

test('groundFront bayWeights/transom/lights (Rapenburg 99): measured bays, one transom line, mullioned lights; absent = byte-identical', async () => {
  const {groundFrontLayout} = await import('../buildingRecipe/fit.ts');
  const run = (g: object) => { const openings: any[] = []; const blocks = groundFrontLayout({kind: 'pui', bays: ['door', 'door', 'window'], colour: '#ece9e0', ...g} as never, 5.7, 4.8, openings); return {openings, blocks}; };
  const base = run({});
  assert.deepEqual(run({bayWeights: [1, 1, 1]}), base, 'equal weights = the stock equal bays');
  const m = run({bayWeights: [0.75, 0.8, 2.5], transom: 2.4, lights: 4});
  const doors = m.openings.filter(o => o.id.endsWith('-door')), win = m.openings.find(o => o.id.endsWith('-window'));
  assert.ok(doors.every(d => d.widthM < 1.0), 'narrow door bays');
  assert.ok(win.widthM > 2.6, 'the shop window takes the wide bay');
  assert.ok(doors.every(d => Math.abs(d.bottomM + d.heightM - 2.34) < 0.02), 'door heads under the transom line');
  assert.ok(Math.abs(win.bottomM + win.heightM * win.horizontalBars[0] - 2.4) < 0.01, 'window transom bar on the line');
  assert.deepEqual(win.verticalBars, [0.25, 0.5, 0.75]);
});

test('atticLight is validated and only with rectangular attic windows', async () => {
  const {validateIntent} = await import('../buildingRecipe/intent.ts');
  const intent = (front: object) => ({schemaVersion: 1, kind: 'canal-house', pandId: '0363100012170674', id: 't', sources: [], fronts: [{id: 'f', street: 'S', gable: 'bell', storeys: 4, bays: 3, doorBay: 0, basement: 'none', cornice: 'none', windows: 'sash', atticWindows: 1, ...front}]});
  const probs = (front: object) => { try { validateIntent(intent(front) as never); return []; } catch (e) { return (e as Error).message.split('\n').filter(p => p.includes('atticLight')); } };
  assert.deepEqual(probs({atticLight: {light: 1.0, sill: -0.5}}), []);
  assert.equal(probs({atticLight: {light: 2.0, sill: 0}}).length, 1);
  assert.equal(probs({atticLight: {light: 1.0, sill: 0}, atticWindows: 0}).length, 1);
});
