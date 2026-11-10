/**
 * The GLB rasteriser of the browser-free first passes (lane H12, docs/house-line.md §8). Pure: no DOM, no GL, no globals;
 * the same inputs give the same bytes.
 *
 * It is houseSpec/softRaster.ts's loop (edge functions over an N x N supersampled grid, perspective-correct barycentric
 * attributes, a z-buffer, a box resolve) generalised from one atlas and one shading rule to a scene of GLB primitives,
 * each with its own material, and to the three.js camera the sheet scripts already describe (render.ts `RenderView`:
 * eye, target, vertical fov, optional orthographic extents). softRaster stays as it is for house:preview, whose bytes
 * are pinned by its own tests.
 *
 * Frame: the sheet renderer's model frame, x east, y up, z south (three.js's world, render-page.ts). Up is +y.
 *
 * Materials, as the browser page draws them:
 *   cell  recipeLook.ts's unlit slot shader: out = texture(map, uv * uvScale).rgb * tint * vShade, sRGB bytes straight
 *         to the framebuffer (a ShaderMaterial gets no colour-space conversion); vShade is the per-vertex baked city
 *         shade (rendererShared/lightRig.ts), interpolated.
 *   lit   MeshStandardMaterial / MeshLambertMaterial diffuse under a hemisphere light, a sun and optional fill lights:
 *         out = encode(albedo / PI * (sun * max(n.l, 0) + mix(ground, sky, 0.5 n.y + 0.5) + fills)), albedo the linear
 *         base colour x the decoded texture, n the interpolated vertex normal turned toward the viewer on a back face.
 *         A standard material adds three.js's direct GGX specular for the sun and fills (`standard`); there is no
 *         environment map, so nothing indirect is specular.
 *   unlit KHR_materials_unlit (MeshBasicMaterial): out = encode(albedo).
 * Alpha: OPAQUE draws; MASK discards below the cutoff; BLEND draws after every opaque triangle, far to near, blended in
 * the encoded framebuffer as WebGL does, without writing depth (GLTFLoader sets depthWrite false on BLEND).
 * Textures are mipmapped (box pyramid) and sampled trilinearly at one level of detail per triangle (its texel area over
 * its pixel area); the browser's anisotropic filtering is not reproduced.
 */

export type Vec3 = readonly [number, number, number];
type M3 = [number, number, number];

/** A texture as GL sees it: rows bottom-up (v = 0 is row 0, CanvasTexture/GLTF flipY already applied), RGBA 0..1. */
export type RasterTexture = {
  width: number; height: number;
  /** Mip levels, level 0 first; each RGBA floats, rows bottom-up. */
  levels: { width: number; height: number; data: Float32Array }[];
  /** ClampToEdge on both axes (the recipe look's glass cells); default repeat. */
  clamp?: boolean;
};

export type RasterMaterial = {
  kind: 'cell' | 'lit' | 'unlit';
  /** cell: the slot tint (may exceed 1: a mottled cell is painted darker and the tint takes it back). lit/unlit: linear base colour. */
  color: Vec3;
  texture?: RasterTexture | null;
  /** cell only: uv multiplier (1 / SLOT_TILE_M). */
  uvScale?: number;
  /** linear emissive added before encoding (lit only). */
  emissive?: Vec3;
  opacity?: number;
  alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND';
  alphaCutoff?: number;
  /**
   * lit only: MeshStandardMaterial's direct specular (three.js BRDF_GGX: Schlick Fresnel, Smith-correlated
   * visibility, GGX distribution) for the sun and fills, with f0 = mix(0.04, albedo, metallic) and the diffuse scaled
   * by 1 - metallic. Absent: diffuse only (MeshLambertMaterial, the game look).
   */
  standard?: { roughness: number; metallic: number };
  /** false: back faces are culled. The sheet page sets DoubleSide on every material, so its callers pass true. */
  doubleSided?: boolean;
};

