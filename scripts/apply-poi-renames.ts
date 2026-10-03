/**
 * Apply `src/canalRecall/poiRenames.ts` to the published Amsterdam POI files
 * without a fresh OSM pull. The builders apply the same list on their next
 * run; this keeps the extract right in between. Idempotent.
 *
 *   npx tsx scripts/apply-poi-renames.ts
 */
import fs from 'node:fs';
import { poiRenameFor } from '../src/canalRecall/poiRenames.ts';

const dir = 'public/data/extracts/amsterdam';
let changed = 0;

const brandedFile = `${dir}/branded-pois.json`;
const branded = JSON.parse(fs.readFileSync(brandedFile, 'utf8')) as Array<{ name: string; center: [number, number] }>;
for (const poi of branded) {
  const rename = poiRenameFor(poi.name, poi.center[1], poi.center[0]);
  if (rename) { console.log(`branded-pois: ${poi.name} -> ${rename.to}`); poi.name = rename.to; changed++; }
}
fs.writeFileSync(brandedFile, JSON.stringify(branded));

const orientationFile = `${dir}/orientation-pois.json`;
const orientation = JSON.parse(fs.readFileSync(orientationFile, 'utf8')) as { pois: Array<[string, number, number, ...number[]]> };
for (const poi of orientation.pois) {
  const rename = poiRenameFor(poi[0], poi[1], poi[2]);
  if (rename) { console.log(`orientation-pois: ${poi[0]} -> ${rename.to}`); poi[0] = rename.to; changed++; }
}
fs.writeFileSync(orientationFile, JSON.stringify(orientation));
console.log(`${changed} POI name(s) renamed`);
