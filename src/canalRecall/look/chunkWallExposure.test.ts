// node --import tsx --test src/canalRecall/look/chunkWallExposure.test.ts
// Street-chunk walls at the sunny look's exposure (docs/chunk-brightness-20261016.md). Named regressions: the five faces
// measured by the chunk-look lane (Nassaukade 318 row nassau-162289, Marnixstraat marnix-c, Utrechtsestraat 48-76,
// Oudezijds Voorburgwal 115-125, Bilderdijkstraat 135-153 bilder-236022-167243).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHUNK_WALL_EXPOSURE_DATA } from './chunkWallExposureData.ts';
import { CHUNK_WALL_GAIN_RANGE, PHOTO_MATCHED_SLOTS, chunkWallExposure, chunkWallGain, photoMatchedWallTint } from './chunkWallExposure.ts';
import { FALLBACK_WALL_GAIN } from './measuredWhitePoints.ts';
import { measuredWallGain, sceneSlotHex, srgbToLinear, sunlitMeasuredWall } from './sunny.ts';
import { cityTint, hexToRgb } from './palette.ts';
import { slotForMaterial, slotTintBytes } from './cityLook.ts';
import { chunkSpecFor } from '../landmarks/ordinaryChunks.ts';

const luma = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const linLuma = (hex: string) => luma(hexToRgb(hex).map(srgbToLinear));
const manifest = JSON.parse(fs.readFileSync('public/canal-drive/ordinary-buildings-data/chunks.json', 'utf8'));
const MEASURED_FACES = ['face-nassau-162289', 'face-marnix-c', 'face-utrechtse-48-76', 'face-wallen-ozv-115-125', 'face-bilder-236022-167243'];

test('every installed block-face chunk has its strip exposure measured (rerun build-chunk-wall-exposure.ts after an install)', () => {
  for (const c of manifest.chunks as { name: string }[]) {
    const face = c.name.replace(/^face-/, '');
    if (!c.name.startsWith('face-') || !fs.existsSync(`scripts/block-face/faces/${face}/strip.json`)) continue;
    assert.ok(CHUNK_WALL_EXPOSURE_DATA[c.name], `${c.name}: no entry in chunkWallExposureData.ts`);
  }
  for (const name of MEASURED_FACES) assert.ok(CHUNK_WALL_EXPOSURE_DATA[name]?.white, `${name}: strip white measured`);
});

test('chunk wall gain: strip white to a sunlit white, times strip over drawn; fallback without a record; bounded', () => {
  assert.equal(chunkWallGain(undefined), FALLBACK_WALL_GAIN);
  assert.equal(chunkWallGain({ white: null, stripOverDrawn: null }), FALLBACK_WALL_GAIN);
  assert.equal(chunkWallGain({ white: [181, 181, 181], stripOverDrawn: null }), measuredWallGain([181, 181, 181]));
  assert.ok(Math.abs(chunkWallGain({ white: '#b5b5b5', stripOverDrawn: 1.2 }) - measuredWallGain([181, 181, 181]) * 1.2) < 1e-12);
  assert.equal(chunkWallGain({ white: [181, 181, 181], stripOverDrawn: 9 }), CHUNK_WALL_GAIN_RANGE[1]);
  assert.equal(chunkWallGain({ white: [181, 181, 181], stripOverDrawn: 0.01 }), CHUNK_WALL_GAIN_RANGE[0]);
  // The faces matched to an overcast strip brighten; Bilderdijkstraat 135-153, lifted 1.44x over its strip by eye, darkens.
  for (const name of MEASURED_FACES.slice(0, 4)) assert.ok(chunkWallGain(chunkWallExposure(name)) > 1.1, name);
  assert.ok(chunkWallGain(chunkWallExposure('face-bilder-236022-167243')) < 0.7);
});

