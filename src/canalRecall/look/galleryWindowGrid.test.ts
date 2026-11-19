import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { applyWindowGrids, patchWindowGridShader, wantsWindowGrid } from './galleryWindowGrid.ts';

// Feedback 13fa7f: the building page drew Politiepost IJburg's unphotographed walls bare although the ride paints windows.
test('only window-grid walls on a brick/stucco/stone cell take the grid', () => {
  assert.equal(wantsWindowGrid({ materialSlot: 'stucco', windowGrid: true }), true);
  assert.equal(wantsWindowGrid({ materialSlot: 'brick', windowGrid: true }), true);
  assert.equal(wantsWindowGrid({ materialSlot: 'stucco' }), false);
  assert.equal(wantsWindowGrid({ materialSlot: 'glass', windowGrid: true }), false);
  assert.equal(wantsWindowGrid(undefined), false);
});

test('the shader patch declares the varying, writes it from the uv and calls the grid after the colour', () => {
  const shader = {
    vertexShader: '#include <common>\nvoid main(){\n#include <begin_vertex>\n}',
    fragmentShader: '#include <common>\nvoid main(){\n#include <color_fragment>\n}',
  };
  assert.equal(patchWindowGridShader(shader), true);
  assert.match(shader.vertexShader, /varying vec2 vGridM;[\s\S]*vGridM = uv;/);
  assert.match(shader.fragmentShader, /void cityWindowGrid\(vec2 m/);
  assert.ok(shader.fragmentShader.indexOf('cityWindowGrid(vGridM') > shader.fragmentShader.indexOf('#include <color_fragment>'));
  assert.equal(patchWindowGridShader({ vertexShader: 'x', fragmentShader: 'y' }), false);
});

test('the installed Politiepost IJburg GLB has window-grid walls, and a scene walk patches each shared material once', () => {
  const glb = fs.readFileSync('public/canal-drive/models/ordinary-buildings/recipe-large-politiepost-ijburg.glb');
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as { materials: { extras?: unknown }[] };
  const grid = json.materials.filter(m => wantsWindowGrid(m.extras));
  assert.ok(grid.length >= 1, 'the IJburg block keeps at least one window-grid wall material');
  const shared = { userData: { materialSlot: 'stucco', windowGrid: true } as Record<string, unknown> };
  const plain = { userData: { materialSlot: 'glass' } as Record<string, unknown> };
  const meshes = [{ material: shared }, { material: [shared, plain] }];
  const root = { traverse: (fn: (o: object) => void) => meshes.forEach(fn) };
  assert.equal(applyWindowGrids(root), 1);
  assert.equal(applyWindowGrids(root), 0);
  assert.equal(typeof (shared as { onBeforeCompile?: unknown }).onBeforeCompile, 'function');
  assert.equal((plain as { onBeforeCompile?: unknown }).onBeforeCompile, undefined);
});
