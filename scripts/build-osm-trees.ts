import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Position = [number, number];
interface InputFeature {
  id?: string | number;
  geometry: { type: string; coordinates: unknown } | null;
  properties?: Record<string, string | number | undefined>;
}

const inputFile = process.argv[2];
const outputFile = process.argv[3];
if (!inputFile || !outputFile) throw new Error('Usage: tsx scripts/build-osm-trees.ts input.geojson output.json');
const source = JSON.parse(await readFile(inputFile, 'utf8')) as { features: InputFeature[] };
const trees: { id: string; lat: number; lng: number; species?: string }[] = [];
const occupied = new Set<string>();
const add = (feature: InputFeature, [lng, lat]: Position, suffix = '') => {
  const properties = feature.properties || {};
  // One visual tree per roughly 8 m cell keeps dense botanical mapping from
  // turning into a multi-megabyte startup cost while remaining deterministic.
  const cell = `${Math.round(lat / 0.000072)},${Math.round(lng / 0.00012)}`;
  if (occupied.has(cell) || trees.length >= 35_000) return;
  occupied.add(cell);
  trees.push({ id: `osm-${feature.id ?? trees.length}${suffix}`, lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), species: String(properties.species || properties['species:en'] || properties.genus || '') || undefined });
};
for (const feature of source.features) {
  if (!feature.geometry) continue;
  if (feature.geometry.type === 'Point') add(feature, feature.geometry.coordinates as Position);
  if (feature.geometry.type === 'LineString') {
    const points = feature.geometry.coordinates as Position[];
    // OSM tree rows are lines rather than individual trunks. Sampling creates
    // a stable, reusable visual approximation without claiming surveyed trees.
    for (let index = 0; index < points.length; index += 2) add(feature, points[index], `-${index}`);
  }
}
await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, JSON.stringify(trees));
process.stdout.write(`Wrote ${trees.length} OSM trees to ${outputFile}\n`);
