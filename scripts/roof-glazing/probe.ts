// Probe: which pands near a point draw a set-back crown, and what Grasweg 118-124 draws as.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { gameDecorator, tileKeyAt, type Feature } from '../../src/canalRecall/galleryPipeline.ts';
import { meshBuildingFor } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { shortBuildingId } from '../../src/canalRecall/buildingFacts.ts';

const EXTRACT = 'public/data/extracts/amsterdam';
const gz = (file: string) => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString());
const landmarkIds = new Set<string>();
for (const list of Object.values(JSON.parse(fs.readFileSync(`${EXTRACT}/landmark-buildings.json`, 'utf8')).buildings as Record<string, string[]>)) for (const id of list) landmarkIds.add(id);
const gables = JSON.parse(fs.readFileSync(`${EXTRACT}/monument-gables.json`, 'utf8'));
const decorate = gameDecorator({ landmarkIds, listed: new Set<string>(gables.listedLandmarks ?? []) });
const [lng, lat] = [Number(process.argv[2] ?? 4.8985), Number(process.argv[3] ?? 52.3935)];
const key = tileKeyAt(lng, lat);
const facts = gz(`${EXTRACT}/building-facts/14/${key}.json.gz`).buildings as Record<string, number[]>;
for (const raw of gz(`${EXTRACT}/building-tiles/14/${key}.geojson.gz`).features as Feature[]) {
  const year = facts[shortBuildingId(String(raw.properties.id))]?.[0];
  const f = decorate({ ...raw, properties: { ...raw.properties, ...(year ? { constructionYear: year } : {}) } });
  const b = meshBuildingFor(f, 'storybook');
  const ring = (f.geometry as any).coordinates?.[0]?.[0];
  if (!b) continue;
  const near = ring && Math.hypot((ring[0] - lng) * 68, (ring[1] - lat) * 111) < 0.5;
  if (b.setbackCrown || String(f.properties.id).includes(process.argv[4] ?? '0363100012252853')) {
    console.log(near ? '*' : ' ', f.properties.id, year, b.heightM, 'setback', !!b.setbackCrown, 'style', b.style, 'tier', f.properties.tier, 'large', f.properties.largeTier ?? '', 'surveyed', !!b.surveyedEnvelope, 'layers', JSON.stringify(b.layers), ring?.map((v: number) => v.toFixed(5)).join(','));
  }
}
