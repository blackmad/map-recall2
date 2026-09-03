/**
 * Build a complete OSM building / building:part extract for the LoD1 ladder.
 *
 * Unlike `buildings-colored.geojson`, this keeps every footprint regardless of
 * colour tags. Appearance is joined afterward. Without this file, Magna Plaza
 * and similar uncoloured compositions collapse into plain BAG boxes.
 *
 * Input may be GeoJSON or GeoJSONSeq (one Feature per line). GeoJSONSeq is the
 * practical path for a whole city — a single FeatureCollection string does not
 * fit in memory.
 *
 * Usage:
 *   tsx scripts/build-osm-buildings.ts INPUT.geojson[seq] [OUTPUT.geojson]
 */

import assert from 'node:assert/strict';
import { createReadStream, createWriteStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { mkdir, stat } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';

type Geometry = { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
type SourceFeature = {
  id?: string | number;
  properties?: Record<string, string | undefined>;
  geometry?: Geometry | { type: string };
};

const inputFile = process.argv[2];
const outputFile = process.argv[3] || 'public/data/extracts/amsterdam/buildings-osm.geojson';
assert.ok(inputFile, 'usage: tsx scripts/build-osm-buildings.ts INPUT.geojson[seq] [OUTPUT.geojson]');
assert.ok(await stat(inputFile).catch(() => null), `missing input: ${inputFile}`);

const numeric = (value?: string): number | undefined => {
  const parsed = Number.parseFloat(value || '');
  return Number.isFinite(parsed) ? parsed : undefined;
};

const canonicalOsmId = (id?: string | number): string => {
  const value = String(id || '');
  const area = /^a(\d+)$/.exec(value);
  if (!area) return value.startsWith('w') || value.startsWith('r') || value.startsWith('n')
    ? value
    : value;
  const number = Number(area[1]);
  return number % 2 === 0 ? `w${number / 2}` : `r${(number - 1) / 2}`;
};

const isBuilding = (tags: Record<string, string | undefined>): boolean =>
  Boolean(tags.building || tags['building:part']);

function toOutputFeature(feature: SourceFeature): object | null {
  if (!feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) return null;
  const tags = feature.properties || {};
  if (!isBuilding(tags)) return null;
  const levels = numeric(tags['building:levels']);
  const height = numeric(tags.height) ?? (levels ? levels * 3 : 9);
  const minHeight = numeric(tags.min_height) ?? numeric(tags['building:min_level']) ?? 0;
  const isPart = tags['building:part'] != null && tags['building:part'] !== '' && tags['building:part'] !== 'no';
  return {
    type: 'Feature',
    id: canonicalOsmId(feature.id),
    properties: {
      osmId: canonicalOsmId(feature.id),
      name: tags.name || '',
      isPart,
      height,
      minHeight,
      roofShape: tags['roof:shape'] || '',
      roofHeight: numeric(tags['roof:height']) ?? 0,
      building: tags.building || '',
      buildingPart: tags['building:part'] || '',
    },
    geometry: feature.geometry,
  };
}

await mkdir(path.dirname(outputFile), { recursive: true });
const output = createWriteStream(outputFile);
await once(output, 'open');
output.write('{"type":"FeatureCollection","features":[\n');

let written = 0;
let parts = 0;
let buffer = '';
let inFeaturesArray = false;
let featureDepth = 0;
let featureStart = -1;

const writeFeature = async (raw: string): Promise<void> => {
  let feature: SourceFeature;
  try {
    feature = JSON.parse(raw) as SourceFeature;
  } catch {
    return;
  }
  const out = toOutputFeature(feature);
  if (!out) return;
  const chunk = `${written === 0 ? '' : ',\n'}${JSON.stringify(out)}`;
  written += 1;
  if ((out as { properties: { isPart?: boolean } }).properties.isPart) parts += 1;
  if (!output.write(chunk)) await once(output, 'drain');
};

const reader = createInterface({ input: createReadStream(inputFile, { encoding: 'utf8' }), crlfDelay: Infinity });
for await (const line of reader) {
  const trimmed = line.replace(/^\u001e/, '').trim();
  if (!trimmed) continue;

  // GeoJSONSeq: one Feature object per line (optionally RS-prefixed).
  if (trimmed.startsWith('{"type":"Feature"') || trimmed.startsWith('{ "type": "Feature"')) {
    await writeFeature(trimmed.replace(/,$/, ''));
    continue;
  }

  // Streaming scan of a FeatureCollection without holding the whole file.
  buffer += line;
  if (!inFeaturesArray) {
    const idx = buffer.indexOf('"features"');
    if (idx < 0) {
      if (buffer.length > 200) buffer = buffer.slice(-50);
      continue;
    }
    const bracket = buffer.indexOf('[', idx);
    if (bracket < 0) continue;
    inFeaturesArray = true;
    buffer = buffer.slice(bracket + 1);
  }

  for (let i = 0; i < buffer.length; i++) {
    const ch = buffer[i];
    if (featureStart < 0) {
      if (ch === '{') {
        featureStart = i;
        featureDepth = 1;
      }
      continue;
    }
    if (ch === '{') featureDepth += 1;
    else if (ch === '}') {
      featureDepth -= 1;
      if (featureDepth === 0) {
        const raw = buffer.slice(featureStart, i + 1);
        await writeFeature(raw);
        featureStart = -1;
      }
    }
  }
  if (featureStart >= 0) {
    buffer = buffer.slice(featureStart);
    featureStart = 0;
  } else {
    buffer = '';
  }
}

output.write('\n]}\n');
output.end();
await once(output, 'finish');
process.stdout.write(`Wrote ${written} OSM buildings (${parts} parts) to ${outputFile}\n`);
