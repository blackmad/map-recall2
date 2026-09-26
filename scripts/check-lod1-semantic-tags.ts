/**
 * Regression for OSM semantic identity through OSM staging -> LoD1 -> tile.
 * It runs the real builders against a disposable city, so it catches a tag
 * disappearing at a boundary without touching the production extract.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const repo = path.resolve(import.meta.dirname, '..');
const tsx = path.resolve(repo, '..', '..', 'node_modules', '.bin', 'tsx');
const city = 'semantic-tags-fixture';
const root = await mkdtemp(path.join(tmpdir(), 'map-recall-semantic-tags-'));
const staging = path.join(root, 'public', 'data', 'extracts', city, 'staging');

type Feature = { id: string; properties: Record<string, string>; geometry: { type: 'Polygon'; coordinates: number[][][] } };
const polygon = (west: number): number[][][] => [[[west, 52.37], [west + .0001, 52.37], [west + .0001, 52.3701], [west, 52.3701], [west, 52.37]]];
const osm: Feature[] = [
  { id: 'w100', properties: { building: 'church', amenity: 'place_of_worship', tourism: 'museum', heritage: 'yes' }, geometry: { type: 'Polygon', coordinates: polygon(4.9) } },
  { id: 'w200', properties: { building: 'residential' }, geometry: { type: 'Polygon', coordinates: polygon(4.901) } },
];
const bagFeatures = osm.map((feature, index) => ({
  type: 'Feature', properties: { bagId: `bag-${index + 1}`, height: 12, minHeight: 0, heightSource: 'lod12-volume' }, geometry: feature.geometry,
}));
const semanticKeys = ['building', 'amenity', 'tourism', 'heritage'] as const;
const appearanceKeys = ['colour', 'roofColour', 'roofShape', 'roofHeight'] as const;

try {
  await mkdir(staging, { recursive: true });
  await writeFile(path.join(root, 'input.geojson'), JSON.stringify({ type: 'FeatureCollection', features: osm }));
  await writeFile(path.join(staging, 'bag-buildings.geojson'), bagFeatures.map(feature => JSON.stringify(feature)).join('\n'));
  const run = (script: string, args: string[] = []): void => {
    execFileSync(tsx, [path.join(repo, 'scripts', script), ...args], { cwd: root, stdio: 'pipe', encoding: 'utf8' });
  };
  run('build-osm-buildings.ts', [path.join(root, 'input.geojson'), path.join(staging, 'buildings-osm.geojson')]);
  run('build-lod1-city.ts', [`--city=${city}`]);
  run('build-lod1-tiles.ts', [`--city=${city}`, '--zoom=14']);

  const stagedOsm = JSON.parse(await readFile(path.join(staging, 'buildings-osm.geojson'), 'utf8')) as { features: Array<{ properties: Record<string, unknown> }> };
  const stagedOrdinary = stagedOsm.features.find(feature => feature.properties.osmId === 'w200')!.properties;
  for (const key of ['amenity', 'tourism', 'heritage'] as const) assert.ok(!(key in stagedOrdinary), `${key} stays absent in OSM staging`);

  const citySource = JSON.parse(await readFile(path.join(staging, 'lod1-city.geojson'), 'utf8')) as { features: Array<{ properties: Record<string, unknown> }> };
  const tagged = citySource.features.find(feature => feature.properties.osmId === 'w100')!.properties;
  const ordinary = citySource.features.find(feature => feature.properties.osmId === 'w200')!.properties;
  assert.deepEqual(Object.fromEntries(semanticKeys.map(key => [key, tagged[key]])), { building: 'church', amenity: 'place_of_worship', tourism: 'museum', heritage: 'yes' }, 'matched BAG mass retains OSM semantic tags');
  for (const key of ['amenity', 'tourism', 'heritage'] as const) assert.ok(!(key in ordinary), `${key} is not inferred during the LoD1 merge`);
  // The OSM staging format retains its established empty/zero placeholders
  // for absent roof fields. They are not renderable evidence and the tiler
  // must remove them from the wire representation below.
  for (const key of appearanceKeys) assert.ok([null, undefined, '', 0].includes(tagged[key] as null | undefined | string | number), `${key} is not inferred from church or museum semantics`);

  const index = JSON.parse(await readFile(path.join(staging, 'building-tiles', 'index-z14.json'), 'utf8')) as { tileList: string[] };
  const tileFeatures = (await Promise.all(index.tileList.map(async tile => {
    const [, x, y] = tile.split('/');
    const compressed = await readFile(path.join(staging, 'building-tiles', '14', x, `${y}.geojson.gz`));
    return (JSON.parse(gunzipSync(compressed).toString('utf8')) as { features: Array<{ properties: Record<string, unknown> }> }).features;
  }))).flat();
  const tiledTagged = tileFeatures.find(feature => feature.properties.id === 'bag-1')!.properties;
  const tiledOrdinary = tileFeatures.find(feature => feature.properties.id === 'bag-2')!.properties;
  assert.deepEqual(Object.fromEntries(semanticKeys.map(key => [key, tiledTagged[key]])), { building: 'church', amenity: 'place_of_worship', tourism: 'museum', heritage: 'yes' }, 'semantic tags reach the streamed tile');
  for (const key of ['amenity', 'tourism', 'heritage'] as const) assert.ok(!(key in tiledOrdinary), `${key} stays absent on the wire`);
  for (const key of appearanceKeys) assert.ok(!(key in tiledTagged), `${key} is absent on the wire without source appearance data`);
  process.stdout.write('LoD1 semantic-tag checks passed (19 assertions).\n');
} finally {
  await rm(root, { recursive: true, force: true });
}
