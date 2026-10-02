/**
 * "Locate on map" hints name places a player knows, broad to specific, and
 * never the answer (src/mapRecall/locateHints.ts). Regression places are the
 * user's report of 2026-10-02: Weesperbuurt's hints were only compass bearings.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLocateHints, hintReferencesFrom, referenceLabel, revealsAnswer, type HintTarget } from '../src/mapRecall/locateHints';

// Names that would give the answer away.
assert.equal(revealsAnswer('Weesperplein', 'Weesperbuurt'), true, 'shares the stem');
assert.equal(revealsAnswer('De Pijp', 'Nieuwe Pijp'), true, 'shares a distinctive word');
assert.equal(revealsAnswer('Amstel', 'Amstelveenseweg'), true, 'is part of the name');
assert.equal(revealsAnswer('Herengracht', 'Herengracht'), true);
assert.equal(revealsAnswer('Plantage', 'Weesperbuurt'), false);
assert.equal(revealsAnswer('Rijksmuseum', 'IJ'), false, 'a two-letter name matches whole names only');
assert.equal(revealsAnswer('Oude Kerk', 'Nieuwe Kerk'), false, 'generic words do not count');

assert.equal(referenceLabel({ name: 'Amstel', kind: 'water' }), 'the Amstel');
assert.equal(referenceLabel({ name: 'The National Maritime Museum', kind: 'landmark' }), 'the National Maritime Museum');
assert.equal(referenceLabel({ name: 'Artis', kind: 'landmark' }), 'Artis');
assert.equal(referenceLabel({ name: 'Dam Square', kind: 'square' }), 'Dam Square');

const dir = 'public/data/extracts/amsterdam/';
const json = (file: string) => JSON.parse(readFileSync(dir + file, 'utf8'));
const areas = json('boundaries.json') as Array<{ name: string; kind: string; geometry: [number, number][][][]; bounds: { minlat: number; maxlat: number; minlon: number; maxlon: number } }>;
const references = hintReferencesFrom({ water: json('water.json'), landmarks: json('landmarks.json'), squares: json('squares.json'), parks: json('parks.json'), areas });
const area = (name: string): HintTarget => {
  const found = areas.find((candidate) => candidate.name === name && candidate.kind !== 'quarter') || areas.find((candidate) => candidate.name === name)!;
  const { minlat, maxlat, minlon, maxlon } = found.bounds;
  return { name, type: 'neighborhood', center: [(minlat + maxlat) / 2, (minlon + maxlon) / 2], areaGeometry: found.geometry };
};
const hintsFor = (target: HintTarget) => buildLocateHints(target, references);

const weesper = hintsFor(area('Weesperbuurt'));
const text = weesper.map((hint) => hint.text).join(' ');
assert.ok(weesper.length >= 3, text);
assert.doesNotMatch(text, /weesper/i, 'never names the answer');
assert.match(text, /Amstel/, 'the river it lies on');
assert.match(text, /Plantage/, 'the neighbourhood it borders');
assert.match(text, /H'ART Museum/, 'the museum inside it');
assert.deepEqual(weesper.map((hint) => hint.kind), ['district', 'water', 'borders', 'inside'], 'broad to specific');

const nieuwePijp = hintsFor(area('Nieuwe Pijp')).map((hint) => hint.text).join(' ');
assert.doesNotMatch(nieuwePijp, /Pijp/, 'De Pijp and Oude Pijp would give Nieuwe Pijp away');
assert.match(hintsFor(area('De Pijp')).map((hint) => hint.text).join(' '), /Albert Cuyp/);
assert.match(hintsFor(area('Grachtengordel')).map((hint) => hint.text).join(' '), /Anne Frank House/);

// Every neighbourhood: no hint repeats a name or names the answer.
for (const candidate of areas.filter((a) => ['neighbourhood', 'neighborhood', 'quarter'].includes(a.kind))) {
  const hints = hintsFor(area(candidate.name));
  assert.ok(hints.length <= 4, candidate.name);
  for (const hint of hints) assert.equal(revealsAnswer(hint.reference.split(' + ')[0], candidate.name), false, `${candidate.name}: ${hint.text}`);
  assert.equal(new Set(hints.map((hint) => hint.reference)).size, hints.length, `${candidate.name} repeats a place`);
}

// Streets and places: centre for a museum, lines for a street.
const streets = json('streets.json') as HintTarget[];
const landmarks = json('landmarks.json') as HintTarget[];
const herengracht = streets.find((street) => street.name === 'Herengracht');
if (herengracht) assert.doesNotMatch(hintsFor(herengracht).map((hint) => hint.text).join(' '), /Herengracht/);
const anneFrank = hintsFor(landmarks.find((landmark) => landmark.name === 'Anne Frank House')!).map((hint) => hint.text).join(' ');
assert.match(anneFrank, /Prinsengracht/);
assert.match(anneFrank, /Westerkerk/);

console.log('locate hints: ok');
