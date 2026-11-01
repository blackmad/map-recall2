import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { decodeRoadExtract, encodeRoadExtract, HEADER_BYTES, loadRoadExtract, readRoadExtractHeader, type RoadExtractFeature } from './roadExtract.ts';

const SHA = 'ab'.repeat(32);

// Every field and flag the format carries, an off-grid (exact) feature, an id
// that needs the string table, and non-ASCII names.
const sample: RoadExtractFeature[] = [
  { id: 'routing_0', name: '', type: 'street', cityId: 'amsterdam', center: [52.365417, 4.922343], highway: 'cycleway', path: [[52.365437, 4.922318], [52.365417, 4.922343]] },
  { id: 'routing_31', name: 'Hein de Haanbrug', type: 'street', cityId: 'amsterdam', center: [52.360725, 4.975055], highway: 'residential',
    path: [[52.360275, 4.97397], [52.3603, 4.974]], paths: [[[52.360275, 4.97397], [52.3603, 4.974]], [[52.3601, 4.9751], [52.36, 4.976], [52.359, 4.977]]], bridge: true },
  { id: 'routing_28060', name: '', type: 'street', cityId: 'amsterdam', center: [52.395421, 4.898766], highway: 'service', path: [[52.395497, 4.89861], [52.3954, 4.8987]], railway: 'razed' },
  { id: 'routing_restricted_1623480878', name: 'Claes Dellsteeg', type: 'street', cityId: 'amsterdam', center: [52.30618656666667, 5.045326866666667], highway: 'pedestrian',
    path: [[52.305938, 5.0449485], [52.3061, 5.0453]], bicycleRestricted: true, bicycle: 'no' },
  { id: 'custom-way', name: 'Meester J.C.Bührmannlaan', type: 'avenue', cityId: 'amsterdam', center: [52.300177, 5.052708], highway: 'pedestrian', path: [[52.300128, 5.052752], [52.3002, 5.0527]], oneway: true },
];

test('round trip reproduces the JSON text exactly', () => {
  const binary = encodeRoadExtract(sample, SHA);
  const { header, features } = decodeRoadExtract(binary);
  assert.equal(JSON.stringify(features), JSON.stringify(sample));
  assert.equal(header.sourceSha256, SHA);
  assert.equal(header.featureCount, 5);
  assert.equal(header.pathCount, 6);
  assert.equal(header.pointCount, 13);
  assert.equal(header.exactCount, 6, 'the off-grid feature stores two points and its centre as Float64');
  // Bit-equal coordinates, not merely close ones.
  assert.ok(Object.is(features[3].center[0], 52.30618656666667));
  // An ArrayBuffer decodes the same as a Uint8Array, and so does an unaligned view.
  assert.equal(JSON.stringify(decodeRoadExtract(binary.slice().buffer).features), JSON.stringify(sample));
  const shifted = new Uint8Array(binary.length + 3);
  shifted.set(binary, 3);
  assert.equal(JSON.stringify(decodeRoadExtract(shifted.subarray(3)).features), JSON.stringify(sample));
});

test('the loader reads the gzip-wrapped file and the bare one alike', async () => {
  const binary = encodeRoadExtract(sample, SHA);
  for (const data of [gzipSync(binary), binary, binary.slice().buffer]) {
    assert.equal(JSON.stringify((await loadRoadExtract(data)).features), JSON.stringify(sample));
  }
  await assert.rejects(loadRoadExtract(gzipSync(binary).subarray(0, 100)));
});

test('the reader refuses damaged files', () => {
  const binary = encodeRoadExtract(sample, SHA);
  const mutate = (change: (bytes: Uint8Array) => Uint8Array) => () => decodeRoadExtract(change(binary.slice()));
  assert.throws(mutate(b => { b[0] = 0; return b; }), /bad magic/);
  assert.throws(mutate(b => { b[4] = 9; return b; }), /version 9/);
  assert.throws(mutate(b => b.subarray(0, b.length - 1)), /buffer has/);
  assert.throws(mutate(b => { const longer = new Uint8Array(b.length + 8); longer.set(b); return longer; }), /buffer has/);
  assert.throws(() => readRoadExtractHeader(binary.subarray(0, HEADER_BYTES - 1)), /shorter than the header/);
  // A feature count one higher runs out of feature bytes; one lower leaves some over.
  const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
  assert.throws(mutate(b => { view(b).setUint32(12, 6, true); return b; }), /truncated varint|exhausted/);
  assert.throws(mutate(b => { view(b).setUint32(12, 4, true); return b; }), /leftover/);
});

