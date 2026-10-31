/**
 * Compile a city's `streets-routing.json` into the binary road extract
 * (`src/canalRecall/routing/roadExtract.ts`) and stage it for review.
 *
 *   npx tsx scripts/roads/build-road-extract.ts [--city amsterdam] [--source <json>] [--out <dir>]
 *
 * Writes `<out>/<city>/streets-routing.bin` (bare, for inspection),
 * `streets-routing.bin.gz` (what ships: hosting does not compress
 * octet-stream) and `report.json` under `artifacts/roads/staging/` by
 * default. Publishing the .gz into `public/data/extracts/<city>/roads-v2/`
 * is a separate, reviewed step.
 *
 * The compile refuses to write anything that does not decode back to the
 * source byte for byte (`JSON.stringify(decoded) === source text`), so a
 * staged file is always a lossless copy of the JSON it names by SHA-256.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';
import { decodeRoadExtract, encodeRoadExtract, loadRoadExtract, type RoadExtractFeature } from '../../src/canalRecall/routing/roadExtract.ts';

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const city = arg('city', 'amsterdam');
const source = resolve(arg('source', `public/data/extracts/${city}/streets-routing.json`));
const outDir = resolve(arg('out', 'artifacts/roads/staging'), city);
const outFile = join(outDir, 'streets-routing.bin');
const outGz = `${outFile}.gz`;

const sourceText = readFileSync(source, 'utf8');
const sourceBytes = Buffer.from(sourceText, 'utf8');
const sha256 = createHash('sha256').update(sourceBytes).digest('hex');
const features = JSON.parse(sourceText) as RoadExtractFeature[];

const encodeStart = performance.now();
const binary = encodeRoadExtract(features, sha256);
const encodeMs = performance.now() - encodeStart;

const decodeStart = performance.now();
const decoded = decodeRoadExtract(binary);
const decodeMs = performance.now() - decodeStart;
if (decoded.header.sourceSha256 !== sha256) throw new Error('decoded SHA-256 does not match the source');
if (JSON.stringify(decoded.features) !== sourceText) {
  const at = decoded.features.findIndex((feature, i) => JSON.stringify(feature) !== JSON.stringify(features[i]));
  throw new Error(`round trip differs from the source (first feature ${at}: ${features[at]?.id})`);
}

// The published file: gzip-wrapped, because hosting does not compress
// octet-stream. Check it decodes through the browser's path too.
const gz = gzipSync(binary, { level: 9 });
if (JSON.stringify((await loadRoadExtract(gz)).features) !== sourceText) throw new Error('gzip-wrapped extract does not round-trip');

const sizes = (bytes: Uint8Array) => ({
  raw: bytes.length,
  gzip: gzipSync(bytes, { level: 9 }).length,
  brotli: brotliCompressSync(bytes, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 } }).length,
});
const report = {
  city,
  source: source.replace(`${process.cwd()}/`, ''),
  sourceSha256: sha256,
  output: outFile.replace(`${process.cwd()}/`, ''),
  publish: outGz.replace(`${process.cwd()}/`, ''),
  header: decoded.header,
  bytes: { json: sizes(sourceBytes), binary: sizes(binary) },
  encodeMs: Math.round(encodeMs),
  nodeDecodeMs: Math.round(decodeMs),
  roundTrip: 'JSON.stringify(decoded) === source',
};

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, binary);
writeFileSync(outGz, gz);
writeFileSync(join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
