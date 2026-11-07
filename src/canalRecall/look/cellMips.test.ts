// The facade colour array's own mip chain (lane R3-B #231): kernel, mean level, sharpness against a box chain, the
// wall mask keeping brick free of the unsharp step, flags; and the manual texSubImage3D upload with its GL fallback.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANCZOS3_2X, arrayMips, cellLodBiasFlag, cellMipOptions, cellMipsEnabled, CELL_MIPS_DEFAULT, downsample2x, layerMips, mipLevelCount, CELL_MIP_DEFAULTS,
  CELL_ROLLOFF_DEFAULT, CELL_ROLLOFF_DEFAULTS, ROLLOFF_PITCH_TEXELS, arrayRolloffMips, blurWrapped, cellRolloffEnabled, cellRolloffOptions, cellTierBandFlag, cellTierFromBand, debugLevelOf, debugLevels,
  LEVEL_DEBUG_RGB, layerRolloffMips, maskWindowPitch, rectWindowPitch, rolloffSigma, runPeriods, type UvRect } from './cellMips.ts';
import { facadeTierUniform } from '../roofTier.ts';
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

// ---- Lane R3-E (#240): the roll-off chain ----

/** A `size` bay: `windows` openings evenly across one row (mask R 0, dark glass), on a pale wall (mask R 255). */
function bayLayer(size: number, windows: number, wallRgb = [200, 190, 175]): { colour: Uint8Array; mask: Uint8Array; rects: UvRect[] } {
  const colour = new Uint8Array(size * size * 4), mask = new Uint8Array(size * size), rects: UvRect[] = [];
  const pitch = size / windows, ww = Math.round(pitch * 0.45), y0 = Math.round(size * 0.25), y1 = Math.round(size * 0.75);
  for (let k = 0; k < windows; k++) { const x0 = Math.round(pitch * (k + 0.5) - ww / 2); rects.push({ x0: x0 / size, x1: (x0 + ww) / size, y0: y0 / size, y1: y1 / size }); }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, win = y >= y0 && y < y1 && rects.some(r => x >= r.x0 * size && x < r.x1 * size);
    colour.set(win ? [30, 40, 50, 255] : [...wallRgb, 255], i * 4); mask[i] = win ? 0 : 255;
  }
  return { colour, mask, rects };
}

test('flags: the roll-off follows CELL_ROLLOFF_DEFAULT unless asked, gives way to ?cellMips=1; options and the tier band parse', () => {
  assert.equal(cellRolloffEnabled(), CELL_ROLLOFF_DEFAULT);
  assert.equal(withGlobal('location', { search: '?cellRolloff=1' }, () => cellRolloffEnabled()), true);
  assert.equal(withGlobal('location', { search: '?cellRolloff=0' }, () => cellRolloffEnabled()), false);
  assert.equal(withGlobal('location', { search: '?cellRolloff=1&cellMips=1' }, () => cellRolloffEnabled()), false);
  assert.deepEqual(cellRolloffOptions(), CELL_ROLLOFF_DEFAULTS);
  assert.equal(CELL_ROLLOFF_DEFAULTS.pitch, ROLLOFF_PITCH_TEXELS);
  assert.deepEqual(withGlobal('location', { search: '?cellRolloffPitch=6&cellRolloffMask=0&cellRolloffLinear=1' }, () => cellRolloffOptions()), { pitch: 6, linear: true, mask: false });
  assert.equal(cellTierBandFlag(), null);
  assert.deepEqual(withGlobal('location', { search: '?cellTierBand=24,45' }, () => cellTierBandFlag()), [24, 45]);
  assert.equal(withGlobal('location', { search: '?cellTierBand=45,24' }, () => cellTierBandFlag()), null);
  // The band is given at DPR 2: at ratio 2 it is the uniform as given, and the constants x 2 are today's tier.
  assert.deepEqual(cellTierFromBand([24, 45], 2), [24, 45]);
  assert.deepEqual(cellTierFromBand([24, 45], 1), [12, 22.5]);
  assert.deepEqual(cellTierFromBand([32, 60], 2), facadeTierUniform(2));
});

