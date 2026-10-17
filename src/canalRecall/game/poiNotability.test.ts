import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  A_LIST_BOOST,
  HERITAGE_RIJKSMONUMENT,
  HERITAGE_RIJKSMONUMENT_BONUS,
  HERITAGE_UNESCO,
  HERITAGE_UNESCO_BONUS,
  MANUAL_TIEBREAK,
  NOTABILITY_FAME_CAP,
  NOTABILITY_TEMPERATURE,
  heritageBonus,
  isAList,
  notabilityFameFactor,
  notabilityScore,
  notabilityWeight,
  tagKind,
  tagWeight,
  type PoiNotability,
} from './poiNotability.ts';

const bare = (over: Partial<PoiNotability> = {}): PoiNotability => ({ name: 'Somewhere', ...over });

test('a bare POI still scores a stable, finite baseline', () => {
  const score = notabilityScore(bare());
  assert.ok(Number.isFinite(score));
  assert.equal(score, 0, 'no sitelinks, pageviews, heritage or tag weight');
});

test('missing pageviews are neutral, never read as a measured zero', () => {
  const withViews = notabilityScore(bare({ sitelinks: 0, pageviews60d: 0 }));
  const withoutViews = notabilityScore(bare({ sitelinks: 0 }));
  assert.equal(withViews, withoutViews, 'pageviews60d === 0 and undefined must score identically');
});

test('sitelinks and pageviews both raise the score', () => {
  const low = notabilityScore(bare({ sitelinks: 1 }));
  const high = notabilityScore(bare({ sitelinks: 31, pageviews60d: 9999 }));
  assert.ok(high > low);
});

test('A-list membership is matched by normalised name, alias and Wikidata id', () => {
  assert.equal(isAList(bare({ name: 'Rijksmuseum' })), true);
  assert.equal(isAList(bare({ name: 'Anne Frank House' })), true, 'an alias resolves to Anne Frank Huis');
  assert.equal(isAList(bare({ name: '  Van   Gogh  Museum ' })), true, 'whitespace is normalised');
  assert.equal(isAList(bare({ name: 'Some Corner Cafe', wikidata: 'Q190804' })), true, 'Wikidata id outranks the name');
  assert.equal(isAList(bare({ name: 'A Corner Cafe' })), false);
});

test('the A-list boost dominates the ordinary tail', () => {
  const plain = notabilityScore(bare({ sitelinks: 5, pageviews60d: 500 }));
  const famous = notabilityScore(bare({ name: 'Westerkerk', sitelinks: 5, pageviews60d: 500 }));
  assert.equal(famous, plain + A_LIST_BOOST);
});

test('heritage bonus: UNESCO outranks rijksmonument, which outranks nothing', () => {
  assert.equal(heritageBonus(undefined), 0);
  assert.equal(heritageBonus([]), 0);
  assert.equal(heritageBonus([HERITAGE_RIJKSMONUMENT]), HERITAGE_RIJKSMONUMENT_BONUS);
  assert.equal(heritageBonus([HERITAGE_UNESCO]), HERITAGE_UNESCO_BONUS);
  assert.equal(heritageBonus([HERITAGE_RIJKSMONUMENT, HERITAGE_UNESCO]), HERITAGE_UNESCO_BONUS, 'UNESCO wins');
});

test('tagKind resolves from OSM tags, the extract type, then Wikidata instance-of', () => {
  assert.equal(tagKind(bare({ tourism: 'museum' })), 'museum');
  assert.equal(tagKind(bare({ tourism: 'zoo' })), 'zoo');
  assert.equal(tagKind(bare({ type: 'museum' })), 'museum');
  assert.equal(tagKind(bare({ amenity: 'place_of_worship' })), 'place_of_worship');
  assert.equal(tagKind(bare({ historic: 'memorial' })), 'memorial');
  assert.equal(tagKind(bare({ wikidataInstanceOf: ['Q33506'] })), 'museum', 'P31 museum');
  assert.equal(tagKind(bare({ wikidataInstanceOf: ['Q43501'] })), 'zoo', 'P31 zoo');
  assert.equal(tagKind(bare({ wikidataInstanceOf: ['Q16970'] })), 'place_of_worship', 'P31 church');
  assert.equal(tagKind(bare()), null);
});

test('tagWeight rewards destinations, penalises plain churches, and lets fame redeem them', () => {
  assert.equal(tagWeight(bare({ tourism: 'museum' })), 1.5);
  assert.equal(tagWeight(bare({ tourism: 'attraction' })), 1.5);
  assert.equal(tagWeight(bare({ historic: 'memorial' })), 0.8);
  assert.equal(tagWeight(bare({ tourism: 'artwork' })), 0.8);
  assert.equal(tagWeight(bare({ amenity: 'place_of_worship' })), -1.5, 'a plain church is not a destination');
  assert.equal(tagWeight(bare({ amenity: 'place_of_worship', name: 'Westerkerk' })), 0, 'an A-list church is redeemed');
  assert.equal(
    tagWeight(bare({ amenity: 'place_of_worship', heritage: [HERITAGE_RIJKSMONUMENT] })),
    0,
    'a rijksmonument church is redeemed',
  );
  assert.equal(tagWeight(bare({})), 0);
});

test('manual status is only a small tie-break, never a floor', () => {
  const plain = notabilityScore(bare());
  const manual = notabilityScore(bare({ manualPoi: true }));
  assert.ok(manual > plain);
  assert.equal(manual, plain + MANUAL_TIEBREAK);
  assert.ok(MANUAL_TIEBREAK < A_LIST_BOOST, 'the tie-break stays well below real fame');
});

test('notabilityWeight is a softmax in score over temperature', () => {
  assert.ok(notabilityWeight(10) > notabilityWeight(0));
  assert.equal(notabilityWeight(0, NOTABILITY_TEMPERATURE), 1);
  assert.equal(notabilityWeight(1, 1), Math.exp(1));
});

test('notabilityFameFactor stays bounded between 1 and 1 + cap', () => {
  assert.equal(notabilityFameFactor(bare()), 1, 'unknown places add no fame');
  assert.ok(notabilityFameFactor(bare({ name: 'Rijksmuseum', sitelinks: 70, pageviews60d: 20000 })) > 1);
  const skyHigh = notabilityFameFactor(bare({ name: 'Rijksmuseum', sitelinks: 1000, pageviews60d: 1_000_000 }));
  assert.equal(skyHigh, 1 + NOTABILITY_FAME_CAP, 'the cap keeps a favourite from swamping the ring');
});

test('a recognisable landmark outranks an ordinary building', () => {
  const famous = notabilityScore(bare({
    name: 'Rijksmuseum', sitelinks: 70, pageviews60d: 20000, heritage: [HERITAGE_RIJKSMONUMENT], type: 'museum',
  }));
  const ordinary = notabilityScore(bare({ name: 'Kinkerstraat flats', sitelinks: 1, type: 'landmark' }));
  assert.ok(famous > ordinary);
});
