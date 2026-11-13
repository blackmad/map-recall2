// The destination pool: one entry per place, famous places first for a new
// rider. Regressions from the 2026-11-13 report: early rides went to El
// Tawheed (a neighbourhood mosque) and Meerpadkerk (a small Noord church)
// while the Westerkerk is a major landmark, and the pool listed several
// places twice.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { CANAL_CITIES } from './cities';
import { mergeManualPoiFeatures } from './manualPoiCatalog';
import { buildRouteDestinationPool } from './routeDestinationPool';
import { dedupeDestinations, isComplexPart, namesAlike, type DedupeFeature } from './destinationDedupe';
import { admitLandmarkCandidate } from './landmarkSelection';
import { pickNextStop } from './chainedRun';
import {
  FAMOUS_TIER_SCORE, capWeightShares, fameTierFactor, kmBetween, pickDestinationNear, pickHomeDestination,
  pickReviewRoute, pickSurpriseStart, tailOpenness, type RoutePoi,
} from './routeSelection';
import { notabilityScore } from './poiNotability';

const at = (id: string, name: string, lat: number, lng: number, extra: Partial<DedupeFeature> = {}): DedupeFeature =>
  ({ id, name, center: [lat, lng], ...extra });

test('dedupe: same QID, same article, A-list aliases, cross-language names and towers fold into one', () => {
  const features = [
    at('uva', 'University of Amsterdam', 52.3676, 4.8898, { wikidata: 'Q214341', wikidataSitelinks: 90 }),
    at('uva-model', 'Universiteit van Amsterdam', 52.3686, 4.8902, { wikidata: 'Q214341', manualPoi: true }),
    at('spanje', 'Spanjemonument', 52.38746, 4.91386, { wikipedia: 'nl:Spanjemonument', manualPoi: true }),
    at('pasaran', '1936-1939 No Pasaran', 52.3874, 4.91398, { wikipediaUrl: 'https://nl.wikipedia.org/wiki/Spanjemonument' }),
    at('xaverius', 'Sint-Franciscus Xaveriuskerk', 52.367682, 4.887755, { wikidata: 'Q1180056', wikidataSitelinks: 12, wikipediaPageviews60d: 900 }),
    at('krijtberg', 'De Krijtberg', 52.36774, 4.88781, { manualPoi: true }),
    at('olhos', "Ons' Lieve Heer op Solder", 52.37522, 4.90037),
    at('attic', 'Our Lord in the Attic', 52.37525, 4.90040, { wikidataSitelinks: 30 }),
    at('westerkerk', 'Westerkerk', 52.374392, 4.883614, { wikidata: 'Q1130722' }),
    at('westertoren', 'Westertoren', 52.374521, 4.883456, { wikipedia: 'nl:Westertoren (Amsterdam)' }),
    at('zuiderkerk', 'Zuiderkerk', 52.370147, 4.89958, { wikidata: 'Q228629' }),
    at('zuidertoren', 'Zuiderkerk Tower', 52.3702214, 4.8995216, { wikidata: 'Q1886733' }),
    at('rijks', 'Rijksmuseum', 52.36, 4.8852),
  ];
  const { kept, removed } = dedupeDestinations(features);
  const ids = kept.map(feature => feature.id).sort();
  assert.deepEqual(ids, ['attic', 'krijtberg', 'rijks', 'spanje', 'uva-model', 'westerkerk', 'zuiderkerk'].sort());
  assert.equal(removed.length, 6);
  // The modelled Krijtberg keeps its id and takes the extract twin's fame.
  const krijtberg = kept.find(feature => feature.id === 'krijtberg')!;
  assert.equal(krijtberg.wikidata, 'Q1180056');
  assert.equal(krijtberg.wikipediaPageviews60d, 900);
  assert.equal(removed.find(r => r.removedId === 'westertoren')?.reason, 'part-of');
});

test('dedupe: neighbours with different names stay apart; a location suffix is not a name', () => {
  assert.equal(namesAlike('Dumplings (Nassauplein)', 'Nassauplein'), false);
  assert.equal(namesAlike('Vondelpark bandstand', 'Vondelpark'), false);
  assert.equal(namesAlike('Het Lieverdje (Spui)', 'Het Lieverdje'), true);
  assert.equal(namesAlike('Magna Plaza', 'Huis Bartolotti'), false);
  assert.equal(isComplexPart(at('a', 'Westerkerk', 52.3744, 4.8836), at('b', 'Westertoren', 52.3745, 4.8835)), false);
  const { kept } = dedupeDestinations([
    at('plaza', 'Magna Plaza', 52.37386, 4.89075), at('bartolotti', 'Huis Bartolotti', 52.37428, 4.88896),
  ]);
  assert.equal(kept.length, 2);
});

test('selection: a new landmark needs an English article and the floor, unless it is on the A-list', () => {
  assert.deepEqual(admitLandmarkCandidate({ name: 'Bijbels Museum', notability: 4, hasEnglishArticle: true }), { admit: true });
  assert.deepEqual(admitLandmarkCandidate({ name: 'Buurtkerk', notability: 5, hasEnglishArticle: true }), { admit: false, reason: 'below floor' });
  assert.deepEqual(admitLandmarkCandidate({ name: 'Rijksmuseum', notability: 20, hasEnglishArticle: false }), { admit: false, reason: 'no English article' });
});

