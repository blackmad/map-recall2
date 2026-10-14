import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ARCHETYPES, archetypeGuess, bagTilesEnabled, coversPand, decodeDescriptor, fullPandId, hiddenIdsFor, matchOsm, midDescriptor,
  mutualShare, plausibleYear, roofCode, shareInside, shortPandId, storeysOf, tileFactProperties,
  type CoversFile, type PandFacts,
} from './bagTiles.js';
import { addFeatures, emptyIndex, nearbyPands, resolveSuppressed } from './bagPandIndex.js';
import { tileUrl } from './buildingTileSource.js';
import { BuildingTileStreamer, loadBagCovers } from './buildingTilesBrowser.js';
import type { Ring } from './buildingLadder.js';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { GROUND_OUTLIER_M, GROUND_REACH_M, bagHeightM, pandGroundNap, sampleTerrain, trustedGroundNap } from './bag3dCityJson.js';
import { bag3dMassingRecords, bag3dPands } from './facade/sources/netherlands.js';
import { sharedTerrain } from '../../scripts/lib/terrainField.js';

/** A square of `size` degrees with its south-west corner at (x, y), closed. */
const square = (x: number, y: number, size = 0.0001): Ring => [[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]];
const facts = (over: Partial<PandFacts> = {}): PandFacts => ({
  heightM: 10, eavesM: 8, ridgeM: 12, roofType: 'slanted', year: 1650, storeys: null, groundAreaM2: 90, partyWallAreaM2: 120, ...over,
});

test('pand ids shorten to the 16-digit tail and come back', () => {
  assert.equal(shortPandId('NL.IMBAG.Pand.0363100012178473'), '0363100012178473');
  assert.equal(fullPandId('0363100012178473'), 'NL.IMBAG.Pand.0363100012178473');
  assert.equal(fullPandId('w123'), 'w123');
  assert.equal(shortPandId('w123'), 'w123');
});

test('shareInside is the share of the subject under the container', () => {
  const house = square(4.9, 52.3);
  assert.equal(shareInside([house], [house]), 1);
  assert.equal(shareInside([house], [square(5, 53)]), 0);
  const half = shareInside([house], [[[4.9, 52.3], [4.90005, 52.3], [4.90005, 52.3001], [4.9, 52.3001], [4.9, 52.3]]]);
  assert.ok(half > 0.45 && half < 0.55, `half was ${half}`);
});

test('mutualShare matches a part inside a pand and a pand inside a bigger outline', () => {
  const pand = square(4.9, 52.3, 0.0002);
  const part = square(4.90005, 52.30005, 0.00005);
  assert.equal(mutualShare([pand], [part]), 1);
  assert.equal(mutualShare([part], [pand]), 1);
});

test('matchOsm keeps ids at or above 60% and drops neighbours', () => {
  const pand = square(4.9, 52.3);
  const same = { osmId: 'w1', rings: [square(4.90000, 52.30000)] };
  const shifted = { osmId: 'w2', rings: [square(4.90002, 52.30000)] };            // ~80% overlap
  const neighbour = { osmId: 'w3', rings: [square(4.90008, 52.30000)] };            // ~20% overlap
  const far = { osmId: 'r4', rings: [square(4.95, 52.35)] };
  assert.deepEqual(matchOsm([pand], [same, shifted, neighbour, far, same]), ['w1', 'w2']);
  assert.deepEqual(matchOsm([pand], [neighbour]), []);
});

test('coversPand accepts the centroid or half the area', () => {
  const pand = square(4.9, 52.3);
  const centroid: [number, number] = [4.90005, 52.30005];
  const box = (w: number, e: number) => ({ contains: (p: readonly [number, number]) => p[0] >= w && p[0] <= e && p[1] >= 52.3 && p[1] <= 52.3001 });
  assert.equal(coversPand(box(4.9, 4.9001), [pand], centroid), true);
  assert.equal(coversPand(box(4.90006, 4.9001), [pand], centroid), false);        // 40% under, centroid outside
  assert.equal(coversPand(box(4.90004, 4.9001), [pand], centroid), true);         // 60% under
  assert.equal(coversPand(box(5, 5.1), [pand], centroid), false);
});

