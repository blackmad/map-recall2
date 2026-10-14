/**
 * The AHN terrain extract (`ground-height-v1`) as a Node-side `TerrainAt`:
 * metres NAP at an RD New point, NaN outside the extract. Water is blanked and
 * pull-push filled from the shores in the extract, so a point in a canal reads
 * the quay level beside it.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { GroundField, readGroundTile, type GroundIndex } from '../../src/canalRecall/ownGround/heightField.ts';
import type { TerrainAt } from '../../src/canalRecall/bag3dCityJson.ts';

export function loadTerrain(dir = path.join('public', 'data', 'extracts', 'amsterdam', 'ground-height-v1')): TerrainAt | null {
  const indexFile = path.join(dir, 'index.json');
  if (!existsSync(indexFile)) return null;
  const index = JSON.parse(readFileSync(indexFile, 'utf8')) as GroundIndex;
  const field = new GroundField(index.stepM, index.tileSizeM);
  for (const entry of index.tiles) {
    const file = path.join(dir, 'tiles', `${entry[0]}_${entry[1]}.bin`);
    if (!existsSync(file)) continue;
    let bytes = readFileSync(file);
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes);
    field.addTile(entry[0], entry[1], readGroundTile(index, entry, new Uint8Array(bytes)));
  }
  return (x, y) => field.heightRd(x, y);
}
