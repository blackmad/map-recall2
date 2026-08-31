import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractSurfaceColors, materialColors } from './lib/building-colors.ts';

type Geometry = { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
type SourceFeature = { id?: string | number; properties?: Record<string, string | undefined>; geometry?: Geometry | { type: string } };

const inputFile = process.argv[2];
const outputFile = process.argv[3] || 'public/data/extracts/amsterdam/buildings-colored.geojson';
assert.ok(inputFile, 'usage: tsx scripts/build-osm-building-appearance.ts INPUT.geojson [OUTPUT.geojson]');

const numeric = (value?: string): number | undefined => {
  const parsed = Number.parseFloat(value || '');
  return Number.isFinite(parsed) ? parsed : undefined;
};
const canonicalOsmId = (id?: string | number): string => {
  const value = String(id || '');
  const area = /^a(\d+)$/.exec(value);
  if (!area) return value;
  const number = Number(area[1]);
  return number % 2 === 0 ? `w${number / 2}` : `r${(number - 1) / 2}`;
};

const source = JSON.parse(await readFile(inputFile, 'utf8')) as { features: SourceFeature[] };
const features = source.features.flatMap(feature => {
  if (!feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) return [];
  const tags = feature.properties || {};
  const { material, roofMaterial, taggedSideColour, taggedRoofColour, sideColour, roofColour } = extractSurfaceColors(tags);
  if (!sideColour && !roofColour) return [];
  const levels = numeric(tags['building:levels']);
  const height = numeric(tags.height) ?? (levels ? levels * 3 : 9);
  const minHeight = numeric(tags.min_height) ?? 0;
  return [{
    type: 'Feature', id: canonicalOsmId(feature.id),
    properties: {
      osmId: canonicalOsmId(feature.id), name: tags.name || '',
      // `colour` remains as a compatibility alias for the existing renderer
      // and previously generated extracts. New consumers should use the
      // surface-specific fields so roofs can never silently become walls.
      sideColour: sideColour || '#d2c9bc', colour: sideColour || '#d2c9bc',
      roofColour: roofColour || sideColour || '#d2c9bc',
      sideColourSource: taggedSideColour ? 'osm' : materialColors[material] ? 'material' : 'fallback',
      roofColourSource: taggedRoofColour ? 'osm' : materialColors[roofMaterial] ? 'material' : sideColour ? 'side' : 'fallback',
      material, roofMaterial, roofShape: tags['roof:shape'] || '', height, minHeight,
    },
    geometry: feature.geometry,
  }];
});

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, JSON.stringify({ type: 'FeatureCollection', features }));
process.stdout.write(`Wrote ${features.length} color/material-backed buildings to ${outputFile}\n`);
