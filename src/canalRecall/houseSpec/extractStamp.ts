/**
 * The HouseSpec stamp a world-v1 compile records in its index.json (house line H1): whether specs were baked
 * (`houseSpecs: 'on' | 'off'`) and, when on, a content hash of the extract directory it read, so a frame or a
 * published world can say which specs it carries. Pure: the compiler passes the directory's files in.
 */
import crypto from 'node:crypto';

export interface HouseSpecsStamp {
  houseSpecs: 'on' | 'off';
  /** Only when on: the extract directory under public/data/extracts/amsterdam, its tile count and content hash. */
  houseSpecsExtract?: { dir: string; tiles: number; hash: string };
}

const sha = (b: Uint8Array | string) => crypto.createHash('sha256').update(b).digest('hex');

/**
 * `files` are [path relative to the extract dir, bytes]. The hash is sha256 over the sorted `path:sha256(bytes)`
 * lines, so it depends only on the files' names and contents, never on listing order or mtimes. An enabled compile
 * whose directory is missing or empty records hash `absent` and 0 tiles.
 */
export function houseSpecsStamp(enabled: boolean, dir: string, files: ReadonlyArray<readonly [string, Uint8Array]>): HouseSpecsStamp {
  if (!enabled) return { houseSpecs: 'off' };
  const lines = files.map(([p, b]) => `${p.split('\\').join('/')}:${sha(b)}`).sort();
  const tiles = files.filter(([p]) => /\.json\.gz$/.test(p)).length;
  return { houseSpecs: 'on', houseSpecsExtract: { dir, tiles, hash: lines.length ? sha(lines.join('\n')) : 'absent' } };
}
