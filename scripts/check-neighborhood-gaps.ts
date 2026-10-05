import assert from 'node:assert/strict';
import {
  aliasCandidates, aliasOf, areaKm2, auditCoverage, commonsAttribution, flat, missingFields, offlineCandidates,
  pointInPolygons, rankCommonsFiles, sentencesAbout, stemOf, streetIsNearby, streetTheme, streetsMatchingStem,
  wikidataLooksRight, type Boundary, type CommonsFile, type StreetOrigin, type StreetSegment,
} from '../src/mapRecall/neighborhoodGaps';

const square = (name: string, kind: string, lat: number, lng: number, size: number, id = 1): Boundary => ({
  id, name, kind, adminLevel: 10,
  geometry: [[[[lat, lng], [lat, lng + size], [lat + size, lng + size], [lat + size, lng], [lat, lng]]]],
});

// Names -> stems and aliases.
assert.equal(stemOf('Rijnbuurt'), 'rijn');
assert.equal(stemOf('Van Galenbuurt'), 'vangalen');
assert.equal(stemOf('Hoofdweg e.o.'), 'hoofdweg');
assert.equal(stemOf('Polder Meerzicht'), 'meerzicht');
assert.equal(stemOf('Revaleiland'), 'reval');
assert.equal(aliasOf('Nieuwmarkt/Lastage', ['Nieuwmarktbuurt', 'Jordaan']), 'Nieuwmarktbuurt');
assert.equal(aliasOf('Jordaan', ['Nieuwmarktbuurt']), null);
assert.equal(aliasOf('Oost', ['Oostenburg']), null, 'a short stem never aliases');

// Geometry.
const hood = square('Sportheldenbuurt', 'neighbourhood', 52.37, 4.96, 0.01);
assert.ok(pointInPolygons([52.375, 4.965], hood.geometry));
assert.ok(!pointInPolygons([52.39, 4.965], hood.geometry));
assert.ok(areaKm2(hood.geometry) > 0.5 && areaKm2(hood.geometry) < 1.2);

// Street matching: word-boundary starts, nearby namesakes only.
const origins: StreetOrigin[] = [
  { name: 'Jan van Galenstraat', kind: 'street', en: 'Named after Jan van Galen, a naval officer.', bagId: 'b1' },
  { name: 'Rijnstraat', kind: 'street', en: 'Named after the river Rhine.', bagId: 'b2' },
  { name: 'Rijnsburgstraat', kind: 'street', en: 'Named after Rijnsburg.', bagId: 'b3' },
  { name: 'Arie Haan Laan', kind: 'street', en: 'Arie Haan (1948) is a Dutch footballer.', bagId: 's1' },
  { name: 'Jaap Eden Laan', kind: 'street', en: 'Jaap Eden (1873) was a Dutch speed skater and cyclist.', bagId: 's2' },
  { name: 'Faas Wilkes Laan', kind: 'street', en: 'Faas Wilkes (1923) was a Dutch footballer.', bagId: 's3' },
  { name: 'Leidsestraat', kind: 'street', en: 'Leads to Leiden.', bagId: 'l1' },
];
assert.deepEqual(streetsMatchingStem('vangalen', origins).map(o => o.name), ['Jan van Galenstraat']);
assert.deepEqual(streetsMatchingStem('rijn', origins).map(o => o.name).sort(), ['Rijnsburgstraat', 'Rijnstraat']);
assert.deepEqual(streetsMatchingStem('ri', origins), [], 'too-short stems match nothing');

const here = (name: string, dlat = 0.002): StreetSegment => ({ name, center: [52.372 + dlat, 4.965] });
const segments: StreetSegment[] = [here('Arie Haan Laan'), here('Jaap Eden Laan', 0.003), here('Faas Wilkes Laan', 0.004), here('Jaap Eden Laan', 0.005),
  { name: 'Rijnstraat', center: [52.2, 4.5] }];
