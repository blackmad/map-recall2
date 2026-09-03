import assert from 'node:assert/strict';
import { attachLocalFacts, triviaForRound } from '../src/mapRecall/localFacts';
import type { Fact, FactsFile } from '../src/canalRecall/facts/factTypes';
import { FEATURE_CATEGORIES } from '../src/types';

const fact = (text: string): Fact => ({
  text, sourceQuote: text, kind: 'history', section: 'History',
  sourceUrl: 'https://en.wikipedia.org/wiki/Test', license: 'CC BY-SA 4.0',
  retrievedAt: '2026-09-01', model: 'ollama:test',
});
const facts = [fact('Alpha was built in 1888.'), fact('Alpha opened with a choir.')];
const catalog: FactsFile = {
  cityId: 'amsterdam', generatorVersion: 'test', generatedAt: '2026-09-01',
  features: [{ id: 'extract_landmarks_1', name: 'Alpha', collection: 'landmarks', facts }],
};
const features = [{ id: 'extract_landmarks_1', name: 'Alpha' }, { id: 'osm_node_2', name: 'Beta' }];
const joined = attachLocalFacts(features, catalog, 'amsterdam');
assert.deepEqual(joined[0].localFacts, facts);
assert.equal(joined[1].localFacts, undefined);
assert.deepEqual(attachLocalFacts(features, { ...catalog, cityId: 'utrecht' }, 'amsterdam'), features,
  'a catalog for another city never joins');
assert.equal(triviaForRound([], 1, 0), null);
assert.equal(triviaForRound(facts, 123, 4), triviaForRound(facts, 123, 4), 'one round is stable');
assert.ok(new Set(Array.from({ length: 12 }, (_, round) => triviaForRound(facts, 123, round)?.text)).size > 1,
  'successive rounds can rotate a feature with several facts');
for (const category of ['all', 'landmarks']) {
  const types = FEATURE_CATEGORIES.find((entry) => entry.id === category)?.types || [];
  for (const civic of ['cinema', 'library', 'university', 'music venue'] as const) {
    assert.ok(types.includes(civic), `${category} includes the extracted civic POI type ${civic}`);
  }
}
console.log('Map Recall local-fact join checks passed.');
