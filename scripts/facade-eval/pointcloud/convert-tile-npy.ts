/**
 * Convert an Amsterdam MLS (LAZ) tile to the UnderOneFacade input format:
 * a NumPy `.npy` array of shape (N, 8), float32, columns
 * `[X, Y, Z, R, G, B, Intensity, Label]` in the tile's RD/NAP frame.
 *
 * The PTv1 inference script selects sliding windows over this array and
 * replicates the per-scene normalisation from `datasets/facade_dataset.py`
 * (`coords -= mean; coords /= max radius`). Labels are left at 0; inference
 * ignores them.
 *
 * Usage:
 *   npx tsx scripts/facade-eval/pointcloud/convert-tile-npy.ts <tile.laz> <out.npy>
 */
import { open } from 'node:fs/promises';
import { loadLazTile } from '../../pointcloud/load-laz-tile.ts';

const COLUMNS = 8;

/** NumPy v1.0 `.npy` header for a C-contiguous little-endian float32 array. */
export const npyHeader = (rows: number, columns: number): Buffer => {
  const magic = Buffer.from([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59]);
  const version = Buffer.from([1, 0]);
  let dict = `{'descr': '<f4', 'fortran_order': False, 'shape': (${rows}, ${columns}), }`;
  const padding = 64 - ((magic.length + version.length + 2 + dict.length + 1) % 64);
  dict += ' '.repeat(padding) + '\n';
  const headerLength = Buffer.alloc(2);
  headerLength.writeUInt16LE(dict.length, 0);
  return Buffer.concat([magic, version, headerLength, Buffer.from(dict, 'latin1')]);
};

export const convertTile = async (tilePath: string, outPath: string): Promise<void> => {
  const tile = await loadLazTile(tilePath);
  const rows = tile.count;
  const values = new Float32Array(rows * COLUMNS);
  for (let index = 0; index < rows; index += 1) {
    values[index * COLUMNS] = tile.positions[index * 3];
    values[index * COLUMNS + 1] = tile.positions[index * 3 + 1];
    values[index * COLUMNS + 2] = tile.positions[index * 3 + 2];
    if (tile.colours) {
      values[index * COLUMNS + 3] = tile.colours[index * 3];
      values[index * COLUMNS + 4] = tile.colours[index * 3 + 1];
      values[index * COLUMNS + 5] = tile.colours[index * 3 + 2];
    }
    if (tile.intensities) values[index * COLUMNS + 6] = tile.intensities[index];
    values[index * COLUMNS + 7] = 0;
  }
  const handle = await open(outPath, 'w');
  try {
    await handle.write(npyHeader(rows, COLUMNS));
    await handle.write(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
  } finally {
    await handle.close();
  }
  console.log(`wrote ${outPath}: (${rows}, ${COLUMNS}) float32 = ${(rows * COLUMNS * 4 / 1e6).toFixed(1)} MB`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const [tilePath, outPath] = process.argv.slice(2);
  if (!tilePath || !outPath) {
    console.error('usage: convert-tile-npy.ts <tile.laz> <out.npy>');
    process.exit(2);
  }
  await convertTile(tilePath, outPath);
}