assert.ok(streetIsNearby('Arie Haan Laan', segments, hood));
assert.ok(!streetIsNearby('Rijnstraat', segments, hood), 'a namesake across town is not this area\'s street');

// Themes need three explained streets and a majority.
const inside = ['Arie Haan Laan', 'Jaap Eden Laan', 'Faas Wilkes Laan'];
assert.equal(streetTheme(inside, origins)?.phrase, 'sportspeople');
assert.equal(streetTheme(['Arie Haan Laan', 'Jaap Eden Laan'], origins), null, 'two streets are not a theme');
assert.equal(streetTheme(['Arie Haan Laan', 'Leidsestraat', 'Rijnstraat', 'Jan van Galenstraat'], origins), null, 'no majority, no theme');

// Offline candidates for a themed area with no street of its own name.
const all = [square('Zeeburg', 'suburb', 52.36, 4.95, 0.04, 9), hood];
const candidates = offlineCandidates({ hood, all, origins, segments, places: [{ name: 'Sportpark', type: 'park', center: [52.374, 4.964] }], missing: ['description', 'nameOrigin', 'photo'] });
const nameOrigin = candidates.find(c => c.field === 'nameOrigin');
assert.equal(nameOrigin?.method, 'street-theme');
assert.match(nameOrigin!.text!, /named after sportspeople, such as/);
assert.equal(streetsMatchingStem('sluis', [{ name: 'Mary van der Sluisstraat', kind: 'street', en: 'x' }]).length, 0, 'a surname inside a street name is not a match');
assert.equal(offlineCandidates({ hood: square('Zuid', 'suburb', 52.3, 4.9, 0.05), all: [], origins: [{ name: 'Zuid-Hollandstraat', kind: 'street', en: 'x' }], segments: [{ name: 'Zuid-Hollandstraat', center: [52.31, 4.91] }], places: [], missing: ['nameOrigin'] }).length, 0, 'districts never match a street');
assert.equal(nameOrigin!.needsReview, true);
// A street list is not trivia: with no fact about anything inside, there is no description at all.
assert.ok(!candidates.some(c => c.field === 'description'), 'no composed street-list description');
assert.equal(candidates.filter(c => c.field === 'nameOrigin').length, 1);
// With a reviewed fact about a place inside, that fact is the description, sourced to its own article.
const park = { id: 'p1', name: 'Sportpark Middenmeer', type: 'park', center: [52.374, 4.964] as [number, number] };
const bridge = { id: 'b1', name: 'Zuiderbrug', type: 'bridge', center: [52.375, 4.965] as [number, number] };
const elsewhere = { id: 'x1', name: 'Faraway Tower', type: 'landmark', center: [52.5, 5.1] as [number, number] };
const facts = [
  { id: 'x1', name: 'Faraway Tower', collection: 'landmarks', facts: [{ text: 'Faraway Tower was built entirely without nails, which was a marvel in its day.', kind: 'surprise', sourceUrl: 'https://nl.wikipedia.org/wiki/Faraway', sourceLanguage: 'nl' }] },
  { id: 'b1', name: 'Zuiderbrug', collection: 'bridges', facts: [
    { text: 'The bridge opened in 1912 and was the first in the city to carry a tram line.', kind: 'history', sourceUrl: 'https://nl.wikipedia.org/wiki/Zuiderbrug', sourceLanguage: 'nl' },
    { text: 'Short.', kind: 'surprise', sourceUrl: 'u' }] },
  { id: 'p1', name: 'Sportpark Middenmeer', collection: 'parks', facts: [{ text: 'Sportpark Middenmeer was laid out on land reclaimed from the Watergraafsmeer polder in the 1930s.', kind: 'culture', sourceUrl: 'https://nl.wikipedia.org/wiki/Sportpark_Middenmeer', sourceLanguage: 'nl' }] },
];
const withFacts = offlineCandidates({ hood, all, origins, segments, places: [park, bridge, elsewhere], facts, missing: ['description', 'history'] });
const fromFact = withFacts.find(c => c.field === 'description');
assert.equal(fromFact?.method, 'inside-fact');
assert.match(fromFact!.text!, /^Sportpark Middenmeer was laid out on land reclaimed/);
assert.equal(fromFact!.sourceUrl, 'https://nl.wikipedia.org/wiki/Sportpark_Middenmeer', 'links to that place\'s article');
assert.equal(fromFact!.sourceLabel, 'Wikipedia (translated from Dutch)');
assert.equal(withFacts.find(c => c.field === 'history')?.text, 'Zuiderbrug (bridge here): The bridge opened in 1912 and was the first in the city to carry a tram line.', 'a history fact names its place when the sentence does not');
assert.ok(!withFacts.some(c => /Faraway/.test(c.text ?? '')), 'a place outside the boundary is never used');
assert.ok(!candidates.some(c => c.field === 'photo'), 'offline never invents a photo');

