/** Node helpers for compiled world-v1 directories: the shared string table (format v4) and cell reads. */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { decodeCell, decodeGlobalStrings, GLOBAL_STRINGS_FILE, type Cell, type GlobalStrings } from '../../src/canalRecall/world/cellFormat.js';

/** dir/strings.bin decoded, or undefined when the directory has none (formats 2-3, or v4 without one). */
export function readGlobalStrings(dir: string): GlobalStrings | undefined {
  const file = path.join(dir, GLOBAL_STRINGS_FILE);
  return fs.existsSync(file) ? decodeGlobalStrings(zlib.gunzipSync(fs.readFileSync(file)), file) : undefined;
}
/** One cell of a compiled directory, decoded against that directory's shared table. */
export function readCell(dir: string, key: string, globals = readGlobalStrings(dir)): Cell {
  return decodeCell(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'cells', `${key}.bin`))), key, globals);
}
