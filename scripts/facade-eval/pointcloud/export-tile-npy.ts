/**
 * Export a demo LAZ tile to the UnderOneFacade (N, 8) float32 `.npy` input
 * format: [X, Y, Z, R, G, B, Intensity, Label], labels 1-indexed (0 = unknown).
 *
 * This is step 2 of the DGCNN lane: the point-cloud decoder already lives in
 * `scripts/pointcloud/load-laz-tile.ts` (float64 positions, auto colour depth),
 * so we reuse it rather than add a second LAZ reader in Python. DGCNN with
 * `--features xyz` reads only columns 0-2, but the (N, 8) layout is the fixed
 * interchange format the upstream code documents.
 *
 * Usage:
 *   npx tsx scripts/facade-eval/pointcloud/export-tile-npy.ts \
 *     --tile=.cache/pointcloud/filtered_2397_9705.laz \
 *     --out=.cache/facade-eval/dgcnn/tiles/filtered_2397_9705.npy
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadLazTile } from '../../pointcloud/load-laz-tile.ts';

const argument = (name: string) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

const tilePath = path.resolve(argument('tile') || '.cache/pointcloud/filtered_2397_9705.laz');
const outPath = path.resolve(
  argument('out') || `.cache/facade-eval/dgcnn/tiles/${path.basename(tilePath).replace(/\.laz$/, '')}.npy`,
);

/** Write a C-order `.npy` v1.0 file. `data` is already little-endian for our types. */
const encodeNpy = (data: Uint8Array, descr: string, shape: readonly number[]): Buffer => {
  const shapeText = shape.length === 1 ? `(${shape[0]},)` : `(${shape.join(', ')})`;
  const dict = `{'descr': '${descr}', 'fortran_order': False, 'shape': ${shapeText}, }`;
  let header = dict;
  while ((10 + header.length + 1) % 64 !== 0) header += ' ';
  header += '\n';
  const prefix = Buffer.alloc(10);
  Buffer.from([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 0x01, 0x00]).copy(prefix, 0);
  prefix.writeUInt16LE(header.length, 8);
  return Buffer.concat([prefix, Buffer.from(header, 'latin1'), Buffer.from(data)]);
};

const tile = await loadLazTile(tilePath);
const count = tile.count;
const features = new Float32Array(count * 8);
for (let index = 0; index < count; index += 1) {
  features[index * 8] = tile.positions[index * 3];
  features[index * 8 + 1] = tile.positions[index * 3 + 1];
  features[index * 8 + 2] = tile.positions[index * 3 + 2];
  features[index * 8 + 3] = tile.colours ? tile.colours[index * 3] : 0;
  features[index * 8 + 4] = tile.colours ? tile.colours[index * 3 + 1] : 0;
  features[index * 8 + 5] = tile.colours ? tile.colours[index * 3 + 2] : 0;
  features[index * 8 + 6] = tile.intensities ? tile.intensities[index] : 0;
  features[index * 8 + 7] = 0;
}
const hasColours = tile.colours !== null;
const hasIntensity = tile.intensities !== null;

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, encodeNpy(new Uint8Array(features.buffer), '<f4', [count, 8]));
const metaPath = `${outPath}.meta.json`;
await writeFile(metaPath, `${JSON.stringify({
  schemaVersion: 1,
  kind: 'facade-eval/dgcnn-tile-input',
  source: tilePath,
  sha256: tile.sha256,
  bytes: tile.bytes,
  points: count,
  columns: ['X', 'Y', 'Z', 'R', 'G', 'B', 'Intensity', 'Label'],
  hasColours,
  hasIntensity,
  bounds: tile.bounds,
  npy: outPath,
}, null, 2)}\n`);

process.stdout.write([
  `tile ${tilePath}`,
  `  sha256 ${tile.sha256}`,
  `  points ${count.toLocaleString()} (colours=${hasColours}, intensity=${hasIntensity})`,
  `  bounds x[${tile.bounds.minX.toFixed(2)}, ${tile.bounds.maxX.toFixed(2)}] y[${tile.bounds.minY.toFixed(2)}, ${tile.bounds.maxY.toFixed(2)}] z[${tile.bounds.minZ.toFixed(2)}, ${tile.bounds.maxZ.toFixed(2)}]`,
  `wrote ${outPath}`,
  `wrote ${metaPath}`,
].join('\n') + '\n');
