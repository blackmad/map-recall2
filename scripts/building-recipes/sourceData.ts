/**
 * `source-data://<path>` references into the map-recall2-source-data checkout named by `$MAP_RECALL_SOURCE_DATA`
 * (archived panorama crops: `source-data://pand-reference-walls/<pand>/<file>`). Resolution fails loudly: no variable,
 * no file, or bytes whose sha256 differs from the one the intent recorded.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const SOURCE_DATA_PREFIX = 'source-data://';
export const sourceDataRoot = () => process.env.MAP_RECALL_SOURCE_DATA ?? null;

export function requireSourceData(): string {
  const root = sourceDataRoot();
  if (!root) throw Error('MAP_RECALL_SOURCE_DATA is not set (the map-recall2-source-data checkout, e.g. /Users/blackmad/Code/map-recall2-source-data)');
  if (!fs.existsSync(root)) throw Error(`MAP_RECALL_SOURCE_DATA=${root} does not exist`);
  return root;
}

export const sha256Of = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');

export const pandWallsDir = (pandId: string) => path.join(requireSourceData(), 'pand-reference-walls', pandId);
export const sourceRef = (pandId: string, file: string) => `${SOURCE_DATA_PREFIX}pand-reference-walls/${pandId}/${file}`;
