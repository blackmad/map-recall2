/**
 * Re-encode compiled world-v1 cells in another cell format version, without recompiling (P2 bytes gate):
 *   node --import tsx scripts/world/transcode.ts [--from=public/data/extracts/amsterdam/world-v1]
 *     [--out=artifacts/world/staging] [--format=4] [--policy [--collinear]] [--no-globals]
 * Every cell is decoded, (with --policy) put through the compile policy (src/canalRecall/world/cellPolicy.ts:
 * heights to the centimetre, near-collinear vertices within 5 cm removed), encoded at --format, decoded again
 * and compared whole with the source cell (or the policy's output); a difference throws before anything is
 * written. Format 4 also writes the shared string table (strings.bin, strings used by two or more cells) unless
 * --no-globals. index.json and tiles.json are copied with the new format, per-cell bytes, gzip size, sha256 and
 * streams; the compile inputs (hashes, tile lists) are kept, so `world:verify` judges the result as it judged
 * the source (applying the policy to the default path when index.policy says the cells carry it).
 * Output goes to staging; publishing is the integrator's.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { decodeCell, encodeCell, sameValue, chooseGlobalStrings, encodeGlobalStrings, GLOBAL_STRINGS_FILE, WORLD_FORMAT_VERSION, type Cell, type GlobalStrings } from '../../src/canalRecall/world/cellFormat.js';
import { applyPolicy, emptyPolicyReport, summarisePolicy, POLICY_VERSION, type PolicyOptions } from '../../src/canalRecall/world/cellPolicy.js';
import { readCell, readGlobalStrings } from './cellFiles.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const value = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const FROM = path.resolve(value('from') ?? path.join(ROOT, 'public/data/extracts/amsterdam/world-v1'));
const OUT = path.resolve(value('out') ?? path.join(ROOT, 'artifacts/world/staging'));
const FORMAT = Number(value('format') ?? WORLD_FORMAT_VERSION);
const POLICY = args.includes('--policy');
const POLICY_OPTIONS: PolicyOptions = { collinear: args.includes('--collinear') };
const GLOBALS = FORMAT >= 4 && !args.includes('--no-globals');
if (FROM === OUT) throw Error('--out must differ from --from');

const gz = (b: Uint8Array) => zlib.gzipSync(b, { level: 6 }); // as the compiler: mtime 0, reproducible
const sha = (b: Uint8Array) => crypto.createHash('sha256').update(b).digest('hex');
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));

const t0 = performance.now();
const index = readJson(path.join(FROM, 'index.json'));
if (POLICY && index.policy) throw Error(`${FROM} already carries ${index.policy}; the policy is applied once`);
const keys = Object.keys(index.cells).sort();
const sourceGlobals = readGlobalStrings(FROM);
const policyReport = emptyPolicyReport();
const cells = new Map<string, Cell>();
for (const key of keys) { const c = readCell(FROM, key, sourceGlobals); cells.set(key, POLICY ? applyPolicy(c, policyReport, POLICY_OPTIONS) : c); }

/** The strings each cell would carry on its own: the shared table is the ones two or more cells repeat. */
let globals: GlobalStrings | undefined, globalsBytes: Uint8Array | undefined;
if (GLOBALS) {
  const lists = [...cells.values()].map(c => encodeCell(c, FORMAT).strings);
  ({ bytes: globalsBytes, table: globals } = encodeGlobalStrings(chooseGlobalStrings(lists, 2)));
}

const staged = new Map<string, Buffer>(), entries: Record<string, any> = {};
const totals: Record<string, { raw: number; gz: number }> = {};
let before = 0, after = 0, rawBefore = 0, rawAfter = 0, buildings = 0, decodeMs = 0;
for (const key of keys) {
  const zipped = fs.readFileSync(path.join(FROM, 'cells', `${key}.bin`)), cell = cells.get(key)!;
  const encoded = encodeCell(cell, FORMAT, globals);
  const t = performance.now(); const back = decodeCell(encoded.bytes, `${key} (format ${FORMAT})`, globals); decodeMs += performance.now() - t;
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
  before += zipped.length; after += out.length; rawBefore += zlib.gunzipSync(zipped).length; rawAfter += encoded.bytes.length; buildings += cell.buildings.length;
}
fs.mkdirSync(path.join(OUT, 'cells'), { recursive: true });
for (const [key, bytes] of staged) fs.writeFileSync(path.join(OUT, 'cells', `${key}.bin`), bytes);
const stringsGz = globalsBytes ? gz(globalsBytes) : null;
if (stringsGz) fs.writeFileSync(path.join(OUT, GLOBAL_STRINGS_FILE), stringsGz); else fs.rmSync(path.join(OUT, GLOBAL_STRINGS_FILE), { force: true });
const strings = globals && stringsGz ? { file: GLOBAL_STRINGS_FILE, count: globals.list.length, hash: globals.hash, gzBytes: stringsGz.length, sha256: sha(stringsGz) } : undefined;
const policy = POLICY ? POLICY_VERSION : index.policy, policyOptions = POLICY ? POLICY_OPTIONS : index.policyOptions;
const { strings: _s, ...indexRest } = index; void _s;
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ ...indexRest, format: FORMAT, ...(policy ? { policy, policyOptions } : {}), ...(strings ? { strings } : {}), cells: entries }));
const tiles = readJson(path.join(FROM, 'tiles.json'));
const { strings: _t, ...tilesRest } = tiles; void _t;
fs.writeFileSync(path.join(OUT, 'tiles.json'), JSON.stringify({ ...tilesRest, format: FORMAT, ...(policy ? { policy, policyOptions } : {}), ...(strings ? { strings } : {}), cells: Object.fromEntries(Object.entries<any>(tiles.cells).map(([k, c]) => [k, { ...c, gzBytes: entries[k]?.gzBytes ?? c.gzBytes }])) }));
const report = { from: path.relative(ROOT, FROM), out: path.relative(ROOT, OUT), fromFormat: index.format, format: FORMAT, policy: POLICY ? summarisePolicy(policyReport) : index.policy ?? null, cells: keys.length, buildings, identical: true,
  bytes: { gzBefore: before, gzAfter: after, stringsGz: stringsGz?.length ?? 0, totalAfter: after + (stringsGz?.length ?? 0), rawBefore, rawAfter, perStream: totals }, strings: strings ?? null, decodeMs: Math.round(decodeMs), ms: Math.round(performance.now() - t0) };
fs.writeFileSync(path.join(OUT, 'transcode-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
