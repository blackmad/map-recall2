import assert from 'node:assert/strict';
import {mergeManualPoiFeatures} from '../src/canalRecall/game/manualPoiCatalog';
import type {LandmarkFeature} from '../src/canalRecall/game/extracts';

const merged = mergeManualPoiFeatures([]);
for (const [modelId, detail, source] of [
  ['jeruzalemkerk', 'Jantzen', 'https://monumentenregister.cultureelerfgoed.nl/monumenten/527155'],
  ['naco-house', 'la Croix', 'https://stadsherstel.nl/monumenten/de-ruijterkade-naco-huisje/'],
] as const) {
  const poi = merged.find(p => p.modelId === modelId);
  assert(poi, `${modelId} remains a genuine destination`);
  assert(poi.funFact?.includes(detail), `${modelId} exposes its researched architectural fact`);
  assert.equal(poi.sourceUrl, source, 'The fact links to its actual research source');
  const mapped: LandmarkFeature = {...poi, funFact: undefined, sourceUrl: 'https://en.wikipedia.org/', wikipediaExtract: 'Existing geographic introduction.'};
  const supplemented = mergeManualPoiFeatures([mapped]).find(p => p.id === poi.id)!;
  assert(supplemented.funFact?.includes(detail), 'Mapped introductions do not hide researched facts');
  assert.equal(supplemented.wikipediaExtract, mapped.wikipediaExtract, 'Existing mapped content remains available');
  assert.equal(supplemented.sourceUrl, source);
  const curated = {...mapped, funFact: 'Existing independently researched fact.', sourceUrl: 'https://example.org/primary'};
  const retained = mergeManualPoiFeatures([curated]).find(p => p.id === poi.id)!;
  assert(retained.researchDetail?.includes(detail), 'Supplemental research remains accessible beside existing facts');
  assert.equal(retained.researchSourceUrl, source);
  assert.equal(retained.funFact, curated.funFact, 'Previously researched extract facts remain intact');
  assert.equal(retained.sourceUrl, curated.sourceUrl);
}
console.log('Researched manual POI facts and their sources are available; existing content preserved.');
