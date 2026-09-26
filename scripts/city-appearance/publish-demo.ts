/** Source-audited local demo releases. No acquisition, inference or review writes.
 * Complete releases are immutable; only current.json is atomically replaced.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileBlockAppearance, sha256 } from './compile-block-tiles.js';
import { reviewEvidenceKey } from '../da-costa-block/review-dependencies.mjs';
import { surfaceMatches } from '../../public/canal-drive/da-costa-block/evidence.js';

export type DemoPublicationOptions = {
  blockPath?: string; evidencePath?: string; evidenceRoot?: string;
  outputRoot?: string; publicBase?: string; dryRun?: boolean;
};
const defaults = {
  blockPath: 'public/data/da-costa-block/block.json',
  evidencePath: 'public/data/da-costa-block/neighbourhood.json',
  evidenceRoot: '.cache/da-costa-neighbourhood',
  outputRoot: 'public/data/city-appearance', publicBase: '/data/city-appearance',
};
const encode = (value: unknown) => Buffer.from(JSON.stringify(value));
async function optionalBytes(file: string) {
  try { return await fs.readFile(file); } catch (error: any) { if (error.code !== 'ENOENT') throw error; return null; }
}
/** Small metadata-only status check. Publication itself also checks every image. */
export async function demoPublicationStatus(options: DemoPublicationOptions = {}) {
  const config = { ...defaults, ...options };
  const files = { block: config.blockPath, evidence: config.evidencePath,
    manifest: path.join(config.evidenceRoot, 'manifest.json'), aerial: path.join(config.evidenceRoot, 'aerial.json'),
    reviews: path.join(config.evidenceRoot, 'reviews.json') };
  const hashes: Record<string, string | null> = {};
  for (const [name, file] of Object.entries(files)) { const bytes = await optionalBytes(file); hashes[name] = bytes ? sha256(bytes) : null; }
  const currentBytes = await optionalBytes(path.join(config.outputRoot, 'current.json'));
  const current = currentBytes ? JSON.parse(currentBytes.toString()) : null;
  return { current, stale: !current || Object.entries(hashes).some(([key, hash]) => current.sourceHashes[key] !== hash) };
}

