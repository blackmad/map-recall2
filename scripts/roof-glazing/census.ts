// City-wide census of the contemporary family's set-back crowns (contemporaryFamily.ts), with each pand's 3DBAG
// roof spread (bag-tiles `eaves` = lowest roof, `height` = top) as the evidence column.
//   npx tsx scripts/roof-glazing/census.ts [--json out.json]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { gameDecorator, type Feature } from '../../src/canalRecall/galleryPipeline.ts';
import { meshBuildingFor } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { shortBuildingId } from '../../src/canalRecall/buildingFacts.ts';

const EXTRACT = 'public/data/extracts/amsterdam';
const gz = (file: string) => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString());
const landmarkIds = new Set<string>();
for (const list of Object.values(JSON.parse(fs.readFileSync(`${EXTRACT}/landmark-buildings.json`, 'utf8')).buildings as Record<string, string[]>)) for (const id of list) landmarkIds.add(id);
const gables = JSON.parse(fs.readFileSync(`${EXTRACT}/monument-gables.json`, 'utf8'));
const decorate = gameDecorator({ landmarkIds, listed: new Set<string>(gables.listedLandmarks ?? []) });
const rows: Array<{ id: string; year: number; h: number; eaves: number | null; at: number[]; bbox: number[] }> = [];
let candidates = 0;
for (const x of fs.readdirSync(`${EXTRACT}/building-tiles/14`)) for (const file of fs.readdirSync(`${EXTRACT}/building-tiles/14/${x}`)) {
  const key = `${x}/${file.replace('.geojson.gz', '')}`;
  const facts = (fs.existsSync(`${EXTRACT}/building-facts/14/${key}.json.gz`) ? gz(`${EXTRACT}/building-facts/14/${key}.json.gz`).buildings : {}) as Record<string, number[]>;
  const bag = fs.existsSync(`${EXTRACT}/bag-tiles/14/${key}.geojson.gz`) ? new Map((gz(`${EXTRACT}/bag-tiles/14/${key}.geojson.gz`).features as Feature[]).map(f => [String(f.properties.id), f.properties])) : new Map();
  for (const raw of gz(`${EXTRACT}/building-tiles/14/${key}.geojson.gz`).features as Feature[]) {
    const year = facts[shortBuildingId(String(raw.properties.id))]?.[0];
    if (!year || year < 2005 || Number(raw.properties.height) < 14) continue;
    candidates++;
    const f = decorate({ ...raw, properties: { ...raw.properties, constructionYear: year } });
    const b = meshBuildingFor(f, 'storybook');
    if (!b?.setbackCrown) continue;
    const eaves = bag.get(String(raw.properties.id))?.eaves;
    const ring = (raw.geometry as { coordinates: number[][][] }).coordinates[0];
    rows.push({ id: String(raw.properties.id), year, h: Number(raw.properties.height), eaves: typeof eaves === 'number' ? eaves : null, at: ring?.[0] ?? [], bbox: [Math.min(...ring.map(p => p[0])), Math.min(...ring.map(p => p[1])), Math.max(...ring.map(p => p[0])), Math.max(...ring.map(p => p[1]))] });
  }
}
const spread = rows.map(r => r.eaves === null ? null : r.h - r.eaves);
const bins: Record<string, number> = {};
for (const s of spread) { const k = s === null ? 'none' : s < 1 ? '<1' : s < 2.4 ? '1-2.4' : s <= 4.5 ? '2.4-4.5' : '>4.5'; bins[k] = (bins[k] ?? 0) + 1; }
console.log(`2005+ pands >= 14 m: ${candidates}; set-back crowns drawn: ${rows.length}`);
console.log('height - lowest roof (3DBAG):', JSON.stringify(bins));
const out = process.argv.indexOf('--json');
if (out > 0) fs.writeFileSync(process.argv[out + 1], JSON.stringify(rows, null, 1));