// A street that gives the area its name wins over a theme.
const vg = square('Van Galenbuurt', 'neighbourhood', 52.37, 4.96, 0.01, 3);
const vgSegments: StreetSegment[] = [{ name: 'Jan van Galenstraat', center: [52.375, 4.965] }];
const named = offlineCandidates({ hood: vg, all: [vg], origins, segments: vgSegments, places: [], missing: ['nameOrigin'] });
assert.equal(named[0].method, 'street-name');
assert.match(named[0].text!, /^The name matches Jan van Galenstraat, in the area\. Named after Jan van Galen/);
const selfMatch = offlineCandidates({ hood: square('Revaleiland', 'neighbourhood', 52.37, 4.96, 0.01, 4), all: [], origins: [{ name: 'Revaleiland', kind: 'street', en: 'Now Tallinn, the capital of Estonia.', bagId: 'r1' }], segments: [{ name: 'Revaleiland', center: [52.375, 4.965] }], places: [], missing: ['nameOrigin'] });
assert.equal(selfMatch[0].text, 'Now Tallinn, the capital of Estonia.');
assert.equal(selfMatch[0].needsReview, false, 'the register entry for the very same name needs no second look');

// Alias hoisting.
const hoisted = aliasCandidates('Nieuwmarkt/Lastage', 'Nieuwmarktbuurt',
  { description: { text: 'Lede.', lang: 'en', sourceUrl: 'u' }, nameOrigin: { text: 'Naam.', lang: 'nl', sourceUrl: 'u2' }, photo: { imageUrl: 'https://x/p.jpg' } },
  ['description', 'nameOrigin', 'photo']);
assert.deepEqual(hoisted.map(c => c.field).sort(), ['description', 'nameOrigin', 'photo']);
assert.equal(hoisted.find(c => c.field === 'nameOrigin')!.needsReview, true, 'Dutch always needs the translation pass');

// Coverage audit.
const cov = auditCoverage([hood, all[0]],
  new Map([['Sportheldenbuurt', { description: {} }]]), new Map([['Sportheldenbuurt', { imageUrl: 'x' }]]));
assert.deepEqual(missingFields(cov[0]), ['history', 'nameOrigin']);
assert.deepEqual(missingFields(cov[1]).length, 4);

// Sentences from another article.
const district = 'De Watergraafsmeer is een stadsdeel. De Sportheldenbuurt is een buurt in Amsterdam-Oost, vlak bij Middenmeer. Het wordt ook wel anders genoemd. Straten dragen de namen van sporthelden.';
assert.equal(sentencesAbout(district, 'Sportheldenbuurt'), 'De Sportheldenbuurt is een buurt in Amsterdam-Oost, vlak bij Middenmeer.');
assert.equal(sentencesAbout(district, 'Onbekendbuurt'), undefined);
assert.equal(sentencesAbout(district, 'Oost'), undefined, 'a name too short to trust');

