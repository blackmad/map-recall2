/**
 * Named regression for the Museumkwartier point-cloud façade spike.
 *
 * Pins the measured facts that the geometry layer relies on: the municipal MLS
 * tile decodes in RD/NAP, street façades are well covered, and the point cloud
 * resolves a shaped roofline that 3DBAG does not carry. Skipped, with a clear
 * message, when the demo tile is not cached.
 */
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { SHAPED_ROOFLINE_RANGE, isWellScanned, measureTile } from './measure-tile.ts';

const tilePath = path.resolve(process.argv.find((value) => value.startsWith('--tile='))?.slice(7) || '.cache/pointcloud/filtered_2397_9705.laz');
try {
  await access(tilePath);
} catch {
  process.stdout.write(`Point-cloud geometry regression skipped: ${tilePath} is not cached.\n`);
  process.exit(0);
}

const { tile, buildings, measurements } = await measureTile(tilePath);
const scanned = measurements.filter(isWellScanned);
const shaped = scanned.filter((measurement) => measurement.shapedRoofline);

assert.ok(tile.count > 10_000_000, `tile decodes to millions of points, got ${tile.count}`);
assert.ok(Math.abs(tile.bounds.minX - 119850) < 1 && Math.abs(tile.bounds.minY - 485250) < 1, 'tile bbox is the expected RD window');
assert.ok(tile.bounds.minZ < 0 && tile.bounds.maxZ > 20, 'tile is in NAP (below and above street level)');
assert.ok(buildings >= 10, `3DBAG returns the tile's buildings, got ${buildings}`);
assert.ok(scanned.length >= 15, `at least 15 street façades are well-scanned, got ${scanned.length}`);
assert.ok(shaped.length >= 5, `at least 5 street façades have a shaped roofline, got ${shaped.length}`);
assert.ok(
  shaped.every((measurement) => measurement.rooflineRange > SHAPED_ROOFLINE_RANGE),
  'shaped rooflines exceed the shape threshold',
);

// Smoothing may lower a measured top but must never raise it above the raw envelope.
for (const measurement of measurements) {
  const rawTop = measurement.measured.rawProfile.length ? Math.max(...measurement.measured.rawProfile.map((point) => point[1])) : -Infinity;
  const smoothTop = measurement.measured.profile.length ? Math.max(...measurement.measured.profile.map((point) => point[1])) : -Infinity;
  assert.ok(smoothTop <= rawTop + 1e-9, `smoothed roofline never exceeds the raw envelope for ${measurement.surfaceId}`);
}

// The pinned gable: a bell/neck gable resolved on the Museumkwartier façade.
const gable = measurements.find((measurement) => measurement.surfaceId.includes('0363100012161771') && measurement.surfaceId.endsWith(':23'));
assert.ok(gable, 'the pinned gable wall is present');
assert.ok(gable!.silhouetteVertices >= 10, `pinned gable keeps a shaped outline, got ${gable!.silhouetteVertices} vertices`);
assert.ok(gable!.rooflineRange > 1.5, `pinned gable has a measured range, got ${gable!.rooflineRange.toFixed(2)} m`);
assert.ok(gable!.coverage >= 0.9, `pinned gable façade is fully scanned, got ${gable!.coverage.toFixed(2)}`);
assert.equal(gable!.rooflineShape, 'shaped', 'the pinned gable is non-monotonic, not a plain slope');

// The second demo tile independently reproduces the result. "Is it cached?" is
// resolved before the assertions, so a failed Willemspark assertion fails the
// process instead of being reported as a skip.
const secondTile = path.resolve(process.argv.find((value) => value.startsWith('--tile2='))?.slice(8) || '.cache/pointcloud/filtered_2386_9702.laz');
let secondCached = true;
try {
  await access(secondTile);
} catch {
  secondCached = false;
}
if (secondCached) {
  const willemspark = await measureTile(secondTile);
  const scanned2 = willemspark.measurements.filter(isWellScanned);
  const shaped2 = scanned2.filter((measurement) => measurement.rooflineShape === 'shaped');
  assert.ok(scanned2.length >= 30, `Willemspark has at least 30 scanned walls, got ${scanned2.length}`);
  assert.ok(shaped2.length >= 4, `Willemspark has at least 4 shaped rooflines, got ${shaped2.length}`);
  process.stdout.write(`Willemspark: ${scanned2.length} scanned walls, ${shaped2.length} shaped rooflines.\n`);
} else {
  process.stdout.write(`Willemspark tile ${secondTile} is not cached; second-tile check skipped.\n`);
}

process.stdout.write(`Point-cloud geometry regression passed: ${scanned.length} scanned walls, ${shaped.length} shaped rooflines, gable range ${gable!.rooflineRange.toFixed(2)} m.\n`);
