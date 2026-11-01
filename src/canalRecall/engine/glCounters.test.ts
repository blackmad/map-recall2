import assert from 'node:assert/strict';
import test from 'node:test';
import { GlCounters, bufferBytes, objectLabel, stackOwner, textureBytes, trianglesOf } from './glCounters';

function fakeGl() {
  const calls: string[] = [];
  const gl: Record<string, any> = {};
  for (const fn of ['drawArrays', 'drawElements', 'drawElementsInstanced', 'texImage2D', 'texSubImage2D', 'bufferData', 'bufferSubData', 'compileShader', 'linkProgram', 'clear']) {
    gl[fn] = (..._a: unknown[]) => { calls.push(fn); return fn; };
  }
  return { gl, calls };
}

test('triangles per draw mode, instancing multiplies', () => {
  assert.equal(trianglesOf(4, 300), 100);
  assert.equal(trianglesOf(5, 10), 8);
  assert.equal(trianglesOf(1, 100), 0);
  assert.equal(trianglesOf(4, 30, 5), 50);
});

test('upload sizes: typed arrays, image sources, size-only allocations', () => {
  assert.equal(textureBytes([0x0de1, 0, 0x8058, 0x1908, 0x1401, { width: 1024, height: 512 }]), 1024 * 512 * 4);
  assert.equal(textureBytes([0x0de1, 0, 0x8058, 256, 256, 0, 0x1908, 0x1401, new Uint8Array(256 * 256 * 4)]), 262144);
  assert.equal(textureBytes([0x0de1, 0, 0x8058, 64, 32, 0, 0x1908, 0x1401, null]), 64 * 32 * 4);
  assert.equal(bufferBytes('bufferData', [0x8892, new Float32Array(1000), 0x88e4]), 4000);
  assert.equal(bufferBytes('bufferData', [0x8892, 2048, 0x88e4]), 2048);
  assert.equal(bufferBytes('bufferSubData', [0x8892, 0, new Float32Array(1000), 0, 10]), 40);
});

test('counts through the wrapped context, splits at warm-up, keeps large uploads and compiles with owners', () => {
  const { gl, calls } = fakeGl();
  let t = 0, names = ['MeshStandardMaterial#1'];
  const c = new GlCounters({ now: () => t, owner: () => 'owner', programNames: () => names });
  const undo = c.install(gl);
  assert.equal(gl.drawElements(4, 600, 0x1403, 0), 'drawElements', 'the original still runs and returns');
  gl.compileShader({}); gl.linkProgram({});
  gl.bufferData(0x8892, new Uint8Array(2 << 20), 0x88e4);
  c.endFrame();
  t = 10; c.markWarm();
  gl.drawArrays(4, 0, 30); gl.drawElementsInstanced(4, 6, 0x1403, 0, 10);
  gl.texImage2D(0x0de1, 0, 0x8058, 0x1908, 0x1401, { width: 1024, height: 1024 });
  gl.texSubImage2D(0x0de1, 0, 0, 0, 16, 16, 0x1908, 0x1401, new Uint8Array(1024));
  names = [...names, 'ShaderMaterial#7'];
  t = 20; gl.compileShader({});
  c.endFrame();
  const r = c.report();
  assert.deepEqual(r.total, { draws: 3, triangles: 200 + 10 + 20, compiles: 2, links: 1, uploads: 3, uploadBytes: (2 << 20) + (4 << 20) + 1024 });
  assert.deepEqual(r.sinceWarm, { draws: 2, triangles: 30, compiles: 1, links: 0, uploads: 2, uploadBytes: (4 << 20) + 1024 });
  assert.deepEqual(r.largeUploads, [{ kind: 'upload', fn: 'texImage2D', bytes: 4 << 20, at: 10, owner: 'owner' }]);
  assert.deepEqual(r.programs, [{ kind: 'compile', fn: 'compileShader', bytes: 0, at: 20, owner: 'owner' }]);
  assert.deepEqual(r.newPrograms, ['ShaderMaterial#7']);
  assert.deepEqual(r.frames.draws, { n: 1, p50: 2, p95: 2, max: 2 });
  assert.equal(r.frames.triangles.max, 30);
  gl.clear();
  assert.ok(calls.includes('clear'), 'unwrapped methods untouched');
  undo();
  assert.equal(Object.keys(gl).length, 10, 'undo restores the own properties');
  gl.drawArrays(4, 0, 3);
  assert.equal(c.total.draws, 3, 'nothing counts after undo');
});

test('stack owner: the caller past three.js frames', () => {
  const stack = 'Error\n    at a (x)\n    at b (x)\n    at WebGLTextures.upload (http://x/js/three.bundle.js:1:2)\n    at Chunk.install (http://127.0.0.1:4545/canal-drive/js/three-buildings.bundle.js?v=2:9:10)';
  assert.equal(stackOwner(stack, 2), 'Chunk.install (canal-drive/js/three-buildings.bundle.js:9:10)');
  // The default owner, through the real wrapper: the function that made the GL call.
  const { gl } = fakeGl();
  const c = new GlCounters({ largeBytes: 1 });
  c.install(gl);
  function installChunkForTest() { gl.bufferData(0x8892, new Uint8Array(8), 0x88e4); }
  installChunkForTest();
  assert.match(c.report().largeUploads[0].owner, /^installChunkForTest /);
});

test('object labels name the shared-frame participant and the nearest named object', () => {
  const root = { name: 'shared-frame', parent: null };
  const wrapper = { name: 'shared-frame/own-ground', parent: root };
  const cell = { name: 'cell 12/34', parent: wrapper };
  assert.equal(objectLabel({ name: '', type: 'Mesh', parent: cell }), 'own-ground:cell 12/34');
  assert.equal(objectLabel({ name: '', type: 'Mesh', parent: wrapper }), 'own-ground');
  assert.equal(objectLabel({ name: '', type: 'Mesh', parent: null }), 'Mesh');
  const { gl } = fakeGl();
  let what = 'own-ground:cell';
  const c = new GlCounters({ largeBytes: 1, owner: () => 'drive', context: () => what });
  c.install(gl);
  gl.bufferData(0x8892, new Uint8Array(8), 0x88e4);
  what = '';
  gl.bufferData(0x8892, new Uint8Array(8), 0x88e4);
  assert.deepEqual(c.report().largeUploads.map(e => e.owner), ['drive @ own-ground:cell', 'drive']);
});

test('draws and triangles per owner, as means per frame since warm-up', () => {
  const { gl } = fakeGl();
  let who = 'facades';
  const c = new GlCounters({ drawOwner: () => who });
  c.install(gl);
  gl.drawArrays(4, 0, 3); c.endFrame();
  c.markWarm();
  gl.drawArrays(4, 0, 300); who = 'own-ground'; gl.drawArrays(4, 0, 30); c.endFrame();
  who = 'facades'; gl.drawArrays(4, 0, 300); c.endFrame();
  assert.deepEqual(c.report().byOwner, [{ owner: 'facades', draws: 1, triangles: 100 }, { owner: 'own-ground', draws: 0.5, triangles: 5 }]);
});
