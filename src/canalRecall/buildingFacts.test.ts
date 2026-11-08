import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING_TYPES, NOTHING_KNOWN, describeBuilding, saysNothingKnown } from './buildingFacts';
import { registerLineUnderArticle } from './buildingArticles';
import { ClickPoiIndex, type ClickPoiRow } from './clickPoiInfo';
import { placeKindLabel, withArticle } from './placeKind';

// Named regression (user shot 2026-11-08, gurdwara-label-empty-card-sloterdijk.png):
// the label "Shri Guru Nanak Gurdwara Sahib" (OSM n2628741158, Schakelstraat 21)
// titled the card and the body said "This building has no name or date".
const GURDWARA = 'Shri Guru Nanak Gurdwara Sahib';
const gurdwaraRow: ClickPoiRow = ['n2628741158', GURDWARA, 4.8490109, 52.3907677, 'worship', 'a Sikh gurdwara', 'Schakelstraat 21', '', ''];
const warehouse = BUILDING_TYPES.indexOf('warehouse');

test('a pand with its own name keeps it and its register line', () => {
  assert.deepEqual(describeBuilding([1720, warehouse, 0], null, 'De Zon'), {
    name: 'De Zon', detail: 'A warehouse, built in 1720, in the eighteenth century.',
  });
});

test('a pand with a name and nothing else does not deny its name', () => {
  assert.deepEqual(describeBuilding(null, null, 'De Zon'), { name: 'De Zon', detail: NOTHING_KNOWN.named });
});

test('a nameless pand with a named, kinded POI says what the place is', () => {
  const place = { name: GURDWARA, kind: 'a Sikh gurdwara', address: 'Schakelstraat 21' };
  assert.deepEqual(describeBuilding(null, undefined, '', place), { name: GURDWARA, detail: 'A Sikh gurdwara at Schakelstraat 21.' });
  // The register's year and the height follow the place.
  assert.deepEqual(describeBuilding([1968, -1, 0], 9, '', place), {
    name: GURDWARA,
    detail: 'A Sikh gurdwara at Schakelstraat 21. Built in 1968, in the post-war decades. About 9 m tall, some 3 storeys.',
  });
  // The register's architect too.
  assert.equal(describeBuilding([0, -1, 2, { a: 'A. Boeken' }], null, '', { name: GURDWARA, kind: 'a Sikh gurdwara' }).detail,
    'A Sikh gurdwara. Designed by A. Boeken. A national monument (rijksmonument).');
});

test('a nameless pand with a named POI of no kind says it is a mapped place', () => {
  assert.deepEqual(describeBuilding(null, undefined, '', { name: 'Het Salon' }), { name: 'Het Salon', detail: NOTHING_KNOWN.place });
  assert.deepEqual(describeBuilding(null, undefined, '', { name: 'Het Salon', address: 'Condensatorweg 54' }),
    { name: 'Het Salon', detail: 'A mapped place at Condensatorweg 54.' });
  assert.equal(describeBuilding([1990, -1, 0], null, '', { name: 'Het Salon' }).detail, 'Built in 1990, in the late twentieth century.');
});

test('a nameless pand with no POI keeps the no-name sentence', () => {
  assert.deepEqual(describeBuilding(null, null), { name: 'No building details', detail: NOTHING_KNOWN.anonymous });
  assert.deepEqual(describeBuilding(null, null, '', null), { name: 'No building details', detail: 'This building has no name or date in the map data.' });
  assert.equal(describeBuilding([1665, -1, 0], 13).name, 'Built 1665');
});

test('a POI named like the pand is not repeated; a different POI is named', () => {
  const same = describeBuilding([1720, warehouse, 0], null, 'De Zon', { name: 'de zon', kind: 'a café' });
  assert.equal(same.name, 'De Zon');
  assert.equal(same.detail, 'A café. A warehouse, built in 1720, in the eighteenth century.');
  assert.equal(same.detail.match(/De Zon/gi), null, 'the name is in the title only');
  const other = describeBuilding([1720, warehouse, 0], null, 'De Zon', { name: 'Café Kobalt', kind: 'a café', address: 'Singel 2' });
  assert.equal(other.detail, 'Café Kobalt is a café at Singel 2. A warehouse, built in 1720, in the eighteenth century.');
  // A type-only building names the place, not "A warehouse." twice over.
  assert.equal(describeBuilding([0, warehouse, 0], null, '', { name: 'Loods 6', kind: 'a gallery' }).detail, 'A gallery.');
});

test('a monument card with no place is unchanged', () => {
  assert.deepEqual(describeBuilding([1933, -1, 3, { n: 'Apollohal', a: 'A. Boeken', y: '1933–1935', f: 6 }], 12), {
    name: 'Apollohal',
    detail: 'Built in 1933–1935, in the early twentieth century, designed by A. Boeken. A municipal monument. Originally built for hospitality, sport and recreation. About 12 m tall, some 4 storeys.',
  });
});

test('the nothing-known bodies are not register lines under an article', () => {
  for (const body of Object.values(NOTHING_KNOWN)) {
    assert(saysNothingKnown(body));
    assert.equal(registerLineUnderArticle(body), '');
  }
  assert.equal(registerLineUnderArticle('Built in 1995, in the late twentieth century.'), 'Built in 1995, in the late twentieth century.');
});