/** Triangles in the model frame. `shade` (per vertex) feeds the cell materials; `normals` the lit ones. */
export type RasterScene = {
  positions: Float32Array; normals: Float32Array; uvs: Float32Array; shade: Float32Array;
  /** Linear RGB per vertex (COLOR_0), multiplying lit and unlit albedo; absent = white. */
  colors?: Float32Array;
  indices: Uint32Array; triMaterial: Uint16Array; materials: RasterMaterial[];
};

/** Linear light colours already multiplied by their intensities; directions point toward the light, model frame. */
export type RasterLight = { sunDir: Vec3; sun: Vec3; sky: Vec3; ground: Vec3; fills?: { dir: Vec3; color: Vec3 }[] };

/** render.ts RenderView: a three.js camera at `eye` looking at `target`, up +y; `ortho` = [left, right, top, bottom] in metres. */
export type RasterCamera = { eye: readonly number[]; target: readonly number[]; fov: number; width: number; height: number; ortho?: readonly [number, number, number, number] | readonly number[]; near?: number; far?: number };

export type RasterOptions = {
  /** Samples per pixel side; default 2. */
  supersample?: number;
  /**
   * Where the samples sit at supersample 2: 'msaa4' (default) the standard 4x MSAA pattern (D3D/Vulkan, which
   * SwiftShader and desktop GPUs use: (0.375, 0.125), (0.875, 0.375), (0.125, 0.625), (0.625, 0.875)), so edges cover
   * the same samples as the browser's antialias: true; 'grid' the regular grid (houseSpec/softRaster.ts's).
   */
  pattern?: 'msaa4' | 'grid';
  background?: Vec3; light?: RasterLight | null;
};

export type RasterImage = { width: number; height: number; rgba: Uint8ClampedArray; ms: number; triangles: number };

export const srgbEncode = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
export const srgbDecode = (x: number) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Box-filtered mip pyramid of RGBA bytes given top-down (as a canvas or a PNG decodes): flips to GL rows. */
export function makeTexture(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, flipY = true, clamp = false): RasterTexture {
  const base = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = flipY ? height - 1 - y : y;
    for (let x = 0; x < width * 4; x++) base[y * width * 4 + x] = rgba[sy * width * 4 + x] / 255;
  }
  const levels = [{ width, height, data: base }];
  while (levels[levels.length - 1].width > 1 || levels[levels.length - 1].height > 1) {
    const p = levels[levels.length - 1], w = Math.max(1, p.width >> 1), h = Math.max(1, p.height >> 1), d = new Float32Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) {
      const x0 = Math.min(p.width - 1, x * 2), x1 = Math.min(p.width - 1, x * 2 + 1), y0 = Math.min(p.height - 1, y * 2), y1 = Math.min(p.height - 1, y * 2 + 1);
      d[(y * w + x) * 4 + c] = (p.data[(y0 * p.width + x0) * 4 + c] + p.data[(y0 * p.width + x1) * 4 + c] + p.data[(y1 * p.width + x0) * 4 + c] + p.data[(y1 * p.width + x1) * 4 + c]) / 4;
    }
    levels.push({ width: w, height: h, data: d });
  }
  return { width, height, levels, clamp };
}