test('roof codes and plausible years', () => {
  assert.deepEqual(['horizontal', 'multiple horizontal', 'slanted', 'unknown', null].map(roofCode), [1, 2, 3, 0, 0]);
  assert.equal(plausibleYear(1005), false);
  assert.equal(plausibleYear(1650), true);
  assert.equal(plausibleYear(null), false);
});

test('storeys come from the eave for pitched roofs and the roof for flat ones', () => {
  assert.equal(storeysOf({ eavesM: 9.4, heightM: 12, ridgeM: 14, roofType: 'slanted', storeys: null }), 3);
  assert.equal(storeysOf({ eavesM: 21, heightM: 21.2, ridgeM: null, roofType: 'horizontal', storeys: null }), 7);
  assert.equal(storeysOf({ eavesM: null, heightM: null, ridgeM: null, roofType: null, storeys: null }), 1);
  assert.equal(storeysOf({ eavesM: 3, heightM: 3, ridgeM: null, roofType: null, storeys: 5 }), 5);
});

test('archetype guesses follow era, shape and size', () => {
  assert.equal(archetypeGuess(facts()), 'canal-house');
  assert.equal(archetypeGuess(facts({ year: 1890 })), 'c19-terrace');
  assert.equal(archetypeGuess(facts({ year: 1890, partyWallAreaM2: 0 })), 'c19-house');
  assert.equal(archetypeGuess(facts({ year: 1928 })), 'school-block');
  assert.equal(archetypeGuess(facts({ year: 1975, roofType: 'horizontal', heightM: 18 })), 'modern-block');
  assert.equal(archetypeGuess(facts({ year: 2005, partyWallAreaM2: 0, heightM: 8 })), 'modern-house');
  assert.equal(archetypeGuess(facts({ heightM: 80 })), 'tower');
  assert.equal(archetypeGuess(facts({ groundAreaM2: 12 })), 'outbuilding');
  assert.equal(archetypeGuess(facts({ groundAreaM2: 4000, roofType: 'horizontal' })), 'large-flat');
  assert.equal(archetypeGuess(facts({ year: 1005, roofType: null, partyWallAreaM2: 0 })), 'unknown');
});

test('the mid descriptor round-trips at decimetre precision', () => {
  const row = midDescriptor(facts({ eavesM: 8.04, ridgeM: 12.26 }));
  assert.equal(row.length, 7);
  const back = decodeDescriptor(row);
  assert.equal(back.archetype, 'canal-house');
  assert.equal(back.storeys, 3);
  assert.equal(back.roof, 3);
  assert.equal(back.eavesM, 8);
  assert.equal(back.ridgeM, 12.3);
  assert.equal(back.year, 1650);
  assert.equal(back.terraced, true);
  assert.equal(JSON.stringify(row).length < 40, true);
  assert.equal(ARCHETYPES[row[0]], back.archetype);
  const none = decodeDescriptor(midDescriptor(facts({ eavesM: null, ridgeM: null, year: 1005, partyWallAreaM2: null })));
  assert.deepEqual([none.eavesM, none.ridgeM, none.year, none.terraced], [null, null, null, false]);
});

test('tile fact properties leave absent facts out', () => {
  assert.deepEqual(tileFactProperties(facts({ ridgeM: null, year: 1005 }), []), { eaves: 8, roof: 3 });
  assert.deepEqual(tileFactProperties(facts(), ['w1', 'r2']), { eaves: 8, ridge: 12, roof: 3, year: 1650, osm: ['w1', 'r2'] });
});

const covers: CoversFile = {
  version: 1, generatedAt: 'test',
  models: { rijks: { p: ['0363100012241554', '0363100012241555'], o: ['w9'] }, empty: { p: [] } },
  buildingTypes: [],
};

test('hiddenIdsFor hides the covered pands and keeps unknown models on their own list', () => {
  const ids = hiddenIdsFor(covers, [
    { id: 'rijks', suppressOsmIds: ['w1', 'NL.IMBAG.Pand.0363100012241554'] },
    { id: 'building-types-a', suppressOsmIds: ['NL.IMBAG.Pand.0363100012000001'] },
  ]);
  assert.deepEqual(ids.sort(), ['NL.IMBAG.Pand.0363100012000001', 'NL.IMBAG.Pand.0363100012241554', 'NL.IMBAG.Pand.0363100012241555', 'w9']);
});