test('fame tier: famous places weigh fully; the tail opens with mastered names round the start', () => {
  const famous: RoutePoi = { id: 'r', name: 'Rijksmuseum', lat: 52.36, lng: 4.885 };
  const tail: RoutePoi = { id: 't', name: 'Buurtkerk', lat: 52.36, lng: 4.885, sitelinks: 2 };
  assert.ok(notabilityScore(famous) >= FAMOUS_TIER_SCORE);
  assert.equal(fameTierFactor(famous, 0), 1);
  assert.ok(fameTierFactor(tail, 0) < 0.05);
  const start = { lat: 52.364, lng: 4.8915 };
  const learned = Array.from({ length: 40 }, (_, i) => ({ lat: start.lat + i * 1e-4, lng: start.lng, mastery: 1 }));
  assert.equal(tailOpenness(start, []), 0);
  assert.equal(tailOpenness(start, learned), 1);
  assert.equal(fameTierFactor(tail, tailOpenness(start, learned)), 1);
});

test('home share cap leaves A-list places alone', () => {
  const capped = capWeightShares([3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 0.12, [true]);
  assert.equal(capped[0], 3);
  const flattened = capWeightShares([10, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 0.12);
  assert.ok(flattened[0] < 10);
});

// --- the real Amsterdam pool ------------------------------------------------
const raw = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/landmarks.json', 'utf8'));
const city = CANAL_CITIES.amsterdam;
const built = buildRouteDestinationPool(mergeManualPoiFeatures(raw, 'amsterdam'), city.curatedPois.map(poi => ({ ...poi })),
  { center: city.center, cityId: 'amsterdam' });
const pool = built.pois;
const names = new Set(pool.map(poi => poi.name));

test('Amsterdam pool: the reported duplicates are never both destinations', () => {
  const pairs: Array<[string, string]> = [
    ['University of Amsterdam', 'Universiteit van Amsterdam'],
    ['Oost-Indisch Huis', 'Dutch East Indian Company'],
    ['Spanjemonument', '1936-1939 No Pasaran'],
    ['Sint-Franciscus Xaveriuskerk', 'De Krijtberg'],
    ['Westertoren', 'Westerkerk'],
    ['Zuiderkerk Tower', 'Zuiderkerk'],
    ["Ons' Lieve Heer op Solder", 'Our Lord in the Attic'],
  ];
  for (const [a, b] of pairs) assert.ok(!(names.has(a) && names.has(b)), `${a} and ${b} are both destinations`);
  assert.ok(names.has('Westerkerk'));
  const qids = pool.flatMap(poi => (poi.wikidata ? [poi.wikidata] : []));
  assert.equal(new Set(qids).size, qids.length, 'one destination per Wikidata item');
});

const VIJZELSTRAAT = { id: 'start', name: 'Vijzelstraat', lat: 52.364, lng: 4.8915 };
function odds(pick: (unit: () => number, index: (n: number) => number) => RoutePoi | null | undefined, draws: number) {
  let seed = 4242;
  const unit = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const index = (n: number) => Math.floor(unit() * n);
  const tally = new Map<string, number>();
  for (let i = 0; i < draws; i += 1) {
    const poi = pick(unit, index);
    if (poi) tally.set(poi.name, (tally.get(poi.name) ?? 0) + 1);
  }
  return (name: string) => (tally.get(name) ?? 0) / draws;
}

test('a new rider at Vijzelstraat is sent to famous places, not neighbourhood ones', () => {
  const start = odds(unit => pickSurpriseStart(pool, [], unit), 6000);
  const surprise = odds(unit => pickDestinationNear(pool, VIJZELSTRAAT, unit), 6000);
  const home = odds(unit => pickHomeDestination(pool, VIJZELSTRAAT, [], unit)?.poi, 6000);
  const next = odds(unit => pickNextStop(pool, VIJZELSTRAAT, { chooseUnit: unit }), 6000);
  const streets = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/streets.json', 'utf8')) as Array<{ name: string; center: [number, number] }>;
  const due = streets.filter(street => kmBetween({ lat: street.center[0], lng: street.center[1] }, VIJZELSTRAAT) <= 2.5).slice(0, 40);
  const review = odds((_, index) => pickReviewRoute({ pois: pool, due, from: { ...VIJZELSTRAAT }, chooseIndex: index })?.to, 300);
  for (const [label, rate] of Object.entries({ start, surprise, home, next, review })) {
    assert.ok(rate('El Tawheed') < 0.01, `${label}: El Tawheed ${rate('El Tawheed')}`);
    assert.ok(rate('Meerpadkerk') < 0.01, `${label}: Meerpadkerk ${rate('Meerpadkerk')}`);
  }
  // The Westerkerk is 1.2 km from Vijzelstraat: outside a new rider's 1 km home ring, common otherwise.
  assert.ok(surprise('Westerkerk') > 0.015, `surprise: Westerkerk ${surprise('Westerkerk')}`);
  assert.ok(next('Westerkerk') > 0.015, `next stop: Westerkerk ${next('Westerkerk')}`);
});