test('photo-matched wall tint: walls only, sunny only, measured tints and models without an exposure unchanged', () => {
  const ozv = chunkWallExposure('face-wallen-ozv-115-125'), drawn = cityTint('brick', '#36302e');
  const lifted = photoMatchedWallTint('brick', drawn, ozv, null, 'sunny');
  assert.ok(Math.abs(linLuma(lifted) / linLuma(drawn) - chunkWallGain(ozv)) < 0.03, `ozv brick ${drawn} -> ${lifted}`);
  for (const slot of ['frame', 'glass', 'door', 'stone', 'roofTile', 'slate']) assert.equal(photoMatchedWallTint(slot, '#7a5a42', ozv, null, 'sunny'), '#7a5a42', slot);
  assert.deepEqual([...PHOTO_MATCHED_SLOTS], ['brick', 'accent', 'stucco']);
  assert.equal(photoMatchedWallTint('brick', drawn, ozv, null, 'legacy'), drawn, 'legacy look untouched');
  assert.equal(photoMatchedWallTint('brick', drawn, ozv, 'measured', 'sunny'), drawn, 'a measured tint carries its own white');
  assert.equal(photoMatchedWallTint('brick', drawn, null, null, 'sunny'), drawn, 'no exposure: byte-identical');
  // A white wall does not clip into another hue: it saturates at white.
  assert.match(photoMatchedWallTint('stucco', '#f4f0e8', { white: [150, 150, 150], stripOverDrawn: 2 }, null, 'sunny'), /^#f[0-9a-f]f[0-9a-f]f[0-9a-f]$/);
});

test('chunk specs carry the exposure: every chunk, the house chunks on the fallback', () => {
  for (const c of manifest.chunks) {
    const spec = chunkSpecFor(c);
    assert.ok(spec.wallExposure, c.name);
    assert.deepEqual(spec.wallExposure, chunkWallExposure(c.name));
  }
  assert.deepEqual(chunkWallExposure('bilder-079721-x2'), { white: null, stripOverDrawn: null });
});

test('a measured tint takes the white it carries (tintWhitePoint), not a white found by matching its hex', () => {
  // Kinkerstraat 31 (wallFidelity.test.ts): #282b24 painted brick read under #a1a698.
  assert.equal(sceneSlotHex('brick', '#282b24', 'measured', 'sunny', '#a1a698'), sunlitMeasuredWall('#282b24', [161, 166, 152]));
  assert.notEqual(sceneSlotHex('brick', '#282b24', 'measured', 'sunny', '#a1a698'), sceneSlotHex('brick', '#282b24', 'measured', 'sunny'));
  assert.equal(sceneSlotHex('brick', '#282b24', 'measured', 'sunny', null), sceneSlotHex('brick', '#282b24', 'measured', 'sunny'), 'no white: as before');
  assert.equal(sceneSlotHex('brick', '#282b24', 'measured', 'legacy', '#a1a698'), '#282b24');
  // The city look reads the extra and applies it.
  const found = slotForMaterial({ userData: { materialSlot: 'brick', tint: '#282b24', tintSource: 'measured', tintWhitePoint: '#a1a698' } }, false);
  assert.equal(found?.white, '#a1a698');
  assert.notDeepEqual(slotTintBytes('brick', '#282b24', 'measured', 'sunny', found?.white), slotTintBytes('brick', '#282b24', 'measured', 'sunny'));
  // ... and a chunk's exposure on an unmeasured wall.
  const ozv = chunkWallExposure('face-wallen-ozv-115-125');
  assert.ok(luma(slotTintBytes('brick', '#36302e', null, 'sunny', null, ozv)) > luma(slotTintBytes('brick', '#36302e', null, 'sunny')));
  assert.deepEqual(slotTintBytes('brick', '#36302e', null, 'sunny', null, null), slotTintBytes('brick', '#36302e', null, 'sunny'));
});

test('region mask discards suppressed facade vertices the way the lit facade material does', () => {
  const mask = fs.readFileSync('scripts/look/region-mask.js', 'utf8'), facade = fs.readFileSync('src/canalRecall/rendererShared/litFacadeMaterial.ts', 'utf8');
  const discard = 'if (hidden > 0.5 && hidden < 1.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);';
  assert.ok(facade.includes(discard), 'litFacadeMaterial VERTEX_HIDE changed: update region-mask.js HIDDEN_DISCARD');
  assert.ok(mask.includes(discard) && mask.includes('attribute float hidden;'), 'region-mask.js applies the hidden discard');
});
