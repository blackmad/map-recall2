/** Offline private source-pack sync. No network or git writes.
 * npx tsx scripts/monument-register/archive-source-pack.ts
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const destination = path.resolve('../map-recall2-source-data');
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const cache = '.cache/monument-register/amsterdam';
const pointer = JSON.parse(await readFile(`${cache}/current.json`, 'utf8'));
if (!/^[a-zA-Z0-9-]+$/.test(pointer.generation)) throw Error('Unsafe generation');
const generation = pointer.generation;
const root = `${cache}/${generation}`;
const state = JSON.parse(await readFile(`${root}/state.json`, 'utf8'));
if (!state.complete) throw Error('Cannot archive an incomplete generation');
const relativeRoot = `datasets/amsterdam-monument-register/${generation}`;
const files: any[] = [];
async function copy(source: string, relative: string, classification: string, extra: object = {}) {
  const bytes = await readFile(source), target = path.join(destination, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  if (hash(await readFile(target)) !== hash(bytes)) throw Error(`Copied checksum mismatch: ${relative}`);
  const entry = { originalPath: source, archivedPath: relative, classification, bytes: bytes.length, sha256: hash(bytes), ...extra };
  files.push(entry); return entry;
}
for (const [key, request] of Object.entries(state.requests) as Array<[string, any]>) {
  if (!/^responses\/[a-f0-9]+\.json\.gz$/.test(request.file)) throw Error('Unsafe response path');
  const raw = gunzipSync(await readFile(`${root}/${request.file}`));
  if (hash(raw) !== request.sha256 || raw.length !== request.bytes) throw Error(`Raw checksum mismatch: ${key}`);
  await copy(`${root}/${request.file}`, `${relativeRoot}/raw/${request.file}`, 'original-http-response-gzip', {
    uncompressedSha256: hash(raw), uncompressedBytes: raw.length, url: request.url,
    query: request.query ?? null, retrievedAt: request.retrievedAt, accessState: 'successful cached HTTP response',
  });
}
await copy(`${root}/state.json`, `${relativeRoot}/raw/state.json`, 'collection-provenance');
await copy(`${cache}/current.json`, `${relativeRoot}/raw/current.json`, 'original-generation-pointer');
for (const file of ['records.json.gz', 'manifest.json', 'README.md']) {
  await copy(`scripts/data/amsterdam-monument-register/${file}`, `${relativeRoot}/normalized/${file}`, 'normalized-snapshot-or-documentation');
}
const panoramaPacks = ['artifacts/street-appearance/retry/7/source', 'artifacts/street-appearance/retry/12/evaluation-source'];
for (const pack of panoramaPacks) {
  const manifest = JSON.parse(await readFile(`${pack}/manifest.json`, 'utf8'));
  const sources = new Map(manifest.evidence.flatMap((e: any) => [
    [path.basename(e.sourceFile), { classification: 'original-downloaded-panorama', expected: e.sourceSha256, url: e.sourceUrl, captureDate: e.captureDate }],
    [path.basename(e.cropFile), { classification: 'processed-perspective-crop', expected: e.cropSha256, parentPanoramaPath: e.sourceFile, perspective: e.perspective }],
  ]));
  for (const name of (await readdir(pack)).sort()) {
    const source = `${pack}/${name}`;
    const metadata: any = sources.get(name);
    if (metadata?.expected && hash(await readFile(source)) !== metadata.expected) throw Error(`Panorama source checksum mismatch: ${source}`);
    const classification = metadata?.classification ?? (name === 'manifest.json' ? 'source-provenance-manifest' : 'cached-discovery-or-supporting-source');
    await copy(source, `streets/bethanien-transition/${source}`, classification, {
      ...(metadata ?? {}), attribution: manifest.attribution,
      evidenceRole: pack.includes('/12/') ? 'fixed-evaluation-only; keep out of recipe inference' : 'transition-investigation',
      retrievedAt: null, retrievalDateState: 'Original manifest does not record retrieval time; captureDate is panorama acquisition date, not retrieval date.',
      accessState: 'available cached file; original source manifest preserved',
    });
  }
}
await copy('artifacts/street-appearance/register-transition/evidence.json', 'streets/bethanien-transition/processed/register-evidence.json', 'processed-architectural-extraction');
// Preserve the original pilot inputs needed to reproduce unchanged context
// recipes, separately from the later fixed transition challenge.
async function copyPilot(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const source = `${directory}/${entry.name}`;
    if (entry.isDirectory()) { await copyPilot(source); continue; }
    await copy(source, `streets/bethanien-transition/${source}`, 'original-pilot-cache-or-derived-observation', {
      evidenceRole: 'Original pilot manifest records training versus heldout; model proposals are not admitted automatically.',
      provenance: '.cache/street-appearance/manifest.json',
    });
  }
}
await copyPilot('.cache/street-appearance');
const manifestTarget = `${destination}/${relativeRoot}/source-pack-manifest.json`;
await writeFile(manifestTarget, JSON.stringify({ schemaVersion: 1, generation, sourceRepository: 'blackmad/map-recall2',
  task: 'Bethaniën historic-modern street transition and reusable citywide monument evidence',
  reproduction: 'npx tsx scripts/monument-register/archive-source-pack.ts',
  licenseState: 'Private archival storage does not change original licensing. Municipal panorama attribution recorded per pack. Register raw provenance retained.',
  files }, null, 2) + '\n');
await writeFile(`${destination}/${relativeRoot}/README.md`, `# Amsterdam monument register source generation\n\nGeneration: ${generation}.\n\nThe raw/ directory preserves original gzipped HTTP response bodies and the original collection state/pointer. Response hashes were verified against decompressed bytes; archived compressed copies were verified after writing. normalized/ is derived JSON and documentation, not original HTTP response content. The portable public snapshot contains descriptions and explicit BAG predicates; missing relations remain missing.\n\nsource-pack-manifest.json records original and archive paths, checksums, retrieval timestamps and request provenance. The same manifest indexes task-relevant panoramas in streets/bethanien-transition/artifacts/: original downloads and processed perspective crops remain distinct, with the original evidence manifests unmodified. Evaluation-only retry 12 evidence retains its heldout role. Missing panorama retrieval dates are explicit; capture dates are not substituted.\n\nSync was offline and made no git commits. Reproduce from the public repository with npx tsx scripts/monument-register/archive-source-pack.ts.\n`);
console.log(JSON.stringify({ destination, generation, verifiedRawResponses: Object.keys(state.requests).length, copiedFiles: files.length, manifest: manifestTarget }));
