import assert from 'node:assert/strict';
import test from 'node:test';
import { DissolveWarmth, LEVEL_DISSOLVE_MS, LevelDissolves, dissolveClone as dissolveCloneTyped, injectDissolve, landmarkDissolveFlag, warmKey as warmKeyTyped } from './levelDissolve.ts';
// The fakes are not three materials: call through `any`.
const dissolveClone = dissolveCloneTyped as (m: any, band: any) => any;
const warmKey = warmKeyTyped as (m: any, rs: boolean) => string;
import { DEPTH_FADE_LIMIT_ONLY, drawLimitFogFragment, landmarkHazeFlag } from './drawLimit.ts';
import { DEPTH_FADE_OPT_OUT, depthFadeOptOutMaterial, isDepthFadeOptOut, optOutFog } from '../look/depthFade.ts';

class FakeMaterial {
  type = 'MeshLambertMaterial'; fog = true; vertexColors = true; side = 2; userData: Record<string, unknown> = {};
  defines?: Record<string, unknown>; uniforms?: Record<string, unknown>;
  onBeforeCompile = (shader: any) => { shader.fragmentShader = shader.fragmentShader.replace('#include <x>', 'X'); };
  customProgramCacheKey = () => 'src';
  clone(): FakeMaterial { const c = new FakeMaterial(); c.type = this.type; c.fog = this.fog; c.vertexColors = this.vertexColors; c.side = this.side; return c; }
}
const mesh = (material: unknown) => ({ isMesh: true, material, receiveShadow: true, geometry: {} });
const root = (...meshes: object[]) => ({ traverse: (fn: (o: any) => void) => meshes.forEach(fn) });

