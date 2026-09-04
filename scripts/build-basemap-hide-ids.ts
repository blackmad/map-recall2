/**
 * Publish the encoded OpenFreeMap building ids that the static coloured
 * extract replaces. The game loads this small sidecar on the no-tiles
 * fallback so it can filter `building-3d` without walking 10k GeoJSON
 * features on the main thread.
 *
 * Usage:
 *   tsx scripts/build-basemap-hide-ids.ts [buildings-colored.geojson] [out.json]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { collectEncodedBasemapHideIds } from '../src/canalRecall/buildingStyle.ts';

const inputFile = process.argv[2] || 'public/data/extracts/amsterdam/buildings-colored.geojson';
const outputFile = process.argv[3]
  || path.join(path.dirname(inputFile), 'basemap-hide-ids.json');

type AppearanceFeature = { properties?: { osmId?: string } };

const collection = JSON.parse(await readFile(inputFile, 'utf8')) as {
  features?: AppearanceFeature[];
};
const osmIds = (collection.features || [])
  .map((feature) => feature.properties?.osmId)
  .filter((id): id is string => typeof id === 'string' && id.length > 0);
const encodedIds = collectEncodedBasemapHideIds(osmIds);

const payload = {
  city: path.basename(path.dirname(path.resolve(inputFile))),
  source: path.basename(inputFile),
  count: encodedIds.length,
  encodedIds,
};

await writeFile(outputFile, `${JSON.stringify(payload)}\n`);
process.stdout.write(
  `Wrote ${encodedIds.length} basemap hide ids to ${outputFile}\n`,
);
