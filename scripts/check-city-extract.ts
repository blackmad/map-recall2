import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve(process.argv[2] || 'public/data/extracts/amsterdam');
const expectedCityId = process.argv[3] || path.basename(directory);
const readJson = async (file: string) => JSON.parse(await readFile(path.join(directory, file), 'utf8'));
const manifest = await readJson('manifest.json');
const finitePosition = (value: unknown): value is [number, number] =>
  Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const finitePaths = (feature: { path?: unknown[]; paths?: unknown[][] }) =>
  (!feature.path || feature.path.every(finitePosition))
  && (!feature.paths || feature.paths.every((line) => line.every(finitePosition)));

assert.equal(manifest.cityId, expectedCityId, 'manifest city id');
assert.ok(Array.isArray(manifest.center) && manifest.center.length === 2 && manifest.center.every(Number.isFinite), 'finite city center');
assert.ok(manifest.boundaries?.count > 0, 'municipality boundary exists');
if (manifest.cityProfile?.file) {
  const cityProfile = await readJson(manifest.cityProfile.file);
  assert.equal(cityProfile.cityId, expectedCityId, 'city profile belongs to the extract');
  assert.equal(cityProfile.wikidata, manifest.cityProfile.wikidata, 'city profile Wikidata id matches manifest');
  assert.ok(cityProfile.name && cityProfile.flag?.imageUrl, 'city profile has a name and flag');
}

for (const category of ['water', 'streets', 'bridges', 'squares', 'parks', 'landmarks']) {
  const partition = manifest.partitions?.[category];
  assert.ok(partition?.file, `${category} is listed in the manifest`);
  const features = await readJson(partition.file);
  assert.equal(features.length, partition.count, `${category} count matches manifest`);
  assert.equal(new Set(features.map((feature: { id?: string }) => feature.id)).size, features.length,
    `${category} feature ids are unique`);
  assert.ok(features.every((feature: { cityId?: string; center?: unknown; path?: unknown[]; paths?: unknown[][] }) =>
    feature.cityId === expectedCityId && finitePosition(feature.center) && finitePaths(feature)),
    `${category} belongs to ${expectedCityId} and has finite geometry`);
}

const routing = await readJson('streets-routing.json');
assert.ok(routing.length >= 1_000, `routing graph is implausibly small (${routing.length})`);
assert.ok(routing.every((feature: { cityId?: string; center?: number[] }) =>
  feature.cityId === expectedCityId && finitePosition(feature.center) && finitePaths(feature)),
  `routing ways belong to ${expectedCityId} and have finite centers`);
assert.equal(new Set(routing.map((feature: { id?: string }) => feature.id)).size, routing.length,
  'routing way ids are unique');
const landmarks = await readJson('landmarks.json');
const linked = landmarks.filter((feature: { wikipedia?: string; wikidata?: string }) => feature.wikipedia || feature.wikidata);
const images = landmarks.filter((feature: { wikipediaImageUrl?: string }) => feature.wikipediaImageUrl);
assert.ok(linked.length >= 50, `too few linked landmarks (${linked.length})`);
assert.ok(images.length >= 25, `too few landmark images (${images.length})`);

const brandedPois = await readJson('branded-pois.json');
assert.equal(brandedPois.length, manifest.brandedPois?.count, 'branded POI count matches manifest');
assert.ok((manifest.majorChains || []).every((chain: { name: string }) => /^(albert heijn|ah)( to go)?$/i.test(chain.name)),
  'Albert Heijn is the only published retail chain');
assert.equal(brandedPois.filter((poi: { kind?: string }) => poi.kind === 'local-food').length,
  manifest.localFoodPois?.count || 0, 'local food POI count matches manifest');
const localFoodNameCounts = new Map<string, number>();
for (const poi of brandedPois.filter((item: { kind?: string }) => item.kind === 'local-food')) {
  const key = String(poi.name || '').trim().toLocaleLowerCase();
  localFoodNameCounts.set(key, (localFoodNameCounts.get(key) || 0) + 1);
}
assert.ok([...localFoodNameCounts.values()].every((count) => count <= 2),
  'repeated hospitality chains are excluded from local food labels');
