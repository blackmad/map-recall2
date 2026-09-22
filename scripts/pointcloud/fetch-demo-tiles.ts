/**
 * Fetch the two UPCP demo tiles into `.cache/pointcloud/`, reproducibly.
 *
 * The tiles are the Amsterdam AI Team's "Urban PointCloud Processing" demo
 * dataset (Gemeente Amsterdam puntenwolk, 50 × 50 m municipal MLS tiles in
 * RD/NAP). The city-wide host is NXDOMAIN, so these pinned raw URLs are the only
 * reproducible source. The sha256 is checked while streaming and a mismatch
 * deletes the file and exits non-zero: a different file is never accepted.
 *
 * Usage:
 *   npx tsx scripts/pointcloud/fetch-demo-tiles.ts
 *   npx tsx scripts/pointcloud/fetch-demo-tiles.ts --out=/tmp/tiles
 */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

type DemoTile = {
  name: string;
  url: string;
  sha256: string;
  bytes: number;
};

const REPOSITORY = 'https://github.com/Amsterdam-AI-Team/Urban_PointCloud_Processing';
const RAW_BASE = 'https://raw.githubusercontent.com/Amsterdam-AI-Team/Urban_PointCloud_Processing/main/datasets/pointcloud';

/**
 * Manifest hashes as published in `public/data/pointcloud-facades/v1/<tile>/manifest.json`.
 * Verified 2026-09-22 with HTTP HEAD (200, matching content-length) and by
 * hashing the downloaded bytes.
 */
export const DEMO_TILES: readonly DemoTile[] = [
  {
    name: 'filtered_2397_9705',
    url: `${RAW_BASE}/filtered_2397_9705.laz`,
    sha256: '7935f0d7803e252b763d8c154cd444775086085192eeef758c14026cb0f61a7c',
    bytes: 71_199_947,
  },
  {
    name: 'filtered_2386_9702',
    url: `${RAW_BASE}/filtered_2386_9702.laz`,
    sha256: '4aaa1a290d92a710998ed927a2216fa1f759a31be21629a91077a109c8da7cf2',
    bytes: 42_939_972,
  },
];

const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const outputDir = path.resolve(argument('out') || '.cache/pointcloud');

const sha256File = async (file: string) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
};

const exists = async (file: string) => {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
};

/** Stream a URL to `destination`, returning the sha256 and byte count of what was written. */
const download = async (url: string, destination: string) => {
  const response = await fetch(url, { headers: { 'User-Agent': 'MapRecallPointCloudFetch/1.0' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  if (!response.body) throw new Error(`no response body for ${url}`);
  const hash = createHash('sha256');
  let bytes = 0;
  const digest = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      bytes += chunk.byteLength;
      callback(null, chunk);
    },
  });
  const temporary = `${destination}.part`;
  try {
    await pipeline(Readable.fromWeb(response.body as never), digest, createWriteStream(temporary));
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return { sha256: hash.digest('hex'), bytes, temporary };
};

await mkdir(outputDir, { recursive: true });

let downloaded = 0;
let skipped = 0;
for (const tile of DEMO_TILES) {
  const destination = path.join(outputDir, `${tile.name}.laz`);
  if (await exists(destination)) {
    const sha256 = await sha256File(destination);
    if (sha256 === tile.sha256) {
      process.stdout.write(`${tile.name}.laz already cached with the expected hash; skipping.\n`);
      skipped += 1;
      continue;
    }
    process.stdout.write(`${tile.name}.laz has sha256 ${sha256}, not the manifest hash; refetching.\n`);
    await rm(destination, { force: true });
  }
  process.stdout.write(`Fetching ${tile.name}.laz from ${REPOSITORY} (${(tile.bytes / 1e6).toFixed(1)} MB)…\n`);
  const { sha256, bytes, temporary } = await download(tile.url, destination);
  if (sha256 !== tile.sha256 || bytes !== tile.bytes) {
    await rm(temporary, { force: true });
    throw new Error(
      `${tile.name}.laz did not match the manifest: expected sha256 ${tile.sha256} / ${tile.bytes} bytes, got sha256 ${sha256} / ${bytes} bytes. Deleted the download.`,
    );
  }
  await rename(temporary, destination);
  process.stdout.write(`${tile.name}.laz verified (${tile.sha256.slice(0, 12)}…, ${bytes} bytes).\n`);
  downloaded += 1;
}

process.stdout.write(`Point-cloud demo tiles ready in ${outputDir}: ${downloaded} fetched, ${skipped} cached.\n`);
