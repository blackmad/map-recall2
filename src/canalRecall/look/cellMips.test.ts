// The facade colour array's own mip chain (lane R3-B #231): kernel, mean level, sharpness against a box chain, the
// wall mask keeping brick free of the unsharp step, flags; and the manual texSubImage3D upload with its GL fallback.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANCZOS3_2X, arrayMips, cellLodBiasFlag, cellMipOptions, cellMipsEnabled, CELL_MIPS_DEFAULT, downsample2x, layerMips, mipLevelCount, CELL_MIP_DEFAULTS } from './cellMips.ts';
import { uploadArrayMips } from './arrayMipUpload.ts';

const withGlobal = <T>(key: string, value: unknown, fn: () => T): T => {
  const g = globalThis as Record<string, unknown>, had = key in g, prev = g[key];
  g[key] = value;
  try { return fn(); } finally { if (had) g[key] = prev; else delete g[key]; }
};

test('flags: custom mips follow CELL_MIPS_DEFAULT unless asked; no LOD bias unless asked; option overrides', () => {
  assert.equal(cellMipsEnabled(), CELL_MIPS_DEFAULT);
  assert.equal(withGlobal('location', { search: '?cellMips=1' }, () => cellMipsEnabled()), true);
  assert.equal(withGlobal('location', { search: '?cellMips=0' }, () => cellMipsEnabled()), false);
  assert.equal(withGlobal('__canalRecallCellMips', false, () => cellMipsEnabled()), false);
  assert.equal(cellLodBiasFlag(), null);
  assert.equal(withGlobal('location', { search: '?cellLodBias=-0.5' }, () => cellLodBiasFlag()), -0.5);
  assert.equal(withGlobal('location', { search: '?cellLodBias=abc' }, () => cellLodBiasFlag()), null);
  assert.deepEqual(cellMipOptions(), CELL_MIP_DEFAULTS);
  assert.deepEqual(withGlobal('location', { search: '?cellMipSharpen=0&cellMipLinear=0' }, () => cellMipOptions()), { sharpen: 0, linear: false, lobes: 3 });
});

test('Lanczos-3 2:1 kernel: 12 symmetric taps summing to 1, negative outer lobes', () => {
  assert.equal(LANCZOS3_2X.length, 12);
  assert.ok(Math.abs(LANCZOS3_2X.reduce((s, v) => s + v, 0) - 1) < 1e-6);
  for (let k = 0; k < 6; k++) assert.ok(Math.abs(LANCZOS3_2X[k] - LANCZOS3_2X[11 - k]) < 1e-7);
  assert.ok(LANCZOS3_2X[2] < 0 && LANCZOS3_2X[5] > 0.3);
});

test('downsample2x keeps a flat plane flat, and near the new level\'s Nyquist keeps more than a 2x2 box', () => {
  const size = 64, flat = new Float32Array(size * size).fill(0.4);
  for (const v of downsample2x(flat, size)) assert.ok(Math.abs(v - 0.4) < 1e-6);
  // Amplitude (RMS x sqrt 2) of a cosine along x after one 2:1 step, Lanczos-3 against GL's 2x2 box.
  const gain = (period: number) => {
    const sine = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) sine[y * size + x] = 0.5 + 0.4 * Math.cos(2 * Math.PI * (x + 0.5) / period);
    const out = downsample2x(sine, size), half = size / 2;
    let l = 0, b = 0;
    for (let x = 0; x < half; x++) { l += (out[x] - 0.5) ** 2; b += (0.5 * (sine[2 * x] + sine[2 * x + 1]) - 0.5) ** 2; }
    return { lanczos: Math.sqrt(2 * l / half) / 0.4, box: Math.sqrt(2 * b / half) / 0.4 };
  };
  const g8 = gain(8), g16 = gain(16), g5 = gain(5.33);
  assert.ok(g16.lanczos > 0.99 && g8.lanczos > 0.98, `lanczos ${g16.lanczos.toFixed(3)} / ${g8.lanczos.toFixed(3)}`);
  // One step: 92 % for the box at period 8 against 98 %+; three cascaded steps compound it (0.92^3 = 0.79).
  assert.ok(g8.box < 0.93 && g8.lanczos > g8.box + 0.05 && g5.lanczos > g5.box + 0.04, `box ${g8.box.toFixed(3)}; period 5.33 lanczos ${g5.lanczos.toFixed(3)} box ${g5.box.toFixed(3)}`);
});

/** A 32 px layer: brick-red wall (mask R 255) with a dark window and a white frame (mask R 0). */
function windowLayer(size = 32): { colour: Uint8Array; mask: Uint8Array } {
  const colour = new Uint8Array(size * size * 4), mask = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, inWin = x >= 8 && x < 24 && y >= 6 && y < 26, inFrame = inWin && (x < 10 || x >= 22 || y < 8 || y >= 24);
    const rgb = inFrame ? [245, 245, 240] : inWin ? [30, 42, 51] : ((x + y) & 1 ? [150, 70, 50] : [120, 55, 40]);
    colour.set([...rgb, 255], i * 4); mask[i] = inWin ? 0 : 255;
  }
  return { colour, mask };
}

test('layerMips: N levels, sizes halve, the 1x1 level is exactly the level-0 byte mean', () => {
  const size = 32, { colour, mask } = windowLayer(size);
  const levels = layerMips(colour, 0, size, mask, 0, CELL_MIP_DEFAULTS);
  assert.equal(levels.length, mipLevelCount(size));
  levels.forEach((l, i) => assert.equal(l.length, (size >> (i + 1)) ** 2 * 4));
  const mean = [0, 1, 2, 3].map(c => { let s = 0; for (let i = 0; i < size * size; i++) s += colour[i * 4 + c]; return Math.round(s / (size * size)); });
  assert.deepEqual([...levels[levels.length - 1]], mean);
});