// Commons photo choice.
const file = (over: Partial<CommonsFile>): CommonsFile => ({ title: 'File:A.jpg', url: 'u', width: 2000, height: 1200, mime: 'image/jpeg', license: 'CC BY-SA 4.0', ...over });
const ranked = rankCommonsFiles([
  file({ title: 'File:Map_of_Sportheldenbuurt.png', mime: 'image/png' }),
  file({ title: 'File:Areas.png', mime: 'image/png' }),
  file({ title: 'File:Logo.jpg' }),
  file({ title: 'File:Portrait.jpg', width: 900, height: 1400 }),
  file({ title: 'File:Sportheldenbuurt street.jpg' }),
  file({ title: 'File:Random street.jpg', license: 'All rights reserved' }),
  file({ title: 'File:Small.jpg', width: 300, height: 200 }),
  file({ title: 'File:Other.jpg' }),
], 'Sportheldenbuurt');
assert.deepEqual(ranked.map(f => f.title), ['File:Sportheldenbuurt street.jpg', 'File:Other.jpg', 'File:Portrait.jpg']);
assert.equal(commonsAttribution(file({ title: 'File:A b.jpg', artist: '<a href="x">Jane</a>' })), 'Wikimedia Commons: A b.jpg (Jane, CC BY-SA 4.0)');

// Wikidata matches must be Amsterdam places that look like the name.
assert.ok(wikidataLooksRight('neighbourhood of Amsterdam', 'Sportheldenbuurt', 'Sportheldenbuurt'));
assert.ok(!wikidataLooksRight('neighbourhood of Utrecht', 'Sportheldenbuurt', 'Sportheldenbuurt'));
assert.ok(!wikidataLooksRight('neighbourhood of Amsterdam', 'Rijnstraat', 'Gouden Bocht'));
assert.equal(flat('Gouden Bocht'), 'goudenbocht');

{
  const { nameOriginSentences } = await import('./fill-neighborhood-gaps');
  const sluis = 'De Sluisbuurt is een wijk op het Zeeburgereiland. De wijk ligt aan de Oranjesluizen, waarnaar de wijk vernoemd is. Zo werd de hoofdstraat vernoemd naar Rudi van Dantzig.';
  assert.equal(nameOriginSentences(sluis, 'nl', 'Sluisbuurt'), 'De wijk ligt aan de Oranjesluizen, waarnaar de wijk vernoemd is.', 'the sentence about the area, not about a street in it');
  assert.equal(nameOriginSentences('De leden treden op onder de naam PRO. De zetelverdeling was zo.', 'nl', 'Zuid'), undefined, 'a party name is not a place name');
  assert.equal(nameOriginSentences('Het bedrijf kreeg de naam Werkspoor. Oostenburg is een eiland.', 'nl', 'Oostenburg'), undefined);
  assert.match(nameOriginSentences('Dorp.\n\n== Naam ==\nDe naam komt van een boerderij.\n', 'nl', 'Dorp')!, /boerderij/, 'a naming section is taken whole');
}
console.log('Neighbourhood gap-fill checks passed.');

// Choosing and publishing: the best shippable candidate per field, articles beat composed text.
{
  const { compareCandidates, mergeCandidates, replaceableBy } = await import('../src/mapRecall/neighborhoodGaps');
  const { publishable } = await import('./fill-neighborhood-gaps');
  const base = { name: 'A', field: 'description' as const, sourceUrl: 'u', sourceLabel: 'l', needsReview: false };
  const composed = { ...base, text: 'Composed.', lang: 'en' as const, method: 'inside-boundary' as const, confidence: 'medium' as const };
  const article = { ...base, text: 'Dutch lede.', lang: 'nl' as const, method: 'wiki-article' as const, confidence: 'high' as const, needsReview: true };
  assert.equal([composed, article].sort(compareCandidates)[0], article, 'a high-confidence article outranks composed text');
  // Dutch without a reviewed English is held, so the composed English ships meanwhile.
  assert.deepEqual(publishable([composed, article], {}, false).map(c => c.final), ['Composed.']);
  // Once translated, the article wins.
  assert.deepEqual(publishable([composed, article], { A: { description: { approve: true, en: 'English lede.' } } }, false).map(c => c.final), ['English lede.']);
  // An explicit null drops a field.
  assert.deepEqual(publishable([composed], { A: { description: null } }, false), []);
  // Needs-review English waits for approval or --accept offline.
  const themed = { ...composed, field: 'nameOrigin' as const, method: 'street-theme' as const, needsReview: true };
  assert.equal(publishable([themed], {}, false).length, 0);
  assert.equal(publishable([themed], {}, true).length, 1);
  assert.equal(replaceableBy('derived', article), true);
  assert.equal(replaceableBy(undefined, article), false, 'legacy entries are never replaced');
  assert.equal(replaceableBy('wikipedia', article), false);
  assert.equal(mergeCandidates([composed, article], [{ ...article, text: 'New.' }]).length, 2);
  console.log('Neighbourhood publish checks passed.');
}