export async function publishDemo(options: DemoPublicationOptions = {}) {
  const config = { ...defaults, ...options };
  if (!/^\/[a-zA-Z0-9/_-]+$/.test(config.publicBase)) throw new Error('publicBase must be an absolute local URL path');
  const pins = new Map<string, { bytes: Buffer | null; hash: string | null }>();
  const pin = async (file: string, optional = false) => {
    const bytes = optional ? await optionalBytes(file) : await fs.readFile(file);
    pins.set(file, { bytes, hash: bytes ? sha256(bytes) : null });
    return bytes ? JSON.parse(bytes.toString()) : null;
  };
  const block = await pin(config.blockPath), evidence = await pin(config.evidencePath);
  const manifestPath = path.join(config.evidenceRoot, 'manifest.json'), aerialPath = path.join(config.evidenceRoot, 'aerial.json');
  const reviewsPath = path.join(config.evidenceRoot, 'reviews.json');
  const source = await pin(manifestPath), aerial = (await pin(aerialPath, true))?.records ?? [];
  const history = (await pin(reviewsPath, true))?.events ?? [];
  if (evidence.sourceHash !== source.sourceHash) throw new Error('Published evidence is from a different source manifest');
  if (new Set(source.records.map((row: any) => row.id)).size !== source.records.length ||
      evidence.records.length !== source.records.length) throw new Error('Evidence manifest record set is incomplete or duplicated');
  const imagePins = new Map<string, string>();
  const image = (directory: string, file: string, hash: string) => {
    if (typeof file !== 'string' || path.basename(file) !== file || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid source image pin');
    const target = path.join(config.evidenceRoot, directory, file);
    if (imagePins.has(target) && imagePins.get(target) !== hash) throw new Error('Conflicting source image pins');
    imagePins.set(target, hash);
  };
  for (const row of evidence.records) {
    const original = source.records.find((candidate: any) => candidate.id === row.id);
    const air = aerial.find((candidate: any) => candidate.buildingId === row.buildingId);
    if (!original || original.buildingId !== row.buildingId || original.derivationKey !== row.derivationKey ||
        row.evidenceKey !== reviewEvidenceKey(original, air)) throw new Error(`Stale source binding: ${row.id}`);
    for (const field of ['localStart', 'localEnd', 'mid', 'normal', 'wall', 'wallWidthM']) {
      if (JSON.stringify(row[field]) !== JSON.stringify(original[field])) throw new Error(`Source frontage changed: ${row.id}/${field}`);
    }
    for (const [kind, metadata] of Object.entries(original.images) as [string, any][]) {
      if (JSON.stringify(row.images[kind]) !== JSON.stringify(metadata)) throw new Error(`Stale image metadata: ${row.id}/${kind}`);
      image('images', metadata.file, metadata.sha256);
      if (!metadata.panoramaId || !metadata.panoramaSha256) throw new Error(`Unpinned original panorama: ${row.id}/${kind}`);
      image('panoramas', metadata.panoramaId + '.jpg', metadata.panoramaSha256);
    }
    if (JSON.stringify(row.images.aerial ?? null) !== JSON.stringify(air ?? null)) throw new Error(`Stale aerial: ${row.id}`);
    if (air) { image('images', air.file, air.sha256); if (air.context) image('images', air.context.file, air.context.sha256); }
    const latest = history.filter((event: any) => event.id === row.id && event.derivationKey === row.derivationKey && event.evidenceKey === row.evidenceKey).at(-1);
    if (latest && latest.origin !== 'human-review') throw new Error(`Non-human event in review history: ${row.id}`);
    if (JSON.stringify(row.review ?? null) !== JSON.stringify(latest?.decision ?? null)) throw new Error(`Review publication is stale: ${row.id}`);
    if (row.review?.placement === 'accepted') {
      const target = source.records.find((candidate: any) => candidate.id === row.review.targetId);
      if (!target || target.buildingId !== row.renderBuildingId) throw new Error(`Invalid reviewed placement: ${row.id}`);
      for (const field of ['shopfront', 'awning', 'roofShape', 'facadeTop']) {
        if (row.effectiveProposal?.[field] !== (row.review[field] ?? 'unknown')) throw new Error(`Review not applied: ${row.id}/${field}`);
      }
    }
    const target = row.review?.placement === 'accepted' ? source.records.find((candidate: any) => candidate.id === row.review.targetId) : original;
    const targetBuilding = block.buildings.find((candidate: any) => candidate.id === target?.buildingId);
    if (!targetBuilding || row.renderBuildingId !== target.buildingId ||
        JSON.stringify(row.renderSurfaceIndices) !== JSON.stringify(surfaceMatches(targetBuilding, target))) throw new Error(`Stale render wall binding: ${row.id}`);
  }
  for (const [file, hash] of imagePins) if (sha256(await fs.readFile(file)) !== hash) throw new Error(`Source pixels changed: ${file}`);
  const compiled = compileBlockAppearance(block, evidence);
  const sourceHashes = Object.fromEntries(Object.entries({ block: config.blockPath, evidence: config.evidencePath,
    manifest: manifestPath, aerial: aerialPath, reviews: reviewsPath }).map(([key, file]) => [key, pins.get(file)!.hash]));
  const compilerFiles = [new URL('./publish-demo.ts', import.meta.url), new URL('./compile-block-tiles.ts', import.meta.url),
    new URL('../../src/canalRecall/cityAppearanceTiles.ts', import.meta.url),
    new URL('../../public/canal-drive/da-costa-block/evidence.js', import.meta.url),
    new URL('../da-costa-block/review-dependencies.mjs', import.meta.url)];
  const compilerHash = sha256(encode(await Promise.all(compilerFiles.map(async file => sha256(await fs.readFile(file))))));
  const releaseId = sha256(encode({ version: 1, sourceHashes, compilerHash }));
  const base = `${config.publicBase}/releases/${releaseId}`;
  // Do not load buildings twice or transport authored landmark overrides as discoveries.
  const context = { ...block, buildings: [], anchors: [], references: [] };
  const artifacts = new Map<string, Buffer>([['context.json', encode(context)]]);
  const tiles = compiled.tiles.map(tile => {
    const relative = `tiles/${tile.key}.json`, bytes = encode(tile); artifacts.set(relative, bytes);
    return { key: tile.key, url: `${base}/${relative}`, bytes: bytes.length, sha256: sha256(bytes), owners: tile.owners.length, haloReferences: tile.halo.length };
  });
  const manifest = {
    version: 1, releaseId, publication: 'experimental-demo', zoom: compiled.zoom,
    sourceHashes, compilerHash, evidenceRevision: source.evidenceRevision ?? evidence.sourceHash,
    reviewed: evidence.records.filter((row: any) => row.review).length,
    accepted: evidence.records.filter((row: any) => row.review?.placement === 'accepted').length,
    followups: evidence.records.filter((row: any) => row.review?.placement === 'crop-repair' || row.review?.notes?.trim())
      .map((row: any) => ({ id: row.id, evidenceKey: row.evidenceKey,
        reason: row.review.placement === 'crop-repair' ? 'crop-repair' : 'human-note-needs-triage', notes: row.review.notes ?? '' })),
    followupCount: evidence.records.filter((row: any) => row.review?.placement === 'crop-repair' || row.review?.notes?.trim()).length,
    buildings: compiled.buildings, observations: compiled.observations, stats: evidence.stats,
    context: { url: `${base}/context.json`, sha256: sha256(artifacts.get('context.json')!) },
    tileList: tiles.map(tile => tile.key), tiles,
    sourceAudit: { imageFiles: imagePins.size, verified: true },
    policy: 'Source-bound experimental appearance, not calibrated citywide truth. Unknowns and review status preserved; canonical roof geometry unchanged.',
    downloads: 0, paidCalls: 0,
  };
  artifacts.set('manifest.json', encode(manifest));
  if (options.dryRun) return manifest;
  const outputRoot = path.resolve(config.outputRoot);
  await fs.mkdir(path.join(outputRoot, 'releases'), { recursive: true });
  const lock = await fs.open(path.join(outputRoot, '.publish.lock'), 'wx');
  try {
    // Refuse mixed generations if a human saved while the expensive audit ran.
    for (const [file, pinned] of pins) {
      const bytes = await optionalBytes(file);
      if ((bytes ? sha256(bytes) : null) !== pinned.hash) throw new Error(`Input changed during publication: ${file}`);
    }
    const releaseRoot = path.join(outputRoot, 'releases', releaseId);
    for (const [relative, bytes] of artifacts) {
      const file = path.join(releaseRoot, relative);
      await fs.mkdir(path.dirname(file), { recursive: true });
      try { await fs.writeFile(file, bytes, { flag: 'wx' }); }
      catch (error: any) { if (error.code !== 'EEXIST' || sha256(await fs.readFile(file)) !== sha256(bytes)) throw error; }
    }
    const temp = path.join(outputRoot, `current-${process.pid}-${releaseId}.tmp`);
    await fs.writeFile(temp, encode(manifest), { flag: 'wx' });
    await fs.rename(temp, path.join(outputRoot, 'current.json'));
    return manifest;
  } finally { await lock.close(); await fs.unlink(path.join(outputRoot, '.publish.lock')); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const flag = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const options = { ...Object.fromEntries([['blockPath','block'],['evidencePath','evidence'],['evidenceRoot','root'],['outputRoot','out'],['publicBase','public-base']]
    .flatMap(([key, name]) => flag(name) ? [[key, flag(name)]] : [])), dryRun: process.argv.includes('--dry-run') };
  (process.argv.includes('--status') ? demoPublicationStatus(options) : publishDemo(options))
    .then(manifest => console.log(JSON.stringify(manifest, null, 2)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
