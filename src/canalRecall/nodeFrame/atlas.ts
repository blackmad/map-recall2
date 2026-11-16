/**
 * The facade atlas in Node (lane node-world-frames): the game's colour and tint-mask texture arrays, painted by the
 * game's own painter (look/paintLookAtlas.ts `paintLookArrays`, on @napi-rs/canvas through shims.ts), mipmapped with
 * GL's box filter and sampled like `texture(sampler2DArray)` with LinearMipmapLinear filtering and repeat wrapping.
 *
 * Layout as the GPU sees it: layer-major, rows bottom-up (the painter already flips), colour RGBA and mask RG
 * (R the wall tint weight, G the accent weight; look/maskPacking.ts packs them differently for upload, the shader
 * reads the same values).
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

export type AtlasLevel = { size: number; colour: Uint8Array; mask: Uint8Array };
export type Atlas = {
  size: number; layers: number; total: number; slotBase: number;
  /** Level 0 first; every level holds all `total` layers. */
  levels: AtlasLevel[];
  /** Per layer: the mean colour (0..1) and mask, the CELL_MEAN_LOD sample of the facade tier. */
  mean: Float32Array;
};

/** Box-filter mip chain of one array (`channels` per texel, `total` layers of size²). */
export function mipChain(level0: Uint8Array, size: number, total: number, channels: number): Uint8Array[] {
  const out = [level0];
  let s = size, prev = level0;
  while (s > 1) {
    const h = s >> 1, next = new Uint8Array(h * h * total * channels);
    for (let l = 0; l < total; l++) {
      const src = l * s * s * channels, dst = l * h * h * channels;
      for (let y = 0; y < h; y++) for (let x = 0; x < h; x++) for (let c = 0; c < channels; c++) {
        const a = src + ((2 * y) * s + 2 * x) * channels + c, b = a + channels, d = a + s * channels, e = d + channels;
        next[dst + (y * h + x) * channels + c] = (prev[a] + prev[b] + prev[d] + prev[e] + 2) >> 2;
      }
    }
    out.push(next); prev = next; s = h;
  }
  return out;
}

export function atlasFrom(colour: Uint8Array, mask: Uint8Array, size: number, layers: number, total: number): Atlas {
  const c = mipChain(colour, size, total, 4), m = mipChain(mask, size, total, 2);
  const levels = c.map((col, i) => ({ size: size >> i, colour: col, mask: m[i] }));
  const last = levels[levels.length - 1], mean = new Float32Array(total * 5);
  for (let l = 0; l < total; l++) {
    for (let k = 0; k < 3; k++) mean[l * 5 + k] = last.colour[l * 4 + k] / 255;
    mean[l * 5 + 3] = last.mask[l * 2] / 255; mean[l * 5 + 4] = last.mask[l * 2 + 1] / 255;
  }
  return { size, layers, total, slotBase: layers, levels, mean };
}

/** A hash of every TypeScript source under src/canalRecall (the painter's closure lives there) and the brick photo. */
export function sourceHash(root: string): string {
  const h = createHash('sha256');
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|js|json)$/.test(e.name) && !/\.test\.ts$/.test(e.name)) { h.update(p); h.update(fs.readFileSync(p)); }
    }
  };
  walk(path.join(root, 'src/canalRecall/look'));
  for (const f of ['facadeCells.ts', 'bayTextures.ts', 'bayLook.ts', 'roofCells.ts', 'glassBlockTexture.ts', 'retailLogos.ts', 'retailTemplates.ts', 'genericFacades.ts', 'streetFacadeRendering.ts']) {
    const p = path.join(root, 'src/canalRecall', f);
    if (fs.existsSync(p)) { h.update(p); h.update(fs.readFileSync(p)); }
  }
  const brick = path.join(root, 'public/canal-drive/materials/ambientcg/Bricks057/colour.jpg');
  if (fs.existsSync(brick)) h.update(fs.readFileSync(brick));
  return h.digest('hex').slice(0, 16);
}