test('?bagTiles=1 is the only switch', () => {
  assert.equal(bagTilesEnabled('?bagTiles=1'), true);
  assert.equal(bagTilesEnabled('?x=1&bagTiles=true'), true);
  assert.equal(bagTilesEnabled('?bagTiles=0'), false);
  assert.equal(bagTilesEnabled(''), false);
});

test('tileUrl names the tile set', () => {
  assert.equal(tileUrl({ z: 14, x: 1, y: 2 }, '../data/'), '../data/building-tiles/14/1/2.geojson.gz');
  assert.equal(tileUrl({ z: 14, x: 1, y: 2 }, '../data', 'bag-tiles'), '../data/bag-tiles/14/1/2.geojson.gz');
});

const feature = (id: string, ring: Ring, extra: Record<string, unknown> = {}) =>
  ({ properties: { id, ...extra }, geometry: { type: 'Polygon', coordinates: [ring] } });

test('the pand index resolves suppress ids directly, through aliases, to OSM-only outlines, or not at all', () => {
  const index = emptyIndex();
  addFeatures(index, [
    feature('NL.IMBAG.Pand.1', square(4.9, 52.3), { osm: ['w10', 'w11'] }),
    feature('NL.IMBAG.Pand.2', square(4.9002, 52.3), { osm: ['r20'] }),
    feature('w99', square(4.91, 52.3)),
  ]);
  assert.equal(index.pands.size, 2);
  assert.deepEqual(index.osmToPands.get('w10'), ['NL.IMBAG.Pand.1']);
  const resolved = resolveSuppressed(index, ['NL.IMBAG.Pand.1', 'r20', 'w99', 'w404', 'w10']);
  assert.deepEqual(resolved.direct, ['NL.IMBAG.Pand.1']);
  assert.deepEqual(resolved.viaAlias, ['NL.IMBAG.Pand.2']);
  assert.deepEqual(resolved.osmOnly, ['w99']);
  assert.deepEqual(resolved.unresolved, ['w404']);
  const near = nearbyPands(index, { w: 4.8999, s: 52.2999, e: 4.9001, n: 52.3001 });
  assert.ok(near.some(p => p.id === 'NL.IMBAG.Pand.1'));
  assert.equal(nearbyPands(index, { w: 5, s: 53, e: 5.0001, n: 53.0001 }).length, 0);
});

// --- the tile reader / streamer, with a stub network -----------------------------------------------------------------

const stubFetch = (published: Record<string, unknown>): typeof fetch =>
  (async (url: string) => {
    const hit = Object.entries(published).find(([path]) => String(url).endsWith(path));
    return hit ? new Response(JSON.stringify(hit[1]), { status: 200 }) : new Response('<html>app</html>', { status: 200 });
  }) as unknown as typeof fetch;

const withEnv = async (search: string, published: Record<string, unknown>, body: () => Promise<void>) => {
  const g = globalThis as unknown as { location?: unknown; fetch: typeof fetch };
  const saved = { location: g.location, fetch: g.fetch };
  g.location = { search };
  g.fetch = stubFetch(published);
  try { await body(); } finally { g.location = saved.location; g.fetch = saved.fetch; }
};
const index14 = { zoom: 14, tileList: ['14/1/2'] };
const streamer = () => new BuildingTileStreamer({} as never, 'src', '../data');

test('the streamer reads bag-tiles under the flag when published, and falls back when not', async () => {
  await withEnv('?bagTiles=1', { 'bag-tiles/index-z14.json': index14, 'building-tiles/index-z14.json': index14 }, async () => {
    const s = streamer();
    assert.equal(await s.probe(), true);
    assert.equal(s.usingBagTiles, true);
  });
  await withEnv('?bagTiles=1', { 'building-tiles/index-z14.json': index14 }, async () => {
    const s = streamer();
    assert.equal(await s.probe(), true);
    assert.equal(s.usingBagTiles, false);
  });
  await withEnv('', { 'bag-tiles/index-z14.json': index14, 'building-tiles/index-z14.json': index14 }, async () => {
    const s = streamer();
    assert.equal(await s.probe(), true);
    assert.equal(s.usingBagTiles, false);
  });
  await withEnv('?bagTiles=1', {}, async () => {
    assert.equal(await streamer().probe(), false);
  });
});