test('window pitch: a 3-window bay reads one third of the cell across and the cell down, from the mask and from the rects; a blank wall has none', () => {
  const size = 96, { mask, rects } = bayLayer(size, 3);
  const fromMask = maskWindowPitch(mask, 0, size, 1);
  assert.ok(Math.abs(fromMask.x - 32) <= 0.5, `mask x ${fromMask.x}`);
  assert.equal(fromMask.y, size);
  const fromRects = rectWindowPitch(rects, size);
  assert.ok(Math.abs(fromRects.x - 32) <= 0.5, `rects x ${fromRects.x}`);
  assert.equal(fromRects.y, size);
  // RG masks are read by their R byte.
  const rg = new Uint8Array(size * size * 2); for (let i = 0; i < size * size; i++) { rg[i * 2] = mask[i]; rg[i * 2 + 1] = 77; }
  assert.deepEqual(maskWindowPitch(rg, 0, size, 2), fromMask);
  const blank = new Uint8Array(size * size).fill(255);
  assert.deepEqual(maskWindowPitch(blank, 0, size, 1), { x: Infinity, y: Infinity });
  assert.deepEqual(rectWindowPitch([], size), { x: Infinity, y: Infinity });
  // One run per wrapped line is the cell; a run across the wrap counts once; a one-texel speck is not a window.
  assert.deepEqual(runPeriods(i => (i < 3 || i > 60 ? 0 : 255), 64), [64]);
  assert.deepEqual(runPeriods(i => (i === 10 ? 0 : 255), 64), []);
  assert.deepEqual(runPeriods(() => 0, 64), []);
});

test('rolloffSigma: P / 2 at pitch 2 and below 2 one texel, 0 from the threshold up, monotone between', () => {
  assert.equal(rolloffSigma(2, 4), 1);
  assert.equal(rolloffSigma(1, 4), 1);
  assert.equal(rolloffSigma(4, 4), 0);
  assert.equal(rolloffSigma(6, 4), 0);
  assert.equal(rolloffSigma(Infinity, 6), 0);
  // Between 2 and the threshold: positive, at most P / 2, and the ramp's weight falls to 0 at the threshold.
  for (let p = 2.25; p < 6; p += 0.25) { const s = rolloffSigma(p, 6); assert.ok(s > 0 && s <= p / 2 + 1e-9, `sigma ${s} at ${p}`); }
  assert.ok(rolloffSigma(5.75, 6) < 0.4 && rolloffSigma(3, 4) > 0 && rolloffSigma(3, 4) < 1.5);
});

test('blurWrapped: keeps a flat plane and the mean; sigma 0 is a no-op', () => {
  const size = 16, v = new Float32Array(size * size);
  for (let i = 0; i < v.length; i++) v[i] = (i * 7919) % 13 / 13;
  const mean = v.reduce((a, b) => a + b, 0) / v.length, copy = v.slice();
  blurWrapped(copy, size, 0, 0);
  assert.deepEqual([...copy], [...v]);
  blurWrapped(v, size, 1.3, 0.7);
  assert.ok(Math.abs(v.reduce((a, b) => a + b, 0) / v.length - mean) < 1e-5);
});

/** Vertical stripes of `period` level-0 texels (half dark, half pale) on a `size` layer, and their mask. */
function stripes(size: number, period: number): { colour: Uint8Array; mask: Uint8Array } {
  const colour = new Uint8Array(size * size * 4), mask = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const win = (x % period) < period / 2, i = y * size + x; colour.set(win ? [20, 30, 40, 255] : [220, 215, 205, 255], i * 4); mask[i] = win ? 0 : 255; }
  return { colour, mask };
}
const lumaRange = (b: Uint8Array, channels = 4) => { let lo = 255, hi = 0, sum = 0; const n = b.length / channels; for (let i = 0; i < n; i++) { const v = channels === 4 ? 0.2126 * b[i * 4] + 0.7152 * b[i * 4 + 1] + 0.0722 * b[i * 4 + 2] : b[i * channels]; lo = Math.min(lo, v); hi = Math.max(hi, v); sum += v; } return { range: hi - lo, mean: sum / n }; };
/** GL's chain: 2x2 boxes on the bytes, rounded per level. */
function glBox(src: Uint8Array, s: number, channels = 4): Uint8Array { const h = s / 2, out = new Uint8Array(h * h * channels); for (let y = 0; y < h; y++) for (let x = 0; x < h; x++) for (let c = 0; c < channels; c++) { const a = ((2 * y) * s + 2 * x) * channels + c; out[(y * h + x) * channels + c] = Math.round((src[a] + src[a + channels] + src[a + s * channels] + src[a + s * channels + channels]) / 4); } return out; }