test('injectDissolve puts the band discard first in main, declarations ahead', () => {
  const out = injectDissolve('precision highp float;\nvoid main() {\n  gl_FragColor = vec4(1.0);\n}');
  assert.match(out, /uniform float lodDissolveLo;\nuniform float lodDissolveHi;\nvoid main\(\) \{\n\{ float lodDissolveHash/);
  assert.ok(out.indexOf('discard') < out.indexOf('gl_FragColor'));
  assert.equal(injectDissolve('no main here'), 'no main here');
});

test('a dissolve clone shares uniforms and defines, chains the source hook, and keys its own program', () => {
  const src = new FakeMaterial();
  src.uniforms = { cells: { value: 1 } }; src.defines = { A: '' };
  const band = { lo: { value: 0 }, hi: { value: 0.5 } };
  const c = dissolveClone(src, band);
  assert.equal(c.defines, src.defines);
  assert.equal(c.uniforms!.cells, src.uniforms.cells);
  assert.equal(c.uniforms!.lodDissolveHi, band.hi);
  assert.equal(c.customProgramCacheKey(), 'src|lodDissolve');
  const shader = { uniforms: {} as Record<string, unknown>, fragmentShader: 'void main() {\n#include <x>\n}' };
  c.onBeforeCompile(shader);
  assert.equal(shader.uniforms.lodDissolveLo, band.lo);
  assert.match(shader.fragmentShader, /X/);
  assert.match(shader.fragmentShader, /lodDissolveHash/);
  assert.equal(c.userData.lodDissolve, true);
  assert.equal(src.userData.lodDissolve, undefined);
});

test('complementary bands: every hash is drawn by exactly one level at every t, and the originals come back', () => {
  const a = new FakeMaterial(), b = new FakeMaterial();
  const inMesh = mesh(a), outMesh = mesh([b, b]);
  const fades = new LevelDissolves<string>(LEVEL_DISSOLVE_MS);
  let done = 0;
  fades.start('m', root(inMesh), root(outMesh), () => done++, 0);
  const inClone = inMesh.material as any, outClone = (outMesh.material as any[])[0];
  assert.notEqual(inClone, a);
  assert.equal((outMesh.material as any[])[1], outClone, 'one clone per source material');
  for (const now of [0, 150, 300, 599]) {
    fades.step(now);
    // Read the bands through a compiled shader's uniforms.
    const si = { uniforms: {} as any, fragmentShader: 'void main() {}' }, so = { uniforms: {} as any, fragmentShader: 'void main() {}' };
    inClone.onBeforeCompile(si); outClone.onBeforeCompile(so);
    for (let h = 0; h < 1; h += 0.01) {
      const drawsIn = h >= si.uniforms.lodDissolveLo.value && h < si.uniforms.lodDissolveHi.value;
      const drawsOut = h >= so.uniforms.lodDissolveLo.value && h < so.uniforms.lodDissolveHi.value;
      assert.equal(drawsIn !== drawsOut, true, `t=${now} hash=${h}`);
    }
  }
  assert.equal(done, 0);
  assert.equal(fades.step(LEVEL_DISSOLVE_MS), false);
  assert.equal(done, 1);
  assert.equal(inMesh.material, a);
  assert.deepEqual(outMesh.material, [b, b]);
});

test('finish ends a dissolve at once; a material changed under it stays', () => {
  const a = new FakeMaterial(), lit = new FakeMaterial();
  const m = mesh(a);
  const fades = new LevelDissolves<number>();
  let done = 0;
  fades.start(1, root(m), root(), () => done++, 0);
  m.material = lit;
  fades.finish(1);
  assert.equal(done, 1);
  assert.equal(m.material, lit);
  assert.equal(fades.has(1), false);
  fades.finish(1);
  assert.equal(done, 1, 'finish twice is a no-op');
});

test('warmth: cold keys compile once, then the swap may dissolve', async () => {
  const w = new DissolveWarmth();
  const r = root(mesh(new FakeMaterial()), mesh(new FakeMaterial()));
  const cold = w.cold([r]);
  assert.equal(cold.size, 1, 'two identical variants are one program');
  let groups = 0;
  await w.warmUp(cold, items => { groups++; return items; }, () => Promise.resolve());
  assert.equal(w.cold([r]).size, 0);
  assert.equal(groups, 1);
  const other = new FakeMaterial(); other.vertexColors = false;
  assert.notEqual(warmKey(other, true), warmKey(new FakeMaterial(), true));
  assert.notEqual(warmKey(new FakeMaterial(), false), warmKey(new FakeMaterial(), true));
});

test('flags: landmarkDissolve on by default, off with =0 or popFade=0', () => {
  const g = globalThis as any;
  try {
    assert.equal(landmarkDissolveFlag(), true);
    g.__canalRecallLandmarkDissolve = '0'; assert.equal(landmarkDissolveFlag(), false);
    delete g.__canalRecallLandmarkDissolve; g.__canalRecallPopFade = false; assert.equal(landmarkDissolveFlag(), false);
  } finally { delete g.__canalRecallLandmarkDissolve; delete g.__canalRecallPopFade; }
});

test('landmark haze: an opt-out keeps fog with the limit-only define; =0 or no limit restores fog off', () => {
  const g = globalThis as any;
  try {
    assert.equal(landmarkHazeFlag(), true);
    const m = new FakeMaterial();
    const twin = depthFadeOptOutMaterial(m as any) as any;
    assert.equal(twin.fog, true);
    assert.deepEqual(twin.defines, { [DEPTH_FADE_LIMIT_ONLY]: '' });
    assert.equal(twin.userData[DEPTH_FADE_OPT_OUT], true);
    assert.equal(isDepthFadeOptOut(twin), true);
    assert.equal(depthFadeOptOutMaterial(twin), twin, 'an opt-out is its own twin');
    assert.equal(m.defines, undefined, 'the source is untouched');
    const unlit = { fog: false, userData: {} as Record<string, unknown> } as any;
    optOutFog(unlit, true);
    assert.equal(unlit.fog, false); assert.equal(unlit.defines, undefined, 'a fog-less material stays fog-less');
    g.__canalRecallLandmarkHaze = '0'; assert.equal(landmarkHazeFlag(), false);
    const off = { fog: true } as any; optOutFog(off); assert.equal(off.fog, false);
    delete g.__canalRecallLandmarkHaze; g.__canalRecallDrawLimit = false; assert.equal(landmarkHazeFlag(), false);
  } finally { delete g.__canalRecallLandmarkHaze; delete g.__canalRecallDrawLimit; }
});

test('the limit fog fragment skips the gentle fade under DEPTH_FADE_LIMIT_ONLY and keeps the opaque ramp', () => {
  const f = drawLimitFogFragment(0.5, 0.38);
  const gentle = f.indexOf('fogFactor * '), guard = f.indexOf('#ifndef DEPTH_FADE_LIMIT_ONLY'), end = f.indexOf('#endif'), ramp = f.indexOf('limitFar');
  assert.ok(guard >= 0 && guard < gentle && gentle < end && end < ramp);
});
