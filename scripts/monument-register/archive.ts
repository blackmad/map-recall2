/** Offline reusable monument source archive; deliberately independent of game rendering. */
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

export const MUNICIPAL_URL = 'https://api.data.amsterdam.nl/v1/monumenten/monumenten/?_format=json&_pageSize=500';
export const RCE_URL = 'https://api.linkeddata.cultureelerfgoed.nl/datasets/rce/cho/sparql';
export const CEO = 'https://linkeddata.cultureelerfgoed.nl/def/ceo#';
const SKOS = 'http://www.w3.org/2004/02/skos/core#';
export type Term = { type: string; value: string; datatype?: string; 'xml:lang'?: string };
export type Triple = { s: Term; p: Term; o: Term };
type Json = Record<string, any>;
type RequestRecord = { file: string; sha256: string; url: string; query?: string; retrievedAt: string; bytes: number };
type State = { version: 1; generation: string; createdAt: string; complete: boolean; requests: Record<string, RequestRecord>; municipalPages: string[]; inventoryKey?: string; supplementalKeys: string[]; graphKeys: string[]; failures: Array<{ url: string; message: string; at: string }> };
export const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
export async function atomic(filename: string, data: string | Buffer): Promise<void> {
  await mkdir(path.dirname(filename), { recursive: true });
  const temp = `${filename}.tmp-${process.pid}`;
  await writeFile(temp, data); await rename(temp, filename);
}
export class Cache {
  state!: State;
  directory!: string;
  constructor(readonly root: string, readonly offline = false, readonly fetcher: typeof fetch = fetch, readonly timeoutMs = 45000, readonly attempts = 3) {}
  async open(refresh = false): Promise<void> {
    const pointer = path.join(this.root, 'current.json');
    let generation: string | undefined;
    if (!refresh) {
      try { generation = JSON.parse(await readFile(pointer, 'utf8')).generation; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    if (!generation) {
      if (this.offline) throw Error('No cached generation: fetch the archive first');
      generation = new Date().toISOString().replace(/[:.]/g, '-') + `-${process.pid}`;
      this.state = { version: 1, generation, createdAt: new Date().toISOString(), complete: false, requests: {}, municipalPages: [], supplementalKeys: [], graphKeys: [], failures: [] };
      this.directory = path.join(this.root, generation);
      await this.save(); await atomic(pointer, JSON.stringify({ generation }) + '\n');
    } else {
      if (!/^[a-zA-Z0-9-]+$/.test(generation)) throw Error('Invalid cache generation');
      this.directory = path.join(this.root, generation);
      this.state = JSON.parse(await readFile(path.join(this.directory, 'state.json'), 'utf8'));
    }
  }
  async save(): Promise<void> { await atomic(path.join(this.directory, 'state.json'), JSON.stringify(this.state, null, 2) + '\n'); }
  async cached(key: string): Promise<Json> {
    const record = this.state.requests[key];
    if (!record) throw Error(`Missing cached request ${key}`);
    const bytes = gunzipSync(await readFile(path.join(this.directory, record.file)));
    if (hash(bytes) !== record.sha256) throw Error(`Cached response checksum mismatch: ${key}`);
    return JSON.parse(bytes.toString('utf8'));
  }
  async request(url: string, query?: string): Promise<{ key: string; data: Json }> {
    const key = hash(JSON.stringify({ url, query }));
    if (this.state.requests[key]) return { key, data: await this.cached(key) };
    if (this.offline) throw Error(`Offline request missing: ${url}`);
    let last: unknown;
    for (let attempt = 0; attempt < this.attempts; attempt++) {
      try {
        const response = await this.fetcher(url, {
          ...(query ? { method: 'POST', body: new URLSearchParams({ query }).toString() } : {}),
          headers: { Accept: query ? 'application/sparql-results+json' : '*/*', ...(query ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer()), data = JSON.parse(bytes.toString('utf8'));
        if (query && !Array.isArray(data.results?.bindings)) throw Error('Invalid SPARQL response');
        if (!query && !Array.isArray(data._embedded?.monumenten)) throw Error('Invalid municipal page');
        const file = `responses/${key}.json.gz`, retrievedAt = new Date().toISOString();
        await atomic(path.join(this.directory, file), gzipSync(bytes, { level: 9 }));
        this.state.requests[key] = { file, sha256: hash(bytes), url, ...(query ? { query } : {}), retrievedAt, bytes: bytes.length };
        await this.save();
        return { key, data };
      } catch (error) { last = error; if (attempt + 1 < this.attempts) await new Promise(resolve => setTimeout(resolve, Math.min(4000, 1000 * 2 ** attempt))); }
    }
    this.state.failures.push({ url, message: String(last), at: new Date().toISOString() }); await this.save();
    throw Error(`Request failed after ${this.attempts} attempts: ${url}: ${String(last)}`);
  }
}

const prefix = `PREFIX ceo: <${CEO}>\n`;
export const INVENTORY_QUERY = prefix + 'SELECT DISTINCT ?m ?nr WHERE { ?basis ceo:gemeentenaam "Amsterdam" . ?m ceo:heeftBasisregistratieRelatie ?basis ; ceo:rijksmonumentnummer ?nr . }';
const iri = (value: string) => {
  if (!/^https?:\/\//.test(value) || /[<>"{}|^`\\\s]/.test(value)) throw Error(`Invalid resource URI ${value}`);
  return `<${value}>`;
};
export const nodeQuery = (nodes: string[]) => `SELECT ?s ?p ?o WHERE { VALUES ?s { ${nodes.map(iri).join(' ')} } ?s ?p ?o . }`;
export const numberQuery = (numbers: string[]) => prefix + `SELECT DISTINCT ?m ?nr WHERE { VALUES ?nr { ${numbers.map(n => JSON.stringify(n)).join(' ')} } ?m ceo:rijksmonumentnummer ?nr . }`;
const list = <T>(values: T[]) => [...new Set(values)].sort();
const rows = (data: Json) => data.results.bindings as Array<Record<string, Term>>;
const bindingsToTriples = (data: Json) => rows(data).map(r => ({ s: r.s, p: r.p, o: r.o }));
const isTerm = (uri: string) => /^https?:\/\/data\.cultureelerfgoed\.nl\/term\//.test(uri);
const followRoot = (t: Triple) => t.p.value.startsWith(CEO) && t.o.type === 'uri' && (/^https?:\/\/linkeddata\.cultureelerfgoed\.nl\//.test(t.o.value) || isTerm(t.o.value));
const followBasis = (t: Triple) => t.o.type === 'uri' && ([CEO + 'heeftBAGRelatie', CEO + 'heeftBRKRelatie'].includes(t.p.value) || t.p.value.startsWith(CEO) && isTerm(t.o.value));

/** Split failed batches recursively; missing leaves fail collection instead of silently vanishing. */
export async function batches(cache: Cache, values: string[], query: (values: string[]) => string, keys: string[], size = 100): Promise<Array<Record<string, Term>>> {
  const result: Array<Record<string, Term>> = [];
  async function collect(part: string[]): Promise<void> {
    try {
      const response = await cache.request(RCE_URL, query(part)); keys.push(response.key); result.push(...rows(response.data)); await cache.save();
    } catch (error) {
      if (cache.offline || part.length < 2) throw error;
      console.log(`Splitting failed batch of ${part.length} resources`);
      const split = Math.ceil(part.length / 2); await collect(part.slice(0, split)); await collect(part.slice(split));
    }
  }
  for (let i = 0; i < values.length; i += size) {
    await collect(values.slice(i, i + size));
    console.log(`RCE resources ${Math.min(values.length, i + size)}/${values.length}`);
  }
  return result;
}

export async function collect(cache: Cache): Promise<void> {
  cache.state.complete = false; await cache.save();
  const municipal: Json[] = [], seen = new Set<string>();
  let url: string | undefined = MUNICIPAL_URL;
  cache.state.municipalPages = [];
  while (url) {
    if (seen.has(url)) throw Error('Municipal pagination loop'); seen.add(url);
    if (new URL(url).origin !== new URL(MUNICIPAL_URL).origin) throw Error('Unexpected pagination origin');
    const response = await cache.request(url); cache.state.municipalPages.push(response.key);
    municipal.push(...response.data._embedded.monumenten); await cache.save();
    const next: string | undefined = response.data._links?.next?.href;
    url = next ? new URL(next, url).href : undefined;
    console.log(`Municipal records ${municipal.length}, pages ${cache.state.municipalPages.length}`);
  }
  const inventory = await cache.request(RCE_URL, INVENTORY_QUERY); cache.state.inventoryKey = inventory.key; await cache.save();
  const initial = rows(inventory.data), known = new Set(initial.map(r => r.nr.value));
  const numbers = list(municipal.filter(r => /rijks/i.test(String(r.status ?? ''))).map(r => String(r.monumentnummer ?? '')).filter(n => /^\d+$/.test(n) && !known.has(n)));
  cache.state.supplementalKeys = [];
  const supplemental = await batches(cache, numbers, numberQuery, cache.state.supplementalKeys);
  const roots = list([...initial, ...supplemental].map(r => r.m.value));
  console.log(`RCE inventory ${known.size}; supplemental ${new Set(supplemental.map(r => r.nr.value)).size}; root resources ${roots.length}`);
  cache.state.graphKeys = [];
  const direct = await batches(cache, roots, nodeQuery, cache.state.graphKeys);
  const directTriples = direct.map(r => ({ s: r.s, p: r.p, o: r.o }));
  const children = list(directTriples.filter(followRoot).map(t => t.o.value)).filter(uri => !roots.includes(uri));
  const linked = await batches(cache, children, nodeQuery, cache.state.graphKeys);
  const childrenTriples = linked.map(r => ({ s: r.s, p: r.p, o: r.o }));
  const grandchildren = list(childrenTriples.filter(followBasis).map(t => t.o.value)).filter(uri => !roots.includes(uri) && !children.includes(uri));
  await batches(cache, grandchildren, nodeQuery, cache.state.graphKeys);
  cache.state.supplementalKeys = list(cache.state.supplementalKeys); cache.state.graphKeys = list(cache.state.graphKeys);
  cache.state.complete = true; await cache.save();
}

export function normalizeMunicipal(records: Json[]): Json[] {
  const unique = new Map<string, Json>();
  for (const record of records) {
    if (record.identificatie == null) throw Error('Municipal record missing identity');
    const sourceId = String(record.identificatie);
    const previous = unique.get(sourceId);
    if (previous && JSON.stringify(previous.metadata) !== JSON.stringify(record)) throw Error(`Conflicting municipal identity ${sourceId}`);
    unique.set(sourceId, {
      source: 'amsterdam', sourceId, monumentNumber: record.monumentnummer == null ? null : String(record.monumentnummer),
      recordUrl: record._links?.self?.href ?? null, status: record.status ?? null, withdrawnAt: record.datumAfvoeren ?? null,
      bagPandIds: list((record._links?.betreftBagPand ?? []).map((r: Json) => String(r.identificatie)).filter((id: string) => /^\d{16}$/.test(id))),
      descriptions: ['redengevendeOmschrijvingPubliek', 'beschrijvingPubliek'].flatMap(field => typeof record[field] === 'string' && record[field].trim() ? [{ field, text: record[field], language: 'nl' }] : []),
      metadata: record,
    });
  }
  return [...unique.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId, 'en'));
}

export function normalizeRce(inventory: Array<Record<string, Term>>, graph: Triple[]): Json[] {
  const subjects = new Map<string, Triple[]>();
  for (const t of graph) {
    const arr = subjects.get(t.s.value) ?? []; arr.push(t); subjects.set(t.s.value, arr);
  }
  const byNumber = new Map<string, Set<string>>();
  for (const row of inventory) { const roots = byNumber.get(row.nr.value) ?? new Set(); roots.add(row.m.value); byNumber.set(row.nr.value, roots); }
  return [...byNumber].sort(([a], [b]) => Number(a) - Number(b)).map(([sourceId, roots]) => {
    const direct = [...roots].flatMap(s => subjects.get(s) ?? []);
    if (!direct.length) throw Error(`Missing RCE root properties for ${sourceId}`);
    const children = list(direct.filter(followRoot).map(t => t.o.value));
    const childTriples = children.flatMap(s => subjects.get(s) ?? []);
    const grandchildren = list(childTriples.filter(followBasis).map(t => t.o.value));
    const relevant = [...direct, ...childTriples, ...grandchildren.flatMap(s => subjects.get(s) ?? [])];
    const unique = new Map(relevant.map(t => [JSON.stringify(t), t]));
    const metadata = [...unique.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
    const values = (predicate: string) => metadata.filter(t => t.p.value === predicate).map(t => t.o);
    const statusUris = list(direct.filter(t => t.p.value === CEO + 'heeftJuridischeStatus').map(t => t.o.value));
    const statusLabels = list(metadata.filter(t => statusUris.includes(t.s.value) && t.p.value === SKOS + 'prefLabel').map(t => t.o.value));
    return {
      source: 'rce', sourceId, monumentNumber: sourceId, recordUrl: `https://monumentenregister.cultureelerfgoed.nl/monumenten/${sourceId}`,
      sourceUris: [...roots].sort(), status: statusLabels, statusUris,
      descriptions: metadata.filter(t => t.p.value === CEO + 'omschrijving').map(t => ({ sourceUri: t.s.value, text: t.o.value, language: t.o['xml:lang'] ?? null })),
      locations: values('http://www.opengis.net/ont/geosparql#asWKT'),
      // Explicit source predicate IDs only; an address is not a BAG building identity.
      bagPandIds: list(metadata.filter(t => /(?:pandIdentificatie|pandidentificatie|bagPandIdentificatie)$/.test(t.p.value)).map(t => t.o.value).filter(id => /^\d{16}$/.test(id))),
      bagVboIds: list(values(CEO + 'verblijfsobjectIdentificatie').map(t => t.value).filter(id => /^\d{16}$/.test(id))),
      metadata,
    };
  });
}

export async function rebuild(cache: Cache, output: string, verifyOnly = false): Promise<Json> {
  if (!cache.state.complete) throw Error('Collection incomplete; resume before publishing a snapshot');
  const municipal: Json[] = [];
  let next: string | undefined = MUNICIPAL_URL;
  for (const key of cache.state.municipalPages) {
    const record = cache.state.requests[key];
    if (!record || record.url !== next) throw Error('Municipal page chain incomplete');
    const page = await cache.cached(key); municipal.push(...page._embedded.monumenten);
    next = page._links?.next?.href ? new URL(page._links.next.href, record.url).href : undefined;
  }
  if (next) throw Error('Municipal terminal page missing');
  if (!cache.state.inventoryKey) throw Error('Missing independent RCE inventory');
  const inventory = rows(await cache.cached(cache.state.inventoryKey)), combined = [...inventory];
  const inventoryNumbers = new Set(inventory.map(row => row.nr.value));
  const expectedSupplemental = list(municipal.filter(r => /rijks/i.test(String(r.status ?? ''))).map(r => String(r.monumentnummer ?? '')).filter(n => /^\d+$/.test(n) && !inventoryNumbers.has(n)));
  const requestedNumbers = new Set(cache.state.supplementalKeys.flatMap(key => {
    const clause = cache.state.requests[key]?.query?.match(/VALUES\s+\?nr\s*\{([^}]+)\}/)?.[1];
    if (!clause) throw Error(`Unrecognized supplemental query ${key}`);
    return [...clause.matchAll(/"(\d+)"/g)].map(m => m[1]);
  }));
  for (const nr of expectedSupplemental) if (!requestedNumbers.has(nr)) throw Error(`Missing municipal-linked national number request ${nr}`);
  for (const key of cache.state.supplementalKeys) combined.push(...rows(await cache.cached(key)));
  const graph: Triple[] = [];
  for (const key of cache.state.graphKeys) graph.push(...bindingsToTriples(await cache.cached(key)));
  const requestedSubjects = new Set(cache.state.graphKeys.flatMap(key => {
    const query = cache.state.requests[key]?.query;
    const clause = query?.match(/VALUES\s+\?s\s*\{([^}]+)\}/)?.[1];
    if (!clause) throw Error(`Unrecognized node query ${key}`);
    return [...clause.matchAll(/<([^>]+)>/g)].map(m => m[1]);
  }));
  const expectedRoots = list(combined.map(row => row.m.value)), rootSet = new Set(expectedRoots), observedSubjects = new Set(graph.map(t => t.s.value));
  const rootsWithNumbers = new Set(graph.filter(t => t.p.value === CEO + 'rijksmonumentnummer').map(t => t.s.value));
  for (const uri of expectedRoots) {
    if (!requestedSubjects.has(uri) || !rootsWithNumbers.has(uri)) throw Error(`Missing RCE root ${uri}`);
  }
  const direct = graph.filter(t => rootSet.has(t.s.value));
  const childUris = list(direct.filter(followRoot).map(t => t.o.value));
  const childSet = new Set(childUris), childTriples = graph.filter(t => childSet.has(t.s.value));
  const expectedNodes = list([...expectedRoots, ...childUris, ...childTriples.filter(followBasis).map(t => t.o.value)]);
  for (const uri of expectedNodes) if (!requestedSubjects.has(uri)) throw Error(`Missing linked-resource request ${uri}`);
  const normalizedMunicipal = normalizeMunicipal(municipal), normalizedRce = normalizeRce(combined, graph);
  const snapshot = { schemaVersion: 1, scope: 'Amsterdam municipal register plus RCE Amsterdam and municipal-linked national monuments', municipal: normalizedMunicipal, rce: normalizedRce };
  const bytes = Buffer.from(JSON.stringify(snapshot) + '\n'), compressed = gzipSync(bytes, { level: 9 });
  const cacheKeys = list([...cache.state.municipalPages, cache.state.inventoryKey, ...cache.state.supplementalKeys, ...cache.state.graphKeys]);
  const coverage = {
    municipalRecords: normalizedMunicipal.length, municipalPages: cache.state.municipalPages.length,
    municipalWithDescriptions: normalizedMunicipal.filter(r => r.descriptions.length).length,
    municipalWithBagLinks: normalizedMunicipal.filter(r => r.bagPandIds.length).length,
    municipalWithdrawn: normalizedMunicipal.filter(r => r.withdrawnAt).length,
    rceIndependentInventory: new Set(inventory.map(r => r.nr.value)).size,
    rceRecords: normalizedRce.length, rceSupplemental: normalizedRce.length - new Set(inventory.map(r => r.nr.value)).size,
    rceWithDescriptions: normalizedRce.filter(r => r.descriptions.length).length,
    rceMissingDescriptions: normalizedRce.filter(r => !r.descriptions.length).map(r => r.sourceId),
    rceWithStatus: normalizedRce.filter(r => r.status.length).length,
    rceWithCoordinates: normalizedRce.filter(r => r.locations.length).length,
    rceRequestedResources: requestedSubjects.size,
    rceResourcesWithoutProperties: expectedNodes.filter(uri => !observedSubjects.has(uri)),
    municipalNationalReferencesUnresolved: list(normalizedMunicipal.filter(r => /rijks/i.test(String(r.status ?? '')) && r.monumentNumber && !normalizedRce.some(n => n.sourceId === r.monumentNumber)).map(r => r.monumentNumber)),
    municipalMissingBagLinks: normalizedMunicipal.filter(r => !r.bagPandIds.length).map(r => r.sourceId),
  };
  const example = normalizedRce.find(r => r.sourceId === '5087');
  if (!example?.descriptions.some((d: Json) => /triglyfen.*consoles.*schilddakje/i.test(d.text))) throw Error('5087 source description missing or incomplete');
  const manifest = {
    schemaVersion: 1, generation: cache.state.generation, collectionStartedAt: cache.state.createdAt,
    snapshot: { file: 'records.json.gz', sha256: hash(compressed), uncompressedSha256: hash(bytes), bytes: compressed.length, uncompressedBytes: bytes.length },
    sources: { municipal: { url: MUNICIPAL_URL }, rce: { url: RCE_URL, inventoryQuery: INVENTORY_QUERY } },
    coverage, requests: cacheKeys.map(key => ({ key, ...cache.state.requests[key] })),
    recoveredRequestFailures: cache.state.failures,
    completeness: 'All municipal pagination pages; independent RCE inventory; all selected roots, direct linked RCE properties and nested BAG/BRK relations fetched. Missing descriptions/identity links are explicitly retained.',
    inference: 'None. Historical statements and architectural dates are source text; no game facts, facade recipes or footprint guesses are updated.',
  };
  if (verifyOnly) {
    const previous = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
    if (previous.snapshot.sha256 !== manifest.snapshot.sha256 || previous.snapshot.uncompressedSha256 !== manifest.snapshot.uncompressedSha256) throw Error('Offline rebuild differs from saved snapshot');
    if (hash(await readFile(path.join(output, 'records.json.gz'))) !== manifest.snapshot.sha256) throw Error('Saved snapshot checksum mismatch');
  } else {
    await atomic(path.join(output, 'records.json.gz'), compressed);
    await atomic(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  }
  return manifest;
}

export async function main(): Promise<void> {
  const args = process.argv.slice(2), command = args[0] ?? 'resume';
  if (args.includes('--help')) { console.log('Usage: archive.ts fetch|resume|refresh|rebuild|verify [--cache=...] [--output=...]'); return; }
  if (!['fetch', 'resume', 'refresh', 'rebuild', 'verify'].includes(command)) throw Error('Usage: archive.ts fetch|resume|refresh|rebuild|verify [--cache=...] [--output=...]');
  const option = (name: string, fallback: string) => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const cache = new Cache(path.resolve(option('cache', '.cache/monument-register/amsterdam')), ['rebuild', 'verify'].includes(command));
  await cache.open(command === 'refresh');
  if (!cache.offline) await collect(cache);
  const manifest = await rebuild(cache, path.resolve(option('output', 'scripts/data/amsterdam-monument-register')), command === 'verify');
  const counts = Object.fromEntries(Object.entries(manifest.coverage).map(([key, value]) => [key, Array.isArray(value) ? value.length : value]));
  console.log(JSON.stringify({ command, ...counts, snapshot: manifest.snapshot }, null, 2));
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(error => { console.error(error); process.exitCode = 1; });
