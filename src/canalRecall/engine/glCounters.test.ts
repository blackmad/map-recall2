import assert from 'node:assert/strict';
import test from 'node:test';
import { GlCounters, GlResident, bufferBytes, chainBytes, objectLabel, stackOwner, texelBytes, textureBytes, trianglesOf } from './glCounters';

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

test('resident GPU bytes follow binds, reallocations and deletes', () => {
  const gl: Record<string, any> = {};
  for (const fn of ['bindBuffer', 'bufferData', 'deleteBuffer', 'activeTexture', 'bindTexture', 'texImage2D', 'texStorage2D', 'deleteTexture', 'bindRenderbuffer', 'renderbufferStorageMultisample', 'deleteRenderbuffer']) gl[fn] = () => fn;
  const r = new GlResident();
  const undo = r.install(gl);
  const a = {}, b = {}, t = {}, cube = {}, rb = {};
  gl.bindBuffer(0x8892, a); gl.bufferData(0x8892, new Float32Array(262144), 0x88e4); // 1 MiB
  gl.bindBuffer(0x8893, b); gl.bufferData(0x8893, 1 << 20, 0x88e4);
  gl.bindBuffer(0x8892, a); gl.bufferData(0x8892, new Float32Array(524288), 0x88e4); // a grows to 2 MiB, not 3
  gl.activeTexture(0x84c1); gl.bindTexture(0x0de1, t);
  gl.texStorage2D(0x0de1, 2, 0x8058, 512, 512); // 1 MiB + 256 KiB
  gl.bindTexture(0x8513, cube);
  for (let f = 0; f < 6; f++) gl.texImage2D(0x8515 + f, 0, 0x8058, 0x1908, 0x1401, { width: 256, height: 256 });
  gl.bindRenderbuffer(0x8d41, rb); gl.renderbufferStorageMultisample(0x8d41, 4, 0x8058, 512, 512);
  let rep = r.report();
  assert.equal(rep.buffers, 2); assert.equal(rep.bufferMB, 3);
  assert.equal(rep.textures, 2); assert.equal(rep.textureMB, 2.8); // 1.25 + 6 x 0.25
  assert.equal(rep.renderbufferMB, 4);
  gl.deleteBuffer(a); gl.deleteTexture(cube); gl.deleteRenderbuffer(rb);
  rep = r.report();
  assert.deepEqual([rep.buffers, rep.bufferMB, rep.textures, rep.textureMB, rep.renderbufferMB, rep.totalMB], [1, 1, 1, 1.3, 0, 2.3]);
  undo();
  assert.equal(gl.bufferData(), 'bufferData');
  assert.equal(chainBytes(4, 4, 1, 3), (16 + 4 + 1) * 4);
});

test('resident bytes by owner: tagged at first allocation, named at report, dropped on delete (lane R3-F #241)', () => {
  const gl: Record<string, any> = {};
  for (const fn of ['bindBuffer', 'bufferData', 'deleteBuffer', 'activeTexture', 'bindTexture', 'texImage2D', 'deleteTexture']) gl[fn] = () => fn;
  const r = new GlResident();
  let who = 'facades';
  r.tagWith(kind => `${kind}:${who}`, () => token => String(token).toUpperCase());
  r.install(gl);
  const a = {}, b = {}, t = {};
  gl.bindBuffer(0x8892, a); gl.bufferData(0x8892, 1 << 20, 0x88e4);
  who = 'own-ground';
  gl.bindBuffer(0x8892, b); gl.bufferData(0x8892, 2 << 20, 0x88e4);
  gl.bindBuffer(0x8892, a); gl.bufferData(0x8892, 3 << 20, 0x88e4); // a keeps its first owner
  gl.bindTexture(0x0de1, t); gl.texImage2D(0x0de1, 0, 0x8058, 0x1908, 0x1401, { width: 512, height: 512 });
  assert.deepEqual(r.report().byOwner, [
    { owner: 'buffer BUFFER:FACADES', MB: 3, decodedMB: 3, objects: 1 },
    { owner: 'buffer BUFFER:OWN-GROUND', MB: 2, decodedMB: 2, objects: 1 },
    { owner: 'texture TEXTURE:OWN-GROUND', MB: 1, decodedMB: 1, objects: 1 },
  ]);
  gl.deleteBuffer(a);
  assert.deepEqual(r.report().byOwner?.map(o => o.owner), ['buffer BUFFER:OWN-GROUND', 'texture TEXTURE:OWN-GROUND']);
  assert.equal(new GlResident().report().byOwner, undefined);
});

test('draws by owner in the last closed frame', () => {
  let who = 'facades coarse';
  const c = new GlCounters({ drawOwner: () => who });
  c.draw(10); c.draw(10); who = 'landmarks'; c.draw(5);
  c.endFrame();
  assert.deepEqual(c.report().lastFrameByOwner, { 'facades coarse': 2, landmarks: 1 });
  c.draw(1);
  assert.deepEqual(c.report().lastFrameByOwner, { 'facades coarse': 2, landmarks: 1 });
  c.endFrame();
  assert.deepEqual(c.report().lastFrameByOwner, { landmarks: 1 });
});

test('decoded resident bytes count each texel at its internal format (lane R4-G #250)', () => {
  const gl: Record<string, any> = {};
  for (const fn of ['activeTexture', 'bindTexture', 'texImage2D', 'texStorage2D', 'texStorage3D', 'deleteTexture', 'bindRenderbuffer', 'renderbufferStorage']) gl[fn] = () => fn;
  const r = new GlResident();
  r.tagWith(kind => kind);
  r.install(gl);
  const colour = {}, mask = {}, rg = {}, data = {}, rb = {};
  // The facade atlas: RGBA8 colour and R8 mask arrays, 256 x 256 x 4 layers, one level each.
  gl.bindTexture(0x8c1a, colour); gl.texStorage3D(0x8c1a, 1, 0x8058, 256, 256, 4);
  gl.bindTexture(0x8c1a, mask); gl.texStorage3D(0x8c1a, 1, 0x8229, 256, 256, 4);
  gl.bindTexture(0x0de1, rg); gl.texStorage2D(0x0de1, 1, 0x822b, 512, 512);
  // A typed-array upload already carries its true bytes: not rescaled.
  gl.bindTexture(0x0de1, data); gl.texImage2D(0x0de1, 0, 0x822b, 256, 256, 0, 0x8227, 0x1401, new Uint8Array(256 * 256 * 2));
  gl.bindRenderbuffer(0x8d41, rb); gl.renderbufferStorage(0x8d41, 0x81a5, 512, 512);
  const rep = r.report();
  assert.equal(rep.textureMB, 3.1); // 1 + 1 + 1 + 0.125: the legacy figure: 4 bytes a texel, the typed array its length
  assert.equal(rep.textureDecodedMB, 1.9); // 1 + 0.25 + 0.5 + 0.125
  assert.equal(rep.renderbufferMB, 1); assert.equal(rep.renderbufferDecodedMB, 0.5);
  assert.equal(rep.totalDecodedMB, 2.4);
  assert.deepEqual(rep.byOwner?.map(o => [o.owner, o.MB, o.decodedMB]), [['texture texture', 3.1, 1.9], ['renderbuffer renderbuffer', 1, 0.5]]);
  gl.deleteTexture(mask); gl.deleteTexture(rg);
  assert.equal(r.report().textureDecodedMB, 1.1);
  assert.deepEqual([texelBytes(0x8058), texelBytes(0x8229), texelBytes(0x822b), texelBytes(0x881a), texelBytes(undefined), texelBytes(0x1234)], [4, 1, 2, 8, 4, 4]);
});
