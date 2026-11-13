// The facade shader and its record texture (F1 S4, #380): the generated GLSL reads exactly the bytes the packer writes,
// the flag, the row allocator, and the cityLook record variant leaves every flag-off program untouched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FACADE_FIELDS, FACADE_RECORD_BYTES, emptyFacadeRecord, packFacadeRecord, unpackFacadeRecord, type FacadeRecord } from './facadeRecord.ts';
import { FACADE_RECORD_GLSL, FACADE_RECORD_VERTEX_BODY, FACADE_RECORD_VERTEX_DECLS, shaderFacadesEnabled, shaderFacadesMode } from './facadeShader.ts';
import { FACADE_TEXTURE_WIDTH, FacadeRecordTexture, firstFitRows } from './facadeRecordTexture.ts';
import { cityProgramKey, createCityLookMaterial, createCityUniforms, variantDefines, variantKey, type CityVariant } from './cityLook.ts';

/** Evaluate a generated `fr_<name>()` accessor in JS over the record's four texels (GLSL uint ops map 1:1). */
function evalAccessor(name: string, texels: Uint32Array): number | number[] {
  const m = new RegExp(`(?:float|vec3) fr_${name}\\(\\) \\{ return (.*?); \\}`).exec(FACADE_RECORD_GLSL);
  assert.ok(m, `accessor fr_${name}`);
  const js = m[1]
    .replace(/frT(\d)\[(\d)\]/g, (_, t, c) => `T[${Number(t) * 4 + Number(c)}]`)
    .replace(/(\d+)u\b/g, '$1')
    .replace(/vec3\((.*)\) \/ 255\.0$/, '[$1].map(x => x / 255)')
    .replace(/float\(/g, '(');
  return new Function('T', `return ${js};`)(texels);
}

test('every generated accessor reads the field the packer wrote', () => {
  const rnd = (() => { let s = 7; return () => (s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32; })();
  for (let trial = 0; trial < 20; trial++) {
    const raw = new Uint8Array(FACADE_RECORD_BYTES);
    for (let i = 0; i < raw.length; i++) raw[i] = Math.floor(rnd() * 256);
    const rec = unpackFacadeRecord(raw);
    const bytes = packFacadeRecord(rec);
    const texels = new Uint32Array(bytes.buffer.slice(0));
    for (const f of FACADE_FIELDS) {
      const got = evalAccessor(f.name, texels), want = rec[f.name as keyof FacadeRecord];
      if (f.kind === 'rgb') assert.deepEqual((got as number[]).map(x => Math.round(x * 255)), want, f.name);
      else assert.equal(got, want, f.name);
    }
  }
});

test('the flag: query wins, then the global, then the device default (off)', () => {
  assert.equal(shaderFacadesEnabled(false, '', {}), false);
  assert.equal(shaderFacadesEnabled(true, '', {}), false);
  assert.equal(shaderFacadesEnabled(false, '?shaderFacades=1', {}), true);
  assert.equal(shaderFacadesEnabled(true, '?a=2&shaderFacades=1', {}), true);
  assert.equal(shaderFacadesEnabled(false, '?shaderFacades=0', { __canalRecallShaderFacades: true }), false);
  assert.equal(shaderFacadesEnabled(false, '', { __canalRecallShaderFacades: true }), true);
  assert.equal(shaderFacadesEnabled(false, '?shaderFacades=10', {}), false, 'a longer value is not the flag');
});

test('P5 the far-only mode: ?shaderFacades=far, or the global "far"; 1 is every tier', () => {
  assert.equal(shaderFacadesMode(false, '?shaderFacades=far', {}), 'far');
  assert.equal(shaderFacadesMode(true, '?x=1&shaderFacades=far&y=2', {}), 'far');
  assert.equal(shaderFacadesMode(false, '?shaderFacades=1', {}), 'all');
  assert.equal(shaderFacadesMode(false, '?shaderFacades=0', { __canalRecallShaderFacades: 'far' }), 'off');
  assert.equal(shaderFacadesMode(false, '', { __canalRecallShaderFacades: 'far' }), 'far');
  assert.equal(shaderFacadesMode(false, '?shaderFacades=farther', {}), 'off', 'a longer value is not the flag');
  assert.equal(shaderFacadesEnabled(false, '?shaderFacades=far', {}), true, 'far draws the baked tier from records');
  assert.equal(shaderFacadesMode(false, '', {}), 'off');
});

test('row allocator: first fit, frees, refuses when full, uploads only its rows', () => {
  const used = new Uint8Array(6);
  assert.equal(firstFitRows(used, 2), 0);
  used.set([1, 1, 0, 1, 0, 0]);
  assert.equal(firstFitRows(used, 1), 2);
  assert.equal(firstFitRows(used, 2), 4);
  assert.equal(firstFitRows(used, 3), -1);

  const t = new FacadeRecordTexture(THREE, 4);
  assert.equal(t.texture.image.width, FACADE_TEXTURE_WIDTH);
  const set = (count: number, fill: number) => ({ version: 1, count, bytes: new Uint8Array(count * FACADE_RECORD_BYTES).fill(fill) });
  assert.equal(t.alloc('a', set(65, 1)), 0, '65 records take two rows');
  assert.equal(t.alloc('b', set(10, 2)), 2);
  assert.equal(t.rowsUsed, 3);
  assert.equal(t.alloc('c', set(130, 3)), null, 'three rows do not fit');
  t.free('a');
  assert.equal(t.alloc('c', set(64, 3)), 0);
  assert.equal(t.base('b'), 2);
  const data = new Uint8Array(t.texture.image.data.buffer);
  assert.equal(data[0], 3); assert.equal(data[2 * FACADE_TEXTURE_WIDTH * 16], 2);
  const ranges = t.texture.updateRanges as { start: number; count: number }[];
  assert.deepEqual(ranges.at(-1), { start: 0, count: FACADE_TEXTURE_WIDTH * 4 }, 'one row (texels x 4 components) uploaded');
  assert.deepEqual(ranges.slice(0, 2), [{ start: 0, count: FACADE_TEXTURE_WIDTH * 4 }, { start: FACADE_TEXTURE_WIDTH * 4, count: FACADE_TEXTURE_WIDTH * 4 }], 'a two-row cell: one range a row');
});

test('the record variant is a lit-chunk program of its own; every other program is unchanged', () => {
  const uniforms = createCityUniforms(THREE);
  const compiled = (m: any) => {
    const lib = THREE.ShaderLib.lambert;
    const shader = { vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, uniforms: THREE.UniformsUtils.clone(lib.uniforms) };
    m.onBeforeCompile(shader, null);
    return shader;
  };
  const plain: CityVariant = { lit: true, kind: 'chunk' };
  const rec: CityVariant = { ...plain, records: true };
  assert.ok(!cityProgramKey(plain).includes('frec'));
  assert.ok(cityProgramKey(rec).endsWith('|frec'));
  assert.ok(variantKey(rec).endsWith('|frec'));
  assert.ok('CITY_FACADE_RECORD' in variantDefines(rec));
  for (const v of [{ lit: false, kind: 'chunk' }, { lit: true, kind: 'slot', uv: 'uv' }] as CityVariant[]) {
    assert.equal(cityProgramKey({ ...v, records: true }), cityProgramKey(v), 'records applies to lit chunks only');
    assert.deepEqual(variantDefines({ ...v, records: true }), variantDefines(v));
  }
  const a = compiled(createCityLookMaterial(THREE, plain, uniforms)), b = compiled(createCityLookMaterial(THREE, rec, uniforms));
  assert.ok(!a.fragmentShader.includes('facadeRecords') && !a.vertexShader.includes('wallKind'));
  assert.ok(b.fragmentShader.includes('facadeRecordColour(cityM)') && b.vertexShader.includes('attribute float wallKind'));
  assert.ok(!b.vertexShader.includes('attribute float layer'), 'the record mesh carries no slot layer');
  const m = createCityLookMaterial(THREE, rec, uniforms);
  assert.ok(m.userData.facadeRecordUniforms.recBase, 'the per-mesh recBase uniform is reachable');
  assert.equal(emptyFacadeRecord().storeys, 0);
});

test('the record GLSL declares no GLSL ES 3.00 reserved word (S6c shipped `float patch` and the program did not link)', () => {
  // GLSL ES 3.00 §3.8 reserved keywords that a TypeScript-minded name can hit; any of them fails compilation on WebGL2.
  const reserved = ['patch', 'sample', 'input', 'output', 'filter', 'common', 'partition', 'active', 'superp', 'resource', 'class', 'union',
    'enum', 'typedef', 'template', 'this', 'goto', 'inline', 'noinline', 'public', 'static', 'extern', 'external', 'interface', 'long', 'short',
    'double', 'half', 'fixed', 'unsigned', 'cast', 'namespace', 'using', 'sizeof', 'asm', 'volatile', 'subroutine', 'buffer', 'shared', 'coherent', 'restrict', 'readonly', 'writeonly', 'atomic_uint', 'noperspective', 'precise'];
  const src = [FACADE_RECORD_GLSL, FACADE_RECORD_VERTEX_DECLS, FACADE_RECORD_VERTEX_BODY].join('\n').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const hits = reserved.filter(w => new RegExp(`\\b${w}\\b`).test(src));
  assert.deepEqual(hits, []);
});
