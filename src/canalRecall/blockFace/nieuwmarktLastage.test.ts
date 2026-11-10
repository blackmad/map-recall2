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