test('roll-off twin: a grid at 2 texels pitch at a level ends within 10 % of its mean there; a 6-texel grid is GL\'s box', () => {
  const size = 64;
  // Period 8 at level 0 is 2 texels at level 2: rolled off (sigma 1).
  const fine = stripes(size, 8);
  const got = layerRolloffMips(fine.colour, 0, size, maskWindowPitch(fine.mask, 0, size, 1), CELL_ROLLOFF_DEFAULTS, fine.mask, 0, 1);
  assert.deepEqual(got.sigmas.slice(0, 3), [[0, 0], [1, 0], [1, 0]]);
  const l2 = lumaRange(got.colour[1]);
  assert.ok(l2.range < 0.1 * l2.mean, `level 2 luma range ${l2.range.toFixed(1)} of mean ${l2.mean.toFixed(1)}`);
  // GL's chain keeps the whole stripe there (the aliasing grid).
  const gl2 = lumaRange(glBox(glBox(fine.colour, 64), 32));
  assert.ok(gl2.range > 0.5 * gl2.mean, `GL level 2 range ${gl2.range.toFixed(1)}`);
  // The mask rolls off with it.
  const m2 = lumaRange(got.mask![1], 1);
  assert.ok(m2.range < 0.1 * m2.mean, `mask level 2 range ${m2.range.toFixed(1)} of ${m2.mean.toFixed(1)}`);
  // Period 24 is 6 texels at level 2 (and 12 at level 1): untouched at both, i.e. GL's box to a byte.
  const coarse = stripes(size, 24);
  const c = layerRolloffMips(coarse.colour, 0, size, maskWindowPitch(coarse.mask, 0, size, 1), CELL_ROLLOFF_DEFAULTS, coarse.mask, 0, 1);
  assert.deepEqual(c.sigmas.slice(0, 2), [[0, 0], [0, 0]]);
  const g1 = glBox(coarse.colour, 64), g2 = glBox(g1, 32);
  for (const [ours, gl] of [[c.colour[0], g1], [c.colour[1], g2]] as const) for (let i = 0; i < gl.length; i++) assert.ok(Math.abs(ours[i] - gl[i]) <= 1, `texel ${i}: ${ours[i]} vs ${gl[i]}`);
  // At a 6-texel threshold the same grid is still untouched at level 2 (pitch 6 is not under 6).
  assert.deepEqual(layerRolloffMips(coarse.colour, 0, size, { x: 24, y: Infinity }, { ...CELL_ROLLOFF_DEFAULTS, pitch: 6 }).sigmas[1], [0, 0]);
});

test('roll-off: the 1x1 level is the exact level-0 mean, the first rolled level follows the pitch, a blank wall is GL\'s chain', () => {
  const size = 32, { colour, mask } = bayLayer(size, 4);
  const got = layerRolloffMips(colour, 0, size, maskWindowPitch(mask, 0, size, 1), CELL_ROLLOFF_DEFAULTS, mask, 0, 1);
  const mean = [0, 1, 2, 3].map(c => { let s = 0; for (let i = 0; i < size * size; i++) s += colour[i * 4 + c]; return Math.round(s / (size * size)); });
  assert.deepEqual([...got.colour[got.colour.length - 1]], mean);
  assert.equal(got.mask![got.mask!.length - 1][0], Math.round(mask.reduce((a, b) => a + b, 0) / mask.length));
  // pitch 8 across: level 2 (pitch 2) blurred; level 1 (pitch 4) at the threshold is not.
  assert.deepEqual(got.sigmas.slice(0, 2).map(s => s[0]), [0, 1]);
  const wall = bayLayer(size, 1, [180, 120, 90]).colour.fill(0).map((_, i) => (i % 4 === 3 ? 255 : 140 + (i % 7)));
  const plain = layerRolloffMips(wall, 0, size, { x: Infinity, y: Infinity }, CELL_ROLLOFF_DEFAULTS);
  const g1 = glBox(wall, size);
  for (let i = 0; i < g1.length; i++) assert.ok(Math.abs(plain.colour[0][i] - g1[i]) <= 1);
});

