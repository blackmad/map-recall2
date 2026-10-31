/**
 * Re-encode compiled world-v1 cells in another cell format version, without recompiling (P2 bytes gate):
 *   node --import tsx scripts/world/transcode.ts [--from=public/data/extracts/amsterdam/world-v1]
 *     [--out=artifacts/world/staging] [--format=3]
 * Every cell is decoded, encoded at --format, decoded again and compared whole with the source cell
 * (buildings, geometry, bags in key order, groups, party walls, hidden ids); a difference throws before
 * anything is written. index.json and tiles.json are copied with the new format and per-cell bytes, gzip
 * size, sha256 and streams; the compile inputs (hashes, tile lists) are kept, so `world:verify` judges the
 * transcoded cells exactly as it judged the source. Output goes to staging; publishing is the integrator's.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { decodeCell, encodeCell, sameValue, WORLD_FORMAT_VERSION } from '../../src/canalRecall/world/cellFormat.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const value = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const FROM = path.resolve(value('from') ?? path.join(ROOT, 'public/data/extracts/amsterdam/world-v1'));
const OUT = path.resolve(value('out') ?? path.join(ROOT, 'artifacts/world/staging'));
const FORMAT = Number(value('format') ?? WORLD_FORMAT_VERSION);
if (FROM === OUT) throw Error('--out must differ from --from');

const gz = (b: Uint8Array) => zlib.gzipSync(b, { level: 6 }); // as the compiler: mtime 0, reproducible
const sha = (b: Uint8Array) => crypto.createHash('sha256').update(b).digest('hex');
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

const t0 = performance.now();
const index = readJson(path.join(FROM, 'index.json'));
const keys = Object.keys(index.cells).sort();
const staged = new Map<string, Buffer>(), entries: Record<string, any> = {};
const totals: Record<string, { raw: number; gz: number }> = {};
let before = 0, after = 0, rawBefore = 0, rawAfter = 0, buildings = 0, decodeMs = 0;
for (const key of keys) {
  const zipped = fs.readFileSync(path.join(FROM, 'cells', `${key}.bin`)), raw = zlib.gunzipSync(zipped);
  const cell = decodeCell(raw, key);
  const encoded = encodeCell(cell, FORMAT);
  const t = performance.now(); const back = decodeCell(encoded.bytes, `${key} (format ${FORMAT})`); decodeMs += performance.now() - t;
  if (back.buildings.length !== cell.buildings.length) throw Error(`${key}: ${back.buildings.length} buildings after transcoding, ${cell.buildings.length} before`);
  back.buildings.forEach((b, k) => { if (!sameValue(b, cell.buildings[k])) throw Error(`${key}: ${b.id} decodes differently after transcoding`); });
  if (!sameValue(back, cell)) throw Error(`${key}: the cell decodes differently after transcoding`);
  const out = gz(encoded.bytes);
  staged.set(key, out);
  const streams: Record<string, { offset: number; bytes: number; gz: number }> = {};
  for (const s of encoded.streams) {
    const g = gz(encoded.bytes.subarray(s.offset, s.offset + s.bytes)).length;
    streams[s.tag.trim()] = { offset: s.offset, bytes: s.bytes, gz: g };
    const tt = totals[s.tag.trim()] ??= { raw: 0, gz: 0 }; tt.raw += s.bytes; tt.gz += g;
  }
  entries[key] = { ...index.cells[key], bytes: encoded.bytes.length, gzBytes: out.length, sha256: sha(out), streams };
  before += zipped.length; after += out.length; rawBefore += raw.length; rawAfter += encoded.bytes.length; buildings += cell.buildings.length;
}
fs.mkdirSync(path.join(OUT, 'cells'), { recursive: true });
for (const [key, bytes] of staged) fs.writeFileSync(path.join(OUT, 'cells', `${key}.bin`), bytes);
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ ...index, format: FORMAT, cells: entries }));
const tiles = readJson(path.join(FROM, 'tiles.json'));
fs.writeFileSync(path.join(OUT, 'tiles.json'), JSON.stringify({ ...tiles, format: FORMAT, cells: Object.fromEntries(Object.entries<any>(tiles.cells).map(([k, c]) => [k, { ...c, gzBytes: entries[k]?.gzBytes ?? c.gzBytes }])) }));
const report = { from: path.relative(ROOT, FROM), out: path.relative(ROOT, OUT), fromFormat: index.format, format: FORMAT, cells: keys.length, buildings, identical: true,
  bytes: { gzBefore: before, gzAfter: after, rawBefore, rawAfter, perStream: totals }, decodeMs: Math.round(decodeMs), ms: Math.round(performance.now() - t0) };
fs.writeFileSync(path.join(OUT, 'transcode-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