{
  const { historyFromBody } = await import('../src/mapRecall/neighborhoodGaps');
  const spor = [
    'Sporenburg is een kunstmatig schiereiland dat in de 19e eeuw is aangeplempt in het Oostelijk Havengebied van Amsterdam.',
    'Het schiereiland ligt in oost-westelijke richting en wordt aan drie kanten door water omgeven.',
    'Sinds de jaren negentig van de twintigste eeuw is het gebied herontwikkeld tot een woonwijk.',
  ];
  const out = historyFromBody(spor, spor[0]);
  assert.ok(out && out.includes('jaren negentig') && !out.includes('aangeplempt'), 'dated prose sentence, not the description');
  assert.equal(historyFromBody(['Het is een eiland met veel water en groen.']), undefined);
}

{
  const { rankAreaPhotos } = await import('../src/mapRecall/neighborhoodGaps');
  const square: [number, number][][][] = [[[[52, 4], [52, 4.1], [52.1, 4.1], [52.1, 4], [52, 4]]]];
  const file = (title: string, lat: number, lon: number, extra: Record<string, unknown> = {}) =>
    ({ title, url: 'u', thumbUrl: 't', width: 1600, height: 1000, mime: 'image/jpeg', license: 'CC BY-SA 4.0', lat, lon, ...extra }) as import('../src/mapRecall/neighborhoodGaps').AreaPhotoFile;
  const picked = rankAreaPhotos([
    file('File:Canal view 1.jpg', 52.01, 4.01),
    file('File:Canal view 2.jpg', 52.011, 4.011), // same title stem: dropped
    file('File:Market square.jpg', 52.09, 4.09),
    file('File:Outside.jpg', 53, 5), // outside the area
    file('File:Tram line 5.jpg', 52.05, 4.05), // vehicle
    file('File:Map of the area.jpg', 52.05, 4.05), // map
    file('File:Portrait.jpg', 52.06, 4.06, { width: 800, height: 1200 }), // portrait orientation
    file('File:Unlicensed.jpg', 52.07, 4.07, { license: undefined }),
    file('File:03-22-1947 01334 Frits Sieger (4995611876).jpg', 52.03, 4.03), // Anefo press portrait
    file('File:Mapillary (MOhnWRiMH9YywAA) (amsterdam) 2016-08-17.jpg', 52.04, 4.08), // dashcam frame
  ], square, 8);
  assert.deepEqual(picked.map(f => f.title).sort(), ['File:Canal view 1.jpg', 'File:Market square.jpg']);
  assert.equal(rankAreaPhotos([
    file('File:Historic street.jpg', 52.01, 4.01, { categories: 'Black and white photographs', width: 5000 }),
    file('File:Colour street.jpg', 52.02, 4.02, { categories: 'Color photographs' }),
  ], square, 1)[0].title, 'File:Colour street.jpg', 'colour wins over larger monochrome images');
}