test('loadBagCovers rejects an app page and anything that is not covers.json', async () => {
  assert.deepEqual(await loadBagCovers('models/covers.json', stubFetch({ 'covers.json': covers })), covers);
  assert.equal(await loadBagCovers('models/covers.json', stubFetch({})), null);
  assert.equal(await loadBagCovers('models/covers.json', stubFetch({ 'covers.json': { version: 2 } })), null);
});

// Nassaukade 63X (NL.IMBAG.Pand.0363100012124441), a box standing in the Singelgracht by the Frederik
// Hendrikplantsoen: 3DBAG measured its roof at +5.9 NAP but fell back to a ground of -9.67 NAP, so it
// stood 15.6 m tall in the water (live play, 2026-10-14). Attributes as 3DBAG v2025.09 publishes them.
const nassaukade63x = { b3_h_maaiveld: -9.673999786376953, b3_h_dak_70p: 5.894999980926514, b3_h_dak_min: 5.7170000076293945, b3_h_nok: null, b3_volume_lod12: 997.97, b3_opp_grond: 64.1, oorspronkelijkbouwjaar: 1990 };
const NASSAUKADE_63X_TERRAIN_NAP = 0.47; // ground-height-v1 at the footprint centre (the quay beside it)

test('a 3DBAG ground far below the AHN terrain is replaced by the terrain (Nassaukade 63X in the Singelgracht)', () => {
  assert.deepEqual(trustedGroundNap(nassaukade63x, NASSAUKADE_63X_TERRAIN_NAP), { groundNapM: NASSAUKADE_63X_TERRAIN_NAP, source: 'terrain' });
  const { heightM, source } = bagHeightM(nassaukade63x, NASSAUKADE_63X_TERRAIN_NAP);
  assert.equal(source, 'roof-70p');
  assert.ok(Math.abs(heightM! - 5.42) < 0.01, `height ${heightM}`);
  // Without a terrain sample the old height stands.
  assert.ok(Math.abs(bagHeightM(nassaukade63x).heightM! - 15.57) < 0.01);
});

test('the terrain does not replace a 3DBAG ground that is plausible, newer than the survey, or above the roof', () => {
  const near = { ...nassaukade63x, b3_h_maaiveld: NASSAUKADE_63X_TERRAIN_NAP - GROUND_OUTLIER_M + 0.1 };
  assert.equal(trustedGroundNap(near, NASSAUKADE_63X_TERRAIN_NAP).source, '3dbag');
  assert.equal(trustedGroundNap({ ...nassaukade63x, oorspronkelijkbouwjaar: 2024 }, NASSAUKADE_63X_TERRAIN_NAP).source, '3dbag');
  // A sunken or underground pand whose roof barely clears the terrain keeps its own ground.
  assert.equal(trustedGroundNap({ ...nassaukade63x, b3_h_dak_70p: NASSAUKADE_63X_TERRAIN_NAP + 1 }, NASSAUKADE_63X_TERRAIN_NAP).source, '3dbag');
  assert.equal(trustedGroundNap(nassaukade63x, Number.NaN).source, '3dbag');
  assert.equal(trustedGroundNap(nassaukade63x, null).source, '3dbag');
});

test('published tiles carry Nassaukade 63X at its re-measured height, not 15.6 m', () => {
  const feature = (dir: string) => {
    const text = gunzipSync(readFileSync(new URL(`../../public/data/extracts/amsterdam/${dir}/14/8414/5383.geojson.gz`, import.meta.url))).toString('utf8');
    return JSON.parse(text).features.find((f: { properties: { id: string } }) => f.properties.id === 'NL.IMBAG.Pand.0363100012124441');
  };
  for (const dir of ['building-tiles', 'bag-tiles']) assert.ok(feature(dir)?.properties.height < 7, `${dir}: ${feature(dir)?.properties.height}`);
  assert.ok(feature('bag-tiles').properties.eaves < 7);
});

// ------------------------------------------------- the terrain rule as the single ground (readers, 2026-10-14)
// Nassaukade 63X and its nearest ordinary neighbour (0363100012207164) as 3DBAG v20250903 publishes them, read on the
// committed AHN terrain extract: the shared entry point `pandGroundNap` and the 3DBAG massing reader that uses it.
const groundFixture = JSON.parse(readFileSync(new URL('./fixtures/bag3d-nassaukade-63x.json', import.meta.url), 'utf8'));
const fixtureRing = (item: any): number[][] => {
  const t = item.metadata.transform, building: any = Object.values(item.feature.CityObjects).find((o: any) => o.type === 'Building');
  return building.geometry.find((g: any) => g.lod === '0').boundaries[0][0].map((i: number) => item.feature.vertices[i]).map((v: number[]) => [v[0] * t.scale[0] + t.translate[0], v[1] * t.scale[1] + t.translate[1]]);
};
const fixtureAttributes = (item: any) => (Object.values(item.feature.CityObjects).find((o: any) => o.type === 'Building') as any).attributes;