test('arrayRolloffMips: layers in order per level, the table decides where it has rects, the mask elsewhere; yields', async () => {
  const size = 32, layers = 3, n = size * size;
  const colour = new Uint8Array(n * 4 * layers), rgMask = new Uint8Array(n * 2 * layers), r8 = new Uint8Array(n * layers);
  const parts = [bayLayer(size, 4), bayLayer(size, 1), { colour: new Uint8Array(n * 4).fill(150), mask: new Uint8Array(n).fill(255), rects: [] as UvRect[] }];
  parts.forEach((p, l) => { colour.set(p.colour, l * n * 4); for (let i = 0; i < n; i++) { rgMask[(l * n + i) * 2] = p.mask[i]; r8[l * n + i] = p.mask[i]; } });
  let yields = 0;
  const got = await arrayRolloffMips(colour, size, layers, { options: CELL_ROLLOFF_DEFAULTS, pitchMask: rgMask, pitchMaskChannels: 2, mask: r8, maskChannels: 1, rects: l => (l === 1 ? parts[1].rects : null), sliceMs: 1e-9, yieldFn: async () => { yields++; } });
  assert.equal(got.colour.length, mipLevelCount(size));
  assert.equal(got.mask!.length, mipLevelCount(size));
  assert.equal(got.colour[0].length, 16 * 16 * 4 * layers);
  assert.equal(got.mask![0].length, 16 * 16 * layers);
  assert.deepEqual(got.layers.map(l => l.source), ['mask', 'table', 'mask']);
  // 4 windows: pitch 8, rolled off from level 2; 1 window: pitch 32 across and down, from level 4 (pitch 2); blank: never.
  assert.deepEqual(got.layers.map(l => l.from), [2, 4, 0]);
  for (let l = 0; l < layers; l++) for (let c = 0; c < 3; c++) {
    let s = 0; for (let i = 0; i < n; i++) s += colour[(l * n + i) * 4 + c];
    assert.equal(got.colour[got.colour.length - 1][l * 4 + c], Math.round(s / n));
  }
  assert.ok(yields >= 2);
  // Mask off: no mask levels.
  const noMask = await arrayRolloffMips(colour, size, layers, { options: { ...CELL_ROLLOFF_DEFAULTS, mask: false }, pitchMask: rgMask, pitchMaskChannels: 2, mask: r8, sliceMs: 0 });
  assert.equal(noMask.mask, null);
});

test('level debug colours: each level one flat colour, read back as its level', () => {
  const lv = debugLevels(8, 2, 4, l => [...LEVEL_DEBUG_RGB[l], 255]);
  assert.deepEqual(lv.map(b => b.length), [8 * 8 * 4 * 2, 4 * 4 * 4 * 2, 2 * 2 * 4 * 2, 4 * 2]);
  assert.deepEqual([...lv[2].subarray(0, 4)], [0, 255, 0, 255]);
  for (let l = 0; l <= 5; l++) assert.ok(Math.abs(debugLevelOf(...(LEVEL_DEBUG_RGB[l] as [number, number, number]).map(v => v * 0.6) as [number, number, number])! - l) < 0.01, `level ${l}`);
  assert.equal(debugLevelOf(200, 200, 200), 6);
  assert.equal(debugLevelOf(5, 5, 5), null);
  // Trilinear between levels 3 (cyan) and 4 (blue): 3.5.
  assert.ok(Math.abs(debugLevelOf(0, 128, 255)! - 3.5) < 0.02);
});

test('uploadArrayMips: R8 levels go up as RED, and from level 0 when asked', () => {
  const calls: any[] = [];
  const gl = { NO_ERROR: 0, TEXTURE_2D_ARRAY: 1, RED: 0x1903, RG: 0x8227, RGBA: 0x1908, UNSIGNED_BYTE: 0x1401, UNPACK_ALIGNMENT: 2, getError: () => 0, bindTexture: () => {}, pixelStorei: () => {}, texSubImage3D: (...a: any[]) => calls.push([a[1], a[5], a[8], a[10].length]), generateMipmap: () => calls.push(['gen']) };
  const tex = {}, renderer = { getContext: () => gl, properties: { get: () => ({ __webglTexture: {} }) }, state: null };
  assert.equal(uploadArrayMips(renderer, tex, [new Uint8Array(4 * 4 * 3), new Uint8Array(2 * 2 * 3)], 8, 3, 1).mode, 'custom');
  assert.deepEqual(calls, [[1, 4, 0x1903, 48], [2, 2, 0x1903, 12]]);
  calls.length = 0;
  assert.equal(uploadArrayMips(renderer, tex, [new Uint8Array(8 * 8 * 2 * 3)], 8, 3, 2, 0).mode, 'custom');
  assert.deepEqual(calls, [[0, 8, 0x8227, 384]]);
});
