// Named regressions for the large-building tier (largeBuildingTier.ts).
// User 2026-10-09 (screenshot, Prinsengracht by the Westermarkt): "are we still leaving big
// buildings with colors as untextured?" — the 1999 Anne Frank museum block drew as a blank
// brown box with a grey lid between faced canal houses. Pinned here with two more canal-belt
// landmarks that stood bare: the UvA PC Hoofthuis (Singel) and Nyenrode (Keizersgracht).
//
//   npx tsx scripts/check-large-tier.ts

import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { gameDecorator, tileKeyAt, type Feature } from '../src/canalRecall/galleryPipeline.ts';
import { buildFeatureChunk, meshBuildingFor } from '../src/canalRecall/threeBuildingFeatures.ts';
import { layoutWall } from '../src/canalRecall/facadeLayout.ts';
import { STYLE_DIMS } from '../src/canalRecall/facadeCells.ts';
import { largeTierArchetype, largeTierSystem } from '../src/canalRecall/largeBuildingTier.ts';
import { shortBuildingId } from '../src/canalRecall/buildingFacts.ts';

const EXTRACT = 'public/data/extracts/amsterdam';
const gz = (file: string) => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString());
const landmarkIds = new Set<string>();
for (const list of Object.values(JSON.parse(fs.readFileSync(`${EXTRACT}/landmark-buildings.json`, 'utf8')).buildings as Record<string, string[]>)) for (const id of list) landmarkIds.add(id);
const gables = JSON.parse(fs.readFileSync(`${EXTRACT}/monument-gables.json`, 'utf8'));
const listed = new Set<string>(gables.listedLandmarks ?? []);
const decorate = gameDecorator({ landmarkIds, listed });

function tileFeatures(lng: number, lat: number): Feature[] {
  const key = tileKeyAt(lng, lat);
  const facts = gz(`${EXTRACT}/building-facts/14/${key}.json.gz`).buildings as Record<string, number[]>;
  return (gz(`${EXTRACT}/building-tiles/14/${key}.geojson.gz`).features as Feature[]).map(f => {
    const year = facts[shortBuildingId(String(f.properties.id))]?.[0];
    return decorate({ ...f, properties: { ...f.properties, ...(year ? { constructionYear: year } : {}) } });
  });
}

const CASES = [
  { name: 'Anne Frank House museum block, Prinsengracht (1999, listed)', id: 'NL.IMBAG.Pand.0363100012169587', at: [4.884147, 52.375053], archetype: 'modern', storeys: [3, 4] },
  { name: 'UvA PC Hoofthuis, Singel (1984, listed)', id: 'NL.IMBAG.Pand.0363100012165429', at: [4.889672, 52.373877], archetype: 'modern', storeys: [6, 7] },
  { name: 'Nyenrode, Keizersgracht (1956)', id: 'NL.IMBAG.Pand.0363100012169023', at: [4.885315, 52.370645], archetype: 'modern', storeys: [5, 6] },
] as const;

for (const c of CASES) {
  const features = tileFeatures(c.at[0], c.at[1]);
  const f = features.find(x => x.properties.id === c.id);
  assert.ok(f, `${c.name}: in its tile`);
  assert.equal(f.properties.largeTier, c.archetype, `${c.name}: large tier ${c.archetype}`);
  assert.equal(f.properties.roofPlanned, undefined, `${c.name}: keeps its own flat form`);
  for (const look of ['photo', 'procedural', 'storybook', 'cartoon'] as const) {
    const b = meshBuildingFor(f, look);
    assert.ok(b && !b.bare, `${c.name}: ${look} look draws a facade, not a bare box`);
    assert.ok(b.layoutScale && b.parapetM, `${c.name}: ${look} civic storeys and parapet`);
    assert.equal(b.extras, false, `${c.name}: no house extras (hoist beams, stoops) on a large building`);
    assert.equal(b.shop, false, `${c.name}: no guessed shopfront`);
  }
  const b = meshBuildingFor(f, 'photo')!;
  const layout = layoutWall(b.style, 30, b.heightM - b.parapetM!, 0.3, true, b.layoutScale);
  assert.ok(layout, `${c.name}: a layout`);
  assert.ok(layout.storeys + 1 >= c.storeys[0] && layout.storeys + 1 <= c.storeys[1], `${c.name}: ${layout.storeys + 1} floors for ${b.heightM} m`);
  assert.ok(layout.storeyM >= 3.2 && layout.storeyM <= 4.6, `${c.name}: civic storey ${layout.storeyM.toFixed(2)} m`);
  assert.deepEqual(layout.doorBays.length, 1, `${c.name}: one entrance per run, not a house door every few bays`);
  // Cost: the same few quads per wall as any faced building.
  const bare = { ...f, properties: { ...f.properties, facade: undefined, facadeStyle: undefined, largeTier: undefined } };
  const faced = buildFeatureChunk([f], 'photo'), plain = buildFeatureChunk([bare], 'photo');
  const tris = (k: { indices: Uint32Array }) => k.indices.length / 3;
  assert.ok(tris(faced) <= tris(plain) * 4 + 400, `${c.name}: ${tris(plain)} -> ${tris(faced)} triangles`);
  console.log(`${c.name}: ${b.style}, ${layout.storeys + 1} floors of ${layout.storeyM.toFixed(2)} m, ${tris(plain)} -> ${tris(faced)} tris`);
}

// Period choice: BAG year picks the system; a listed landmark keeps brick even when BAG dates a rebuild.
assert.equal(largeTierArchetype(1888, false, 20), 'c19');
assert.equal(largeTierArchetype(1932, false, 39), 'school');
assert.equal(largeTierArchetype(1999, true, 17), 'modern');
assert.equal(largeTierArchetype(null, true, 20), 'c19');
assert.equal(largeTierArchetype(null, false, 60), 'modern');
assert.ok([0, 1].includes(largeTierSystem('x', 'modern', '#7a4535', 17).style), 'a brick-coloured post-war block takes brick punched windows');
assert.ok([6, 7].includes(largeTierSystem('x', 'modern', '#b9ad9a', 60).style), 'a pale tower takes ribbon or curtain glazing');
for (const a of ['c19', 'school', 'modern'] as const) {
  const s = largeTierSystem('y', a, '#b9ad9a', 20);
  assert.ok(STYLE_DIMS[s.layout], `${a}: a known layout`);
}
console.log('large tier: ok');