test('pandGroundNap: Nassaukade 63X stands on the terrain, its ordinary neighbour on 3DBAG; nothing injected keeps 3DBAG', () => {
  const terrainAt = sharedTerrain()!;
  const outlier = pandGroundNap(fixtureAttributes(groundFixture.outlier), terrainAt, fixtureRing(groundFixture.outlier));
  assert.equal(outlier.source, 'terrain');
  assert.ok(Math.abs(outlier.groundNapM! - NASSAUKADE_63X_TERRAIN_NAP) < 0.01, `ground ${outlier.groundNapM}`);
  assert.ok(outlier.terrain!.aroundMinNapM! > -9.674 + GROUND_REACH_M, 'no low ground beside it: the −9.67 is a failed estimate');
  const ordinary = pandGroundNap(fixtureAttributes(groundFixture.ordinary), terrainAt, fixtureRing(groundFixture.ordinary));
  assert.deepEqual([ordinary.source, ordinary.groundNapM], ['3dbag', fixtureAttributes(groundFixture.ordinary).b3_h_maaiveld]);
  assert.deepEqual(pandGroundNap(fixtureAttributes(groundFixture.outlier)), { groundNapM: -9.673999786376953, source: '3dbag', terrain: null });
  // A closed ring samples the same as the open one.
  const ring = fixtureRing(groundFixture.outlier);
  assert.deepEqual(sampleTerrain(terrainAt, [...ring, ring[0]]), sampleTerrain(terrainAt, ring));
});

test('pandGroundNap: split-level ground is real ground (Stadsloket West against the Bos en Lommerplein deck)', () => {
  // 0363100012118358: 3DBAG ground +0.82 NAP on the A10 side street; the terrain under the footprint is interpolated from
  // the raised plaza at +4.7, 3.9 m above it. The terrain 4 m outside the walls comes down to +0.71: not a failed estimate.
  const facts = JSON.parse(readFileSync(new URL('../../scripts/building-recipes/houses/stadsloket-west/facts.json', import.meta.url), 'utf8'));
  const g = pandGroundNap(facts.attributes, sharedTerrain(), facts.bagFootprintRD[0]);
  assert.ok(g.terrain!.underNapM! > facts.attributes.b3_h_maaiveld + GROUND_OUTLIER_M, `under ${g.terrain!.underNapM}`);
  assert.deepEqual([g.source, g.groundNapM], ['3dbag', facts.attributes.b3_h_maaiveld]);
  // The bare under-footprint number (no sample around) still replaces it: the reach test is what keeps it.
  assert.equal(trustedGroundNap(facts.attributes, g.terrain!.underNapM).source, 'terrain');
});

test('3DBAG massing records (facade/sources/netherlands.ts): groundLevel is the trusted ground', () => {
  const page = (item: any) => ({ CityObjects: item.feature.CityObjects, vertices: item.feature.vertices });
  // Both items come from one tile, so one transform decodes both rings.
  assert.deepEqual(groundFixture.outlier.metadata.transform, groundFixture.ordinary.metadata.transform);
  const pands = bag3dPands([page(groundFixture.outlier), page(groundFixture.ordinary)], groundFixture.outlier.metadata.transform);
  const [outlier, ordinary] = bag3dMassingRecords(pands, sharedTerrain());
  assert.equal(outlier.buildingId, '0363100012124441');
  assert.ok(Math.abs(outlier.groundLevel! - NASSAUKADE_63X_TERRAIN_NAP) < 0.01, `groundLevel ${outlier.groundLevel}`);
  assert.equal(ordinary.groundLevel, fixtureAttributes(groundFixture.ordinary).b3_h_maaiveld);
  // Without a terrain field the record is what the source publishes.
  assert.equal(bag3dMassingRecords(pands)[0].groundLevel, -9.673999786376953);
});