test('layerMips: the window keeps more contrast at mip 2 than GL box mips; brick away from it is not sharpened', () => {
  const size = 32, { colour, mask } = windowLayer(size);
  const ours = layerMips(colour, 0, size, mask, 0, CELL_MIP_DEFAULTS)[1]; // level 2: 8 x 8
  // GL's chain: two 2x2 boxes on the bytes.
  const box = (src: Uint8Array, s: number) => { const h = s / 2, out = new Uint8Array(h * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < h; x++) for (let c = 0; c < 4; c++) { const a = ((2 * y) * s + 2 * x) * 4 + c; out[(y * h + x) * 4 + c] = Math.round((src[a] + src[a + 4] + src[a + s * 4] + src[a + s * 4 + 4]) / 4); } return out; };
  const gl = box(box(colour, 32), 16);
  const lum = (b: Uint8Array, i: number) => 0.2126 * b[i * 4] + 0.7152 * b[i * 4 + 1] + 0.0722 * b[i * 4 + 2];
  const range = (b: Uint8Array) => { let lo = 255, hi = 0; for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) { const v = lum(b, y * 8 + x); lo = Math.min(lo, v); hi = Math.max(hi, v); } return hi - lo; };
  assert.ok(range(ours) > range(gl) + 10, `window luma range ours ${range(ours).toFixed(1)} vs box ${range(gl).toFixed(1)}`);
  // Unsharp only off the wall: the same chain with sharpen 0 is identical on the wall-only corner texels.
  const plain = layerMips(colour, 0, size, mask, 0, { ...CELL_MIP_DEFAULTS, sharpen: 0 })[0];
  const sharp = layerMips(colour, 0, size, mask, 0, CELL_MIP_DEFAULTS)[0];
  for (const i of [0, 1, 16, 17]) for (let c = 0; c < 3; c++) assert.equal(sharp[i * 4 + c], plain[i * 4 + c]);
});

test('arrayMips: all layers per level in layer order, RG masks read by their R byte, yields between slices', async () => {
  const size = 16, layers = 3, n = size * size;
  const colour = new Uint8Array(n * 4 * layers), mask = new Uint8Array(n * 2 * layers);
  for (let l = 0; l < layers; l++) for (let i = 0; i < n; i++) { colour.set([40 * (l + 1), 10, 200 - 50 * l, 255], (l * n + i) * 4); mask[(l * n + i) * 2] = 255; }
  let yields = 0;
  const { levels } = await arrayMips(colour, size, layers, mask, 2, CELL_MIP_DEFAULTS, 1e-9, async () => { yields++; });
  assert.equal(levels.length, 4);
  for (let l = 0; l < layers; l++) assert.deepEqual([...levels[3].subarray(l * 4, l * 4 + 4)], [40 * (l + 1), 10, 200 - 50 * l, 255]);
  assert.ok(yields >= 2);
});

function fakeGl(fail = false) {
  const calls: any[] = [];
  return {
    calls, NO_ERROR: 0, TEXTURE_2D_ARRAY: 0x8c1a, UNPACK_ALIGNMENT: 0x0cf5, RGBA: 0x1908, UNSIGNED_BYTE: 0x1401,
    getError: () => (fail && calls.some(c => c[0] === 'sub') && !calls.some(c => c[0] === 'err') ? (calls.push(['err']), 1282) : 0),
    bindTexture: (...a: any[]) => calls.push(['bind', ...a]), pixelStorei: (...a: any[]) => calls.push(['store', ...a]),
    texSubImage3D: (...a: any[]) => calls.push(['sub', a[1], a[5], a[6], a[7], a[10].length]), generateMipmap: (...a: any[]) => calls.push(['gen', ...a]),
  };
}

test('uploadArrayMips: level 1..N by texSubImage3D on the bound array; GL mips when the handle or the upload fails', () => {
  const size = 8, depth = 2, levels = [4, 2, 1].map(s => new Uint8Array(s * s * 4 * depth));
  const tex = {}, handle = { id: 1 };
  const gl = fakeGl();
  const renderer = { getContext: () => gl, properties: { get: (t: any) => (t === tex ? { __webglTexture: handle } : {}) }, state: { bindTexture: (...a: any[]) => gl.calls.push(['stateBind', ...a]) } };
  const r = uploadArrayMips(renderer, tex, levels, size, depth);
  assert.equal(r.mode, 'custom');
  assert.deepEqual(gl.calls.filter(c => c[0] === 'sub'), [['sub', 1, 4, 4, 2, 128], ['sub', 2, 2, 2, 2, 32], ['sub', 3, 1, 1, 2, 8]]);
  assert.ok(gl.calls.some(c => c[0] === 'stateBind' && c[2] === handle));
  assert.ok(!gl.calls.some(c => c[0] === 'gen'));
  // No WebGL texture yet: nothing to bind, nothing uploaded.
  assert.equal(uploadArrayMips({ ...renderer, properties: { get: () => ({}) } }, tex, levels, size, depth).mode, 'gl-fallback');
  // A GL error after the uploads: the storage is regenerated by GL.
  const bad = fakeGl(true);
  const r2 = uploadArrayMips({ ...renderer, getContext: () => bad, state: null }, tex, levels, size, depth);
  assert.equal(r2.mode, 'gl-fallback'); assert.ok(bad.calls.some(c => c[0] === 'gen'));
  // A short level is refused before any GL error.
  const short = fakeGl();
  assert.equal(uploadArrayMips({ ...renderer, getContext: () => short }, tex, [new Uint8Array(4)], size, depth).mode, 'gl-fallback');
});