/** Bilinear sample of one level into out[0..3]. */
function sampleLevel(t: RasterTexture, level: number, u: number, v: number, out: Float64Array, k: number) {
  const L = t.levels[level], w = L.width, h = L.height, d = L.data;
  let fx: number, fy: number;
  if (t.clamp) { fx = clamp01(u) * w - 0.5; fy = clamp01(v) * h - 0.5; }
  else { fx = (u - Math.floor(u)) * w - 0.5; fy = (v - Math.floor(v)) * h - 0.5; }
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  let xa: number, xb: number, ya: number, yb: number;
  if (t.clamp) { xa = Math.max(0, Math.min(w - 1, x0)); xb = Math.max(0, Math.min(w - 1, x0 + 1)); ya = Math.max(0, Math.min(h - 1, y0)); yb = Math.max(0, Math.min(h - 1, y0 + 1)); }
  else { xa = ((x0 % w) + w) % w; xb = (xa + 1) % w; ya = ((y0 % h) + h) % h; yb = (ya + 1) % h; }
  const i00 = (ya * w + xa) * 4, i10 = (ya * w + xb) * 4, i01 = (yb * w + xa) * 4, i11 = (yb * w + xb) * 4;
  const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
  for (let c = 0; c < 4; c++) out[c] += k * (d[i00 + c] * w00 + d[i10 + c] * w10 + d[i01 + c] * w01 + d[i11 + c] * w11);
}
/** Trilinear sample at level-of-detail `lod` into out[0..3] (overwritten). */
export function sampleTexture(t: RasterTexture, u: number, v: number, lod: number, out: Float64Array) {
  out[0] = out[1] = out[2] = out[3] = 0;
  const max = t.levels.length - 1, l = Math.max(0, Math.min(max, lod)), l0 = Math.floor(l), f = l - l0;
  sampleLevel(t, l0, u, v, out, 1 - f);
  if (f > 0 && l0 < max) sampleLevel(t, l0 + 1, u, v, out, f);
}

/** Camera basis of three.js `lookAt` (up +y): x right, y up, z backward (the camera looks along -z). */
export function cameraBasis(eye: readonly number[], target: readonly number[]): { x: M3; y: M3; z: M3 } {
  let z: M3 = [eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]];
  let l = Math.hypot(z[0], z[1], z[2]);
  if (l === 0) z = [0, 0, 1]; else z = [z[0] / l, z[1] / l, z[2] / l];
  // up x z; three nudges z when it is parallel to up.
  let x: M3 = [1 * z[2] - 0 * z[1], 0 * z[0] - 0 * z[2], 0 * z[1] - 1 * z[0]];
  l = Math.hypot(x[0], x[1], x[2]);
  if (l < 1e-9) { z = [z[0], z[1], z[2] + 1e-4]; const m = Math.hypot(...z); z = [z[0] / m, z[1] / m, z[2] / m]; x = [z[2], 0, -z[0]]; l = Math.hypot(x[0], x[1], x[2]); }
  x = [x[0] / l, x[1] / l, x[2] / l];
  const y: M3 = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return { x, y, z };
}

// Per clipped vertex: camera-space position (3), uv (2), normal (3), shade (1), colour (3).
const STRIDE = 12;

/** Sutherland–Hodgman against depth >= near (depth = -camera z). `poly` is a flat list of STRIDE-wide vertices. */
function clipNear(poly: number[], near: number): number[] {
  const out: number[] = [], n = poly.length / STRIDE;
  for (let i = 0; i < n; i++) {
    const a = i * STRIDE, b = ((i + 1) % n) * STRIDE, da = -poly[a + 2] - near, db = -poly[b + 2] - near;
    if (da >= 0) for (let k = 0; k < STRIDE; k++) out.push(poly[a + k]);
    if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); for (let k = 0; k < STRIDE; k++) out.push(poly[a + k] + (poly[b + k] - poly[a + k]) * t); }
  }
  return out;
}