{
  // Area photo search points: a horseshoe like the Grachtengordel has its centroid outside it.
  const { areaSearchPoints, pointInPolygons: inside } = await import('../src/mapRecall/neighborhoodGaps');
  const small: [number, number][][][] = [[[[52, 4], [52, 4.005], [52.005, 4.005], [52.005, 4], [52, 4]]]];
  const one = areaSearchPoints(small);
  assert.equal(one.length, 1, 'a small compact area is one search');
  assert.ok(one[0].radiusM >= 300 && one[0].radiusM < 1000);
  // A U shape 3 km across: no point may sit in the empty middle, and both arms are searched.
  const u: [number, number][][][] = [[[[52, 4], [52, 4.045], [52.027, 4.045], [52.027, 4.03], [52.009, 4.03], [52.009, 4.015], [52.027, 4.015], [52.027, 4], [52, 4]]]];
  const points = areaSearchPoints(u);
  assert.ok(points.length >= 3, `U shape searched from ${points.length} points`);
  assert.ok(points.every(p => inside([p.lat, p.lon], u)), 'every search point lies inside the area');
  assert.ok(points.some(p => p.lon < 4.015) && points.some(p => p.lon > 4.03), 'both arms are searched');
}

{
  // Commons store: round trip, stable order, and API error bodies recognised.
  const { CommonsStore, apiError } = await import('../src/mapRecall/commonsStore');
  const store = new CommonsStore();
  store.addGeo({ lat: 52.1, lon: 4.2, radiusM: 500, namespace: 6, limit: 200, fetchedAt: 't', hits: [{ pageid: 9, title: 'File:B.jpg', lat: 52.1, lon: 4.2 }, { pageid: 3, title: 'File:A.jpg', lat: 52.1, lon: 4.2 }] });
  store.addImageInfoPage({ pageid: 3, title: 'File:A.jpg', imageinfo: [{ url: 'u', thumburl: 't', thumbwidth: 480, width: 1600, height: 1000, mime: 'image/jpeg', extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<a>Me</a>' }, Unkept: { value: 'x' } } }] }, 't');
  assert.equal(store.addImageInfoPage({ pageid: 4, title: 'File:Gone.jpg' }, 't'), undefined, 'a page without imageinfo is not stored');
  const text = store.serialise();
  const again = CommonsStore.parse(text.geo, text.files);
  assert.deepEqual(again.serialise(), text, 'serialisation is stable');
  assert.deepEqual(again.getGeo({ lat: 52.1, lon: 4.2, radiusM: 500, namespace: 6, limit: 200 })!.hits.map(h => h.pageid), [9, 3], 'hits keep nearest-first order');
  assert.deepEqual(again.files.get(3)!.meta, { LicenseShortName: 'CC BY-SA 4.0', Artist: '<a>Me</a>' });
  assert.equal(apiError({ query: {} }), undefined);
  assert.equal(apiError({ error: { code: 'ratelimited', info: 'slow down' } })!.retryable, true);
  assert.equal(apiError({ error: { code: 'badvalue' } })!.retryable, false);
}

{
  // Small islands with nothing geotagged inside may use photos taken from just outside.
  const { distanceToPolygonsKm, rankAreaPhotos } = await import('../src/mapRecall/neighborhoodGaps');
  const island: [number, number][][][] = [[[[52, 4], [52, 4.002], [52.001, 4.002], [52.001, 4], [52, 4]]]];
  assert.equal(distanceToPolygonsKm([52.0005, 4.001], island), 0);
  const d = distanceToPolygonsKm([52.002, 4.001], island);
  assert.ok(d > 0.1 && d < 0.12, `about 110 m north of the island, got ${d}`);
  const shore = { title: 'File:View of the island.jpg', url: 'u', thumbUrl: 't', width: 1600, height: 1000, mime: 'image/jpeg', license: 'CC0', lat: 52.002, lon: 4.001 };
  assert.equal(rankAreaPhotos([shore], island).length, 0, 'outside is excluded by default');
  assert.equal(rankAreaPhotos([shore], island, 8, 0.15).length, 1, 'within the slack it is allowed');
}
