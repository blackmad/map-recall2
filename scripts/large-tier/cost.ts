// Triangle cost of the large-building tier: every large-tier building's wall
// chunk, faced vs the bare box it replaced.
//   node --import tsx scripts/large-tier/cost.ts
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { gameDecorator, type Feature } from '../../src/canalRecall/galleryPipeline.ts';
import { buildFeatureChunk } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { shortBuildingId } from '../../src/canalRecall/buildingFacts.ts';

const E = 'public/data/extracts/amsterdam';
const gz = (f: string) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());
const ids = new Set<string>();
for (const l of Object.values(JSON.parse(fs.readFileSync(`${E}/landmark-buildings.json`, 'utf8')).buildings as Record<string, string[]>)) for (const i of l) ids.add(i);
const listed = new Set<string>(JSON.parse(fs.readFileSync(`${E}/monument-gables.json`, 'utf8')).listedLandmarks);
const decorate = gameDecorator({ landmarkIds: ids, listed });
let n = 0, before = 0, after = 0;
const R = `${E}/building-tiles/14`;
for (const x of fs.readdirSync(R)) for (const file of fs.readdirSync(path.join(R, x))) {
  const y = file.replace('.geojson.gz', '');
  const ff = `${E}/building-facts/14/${x}/${y}.json.gz`;
  const facts = fs.existsSync(ff) ? gz(ff).buildings : {};
  for (const raw of gz(path.join(R, x, file)).features as Feature[]) {
    if (!ids.has(String(raw.properties.id))) continue;
    const year = facts[shortBuildingId(String(raw.properties.id))]?.[0];
    const f = decorate({ ...raw, properties: { ...raw.properties, ...(year ? { constructionYear: year } : {}) } });
    if (!f.properties.largeTier) continue;
    n++;
    const bare = { ...f, properties: { ...f.properties, facade: undefined, facadeStyle: undefined, largeTier: undefined } };
    after += buildFeatureChunk([f], 'photo').indices.length / 3;
    before += buildFeatureChunk([bare], 'photo').indices.length / 3;
  }
}
console.log({ largeTier: n, trianglesBare: before, trianglesFaced: after, delta: after - before, perBuilding: Math.round((after - before) / n) });
