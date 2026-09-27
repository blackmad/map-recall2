import assert from 'node:assert/strict';
import test from 'node:test';
import {buildRoofRepair, clipMeshToRear, skylineFromRgba, type Mesh} from './headOnRoofRepair';

test('roof skyline rejects a narrow isolated spike while keeping a broad gable', () => {
  const width = 96, height = 60;
  const rgba = new Uint8Array(width * height * 4).fill(255);
  for (let x = 0; x < width; x++) {
    const top = x >= 30 && x <= 65 ? 12 : x === 5 ? 2 : 30;
    for (let y = top; y < height; y++) {
      const offset = (y * width + x) * 4;
      rgba[offset] = rgba[offset + 1] = rgba[offset + 2] = 80;
    }
  }
  const profile = skylineFromRgba(rgba, width, height, 4, 95);
  assert.ok(profile[5] >= 25, 'isolated spike should not become a roof peak');
  assert.ok(profile[45] <= 14, 'broad gable must survive');
});

test('front clipping preserves rear triangle geometry and rejects the frontage', () => {
  const mesh: Mesh = {id: 'wall', buildingId: 'a', kind: 'wall', positions: [-1, 0, 0, 1, 0, 0, -1, 4, 0], indices: [0, 1, 2], textured: false};
  const clipped = clipMeshToRear(mesh, [1, 0], 0.5);
  assert.ok(clipped);
  assert.ok(clipped.indices.length >= 3);
  for (let i = 0; i < clipped.positions.length; i += 3) assert.ok(clipped.positions[i] <= -0.5 + 1e-4);
  assert.equal(clipMeshToRear(mesh, [1, 0], 2), null);
});

test('repair keeps the source mesh and joins an actual rear BAG roof', () => {
  const wall: Mesh = {id: 'wall', buildingId: 'target', kind: 'wall', positions: [-5, 0, 0, 5, 0, 0, 5, 8, 0, -5, 8, 0], indices: [0, 1, 2, 0, 2, 3], textured: false};
  const roof: Mesh = {id: 'roof', buildingId: 'target', kind: 'roof', positions: [-5, 8, 0, 5, 8, 0, 5, 10, -8, -5, 10, -8], indices: [0, 1, 2, 0, 2, 3], textured: false};
  const original = [wall, roof];
  const repair = buildRoofRepair({meshes: original, plane: {start: {x: -5, y: 0}, end: {x: 5, y: 0}, baseZ: 0, topZ: 12},
    crop: [0, 0, 100, 100], contextSize: [100, 100], originRD: [0, 0, 0], cameraPosition: [0, 8, 20],
    imageWidth: 100, imageHeight: 100, skylineY: [20, 20, 10, 20, 20], setbackM: 2});
  assert.deepEqual(original, [wall, roof], 'original BAG variant must remain untouched');
  assert.equal(repair.stats.roofJoinSamples, 5);
  assert.equal(repair.stats.roofFallbackSamples, 0);
  const apron = repair.meshes.find(mesh => mesh.id === 'generated:roof-apron');
  const shell = repair.meshes.find(mesh => mesh.id === 'generated:front-shell');
  assert.ok(apron && shell);
  assert.equal(shell.textured, true);
  assert.equal(apron.positions[5], -2, 'back apron edge lies two metres behind the frontage');
  assert.ok(repair.meshes.some(mesh => mesh.id === 'roof:rear'), 'original rear roof remains');
});
