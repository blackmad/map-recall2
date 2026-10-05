import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { Cache, CEO, MUNICIPAL_URL, RCE_URL, INVENTORY_QUERY, batches, collect, hash, nodeQuery, numberQuery, normalizeMunicipal, normalizeRce, rebuild, type Term, type Triple } from './archive.ts';

const uri = (value: string): Term => ({ type: 'uri', value });
const literal = (value: string, language?: string): Term => ({ type: 'literal', value, ...(language ? { 'xml:lang': language } : {}) });
const triple = (s: string, p: string, o: Term): Triple => ({ s: uri(s), p: uri(p), o });
const sparql = (bindings: unknown[]) => ({ head: { vars: ['s', 'p', 'o'] }, results: { bindings } });
const municipal = (records: unknown[], next?: string) => ({ _embedded: { monumenten: records }, _links: next ? { next: { href: next } } : {} });
const response = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
const forbiddenFetch: typeof fetch = async () => { throw Error('Network must never be invoked'); };
async function temp(t: TestContext) {
  const directory = await mkdtemp(path.join(tmpdir(), 'monument-archive-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

// Each fixture is source data: no nearby-building or game identity hints are supplied.
const root = 'https://linkeddata.cultureelerfgoed.nl/cho/5087';
const alias = root + '-duplicate';
const basis = 'https://linkeddata.cultureelerfgoed.nl/basis/5087';
const bag = 'https://linkeddata.cultureelerfgoed.nl/bag/5087';
const status = 'https://data.cultureelerfgoed.nl/term/status/protected';
const pand = '0363100012345678', vbo = '0363010012345678';
const inventory = [{ m: uri(root), nr: literal('5087') }, { m: uri(alias), nr: literal('5087') }];
const graph = [
  triple(root, CEO + 'rijksmonumentnummer', literal('5087')),
  triple(root, CEO + 'omschrijving', literal('Gevel met triglyfen, consoles en een schilddakje.\nVolledige tweede alinea.', 'nl')),
  triple(root, CEO + 'omschrijving', literal('A distinct English description.', 'en')),
  triple(alias, CEO + 'rijksmonumentnummer', literal('5087')),
  triple(alias, CEO + 'omschrijving', literal('Een afzonderlijke bronbeschrijving.', 'nl')),
  triple(root, CEO + 'heeftBasisregistratieRelatie', uri(basis)),
  triple(root, CEO + 'heeftJuridischeStatus', uri(status)),
  triple(status, 'http://www.w3.org/2004/02/skos/core#prefLabel', literal('Beschermd', 'nl')),
  triple(basis, CEO + 'heeftBAGRelatie', uri(bag)),
  triple(bag, CEO + 'pandIdentificatie', literal(pand)),
  triple(bag, CEO + 'verblijfsobjectIdentificatie', literal(vbo)),
  triple(bag, CEO + 'pandIdentificatie', literal('invalid')),
  triple(root, 'https://example.test/unknownLink', uri('https://example.test/nearby-building/' + pand)),
  triple(root, 'http://www.opengis.net/ont/geosparql#asWKT', literal('POINT(4.9 52.37)')),
];
const municipalRecord = {
  identificatie: 'municipal-1', monumentnummer: 5087, status: 'Afgevoerd', datumAfvoeren: '2001-01-01',
  redengevendeOmschrijvingPubliek: '  Volledige omschrijving.\nTweede alinea met élk detail.  ',
  beschrijvingPubliek: '<p>Andere oorspronkelijke tekst.</p>',
  _links: { self: { href: 'https://example.test/monument/1' }, betreftBagPand: [{ identificatie: pand }, { identificatie: pand }, { identificatie: 'invalid' }] },
};

test('raw cache survives reopen, verifies checksum, and refuses corrupted bytes', async t => {
  const directory = await temp(t);
  let calls = 0;
  const cache = new Cache(directory, false, async () => { calls++; return response(municipal([])); }, 1000, 1);
  await cache.open();
  const saved = await cache.request(MUNICIPAL_URL);
  const offline = new Cache(directory, true, forbiddenFetch); await offline.open();
  assert.deepEqual((await offline.request(MUNICIPAL_URL)).data, saved.data);
  assert.equal(calls, 1);
  const record = offline.state.requests[saved.key];
  await writeFile(path.join(offline.directory, record.file), gzipSync(JSON.stringify(municipal([{ identificatie: 'changed' }]))));
  await assert.rejects(offline.request(MUNICIPAL_URL), /checksum mismatch/);
});

test('failed request leaves no success entry; resume reuses earlier successful responses', async t => {
  const directory = await temp(t), next = MUNICIPAL_URL + '&page=2';
  const calls: string[] = [];
  let fail = true;
  const fetcher: typeof fetch = async input => {
    const url = String(input); calls.push(url);
    if (url === next && fail) return new Response('failure', { status: 503 });
    return response(municipal([], url === MUNICIPAL_URL ? next : undefined));
  };
  const cache = new Cache(directory, false, fetcher, 1000, 1); await cache.open();
  await cache.request(MUNICIPAL_URL);
  await assert.rejects(cache.request(next), /HTTP 503/);
  assert.equal(Object.keys(cache.state.requests).length, 1);
  assert.equal(cache.state.failures.length, 1);
  fail = false;
  const resumed = new Cache(directory, false, fetcher, 1000, 1); await resumed.open();
  await resumed.request(MUNICIPAL_URL); await resumed.request(next);
  assert.deepEqual(calls, [MUNICIPAL_URL, next, next]);
  assert.equal(Object.keys(resumed.state.requests).length, 2);
  assert.equal(resumed.state.failures.length, 1);
});

test('offline missing generation and missing request fail without network', async t => {
  const directory = await temp(t);
  await assert.rejects(new Cache(directory, true, forbiddenFetch).open(), /No cached generation/);
  const seed = new Cache(directory, false, forbiddenFetch); await seed.open();
  const offline = new Cache(directory, true, forbiddenFetch); await offline.open();
  await assert.rejects(offline.request(MUNICIPAL_URL), /Offline request missing/);
  assert.deepEqual(offline.state.requests, {});
});

test('adaptive splitting returns every successful leaf and aborts on a missing leaf', async t => {
  const directory = await temp(t);
  let failLeaf = false;
  const fetcher: typeof fetch = async (_input, options) => {
    const query = new URLSearchParams(String(options?.body)).get('query')!;
    const nodes = [...query.matchAll(/<([^>]+)>/g)].map(m => m[1]);
    if (nodes.length > 1 || failLeaf && nodes[0].endsWith('/d')) return new Response('unavailable', { status: 503 });
    return response(sparql(nodes.map(s => triple(s, CEO + 'omschrijving', literal(s)))));
  };
  const cache = new Cache(directory, false, fetcher, 1000, 1); await cache.open();
  const values = ['a', 'b', 'c', 'd'].map(id => 'https://example.test/' + id), keys: string[] = [];
  const result = await batches(cache, values, nodeQuery, keys, 4);
  assert.deepEqual(result.map(r => r.s.value), values);
  assert.equal(keys.length, 4);
  assert.equal(Object.keys(cache.state.requests).length, 4);
  const directory2 = await mkdtemp(path.join(tmpdir(), 'monument-archive-leaf-'));
  t.after(() => rm(directory2, { recursive: true, force: true }));
  failLeaf = true;
  const failing = new Cache(directory2, false, fetcher, 1000, 1); await failing.open();
  const partialKeys: string[] = [];
  await assert.rejects(batches(failing, values, nodeQuery, partialKeys, 4), /Request failed/);
  assert.equal(partialKeys.length, 3);
  assert.equal(failing.state.complete, false);
});

test('municipal normalization retains full text, inactive status, source metadata and missing BAG fields', () => {
  const absent = { identificatie: 'municipal-2', status: 'Onbekend', beschrijvingPubliek: ' ' };
  const normalized = normalizeMunicipal([municipalRecord, absent, municipalRecord]);
  assert.equal(normalized.length, 2);
  const first = normalized[0];
  assert.deepEqual(first.descriptions.map((d: any) => d.text), [municipalRecord.redengevendeOmschrijvingPubliek, municipalRecord.beschrijvingPubliek]);
  assert.equal(first.status, 'Afgevoerd'); assert.equal(first.withdrawnAt, '2001-01-01');
  assert.deepEqual(first.bagPandIds, [pand]); assert.deepEqual(first.metadata, municipalRecord);
  assert.deepEqual(normalized[1].bagPandIds, []); assert.deepEqual(normalized[1].descriptions, []);
  assert.equal(normalized[1].monumentNumber, null);
  assert.throws(() => normalizeMunicipal([{ ...municipalRecord, status: 'Changed' }, municipalRecord]), /Conflicting municipal identity/);
  assert.throws(() => normalizeMunicipal([{}]), /missing identity/);
});

test('RCE merges duplicate resources while retaining distinct descriptions, status and explicit BAG literals', () => {
  const normalized = normalizeRce([...inventory, inventory[0]], [...graph, graph[0]]);
  assert.equal(normalized.length, 1);
  const record = normalized[0];
  assert.deepEqual(record.sourceUris, [root, alias]);
  assert.equal(record.descriptions.length, 3);
  assert.deepEqual(new Set(record.descriptions.map((d: any) => d.text)), new Set(graph.filter(t => t.p.value === CEO + 'omschrijving').map(t => t.o.value)));
  assert.deepEqual(record.status, ['Beschermd']); assert.deepEqual(record.statusUris, [status]);
  assert.deepEqual(record.bagPandIds, [pand]); assert.deepEqual(record.bagVboIds, [vbo]);
  assert.equal(record.metadata.length, graph.length);
  const unknownOnly = normalizeRce([inventory[0]], [graph[0], graph.find(t => t.p.value.endsWith('unknownLink'))!]);
  assert.deepEqual(unknownOnly[0].bagPandIds, []);
  assert.deepEqual(unknownOnly[0].bagVboIds, []);
  assert.throws(() => normalizeRce(inventory, []), /Missing RCE root properties/);
});

test('complete collection offline rebuild reproduces snapshot and rejects incomplete page cache', async t => {
  const directory = await temp(t), output = path.join(directory, 'output');
  const next = MUNICIPAL_URL + '&page=2';
  let calls = 0;
  const fetcher: typeof fetch = async (input, options) => {
    calls++;
    if (String(input) === MUNICIPAL_URL) return response(municipal([municipalRecord], next));
    if (String(input) === next) return response(municipal([{ identificatie: 'municipal-2', monumentnummer: 999999, status: 'Rijksmonument' }]));
    assert.equal(String(input), RCE_URL);
    const query = new URLSearchParams(String(options?.body)).get('query')!;
    if (query === INVENTORY_QUERY) return response(sparql(inventory));
    if (query === numberQuery(['999999'])) return response(sparql([]));
    const subjects = [...query.matchAll(/<([^>]+)>/g)].map(m => m[1]);
    return response(sparql(graph.filter(t => subjects.includes(t.s.value))));
  };
  const cache = new Cache(path.join(directory, 'cache'), false, fetcher, 1000, 1); await cache.open();
  await collect(cache);
  const manifest = await rebuild(cache, output);
  assert.equal(manifest.coverage.municipalRecords, 2); assert.equal(manifest.coverage.rceRecords, 1);
  assert.equal(cache.state.supplementalKeys.length, 1);
  assert.deepEqual((await cache.cached(cache.state.supplementalKeys[0])).results.bindings, []);
  assert.deepEqual(manifest.coverage.municipalNationalReferencesUnresolved, ['999999']);
  assert.equal(manifest.coverage.rceWithDescriptions, 1); assert.equal(manifest.coverage.rceWithStatus, 1);
  const compressed = await readFile(path.join(output, 'records.json.gz'));
  const snapshot = JSON.parse(gunzipSync(compressed).toString());
  assert.equal(hash(compressed), manifest.snapshot.sha256);
  assert.equal(snapshot.rce[0].descriptions.length, 3);
  const callsBeforeOffline = calls;
  const offline = new Cache(cache.root, true, forbiddenFetch); await offline.open();
  const verified = await rebuild(offline, output, true);
  assert.deepEqual(verified.snapshot, manifest.snapshot); assert.equal(calls, callsBeforeOffline);
  await t.test('empty supplemental response is valid but an omitted supplemental request fails', async () => {
    const completeSupplementalKeys = [...offline.state.supplementalKeys];
    offline.state.supplementalKeys = [];
    await assert.rejects(rebuild(offline, output), /Missing municipal-linked national number request 999999/);
    offline.state.supplementalKeys = completeSupplementalKeys;
    assert.deepEqual((await rebuild(offline, output, true)).snapshot, manifest.snapshot);
  });
  const completeGraphKeys = [...offline.state.graphKeys];
  for (const [missing, expected] of [[root, /Missing RCE root/], [basis, /Missing linked-resource request/], [bag, /Missing linked-resource request/]] as const) {
    await t.test(`rejects missing graph request for ${missing}`, async () => {
      offline.state.graphKeys = completeGraphKeys.filter(key => !offline.state.requests[key].query!.includes(`<${missing}>`));
      await assert.rejects(rebuild(offline, output), expected);
      offline.state.graphKeys = [...completeGraphKeys];
    });
  }
  offline.state.municipalPages.pop();
  await assert.rejects(rebuild(offline, output), /terminal page missing/);
  offline.state.complete = false;
  await assert.rejects(rebuild(offline, output), /Collection incomplete/);
});
