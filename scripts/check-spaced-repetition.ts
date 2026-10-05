import assert from 'node:assert/strict';
import { rateRound, scheduleReview, selectReviewFeatures } from '../src/spacedRepetition';
import { RoundResult, StreetFeature } from '../src/types';
import { getFeatureKey } from '../src/utils/featureIdentity';

const feature: StreetFeature = {
  id: 'extract_streets_42',
  name: 'Prinsengracht',
  type: 'canal',
  cityId: 'amsterdam',
  center: [52.374, 4.883],
  funFact: '', clues: [], distractors: [], difficulty: 'medium',
};
const result: RoundResult = {
  roundNumber: 1, feature, gameMode: 'guess_name', userSelectedName: feature.name,
  isCorrect: true, pointsEarned: 5000, timeSpentMs: 3000,
};

assert.equal(getFeatureKey(feature), getFeatureKey({ ...feature, id: 'osm_999' }), 'source IDs must not affect identity');
assert.equal(rateRound(result), 'easy');
const first = scheduleReview(result, undefined, 1_000_000);
assert.equal(first.state.intervalDays, 4);
const missed = scheduleReview({ ...result, isCorrect: false, pointsEarned: 0 }, first.state, 2_000_000);
assert.equal(missed.event.rating, 'again');
assert.ok(missed.state.dueAt < 2_000_000 + 11 * 60 * 1000);
assert.deepEqual(selectReviewFeatures([feature], [{ ...first.state, dueAt: 0 }], 'guess_name', 1), [feature]);

console.log('Spaced-repetition checks passed.');

import { readSharedHome, scopeToHome } from '../src/mapRecall/homeScope';
const mk = (id: string, name: string, lat: number): StreetFeature => ({ ...feature, id, name, center: [lat, 4.9] });
const near = [0, 1, 2, 3].map(i => mk(`n${i}`, `Near ${i}`, 52.37 + i * 0.001));
const far = [0, 1, 2].map(i => mk(`f${i}`, `Far ${i}`, 52.37 + 0.02 + i * 0.001));
const home = { lat: 52.37, lng: 4.9 };
assert.equal(scopeToHome([...near, ...far], home, new Set(), 3).features.length, 4, 'unfamiliar ring stays tight');
const known = new Set(near.map(getFeatureKey));
assert.ok(scopeToHome([...near, ...far], home, known, 3).features.length > 4, 'ring widens once the near ones are learned');
assert.equal(readSharedHome({ getItem: k => k === 'canalRecall.preferences.v1' ? '{"homeAddress":"A 1"}' : '{"x|a 1":{"address":"A 1","lat":52.3,"lng":4.9}}' })?.lat, 52.3);
assert.equal(readSharedHome({ getItem: () => null }), null);
console.log('Home scope checks passed.');

// Regression: random importance weighting used to put obscure waters ahead of
// the canal belt. Check the real extract, every seed and previously due trivia.
const { readFileSync } = await import('node:fs');
const { attachWaterImportance, focusImportantWaters, waterImportance, waterExtent } = await import('../src/mapRecall/waterImportance');
const waters: StreetFeature[] = JSON.parse(readFileSync('public/data/extracts/amsterdam/water.json', 'utf8'));
const areas = JSON.parse(readFileSync('public/data/extracts/amsterdam/boundaries.json', 'utf8'));
const ranked = attachWaterImportance(waters, areas);
const focused = focusImportantWaters(ranked);
assert.equal(focused.length, 40);
for (const name of ['Prinsengracht', 'Keizersgracht', 'Herengracht', 'Singel', 'Amstel', 'IJ']) {
  assert.ok(focused.some(f => f.name === name), `${name} is in the default syllabus`);
}
assert.ok(!focused.some(f => /sluis|fontein/.test(f.name.toLowerCase())));
assert.ok(!focused.some(f => f.name === 'Buiksloterkanaal'), 'Noord water does not compete with the core');
const tiny = ranked.find(f => f.name === 'Hans Snoekfontein')!;
assert.ok(tiny);
const tinyState = scheduleReview({ ...result, feature: tiny }, undefined, 0).state;
for (let seed = 1; seed <= 100; seed++) {
  const selected = selectReviewFeatures(focused, [{ ...tinyState, dueAt: 0 }], 'guess_name', 5, 1_000_000, seed);
  assert.ok(selected.every(f => waterImportance(f) === 500), 'major waters always come first');
  assert.ok(!selected.some(f => f.name === tiny.name), 'obscure old reviews stay outside the default pool');
}
const canal = { ...feature, name: 'Test canal', cityId: 'utrecht', paths: [[[52.37, 4.88], [52.38, 4.88]]] as [number, number][][] };
assert.equal(waterExtent({ ...canal, path: canal.paths[0] }).lengthMeters, waterExtent(canal).lengthMeters, 'paths and path are not counted twice');
assert.equal(waterExtent({ ...canal, paths: [...canal.paths, ...canal.paths] }).lengthMeters, waterExtent(canal).lengthMeters, 'duplicate segments are not counted twice');
assert.ok(waterImportance({ ...canal, wikipedia: 'nl:Test', wikidata: 'Q1' }) > waterImportance(canal), 'reference links increase importance');
const north = { ...canal, cityId: 'amsterdam', center: [52.39343, 4.909289] as [number, number] };
const central = { ...north, center: [52.374802, 4.887972] as [number, number] };
assert.ok(waterImportance(central, areas) > waterImportance(north, areas) + 200, 'real district geometry boosts Centrum and penalizes Noord');
console.log('Water syllabus checks passed.');
