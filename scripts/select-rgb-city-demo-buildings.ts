/** Select a spatially spread, reproducible set of 3DBAG buildings for the RGB DSM demo. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const input = path.resolve(arg('input') || '.cache/3dbag-appearance/amsterdam-buildings.staging.geojson');
const output = path.resolve(arg('output') || '.cache/rgb-city-demo/building-ids.json');
const columns = Number(arg('columns') || 5);
const rows = Number(arg('rows') || 4);

type Feature = {
  properties: { bagId?: string; height?: number };
  geometry: { coordinates: number[][][] };
};
const collection = JSON.parse(await readFile(input, 'utf8')) as { features: Feature[] };
const candidates = collection.features.flatMap((feature) => {
  const ring = feature.geometry?.coordinates?.[0];
  const id = feature.properties?.bagId;
  if (!id || !ring?.length || !feature.properties.height || feature.properties.height < 4) return [];
  const center = ring.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]);
  return [{ id: `bag:${id.replace(/^NL\.IMBAG\.Pand\./, '')}`, lon: center[0] / ring.length, lat: center[1] / ring.length }];
});
if (!candidates.length) throw new Error('No usable 3DBAG buildings in input.');
const bounds = candidates.reduce((value, item) => ({
  minLon: Math.min(value.minLon, item.lon), minLat: Math.min(value.minLat, item.lat),
  maxLon: Math.max(value.maxLon, item.lon), maxLat: Math.max(value.maxLat, item.lat),
}), { minLon: Infinity, minLat: Infinity, maxLon: -Infinity, maxLat: -Infinity });
const selected: string[] = [];
for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
  const lon = bounds.minLon + (column + 0.5) / columns * (bounds.maxLon - bounds.minLon);
  const lat = bounds.minLat + (row + 0.5) / rows * (bounds.maxLat - bounds.minLat);
  const nearest = candidates.filter((item) => !selected.includes(item.id))
    .sort((a, b) => ((a.lon - lon) ** 2 + (a.lat - lat) ** 2) - ((b.lon - lon) ** 2 + (b.lat - lat) ** 2))[0];
  if (nearest) selected.push(nearest.id);
}
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(selected, null, 2)}\n`);
process.stdout.write(`Selected ${selected.length} spatially spread buildings from ${candidates.length}; wrote ${output}.\n`);