const localFoodCellCounts = new Map<string, number>();
for (const poi of brandedPois.filter((item: { kind?: string }) => item.kind === 'local-food')) {
  const [lat, lon] = poi.center as [number, number];
  const cell = `${Math.floor(lon * 111_320 * Math.cos(lat * Math.PI / 180) / 100)}:${Math.floor(lat * 111_320 / 100)}`;
  localFoodCellCounts.set(cell, (localFoodCellCounts.get(cell) || 0) + 1);
}
assert.ok([...localFoodCellCounts.values()].every((count) => count <= 2),
  'local food labels are capped at two candidates per block-scale cell');
assert.ok(brandedPois.every((poi: { id?: string; brand?: string; center?: number[] }) =>
  poi.id && poi.center?.length === 2 && poi.center.every(Number.isFinite)),
  'every branded POI has identity and a finite center');
if (manifest.brandIdentifiers?.file) {
  const identifiers = await readJson(manifest.brandIdentifiers.file);
  assert.equal(identifiers.length, manifest.brandIdentifiers.count, 'brand identity count matches manifest');
  assert.equal(identifiers.filter((brand: { logo?: unknown }) => brand.logo).length,
    manifest.brandIdentifiers.logoCount, 'brand logo count matches manifest');
  assert.ok(identifiers.every((brand: { name?: string; wikidata?: string }) => brand.name && /^Q\d+$/.test(brand.wikidata || '')),
    'every brand identity has a name and Wikidata id');
  assert.ok(brandedPois.every((poi: { icon?: string; iconUrl?: string }) => !poi.iconUrl || poi.icon),
    'every remotely sourced brand logo has an icon id');
}

if (expectedCityId === 'amsterdam') {
  assert.ok(landmarks.length >= 300, `Amsterdam landmark coverage regressed (${landmarks.length})`);
  const landmarkNames = new Set(landmarks.map((feature: { name?: string }) => feature.name?.toLocaleLowerCase()));
  for (const name of ['OT301', 'Melkweg', 'Artis', 'Framer Framed']) {
    assert.ok(landmarkNames.has(name.toLocaleLowerCase()), `${name} is missing from Amsterdam landmarks`);
  }
  // Street mode is cycling: bikeable pedestrian corridors must be in the
  // routing graph, and bicycle=no shopping streets must stay out.
  const routingByName = new Map<string, Array<{ highway?: string }>>();
  for (const feature of routing as Array<{ name?: string; highway?: string }>) {
    if (!feature.name) continue;
    const list = routingByName.get(feature.name) || [];
    list.push(feature);
    routingByName.set(feature.name, list);
  }
  assert.ok((routingByName.get('Zeedijk') || []).some((way) => way.highway === 'pedestrian'),
    'Zeedijk pedestrian centreline is missing from bike routing');
  assert.equal((routingByName.get('Kalverstraat') || []).length, 0,
    'Kalverstraat is bicycle=no and must not enter bike routing');
  const ah = brandedPois.filter((poi: { kind?: string }) => poi.kind === 'albert-heijn');
  assert.ok(ah.length >= 20, `Albert Heijn coverage regressed (${ah.length})`);
  const warehouse = landmarks.find((feature: { wikidata?: string }) => feature.wikidata === 'Q14518704');
  assert.ok(warehouse?.wikipediaImageUrl, 'West-Indisch Pakhuis has a Wikipedia image');
  const carmiggelt = landmarks.find((feature: { wikidata?: string }) => feature.wikidata === 'Q56641054');
  assert.ok(carmiggelt?.wikipediaImageUrl, 'Simon Carmiggelt bust has a Wikimedia image');
}

process.stdout.write(`${expectedCityId} extract OK: ${routing.length} routing ways, ${landmarks.length} landmarks, `
  + `${linked.length} linked, ${images.length} images, ${brandedPois.length} branded POIs, `
  + `${(manifest.majorChains || []).length} major chains\n`);
