import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, link, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sourceRoot = path.resolve(process.argv.find(value => value.startsWith('--source='))?.slice(9) ?? '../amsterdam-building-twin/.cache/facade-twin');
const targetRoot = path.resolve(process.argv.find(value => value.startsWith('--target='))?.slice(9) ?? '.cache/facade-rebuild/raw/v1');

const records = [
  ['bag-panden.json', 'BAG pand source response', 'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand', 'CC0 1.0 — Kadaster'],
  ['amsterdam-grachtengordel-west-registry.json', 'BAG adapter output', 'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand', 'CC0 1.0 — Kadaster'],
  ['3dbag-attributes.json', '3DBAG source response', 'https://api.3dbag.nl/collections/pand', 'CC BY 4.0 — 3DBAG, TU Delft'],
  ['amsterdam-grachtengordel-west-massing.json', '3DBAG adapter output', 'https://api.3dbag.nl/collections/pand', 'CC BY 4.0 — 3DBAG, TU Delft'],
  ['amsterdam-grachtengordel-west-heritage.json', 'Rijksmonumenten source records', 'https://services.rce.geovoorziening.nl/rce/wfs', 'CC0 / CC BY — Rijksdienst voor het Cultureel Erfgoed'],
  ['amsterdam-grachtengordel-west-semantics.json', 'OpenStreetMap corroboration records', 'https://overpass-api.de/api/interpreter', 'ODbL 1.0 — OpenStreetMap contributors'],
  ['amsterdam-grachtengordel-west-panoramas.json', 'Amsterdam panorama metadata', 'https://api.data.amsterdam.nl/panorama/panoramas/', 'CC BY 4.0 — Gemeente Amsterdam'],
] as const;

const sha256 = async (file: string) => new Promise<string>((resolve, reject) => {
  const hash = createHash('sha256');
  createReadStream(file).on('data', chunk => hash.update(chunk)).on('error', reject).on('end', () => resolve(hash.digest('hex')));
});

const hardLinkOrCopy = async (source: string, target: string) => {
  await mkdir(path.dirname(target), { recursive: true });
  try { await link(source, target); return 'hard-link' as const; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return 'existing' as const;
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
    await copyFile(source, target);
    return 'copy' as const;
  }
};

const metadataPayload = JSON.parse(await readFile(path.join(sourceRoot, 'amsterdam-grachtengordel-west-panoramas.json'), 'utf8')) as {
  retrieved?: string;
  data?: Array<{ panoramaId: string; imageUrl: string }>;
};
const panoramaMetadata = new Map((metadataPayload.data ?? []).map(entry => [entry.panoramaId, entry]));
const manifestEntries: Array<Record<string, unknown>> = [];

for (const [relativePath, kind, sourceUrl, license] of records) {
  const source = path.join(sourceRoot, relativePath);
  const target = path.join(targetRoot, relativePath);
  const sourceStat = await stat(source);
  const mode = await hardLinkOrCopy(source, target);
  manifestEntries.push({
    relativePath, kind, sourceUrl, license, retrievedAt: metadataPayload.retrieved ?? sourceStat.mtime.toISOString(),
    bytes: sourceStat.size, sha256: await sha256(source), materialisation: mode,
  });
}

const panoramaDirectory = path.join(sourceRoot, 'panoramas');
for (const name of (await readdir(panoramaDirectory)).filter(name => name.endsWith('.jpg')).sort()) {
  const panoramaId = name.slice(0, -4);
  const metadata = panoramaMetadata.get(panoramaId);
  if (!metadata) throw new Error(`Original panorama ${name} has no allowlisted metadata record`);
  const source = path.join(panoramaDirectory, name);
  const target = path.join(targetRoot, 'panoramas', name);
  const sourceStat = await stat(source);
  const mode = await hardLinkOrCopy(source, target);
  manifestEntries.push({
    relativePath: `panoramas/${name}`, kind: 'original Amsterdam panorama', sourceUrl: metadata.imageUrl,
    license: 'CC BY 4.0 — Gemeente Amsterdam', retrievedAt: sourceStat.mtime.toISOString(), bytes: sourceStat.size,
    sha256: await sha256(source), materialisation: mode,
  });
}

const manifest = {
  schemaVersion: 1, generatedAt: new Date().toISOString(), sourceRoot, targetRoot,
  policy: 'Allowlisted upstream records and original panoramas only. No rectifications, measurements, textures, labels, review images, or renderer extracts.',
  entries: manifestEntries,
};
await mkdir(targetRoot, { recursive: true });
await writeFile(path.join(targetRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const bytes = manifestEntries.reduce((sum, entry) => sum + Number(entry.bytes), 0);
console.log(`Migrated ${manifestEntries.length} allowlisted files (${(bytes / 1024 ** 3).toFixed(2)} GiB) to ${targetRoot}`);
console.log(`Manifest: ${path.join(targetRoot, 'manifest.json')}`);
