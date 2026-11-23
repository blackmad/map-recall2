// node --import tsx --test src/canalRecall/look/chunkWallExposureBuild.test.ts
// build-chunk-wall-exposure.ts kept stopping on one bad strip (2026-11-22: bellamyplein-18-38-r1's archived strip was a
// 1101 px crop under 2203 px spans, "RangeError: Invalid typed array length" in stripPalette.ts). Named regression.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pickStripImage, rebuildExposure, type ExposureEntry} from './chunkWallExposureBuild.ts';
import {measureStripPalette} from '../blockFace/stripPalette.ts';
import {CHUNK_WALL_EXPOSURE_DATA} from './chunkWallExposureData.ts';

const sizes: Record<string, {width: number; height: number}> = {
  'staging/block-face/bellamyplein-18-38-r1/strip.jpg': {width: 2203, height: 755},
  'archive/bellamyplein-18-38-r1/files/strip.jpg': {width: 1101, height: 755},
};
const sizeOf = async (f: string) => sizes[f];

test('pickStripImage skips an image of another size than strip.json (the bellamyplein-18-38-r1 archive crop)', async () => {
  const onlyArchive = await pickStripImage([undefined, 'missing.jpg', 'archive/bellamyplein-18-38-r1/files/strip.jpg'], {width: 2203, height: 755}, sizeOf);
  assert.equal(onlyArchive.file, undefined);
  assert.equal(onlyArchive.rejected.length, 1);
  assert.match(onlyArchive.rejected[0], /1101x755.*2203x755/);
  const both = await pickStripImage(['archive/bellamyplein-18-38-r1/files/strip.jpg', 'staging/block-face/bellamyplein-18-38-r1/strip.jpg'], {width: 2203, height: 755}, sizeOf);
  assert.equal(both.file, 'staging/block-face/bellamyplein-18-38-r1/strip.jpg');
});

// Two fixes for the same stale Bellamyplein strip met on 2026-11-23: pickStripImage skips a wrong-size image here, and
// measureStripPalette (lane/baerle-fix-20261122) now measures nothing for a span past the image instead of throwing.
// The per-face catch in rebuildExposure stays for any other error.
test('a span past a stale strip image measures nothing instead of throwing', () => {
  const rgb = new Uint8Array(1101 * 755 * 3);
  const p = measureStripPalette({rgb, width: 1101, height: 755, x0: 1983, x1: 2203, pixelsPerMetre: 40, eavesM: 14});
  assert.equal(p.wall, null);
});

test('rebuildExposure: a face that throws keeps its published entry; the others are measured', async () => {
  const published: Record<string, ExposureEntry> = {'face-bad': {white: [200, 200, 190], stripOverDrawn: 1.2}, 'face-good': {white: [1, 1, 1], stripOverDrawn: 9}};
  const fresh: ExposureEntry = {white: [210, 205, 200], stripOverDrawn: 1.5};
  const out = await rebuildExposure(['face-good', 'face-bad', 'face-new-bad', 'face-kept', 'house-x'], async name => {
    if (name.endsWith('bad')) throw new RangeError('Invalid typed array length: -880');
    if (name === 'face-kept') return {keep: true, row: `${name}: strip image missing`};
    if (name === 'house-x') return {row: `${name}: no strip`};
    return {entry: fresh, row: `${name}: measured`};
  }, published);
  assert.deepEqual(out.failed, ['face-bad', 'face-new-bad']);
  assert.deepEqual(out.entries['face-good'], fresh);
  assert.deepEqual(out.entries['face-bad'], published['face-bad']);
  assert.ok(!('face-new-bad' in out.entries));
  assert.ok(!('face-kept' in out.entries));
  assert.ok(!('house-x' in out.entries));
  assert.match(out.rows[1], /face-bad: measure failed \(Invalid typed array length: -880\); kept the published entry/);
  assert.match(out.rows[2], /no published entry: fallback gain/);
});

test('bellamyplein-18-38-r1 has a published entry for the build to keep', () => {
  assert.ok(CHUNK_WALL_EXPOSURE_DATA['face-bellamyplein-18-38-r1'] !== undefined);
});
