/**
 * Publish the staged LoD1 city into the versioned extract.
 *
 * Everything upstream of this writes to `staging/` and reports what it found;
 * this is the one step that changes what the game serves, and it is separate
 * because 15 MB of generated data across 382 files is a decision someone makes,
 * not a side effect of a build.
 *
 * It refuses rather than guesses. A staging directory that does not match its
 * own index, or that is missing tiles the index names, means a build was
 * interrupted, and half a city is worse than none — the missing tiles would
 * read as holes in the map rather than as an error.
 *
 * Usage:
 *   npm run publish:lod1-city                # report what would change
 *   npm run publish:lod1-city -- --confirm   # actually publish
 */

import { cp, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const flag = (name: string): string | undefined =>
  process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const city = flag('city') ?? 'amsterdam';
const confirm = process.argv.includes('--confirm');

const extractDir = path.join('public', 'data', 'extracts', city);
const stagedDir = path.join(extractDir, 'staging', 'building-tiles');
const publishedDir = path.join(extractDir, 'building-tiles');

const indexes = (await readdir(stagedDir).catch(() => [] as string[])).filter(name => /^index-z\d+\.json$/.test(name));
if (indexes.length !== 1) {
  process.stderr.write(
    indexes.length === 0
      ? `no built tiles in ${stagedDir} — run \`npm run build:lod1-tiles\` first\n`
      : `${stagedDir} holds ${indexes.length} zoom levels (${indexes.join(', ')}); leave only the one to publish\n`
  );
  process.exit(1);
}

const index = JSON.parse(await readFile(path.join(stagedDir, indexes[0]), 'utf8')) as {
  city: string; zoom: number; features: number; tiles: number; tileList: string[]; totalGzipBytes: number;
};

// --- verify before touching anything -----------------------------------------
const missing: string[] = [];
let bytes = 0;
for (const tile of index.tileList) {
  const [, x, y] = tile.split('/');
  const file = path.join(stagedDir, String(index.zoom), x, `${y}.geojson`);
  const found = await stat(file).catch(() => null);
  if (!found) missing.push(tile);
  else bytes += found.size;
}
if (missing.length > 0) {
  process.stderr.write(`${missing.length} tiles named by the index are missing, e.g. ${missing.slice(0, 5).join(', ')}\n`);
  process.stderr.write('Rebuild before publishing; a partial city reads as holes in the map, not as an error.\n');
  process.exit(1);
}
if (index.city !== city) {
  process.stderr.write(`the staged index is for ${index.city}, not ${city}\n`);
  process.exit(1);
}

const existing = await stat(publishedDir).catch(() => null);
const previous = existing ? (await readdir(path.join(publishedDir, String(index.zoom))).catch(() => [] as string[])).length : 0;

process.stdout.write(`publish ${city} LoD1 city\n`);
process.stdout.write(`  from          ${stagedDir}\n`);
process.stdout.write(`  to            ${publishedDir}\n`);
process.stdout.write(`  zoom          z${index.zoom}\n`);
process.stdout.write(`  tiles         ${index.tiles}, all present\n`);
process.stdout.write(`  buildings     ${index.features}\n`);
process.stdout.write(`  size          ${(bytes / 1e6).toFixed(0)} MB raw, ${(index.totalGzipBytes / 1e6).toFixed(0)} MB gzipped\n`);
process.stdout.write(`  replaces      ${existing ? `an existing ${previous}-column tree` : 'nothing — this is the first publish'}\n`);

if (!confirm) {
  process.stdout.write('\nNothing written. Re-run with --confirm to publish.\n');
  process.exit(0);
}

// A stale tile left behind from an earlier, differently-tiled vintage would be
// served forever, because nothing ever asks for it again.
if (existing) await rm(publishedDir, { recursive: true, force: true });
await cp(stagedDir, publishedDir, { recursive: true });
process.stdout.write(`\nPublished. \`npm run test:e2e -- complete-city\` now exercises it instead of skipping.\n`);