test('place kinds: religion and denomination, shop goods, articles', () => {
  assert.equal(placeKindLabel('place_of_worship', { religion: 'sikh' }), 'a Sikh gurdwara');
  assert.equal(placeKindLabel('place_of_worship', { religion: 'muslim', denomination: 'sunni' }), 'a mosque');
  assert.equal(placeKindLabel('place_of_worship', { religion: 'christian', denomination: 'roman_catholic' }), 'a Roman Catholic church');
  assert.equal(placeKindLabel('place_of_worship', { religion: 'christian', denomination: 'Reformed (GKV)' }), 'a church');
  assert.equal(placeKindLabel('place_of_worship', {}), 'a place of worship');
  assert.equal(placeKindLabel('cafe'), 'a café');
  assert.equal(placeKindLabel('art', {}, 'shop'), 'an art shop');
  assert.equal(placeKindLabel('gift', {}, 'shop'), 'a gift shop');
  assert.equal(placeKindLabel('butcher', {}, 'shop'), 'a butcher');
  assert.equal(placeKindLabel('fire_station', {}, 'amenity'), 'a fire station');
  assert.equal(placeKindLabel('artwork', {}, 'tourism'), 'an artwork');
  assert.equal(withArticle('an old one'), 'an old one');
});

test('a POI label finds its mapped row by name and point', () => {
  const index = new ClickPoiIndex({ version: 1, source: 'OSM', points: [
    gurdwaraRow,
    ['n2', GURDWARA, 4.8600, 52.3907677, 'worship', 'a Sikh gurdwara', '', '', ''],
    ['n3', 'Black Cat Theater', 4.8491, 52.3908, 'culture', 'a theatre', '', '', ''],
  ] });
  // Label points are rounded to 6 decimals (orientation-pois.json).
  assert.equal(index.named(GURDWARA, [4.849011, 52.390768])?.[0], 'n2628741158');
  assert.equal(index.named(GURDWARA.toUpperCase(), [4.8491, 52.3908])?.[0], 'n2628741158', 'case-insensitive');
  assert.equal(index.named(GURDWARA, [4.8550, 52.3907677]), null, '~400 m away is another place');
  assert.equal(index.named('Het Salon', [4.849011, 52.390768]), null);
  assert.equal(index.named('', [4.849011, 52.390768]), null);
});

test('tapping the gurdwara label opens a card that says what it is', async () => {
  (globalThis as any).window ??= { CanalRecallGameModules: [] };
  const { GameLandmarkRuntime } = await import('./game/landmarkRuntime');
  const host: any = {
    landmarks: [], vectorMap: { _spoils: () => false }, _landmarkNotice: null,
    _clickPoiInfo: new ClickPoiIndex({ version: 1, source: 'OSM', points: [gurdwaraRow] }),
    _buildingFacts: { lookup: () => null, article: () => null, ensureAt: () => Promise.resolve() },
    _requestBuildingFacts: () => {},
  };
  // labelLayer.ts hitTest's shape.
  const label = { id: `own:${GURDWARA}:4.84901`, landmarkId: `own:${GURDWARA}:4.84901`, name: GURDWARA,
    lngLat: [4.849011, 52.390768] as [number, number], poi: true, featureTarget: null };
  const card = GameLandmarkRuntime.prototype._cardForClickedBuilding.call(host, label)!;
  assert.equal(card.name, GURDWARA);
  assert.equal(card.detail, 'A Sikh gurdwara at Schakelstraat 21.');
  assert.equal(card.sourceUrl, 'https://www.openstreetmap.org/node/2628741158');
  // A label with no mapped row still does not say "no name".
  host._clickPoiInfo = new ClickPoiIndex({ version: 1, source: 'OSM', points: [] });
  assert.equal(GameLandmarkRuntime.prototype._cardForClickedBuilding.call(host, label)!.detail, NOTHING_KNOWN.place);
  // A label whose name would spoil a question stays untitled, as before.
  host.vectorMap._spoils = () => true;
  assert.deepEqual(
    (({ name, detail }) => ({ name, detail }))(GameLandmarkRuntime.prototype._cardForClickedBuilding.call(host, label)!),
    { name: 'No building details', detail: NOTHING_KNOWN.anonymous });
  // A clicked facade (no `poi`) with no row is unchanged.
  host.vectorMap._spoils = () => false;
  const facade = GameLandmarkRuntime.prototype._cardForClickedBuilding.call(host, { id: 'P1', name: '', lngLat: [4.9, 52.37], featureTarget: null })!;
  assert.equal(facade.detail, NOTHING_KNOWN.anonymous);
  // A researched landmark owner still wins over everything (Hortus-like).
  host.landmarks = [{ id: 'hortus', name: 'Hortus Botanicus', detail: 'One of the oldest botanical gardens.', buildingIds: ['P9'] }];
  assert.equal(GameLandmarkRuntime.prototype._cardForClickedBuilding.call(host, { id: 'P9', name: '', lngLat: [4.9, 52.37], featureTarget: null })!.id, 'hortus');
});
