import test from 'node:test';
import assert from 'node:assert/strict';
import { artHasSubstance, hasCardSubstance, isLabelOnly, poiChipEnglish, poiChipKey } from './poiCardPolicy.ts';
import { ClickPoiIndex, poiChipLabel, type ClickPoiRow } from './clickPoiInfo.ts';
import { StreetArtIndex, streetArtCard, type StreetArtPoint } from './streetArt.ts';
import { en } from '../i18n/messages/en.ts';
import { nl } from '../i18n/messages/nl.ts';
import { resetLanguageForTests, setLanguage } from '../i18n/index.ts';

const art: ClickPoiRow = ['n4771449016', 'Brettensuite 11/20', 4.8363, 52.3861, 'art', 'an artwork', '', '', ''];
const cafe: ClickPoiRow = ['n1', 'Café Zed', 4.9001, 52.3701, 'food', 'a café', '', '', ''];
const cafeAddr: ClickPoiRow = ['n2', 'Café Adres', 4.9002, 52.3702, 'food', 'a café', 'Teststraat 1', '', ''];
const series: StreetArtPoint = { id: 'n4771449016', name: 'Brettensuite 11/20', lng: 4.8363, lat: 52.3861, k: 'sculpture', a: 'Herbert Nouwens',
  s: 'Beeldenroute Brettensuite', n: 11, m: 20, e: 'A sculpture trail of 20 sculptures.', u: 'https://nl.wikipedia.org/wiki/Beeldenroute_Brettensuite' };

test('a row with only its kind is label-only; an address makes it a card', () => {
  assert.equal(isLabelOnly(art), true);
  assert.equal(isLabelOnly(cafe), true);
  assert.equal(isLabelOnly(cafeAddr), false);
});

test('an artwork needs street-art substance to earn a card', () => {
  assert.equal(hasCardSubstance(art, null), false);
  assert.equal(hasCardSubstance(art, { id: 'x', name: 'x', lng: 0, lat: 0, k: 'artwork' }), false);
  assert.equal(hasCardSubstance(art, series), true);
  assert.equal(artHasSubstance({ id: 'x', name: 'x', lng: 0, lat: 0, k: 'artwork', y: '1997' }), true);
});

test('the series piece card says its part, artist, series text and carries the Wikipedia link', () => {
  const card = streetArtCard(series);
  assert.match(card.detail!, /^Part 11 of 20 of Beeldenroute Brettensuite\. A sculpture trail/);
  assert.match(card.longDetail!, /Herbert Nouwens/);
  assert.equal(card.wikipediaUrl, 'https://nl.wikipedia.org/wiki/Beeldenroute_Brettensuite');
  assert.equal(card.type, 'sculpture');
  assert.doesNotMatch(card.detail!, /^An artwork/);
});

test('StreetArtIndex finds a record by the OSM id of a click POI', () => {
  const index = new StreetArtIndex({ version: 1, source: '', points: [series] });
  assert.equal(index.byId('n4771449016')?.n, 11);
  assert.equal(index.byId('n0'), null);
  assert.equal(index.byId(undefined), null);
});

test('a building holding only label-only places gets no mapped-place card, so the building answers', () => {
  const box = [[4.9, 52.37], [4.9005, 52.37], [4.9005, 52.3705], [4.9, 52.3705], [4.9, 52.37]];
  const footprint = { type: 'Polygon' as const, coordinates: [box] };
  const only = new ClickPoiIndex({ version: 1, source: '', points: [art.slice() as ClickPoiRow, cafe] .map(r => [r[0], r[1], 4.9002, 52.3702, ...r.slice(4)] as ClickPoiRow) });
  assert.equal(only.card({ id: 'p', lngLat: [4.9, 52.37], footprint, featureTarget: null }), null);
  const mixed = new ClickPoiIndex({ version: 1, source: '', points: [[cafe[0], cafe[1], 4.9002, 52.3702, ...cafe.slice(4)] as ClickPoiRow, [cafeAddr[0], cafeAddr[1], 4.9003, 52.3703, ...cafeAddr.slice(4)] as ClickPoiRow] });
  const card = mixed.card({ id: 'p', lngLat: [4.9, 52.37], footprint, featureTarget: null })!;
  assert.equal(card.name, 'Café Adres');
  assert.match(card.detail!, /Teststraat 1/);
  assert.equal(card.typeLabel, 'CAFÉ');
});

test('chips name the thing, never BUILDING', () => {
  resetLanguageForTests(); setLanguage('en', { persist: false });
  assert.equal(poiChipEnglish(art), 'ARTWORK');
  assert.equal(poiChipEnglish(cafe), 'CAFÉ');
  assert.equal(poiChipLabel(art), 'ARTWORK');
  setLanguage('nl', { persist: false });
  assert.equal(poiChipLabel(art), 'KUNSTWERK');
  assert.equal(poiChipLabel(cafe), 'ETEN EN DRINKEN');
  assert.match(streetArtCard(series).detail!, /^Deel 11 van 20 van Beeldenroute Brettensuite\./);
  resetLanguageForTests();
});

test('every chip category has an English and a Dutch message', () => {
  for (const c of ['art', 'food', 'shop', 'lodging', 'culture', 'education', 'civic', 'bike', 'worship', 'leisure', 'health', 'market', 'place']) {
    const key = `poi.chip.${c}` as keyof typeof en;
    assert.ok(en[key] && nl[key], key);
  }
  assert.equal(poiChipKey('unknown'), 'poi.chip.place');
});