/**
 * The look's arrays, painted once and cached under `cacheDir` (keyed by the look, size and the painter sources).
 * The painter needs shims.ts installed first.
 */
export async function loadAtlas(root: string, cacheDir: string, look = 'photo', size = 256): Promise<{ atlas: Atlas; cached: boolean; ms: number }> {
  const t0 = performance.now();
  const key = `${look}-${size}-slots-${sourceHash(root)}`, file = path.join(cacheDir, `atlas-${key}.bin.gz`);
  let colour: Uint8Array, mask: Uint8Array, layers: number, total: number, cached = false;
  if (fs.existsSync(file)) {
    const bytes = gunzipSync(fs.readFileSync(file)), head = new DataView(bytes.buffer, bytes.byteOffset, 8);
    layers = head.getUint32(0, true); total = head.getUint32(4, true);
    const n = size * size * total;
    colour = bytes.subarray(8, 8 + n * 4); mask = bytes.subarray(8 + n * 4, 8 + n * 6);
    cached = true;
  } else {
    const { paintLookArrays } = await import('../look/paintLookAtlas.ts');
    const a = await paintLookArrays(look as never, size, { slotLayers: true, sliceMs: 1e9 });
    ({ colour, mask, layers, total } = a);
    fs.mkdirSync(cacheDir, { recursive: true });
    const head = new Uint8Array(8); new DataView(head.buffer).setUint32(0, layers, true); new DataView(head.buffer).setUint32(4, total, true);
    const all = new Uint8Array(8 + colour.length + mask.length); all.set(head); all.set(colour, 8); all.set(mask, 8 + colour.length);
    fs.writeFileSync(file, gzipSync(all, { level: 1 }));
  }
  return { atlas: atlasFrom(colour, mask, size, layers, total), cached, ms: performance.now() - t0 };
}

/** Bilinear, repeat-wrapped sample of one level and layer, added with weight k into c (rgb) and m (rg). */
function sampleLevel(a: Atlas, level: number, layer: number, u: number, v: number, k: number, c: Float64Array, m: Float64Array): void {
  const L = a.levels[level], s = L.size;
  const fx = (u - Math.floor(u)) * s - 0.5, fy = (v - Math.floor(v)) * s - 0.5;
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const xa = (x0 + s) % s, xb = (xa + 1) % s, ya = (y0 + s) % s, yb = (ya + 1) % s;
  const base = layer * s * s;
  const p00 = base + ya * s + xa, p10 = base + ya * s + xb, p01 = base + yb * s + xa, p11 = base + yb * s + xb;
  const w00 = (1 - tx) * (1 - ty) * k, w10 = tx * (1 - ty) * k, w01 = (1 - tx) * ty * k, w11 = tx * ty * k;
  const C = L.colour, M = L.mask;
  for (let ch = 0; ch < 3; ch++) c[ch] += (C[p00 * 4 + ch] * w00 + C[p10 * 4 + ch] * w10 + C[p01 * 4 + ch] * w01 + C[p11 * 4 + ch] * w11) / 255;
  for (let ch = 0; ch < 2; ch++) m[ch] += (M[p00 * 2 + ch] * w00 + M[p10 * 2 + ch] * w10 + M[p01 * 2 + ch] * w01 + M[p11 * 2 + ch] * w11) / 255;
}

/** Trilinear sample at level of detail `lod` (log2 texels per pixel), into c (rgb 0..1) and m (tint, accent weights). */
export function sampleAtlas(a: Atlas, layer: number, u: number, v: number, lod: number, c: Float64Array, m: Float64Array): void {
  c[0] = c[1] = c[2] = 0; m[0] = m[1] = 0;
  const max = a.levels.length - 1, l = lod < 0 ? 0 : lod > max ? max : lod, l0 = Math.floor(l), f = l - l0;
  if (layer < 0 || layer >= a.total) { c[0] = c[1] = c[2] = 1; return; }
  sampleLevel(a, l0, layer, u, v, 1 - f, c, m);
  if (f > 0 && l0 < max) sampleLevel(a, l0 + 1, layer, u, v, f, c, m);
}
