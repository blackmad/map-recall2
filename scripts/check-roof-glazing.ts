// Named regressions for the contemporary family's set-back crown (user feedback 2026-11-14 on build 2cd2fb7).
//
// 09e7bce0 "this generic roof window style is weird" (Grasweg / Buiksloterham, storybook, aerial pan): a blue curtain-wall
// band ran along the parapets of flat 2005+ blocks. It was the set-back top storey (threeBuildingFeatures.ts
// withSetbackCrown, curtain cell BAY_STYLES.modern[7]) on a 35 % hash draw of every 2005+ housing pand of 14 m and more
// (852 pands). On Grasweg 116-124 (BAG 0363100012252853, the bespoke grasweg-116.glb suppresses it) the crown was a
// separate `<id>:setback` range the suppression never named, so it floated as a glass ring over the model's towers.
// 6070a7e5 (same view): Grasweg 116-124's stepped base is the model's terraces, real on the PDOK orthophoto.
//
//   npx tsx scripts/check-roof-glazing.ts            (npm run -s check:roof-glazing)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { gameDecorator, tileKeyAt, type Feature } from '../src/canalRecall/galleryPipeline.ts';
import { buildFeatureChunk, meshBuildingFor } from '../src/canalRecall/threeBuildingFeatures.ts';
import { shortBuildingId } from '../src/canalRecall/buildingFacts.ts';
import { setbackTagged } from '../src/canalRecall/contemporaryFamily.ts';

const EXTRACT = 'public/data/extracts/amsterdam';
const gz = (file: string) => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString());
const landmarkIds = new Set<string>();
for (const list of Object.values(JSON.parse(fs.readFileSync(`${EXTRACT}/landmark-buildings.json`, 'utf8')).buildings as Record<string, string[]>)) for (const id of list) landmarkIds.add(id);
const gables = JSON.parse(fs.readFileSync(`${EXTRACT}/monument-gables.json`, 'utf8'));
const decorate = gameDecorator({ landmarkIds, listed: new Set<string>(gables.listedLandmarks ?? []) });
const tileFeatures = (key: string): Feature[] => {
  const facts = gz(`${EXTRACT}/building-facts/14/${key}.json.gz`).buildings as Record<string, number[]>;
  return (gz(`${EXTRACT}/building-tiles/14/${key}.geojson.gz`).features as Feature[]).map(f => {
    const year = facts[shortBuildingId(String(f.properties.id))]?.[0];
    return decorate({ ...f, properties: { ...f.properties, ...(year ? { constructionYear: year } : {}) } });
  });
};

// The pands the user's view showed with a glass crown (Grasweg 116-124 under its model, the orange 2025 block south of it,
// the 2018 block by the Wim Ibobrug): none carries set-back evidence, so none steps back, in any look.
const GRASWEG = tileFeatures(tileKeyAt(4.8985, 52.3935));
for (const [name, id] of [['Grasweg 116-124 (grasweg-116.glb)', 'NL.IMBAG.Pand.0363100012252853'], ['Grasweg 2025 block, orange (OSM w1443650337)', 'w1443650337'], ['Grasweg 2018 block (BAG 0363100012250965)', 'NL.IMBAG.Pand.0363100012250965']] as const) {
  const f = GRASWEG.find(x => x.properties.id === id);
  assert.ok(f, `${name}: in its tile`);
  for (const look of ['storybook', 'photo', 'cartoon'] as const) assert.ok(!meshBuildingFor(f, look)?.setbackCrown, `${name}: no set-back crown (${look})`);
  const chunk = buildFeatureChunk([f], 'storybook');
  assert.deepEqual(chunk.ranges.map(r => r.id), [id], `${name}: one range, the pand's own`);
  console.log(`ok ${name}: no crown, one range`);
}

// An evidenced crown (Houthavenkade 26: "a set-back glazed top floor") still splits, and its vertices stay in the pand's
// range, so a model's suppression, the rider-cover ghost, the card highlight and the ground lift reach it.
const id = 'NL.IMBAG.Pand.0363100012247232';
assert.ok(setbackTagged(id), 'Houthavenkade 26 carries the setback tag');
const ring = [[4.8770, 52.3930], [4.8780, 52.3930], [4.8780, 52.3936], [4.8770, 52.3936], [4.8770, 52.3930]];
const tagged = { type: 'Feature' as const, properties: { id, height: 26, minHeight: 0, constructionYear: 2018, facade: 'modern|x', facadeStyle: 'modern' }, geometry: { type: 'Polygon', coordinates: [ring] } } as unknown as Feature;
assert.equal(meshBuildingFor(tagged, 'storybook')?.setbackCrown, true, 'a tagged block steps back');
const neighbour = { ...tagged, properties: { ...tagged.properties, id: 'NL.IMBAG.Pand.0363100012247233' }, geometry: { type: 'Polygon', coordinates: [ring.map(([x, y]) => [x + 0.002, y])] } } as unknown as Feature;
const chunk = buildFeatureChunk([tagged, neighbour], 'storybook');
assert.deepEqual(chunk.ranges.map(r => r.id), [id, neighbour.properties.id], 'crown merged into its pand, neighbour untouched');
assert.equal(chunk.ranges[0].count + chunk.ranges[1].count, chunk.vertexCount);
console.log('ok Houthavenkade 26 (tagged): crown drawn inside the pand range');

// City-wide: only tagged pands step back (852 before 2026-11-14).
let crowns = 0, candidates = 0;
for (const x of fs.readdirSync(`${EXTRACT}/building-tiles/14`)) for (const file of fs.readdirSync(`${EXTRACT}/building-tiles/14/${x}`)) {
  const key = `${x}/${file.replace('.geojson.gz', '')}`;
  if (!fs.existsSync(`${EXTRACT}/building-facts/14/${key}.json.gz`)) continue;
  const facts = gz(`${EXTRACT}/building-facts/14/${key}.json.gz`).buildings as Record<string, number[]>;
  for (const raw of gz(`${EXTRACT}/building-tiles/14/${key}.geojson.gz`).features as Feature[]) {
    const year = facts[shortBuildingId(String(raw.properties.id))]?.[0];
    if (!year || year < 2005 || Number(raw.properties.height) < 14) continue;
    candidates++;
    const b = meshBuildingFor(decorate({ ...raw, properties: { ...raw.properties, constructionYear: year } }), 'storybook');
    if (b?.setbackCrown) { crowns++; assert.ok(setbackTagged(String(raw.properties.id)), `${raw.properties.id}: crown without the setback tag`); }
  }
}
assert.ok(crowns <= 2, `${crowns} set-back crowns city-wide`);
console.log(`ok city-wide: ${crowns} set-back crowns among ${candidates} 2005+ pands of 14 m and more (852 before)`);