/** Rasterise `scene` from `camera`. */
export function rasteriseScene(scene: RasterScene, camera: RasterCamera, options: RasterOptions = {}): RasterImage {
  const t0 = performance.now();
  const ss = Math.max(1, Math.round(options.supersample ?? 2));
  const msaa = ss === 2 && (options.pattern ?? 'msaa4') === 'msaa4';
  // Sample position in sample units for local sample (qx & 1, qy & 1): 2 * (pixel + offset).
  const MSX = [0.375, 0.875, 0.125, 0.625], MSY = [0.125, 0.375, 0.625, 0.875];
  const width = Math.max(1, Math.round(camera.width)), height = Math.max(1, Math.round(camera.height)), W = width * ss, H = height * ss;
  const ortho = camera.ortho && camera.ortho.length === 4 ? camera.ortho : null;
  const near = camera.near ?? (ortho ? 0.1 : 0.5), far = camera.far ?? 2000;
  const { x: cx, y: cy, z: cz } = cameraBasis(camera.eye, camera.target), e = camera.eye;
  const focal = (H / 2) / Math.tan(camera.fov * Math.PI / 360), aspect = W / H;
  void aspect;
  const bg = options.background ?? [201, 214, 224];
  const col = new Float32Array(W * H * 3), zbuf = new Float64Array(W * H).fill(Infinity), hit = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { col[i * 3] = bg[0] / 255; col[i * 3 + 1] = bg[1] / 255; col[i * 3 + 2] = bg[2] / 255; }
  const light = options.light ?? null;
  const P = scene.positions, N = scene.normals, U = scene.uvs, S = scene.shade, I = scene.indices, Cv = scene.colors;
  const toCam = (v: number, out: number[]) => {
    const dx = P[v * 3] - e[0], dy = P[v * 3 + 1] - e[1], dz = P[v * 3 + 2] - e[2];
    out.push(dx * cx[0] + dy * cx[1] + dz * cx[2], dx * cy[0] + dy * cy[1] + dz * cy[2], dx * cz[0] + dy * cz[1] + dz * cz[2],
      U[v * 2], U[v * 2 + 1], N[v * 3], N[v * 3 + 1], N[v * 3 + 2], S[v], Cv ? Cv[v * 3] : 1, Cv ? Cv[v * 3 + 1] : 1, Cv ? Cv[v * 3 + 2] : 1);
  };
  // Screen position (samples, y down) and the 1/w used for perspective-correct weights.
  const screen = (c: number[], i: number): [number, number, number, number] => {
    const xc = c[i], yc = c[i + 1], depth = -c[i + 2];
    if (ortho) return [(xc - ortho[0]) / (ortho[1] - ortho[0]) * W, (ortho[2] - yc) / (ortho[2] - ortho[3]) * H, depth, 1];
    return [W / 2 + xc / depth * focal, H / 2 - yc / depth * focal, depth, 1 / depth];
  };
  const tex = new Float64Array(4), nrm = [0, 0, 0], cache = new Float64Array(5);
  type Job = { m: RasterMaterial; poly: number[]; depth: number };
  const blended: Job[] = [];
  let drawn = 0;

  const ZERO: Vec3 = [0, 0, 0];
  const fills = light?.fills ?? [];
  const irr = [0, 0, 0];
  /** Irradiance (linear, / PI) for a unit normal into irr. */
  const irradiance = (nx: number, ny: number, nz: number) => {
    const L = light!;
    const ndl = Math.max(0, nx * L.sunDir[0] + ny * L.sunDir[1] + nz * L.sunDir[2]), hh = 0.5 * ny + 0.5;
    let ir = L.sun[0] * ndl + L.ground[0] + (L.sky[0] - L.ground[0]) * hh;
    let ig = L.sun[1] * ndl + L.ground[1] + (L.sky[1] - L.ground[1]) * hh;
    let ib = L.sun[2] * ndl + L.ground[2] + (L.sky[2] - L.ground[2]) * hh;
    for (let f = 0; f < fills.length; f++) { const fl = fills[f], d = Math.max(0, nx * fl.dir[0] + ny * fl.dir[1] + nz * fl.dir[2]); ir += fl.color[0] * d; ig += fl.color[1] * d; ib += fl.color[2] * d; }
    irr[0] = ir / Math.PI; irr[1] = ig / Math.PI; irr[2] = ib / Math.PI;
  };

  const spec = [0, 0, 0];
  // Lights for the specular term: the sun then the fills, flat arrays (no allocation per sample).
  const LD: number[] = [], LC: number[] = [];
  if (light) { LD.push(...light.sunDir); LC.push(...light.sun); for (const f of fills) { LD.push(...f.dir); LC.push(...f.color); } }
  const nLights = LD.length / 3;
  /** three.js BRDF_GGX x irradiance for the sun and fills, into spec (linear); `f0` per channel. */
  const specular = (nx: number, ny: number, nz: number, vx: number, vy: number, vz: number, alpha: number, f0r: number, f0g: number, f0b: number) => {
    const a2 = alpha * alpha, dotNV = Math.min(1, Math.max(0, nx * vx + ny * vy + nz * vz)), gNV = Math.sqrt(a2 + (1 - a2) * dotNV * dotNV);
    spec[0] = spec[1] = spec[2] = 0;
    for (let k = 0; k < nLights; k++) {
      const lx = LD[k * 3], ly = LD[k * 3 + 1], lz = LD[k * 3 + 2];
      const dotNL = Math.min(1, Math.max(0, nx * lx + ny * ly + nz * lz));
      if (dotNL <= 0) continue;
      let hx = lx + vx, hy = ly + vy, hz = lz + vz; const hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1; hx /= hl; hy /= hl; hz /= hl;
      const dotNH = Math.min(1, Math.max(0, nx * hx + ny * hy + nz * hz)), dotVH = Math.min(1, Math.max(0, vx * hx + vy * hy + vz * hz));
      const o = 1 - dotVH, o2 = o * o, fw = o2 * o2 * o;
      const gv = 0.5 / (dotNL * gNV + dotNV * Math.sqrt(a2 + (1 - a2) * dotNL * dotNL) + 1e-6);
      const den = dotNH * dotNH * (a2 - 1) + 1, kk = gv * a2 / (Math.PI * den * den) * dotNL;
      spec[0] += (f0r + (1 - f0r) * fw) * kk * LC[k * 3]; spec[1] += (f0g + (1 - f0g) * fw) * kk * LC[k * 3 + 1]; spec[2] += (f0b + (1 - f0b) * fw) * kk * LC[k * 3 + 2];
    }
  };

  const drawPolygon = (m: RasterMaterial, poly: number[], blend: boolean) => {
    const n = poly.length / STRIDE;
    if (n < 3) return;
    const sv = Array.from({ length: n }, (_, k) => screen(poly, k * STRIDE));
    // Signed area of the whole polygon (y down): negative = counter-clockwise seen from the camera = front face.
    let area2 = 0;
    for (let k = 0; k < n; k++) { const a = sv[k], b = sv[(k + 1) % n]; area2 += a[0] * b[1] - b[0] * a[1]; }
    const back = area2 > 0;
    if (Math.abs(area2) < 1e-12 || (back && !m.doubleSided)) return;
    drawn++;
    // One level of detail per polygon: texel area over pixel area (output pixels).
    let lod = 0;
    const t = m.texture ?? null;
    const cellKind = m.kind === 'cell', sc = cellKind ? m.uvScale ?? 1 : 1;
    if (t) {
      let uvArea = 0;
      for (let k = 0; k < n; k++) { const a = k * STRIDE, b = ((k + 1) % n) * STRIDE; uvArea += poly[a + 3] * poly[b + 4] - poly[b + 3] * poly[a + 4]; }
      const texels = Math.abs(uvArea) / 2 * sc * sc * t.width * t.height, pixels = Math.abs(area2) / 2 / (ss * ss);
      lod = texels > 0 && pixels > 0 ? 0.5 * Math.log2(texels / pixels) : 0;
    }
    const opacityBase = m.opacity ?? 1, mask = m.alphaMode === 'MASK', cutoff = m.alphaCutoff ?? 0.5;
    const shaded = !cellKind && m.kind === 'lit' && !!light, em = m.emissive ?? ZERO, mr = m.color[0], mg = m.color[1], mb = m.color[2];
    const std = shaded && m.standard ? m.standard : null, metal = std ? std.metallic : 0, kd = 1 - metal;
    // three.js: roughness = max(r, 0.0525) (+ the geometry roughness of curved normals, 0 on flat faces), clamped to 1; alpha = roughness^2.
    const rough = std ? Math.min(1, Math.max(0.0525, std.roughness)) : 1, galpha = rough * rough;
    // Flat polygons (every vertex normal equal, the usual building face) light once.
    let flat = false;
    if (shaded) {
      flat = true;
      for (let k = 1; k < n && flat; k++) for (let c = 5; c < 8; c++) if (Math.abs(poly[k * STRIDE + c] - poly[c]) > 1e-4) { flat = false; break; }
      if (flat) { const l = Math.hypot(poly[5], poly[6], poly[7]) || 1, f = back ? -1 / l : 1 / l; irradiance(poly[5] * f, poly[6] * f, poly[7] * f); }
    }
    // A flat polygon in an orthographic view has one normal and one view direction: its specular is one value (not per albedo texel when untextured).
    const constSpec = !!std && flat && !!ortho && !t && !Cv;
    if (constSpec) {
      const l = Math.hypot(poly[5], poly[6], poly[7]) || 1, f = back ? -1 / l : 1 / l;
      specular(poly[5] * f, poly[6] * f, poly[7] * f, cz[0], cz[1], cz[2], galpha, 0.04 + (mr - 0.04) * metal, 0.04 + (mg - 0.04) * metal, 0.04 + (mb - 0.04) * metal);
    }
    for (let k = 1; k + 1 < n; k++) {
      const A = sv[0], B = sv[k], C = sv[k + 1];
      const area = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
      if (Math.abs(area) < 1e-12) continue;
      const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
      const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
      if (x0 > x1 || y0 > y1) continue;
      const pa = 0, pb = k * STRIDE, pc = (k + 1) * STRIDE;
      const inv = 1 / area;
      // w0, w1 are affine in (sx, sy): w = (e0 + ex * sx + ey * sy)
      const w0x = -(C[1] - B[1]) * inv, w0y = (C[0] - B[0]) * inv, w0c = (B[0] * C[1] - C[0] * B[1]) * inv;
      const w1x = -(A[1] - C[1]) * inv, w1y = (A[0] - C[0]) * inv, w1c = (C[0] * A[1] - A[0] * C[1]) * inv;
      const Aw = A[3], Bw = B[3], Cw = C[3], Az = A[2], Bz = B[2], Cz = C[2];
      const ua = poly[pa + 3], ub = poly[pb + 3], uc = poly[pc + 3], va = poly[pa + 4], vb = poly[pb + 4], vc = poly[pc + 4];
      const sa = poly[pa + 8], sb = poly[pb + 8], sc2 = poly[pc + 8];
      let cachePix = -1;
      for (let py = y0; py <= y1; py++) {
        const sy = py + 0.5;
        let w0 = w0c + w0y * sy + w0x * (x0 + 0.5), w1 = w1c + w1y * sy + w1x * (x0 + 0.5);
        const rowY = msaa ? ((py >> 1) + MSY[(py & 1) * 2]) * 2 : sy, rowY1 = msaa ? ((py >> 1) + MSY[(py & 1) * 2 + 1]) * 2 : sy;
        for (let qx = x0; qx <= x1; qx++, w0 += w0x, w1 += w1x) {
          if (msaa) {
            const j = (py & 1) * 2 + (qx & 1), mx = ((qx >> 1) + MSX[j]) * 2, my = (qx & 1) ? rowY1 : rowY;
            w0 = w0c + w0y * my + w0x * mx; w1 = w1c + w1y * my + w1x * mx;
          }
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-7 || w1 < -1e-7 || w2 < -1e-7) continue;
          // Perspective-correct weights; depth from the interpolated 1/w (ortho: the screen weights, linear depth).
          const p0 = w0 * Aw, p1 = w1 * Bw, p2 = w2 * Cw, sum = p0 + p1 + p2;
          let q0 = p0 / sum, q1 = p1 / sum, q2 = p2 / sum;
          const depth = ortho ? w0 * Az + w1 * Bz + w2 * Cz : 1 / sum;
          if (depth < near || depth > far) continue;
          const i = py * W + qx;
          if (depth >= zbuf[i] - 1e-6 * (depth > 1 ? depth : 1)) continue;
          let r: number, g: number, b: number, alpha = opacityBase;
          // MSAA shades once per pixel, at its centre (extrapolated when the centre is off the triangle), and writes that
          // colour to every covered sample: the texture is read at the pixel's footprint, not 4 times half a pixel apart.
          const pix = msaa ? (py >> 1) * width + (qx >> 1) : -1;
          if (msaa && pix === cachePix) { r = cache[0]; g = cache[1]; b = cache[2]; alpha = cache[3]; if (cache[4]) continue; }
          else {
          if (msaa) {
            const cxs = (qx >> 1) * 2 + 1, cys = (py >> 1) * 2 + 1, c0 = w0c + w0y * cys + w0x * cxs, c1 = w1c + w1y * cys + w1x * cxs, c2 = 1 - c0 - c1;
            const e0 = c0 * Aw, e1 = c1 * Bw, e2 = c2 * Cw, es = e0 + e1 + e2;
            if (es > 0 || ortho) { q0 = e0 / es; q1 = e1 / es; q2 = e2 / es; }
          }
          if (cellKind) {
            const shade = q0 * sa + q1 * sb + q2 * sc2;
            if (t) sampleTexture(t, (q0 * ua + q1 * ub + q2 * uc) * sc, (q0 * va + q1 * vb + q2 * vc) * sc, lod, tex); else { tex[0] = tex[1] = tex[2] = 1; }
            r = clamp01(tex[0] * mr * shade); g = clamp01(tex[1] * mg * shade); b = clamp01(tex[2] * mb * shade);
          } else {
            let ar = mr, ag = mg, ab = mb;
            if (Cv) { ar *= q0 * poly[pa + 9] + q1 * poly[pb + 9] + q2 * poly[pc + 9]; ag *= q0 * poly[pa + 10] + q1 * poly[pb + 10] + q2 * poly[pc + 10]; ab *= q0 * poly[pa + 11] + q1 * poly[pb + 11] + q2 * poly[pc + 11]; }
            if (t) { sampleTexture(t, q0 * ua + q1 * ub + q2 * uc, q0 * va + q1 * vb + q2 * vc, lod, tex); ar *= srgbDecode(tex[0]); ag *= srgbDecode(tex[1]); ab *= srgbDecode(tex[2]); alpha *= tex[3]; }
            if (mask && alpha < cutoff) { if (msaa) { cachePix = pix; cache[4] = 1; } continue; }
            if (!shaded) { r = srgbEncode(clamp01(ar)); g = srgbEncode(clamp01(ag)); b = srgbEncode(clamp01(ab)); }
            else {
              if (!flat) {
                nrm[0] = q0 * poly[pa + 5] + q1 * poly[pb + 5] + q2 * poly[pc + 5];
                nrm[1] = q0 * poly[pa + 6] + q1 * poly[pb + 6] + q2 * poly[pc + 6];
                nrm[2] = q0 * poly[pa + 7] + q1 * poly[pb + 7] + q2 * poly[pc + 7];
                const l = Math.hypot(nrm[0], nrm[1], nrm[2]) || 1, f = back ? -1 / l : 1 / l;
                irradiance(nrm[0] * f, nrm[1] * f, nrm[2] * f);
              }
              if (std && constSpec) {
                r = srgbEncode(clamp01(ar * kd * irr[0] + spec[0] + em[0])); g = srgbEncode(clamp01(ag * kd * irr[1] + spec[1] + em[1])); b = srgbEncode(clamp01(ab * kd * irr[2] + spec[2] + em[2]));
              } else if (std) {
                let nx: number, ny: number, nz: number;
                if (flat) { const l = Math.hypot(poly[5], poly[6], poly[7]) || 1, f = back ? -1 / l : 1 / l; nx = poly[5] * f; ny = poly[6] * f; nz = poly[7] * f; }
                else { const l = Math.hypot(nrm[0], nrm[1], nrm[2]) || 1, f = back ? -1 / l : 1 / l; nx = nrm[0] * f; ny = nrm[1] * f; nz = nrm[2] * f; }
                let vx: number, vy: number, vz: number;
                if (ortho) { vx = cz[0]; vy = cz[1]; vz = cz[2]; }
                else {
                  const px = q0 * poly[pa] + q1 * poly[pb] + q2 * poly[pc], pyc = q0 * poly[pa + 1] + q1 * poly[pb + 1] + q2 * poly[pc + 1], pz = q0 * poly[pa + 2] + q1 * poly[pb + 2] + q2 * poly[pc + 2];
                  vx = -(px * cx[0] + pyc * cy[0] + pz * cz[0]); vy = -(px * cx[1] + pyc * cy[1] + pz * cz[1]); vz = -(px * cx[2] + pyc * cy[2] + pz * cz[2]);
                  const l = Math.hypot(vx, vy, vz) || 1; vx /= l; vy /= l; vz /= l;
                }
                specular(nx, ny, nz, vx, vy, vz, galpha, 0.04 + (ar - 0.04) * metal, 0.04 + (ag - 0.04) * metal, 0.04 + (ab - 0.04) * metal);
                r = srgbEncode(clamp01(ar * kd * irr[0] + spec[0] + em[0])); g = srgbEncode(clamp01(ag * kd * irr[1] + spec[1] + em[1])); b = srgbEncode(clamp01(ab * kd * irr[2] + spec[2] + em[2]));
              } else { r = srgbEncode(clamp01(ar * irr[0] + em[0])); g = srgbEncode(clamp01(ag * irr[1] + em[1])); b = srgbEncode(clamp01(ab * irr[2] + em[2])); }
            }
          }
          if (msaa) { cachePix = pix; cache[0] = r; cache[1] = g; cache[2] = b; cache[3] = alpha; cache[4] = 0; }
          }
          if (blend) {
            const a = clamp01(alpha);
            col[i * 3] = col[i * 3] * (1 - a) + r * a; col[i * 3 + 1] = col[i * 3 + 1] * (1 - a) + g * a; col[i * 3 + 2] = col[i * 3 + 2] * (1 - a) + b * a;
            if (a > 0) hit[i] = 1;
          } else {
            zbuf[i] = depth; hit[i] = 1;
            col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
          }
        }
      }
    }
  };

  const buf: number[] = [];
  for (let tri = 0; tri + 2 < I.length; tri += 3) {
    const m = scene.materials[scene.triMaterial[tri / 3]];
    if (!m || (m.opacity ?? 1) <= 0) continue;
    buf.length = 0;
    toCam(I[tri], buf); toCam(I[tri + 1], buf); toCam(I[tri + 2], buf);
    const d0 = -buf[2], d1 = -buf[STRIDE + 2], d2 = -buf[2 * STRIDE + 2];
    if (d0 < near && d1 < near && d2 < near) continue;
    if (d0 > far && d1 > far && d2 > far) continue;
    const poly = d0 < near || d1 < near || d2 < near ? clipNear(buf, near) : buf.slice();
    if (m.alphaMode === 'BLEND') { blended.push({ m, poly, depth: (d0 + d1 + d2) / 3 }); continue; }
    drawPolygon(m, poly, false);
  }
  // three sorts transparent objects far to near (per object); per triangle here.
  blended.sort((a, b) => b.depth - a.depth);
  for (const j of blended) drawPolygon(j.m, j.poly, true);

  const rgba = new Uint8ClampedArray(width * height * 4), n = ss * ss;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let r = 0, g = 0, b = 0, h = 0;
    for (let dy = 0; dy < ss; dy++) for (let dx = 0; dx < ss; dx++) {
      const i = (y * ss + dy) * W + x * ss + dx;
      r += col[i * 3]; g += col[i * 3 + 1]; b += col[i * 3 + 2]; h += hit[i];
    }
    const o = (y * width + x) * 4;
    rgba[o] = Math.round(r / n * 255); rgba[o + 1] = Math.round(g / n * 255); rgba[o + 2] = Math.round(b / n * 255); rgba[o + 3] = 255;
    void h;
  }
  return { width, height, rgba, ms: performance.now() - t0, triangles: drawn };
}