test('the compile refuses what it cannot carry exactly', () => {
  const base = sample[0];
  assert.throws(() => encodeRoadExtract([{ ...base, surface: 'asphalt' } as RoadExtractFeature], SHA), /unsupported key surface/);
  assert.throws(() => encodeRoadExtract([{ ...base, bridge: 'yes' } as unknown as RoadExtractFeature], SHA), /bridge must be true/);
  assert.throws(() => encodeRoadExtract([{ ...base, paths: [[[52, 4], [52.1, 4.1]]] }], SHA), /path is not paths\[0\]/);
  assert.throws(() => encodeRoadExtract([{ ...base, path: [[52, 4, 1]] as unknown as [number, number][] }], SHA), /malformed point/);
  assert.throws(() => encodeRoadExtract([base], 'nope'), /SHA-256/);
});

// The shipped Amsterdam extract: the whole file round-trips to its own text,
// and named ways keep their ids, names, classes, flags and coordinates.
test('Amsterdam streets-routing.json round-trips with sentinel ways pinned by id', () => {
  const text = readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8');
  const sha = createHash('sha256').update(text).digest('hex');
  const binary = encodeRoadExtract(JSON.parse(text), sha);
  const { header, features } = decodeRoadExtract(binary);
  assert.equal(header.sourceSha256, sha);
  assert.ok(JSON.stringify(features) === text, 'decoded features stringify to the source text');
  assert.ok(binary.length < text.length / 5, `binary ${binary.length} bytes vs JSON ${text.length}`);

  const byId = new Map(features.map(feature => [feature.id, feature]));
  const pin = (id: string, expected: Partial<RoadExtractFeature> & { pathLengths: number[] }) => {
    const feature = byId.get(id);
    assert.ok(feature, `${id} is in the extract`);
    const { pathLengths, ...fields } = expected;
    for (const [key, value] of Object.entries(fields)) assert.deepEqual(feature[key as keyof RoadExtractFeature], value, `${id} ${key}`);
    assert.deepEqual((feature.paths ?? [feature.path]).map(path => path.length), pathLengths, `${id} path lengths`);
  };
  // A bike-restricted corridor with averaged, off-grid centre (Float64 path).
  pin('routing_restricted_754403713', { name: 'Kalverstraat', highway: 'pedestrian', bicycleRestricted: true, bicycle: 'no',
    center: [52.36975630625, 4.8916564000000005], pathLengths: [9, 13, 10] });
  pin('routing_restricted_1623480878', { name: 'Claes Dellsteeg', bicycle: 'no', center: [52.30618656666667, 5.045326866666667], pathLengths: [3] });
  // A multi-path bridge (grid deltas).
  pin('routing_31', { name: 'Hein de Haanbrug', highway: 'residential', bridge: true, center: [52.360725, 4.975055], pathLengths: [2, 5, 5] });
  assert.deepEqual(byId.get('routing_31')!.path[0], [52.360275, 4.97397]);
  // Railway-tagged service way, an eleven-path name, and a non-ASCII name.
  pin('routing_28060', { name: '', highway: 'service', railway: 'razed', pathLengths: [3] });
  pin('routing_4387', { name: 'Damrak', highway: 'cycleway', type: 'street', pathLengths: [6, 14, 4, 9, 10, 6, 17, 5, 3, 10, 3] });
  pin('routing_125', { name: 'Meester J.C.Bührmannlaan', highway: 'pedestrian', center: [52.300177, 5.052708], pathLengths: [3, 3, 5, 12, 2, 3, 3, 3, 3, 5, 2, 3, 2] });
});

// The binary is the game's default road source, so the published file must be
// compiled from the JSON that ships beside it: an edit to streets-routing.json
// without re-running scripts/roads/build-road-extract.ts fails here, not on
// the road in the browser.
test('the published Amsterdam binary is compiled from the shipped JSON', async () => {
  const text = readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8');
  const sha = createHash('sha256').update(text).digest('hex');
  const { header, features } = await loadRoadExtract(readFileSync('public/data/extracts/amsterdam/roads-v2/streets-routing.bin.gz'));
  assert.equal(header.sourceSha256, sha, 'roads-v2/streets-routing.bin.gz is stale: re-run scripts/roads/build-road-extract.ts and publish');
  assert.ok(JSON.stringify(features) === text, 'the published binary decodes to the shipped JSON text');
});
