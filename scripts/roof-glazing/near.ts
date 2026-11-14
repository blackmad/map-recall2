// Diagnostic: the storybook mesh building of every pand within R m of a point (wall, layers, bare/plain, crown).
//   npx tsx scripts/roof-glazing/near.ts <lng> <lat> [R]
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
const [lng, lat, R] = [Number(process.argv[2]), Number(process.argv[3]), Number(process.argv[4] ?? 150)];
const key = tileKeyAt(lng, lat);
const facts = gz(`${EXTRACT}/building-facts/14/${key}.json.gz`).buildings as Record<string, number[]>;
for (const raw of gz(`${EXTRACT}/building-tiles/14/${key}.geojson.gz`).features as Feature[]) {
  const g = raw.geometry as { type: string; coordinates: any };
  const ring: number[][] = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0];
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const d = Math.hypot((cx - lng) * 67900, (cy - lat) * 111200);
  if (d > R) continue;
  const year = facts[shortBuildingId(String(raw.properties.id))]?.[0];
  const f = decorate({ ...raw, properties: { ...raw.properties, ...(year ? { constructionYear: year } : {}) } });
  const b = meshBuildingFor(f, 'storybook');
  const p = f.properties as Record<string, unknown>;
  console.log(Math.round(d), String(raw.properties.id).replace('NL.IMBAG.Pand.', ''), year, Math.round(Number(raw.properties.height)), b ? `${b.style} wall ${b.wallHex} layers ${JSON.stringify(b.layers)} bare ${!!b.bare} plain ${!!b.plainWalls} ind ${JSON.stringify(b.industrial ?? null)?.slice(0, 40)} crown ${!!b.setbackCrown} large ${p.largeTier ?? ''} kit ${p.kitWall ?? ''}` : 'null', `@${cx.toFixed(5)},${cy.toFixed(5)}`);
}
