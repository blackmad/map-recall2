// Street-side art (sculptures, murals, memorials) is clickable from the
// ground. Named regressions (2026-10-31): the Homomonument (Wikidata only, no
// OSM artwork node), De Dokwerker and Het Lieverdje (OSM nodes with Dutch
// articles) are the kind of thing a rider stops next to and asks about.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STREET_ART_KINDS, StreetArtIndex, streetArtCard, streetArtFallbackDetail, type StreetArtFile } from '../src/canalRecall/streetArt.ts';

const file = JSON.parse(readFileSync('public/data/extracts/amsterdam/street-art.json', 'utf8')) as StreetArtFile;
assert.ok(file.points.length >= 1200, `street art points published (${file.points.length})`);
const kinds = new Set<string>(STREET_ART_KINDS);
const ids = new Set<string>();
for (const p of file.points) {
  assert.ok(kinds.has(p.k), `${p.name}: known kind ${p.k}`);
  assert.ok(!ids.has(p.id), `${p.id} published once`);
  ids.add(p.id);
  assert.ok(p.lng > 4.6 && p.lng < 5.2 && p.lat > 52.2 && p.lat < 52.5, `${p.name} is inside the streamed tiles`);
  if (p.e) assert.ok(p.e.length <= 400 && /[.!?)"\u2026]$/.test(p.e), `${p.name}: lede is card-sized and ends a sentence`);
}
const withArticle = file.points.filter(p => p.e);
assert.ok(withArticle.length >= 800, `points with an article lede (${withArticle.length})`);
const dutch = withArticle.filter(p => p.l && p.l !== 'en');
assert.ok(dutch.length <= 20, `ledes are English (${dutch.length} still Dutch: ${dutch.slice(0, 5).map(p => p.name).join(', ')})`);

const index = new StreetArtIndex(file);
assert.equal(index.size, file.points.length, 'every point is indexed');
const expect: Array<[string, number, number]> = [
  ['Homomonument', 4.8847, 52.3744],
  ['De Dokwerker', 4.9050, 52.3672],
  ['Het Lieverdje', 4.8890, 52.3688],
];
for (const [name, lng, lat] of expect) {
  const hit = index.nearest(lng, lat, 20);
  assert.ok(hit && hit.name.startsWith(name), `${name} is found within 20 m of its mapped point (got ${hit?.name ?? 'nothing'})`);
  const card = streetArtCard(hit!);
  assert.ok(card.detail.length >= 40 && card.wikipediaUrl, `${name} card has a lede and a link`);
  assert.equal(card.extractLang, 'en', `${name} card is English`);
  assert.equal(card.name, hit!.name, `${name} card is titled by name`);
  assert.notEqual(streetArtCard(hit!, true).name, hit!.name, `${name} card hides its name while it is the answer`);
}
// 40 m from the Homomonument is open square, not a click on it.
assert.equal(index.nearest(4.8847 + 0.0006, 52.3744), null, 'a click 40 m away does not open the card');
assert.equal(streetArtFallbackDetail({ k: 'mural', a: 'Eduardo Kobra', y: '2016' }), 'A mural by Eduardo Kobra (2016), mapped here.');
process.stdout.write(`Street art checks passed (${file.points.length} points, ${withArticle.length} with an article)\n`);
