/**
 * Software rasteriser for the Node house preview (house line H2, docs/house-line.md §2). Pure: no DOM, no GL.
 *
 * Input is a facade chunk as threeBuildingFeatures.buildFeatureChunk returns it (positions in ORIGIN-local metres,
 * x east, y north, z up; uv; one atlas layer byte per vertex; RGBA tint whose alpha is the directional shade; RGBA
 * accent) and the painted atlas (look/paintLookAtlas.ts: colour RGBA, mask RG, rows stored bottom-up, i.e. in GL's
 * texture row order, so v = 0 is row 0). Per pixel it does what the unlit facade shader does in the near tier
 * (threeBuildingsBrowser.ts FRAGMENT):
 *   c = texture(cells, uv, layer); m = texture(masks, uv, layer).rg   (bilinear, repeat-wrapped: fract(uv))
 *   c *= mix(1, tint, m.r) * mix(1, accent, m.g); out = c * shade
 * with perspective-correct barycentric attributes, a z-buffer, back-face culling (the material is FrontSide) and
 * N x N supersampling.
 *
 * With `lit` it does what the lit city look does instead (look/cityLook.ts createCityLookMaterial: a flat-shaded
 * MeshLambertMaterial under the shared rig, rendererShared/lightRig.ts):
 *   cityC = c * mix(1, tint, m.r) * mix(1, accent, m.g) * mix(1, wallGain, m.r)
 *   out = pow(cityC, 2.2) / PI * (sun * max(n.l, 0) + mix(ground, sky, 0.5 n.z + 0.5))
 *       + skyTint * (1 - smoothstep(0.06, 0.2, luma(cityC))) * (1 - m.r)          (linear, then sRGB-encoded)
 * with n the triangle's face normal (flatShading) and the baked shade (tint alpha) unused, as in the game's lit path.
 * Not reproduced: the far/roof tiers, mipmaps, cast shadows, fog, post-processing, the analytic window SDF.
 *
 * Extends the triangle loop of landmarks/facadeCompare.ts renderElevation (material ids, ortho only) with texture
 * sampling and a perspective camera.
 */

import { facadePixel } from '../look/facadeTwin.js';
import type { FacadeRecord } from '../look/facadeRecord.js';
export type Vec3 = readonly [number, number, number];

export type RasterMesh = {
  positions: Float32Array; uvs: Float32Array; layers: Uint8Array;
  tints: Uint8Array; accents: Uint8Array; indices: Uint32Array;
  /**
   * F1 (#380, `--shader-facades`): the record path. Per vertex the wall metres (u, v, run length), the record index
   * (RASTER_NO_RECORD: drawn from the atlas as before) and the wall kind; a triangle whose last vertex has a record is
   * coloured by the record shader's CPU twin (look/facadeTwin.ts facadePixel), lit as the record variant is.
   */
  record?: { walls: Float32Array; recs: Uint16Array; wallKinds: Uint8Array; records: readonly FacadeRecord[] };
};
export const RASTER_NO_RECORD = 0xffff;
export type RasterAtlas = { colour: Uint8Array; mask: Uint8Array; size: number; total: number };

/**
 * Orthographic elevation: the viewer stands outside the wall looking along -normal. `origin` is the wall's left end at
 * ground level (as the viewer sees it), `right` the unit vector along the wall to the viewer's right, `normal` the
 * outward unit normal; up is +z. The image covers u in [u0, u1] metres along `right` and heights [v0, v1] above origin.z.
 */
export type OrthoView = { kind: 'ortho'; origin: Vec3; right: Vec3; normal: Vec3; u0: number; u1: number; v0: number; v1: number; pxPerM: number };
/** Pinhole camera: `fovDeg` is the vertical field of view; up is +z. */
export type PerspectiveView = { kind: 'perspective'; eye: Vec3; target: Vec3; fovDeg: number; width: number; height: number; near?: number };
export type RasterView = OrthoView | PerspectiveView;

export type RasterOptions = {
  /** Samples per pixel side (2 = 4 samples a pixel). */
  supersample?: number;
  /** sRGB bytes for pixels no triangle covers. */
  background?: Vec3;
  /** Draw only these vertex ranges (a building's range in the chunk); default every triangle. */
  keep?: (vertex: number) => boolean;
  /** The lit city look (see the header); default the unlit near-tier facade shader. */
  lit?: LitShading;
  /** Draw back faces too, lit with the normal turned toward the viewer (double-sided GLB materials). */
  twoSided?: boolean;
  /** Perspective views only: an endless flat ground plane at height `z` in sRGB bytes `rgb`, depth-tested. */
  ground?: { z: number; rgb: Vec3 };
};

/** The lit city look's rig, every colour linear and already multiplied by its intensity. */
export type LitShading = {
  /** Unit vector toward the sun, east/north/up. */
  sunDir: Vec3;
  sun: Vec3;
  sky: Vec3;
  ground: Vec3;
  /** Gain on tinted texels (m.r): litFacadeWallGain x CITY_LIT_LEVEL. */
  wallGain: number;
  /** Emissive sky tint on dark untinted texels (cityLook.ts SKY_TINT). */
  skyTint: Vec3;
};

const srgbEncode = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);

export type RasterImage = {
  width: number; height: number;
  /** RGBA bytes, row 0 at the top. Alpha 255 where a triangle covered any sample, else 0. */
  rgba: Uint8ClampedArray;
  /** Share of each pixel's samples that hit geometry (0..1), row 0 at the top. */
  coverage: Float32Array;
};

const sub = (a: Vec3, b: Vec3): [number, number, number] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): [number, number, number] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const smoothstep = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const norm = (a: Vec3): [number, number, number] => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Image size of a view at supersample 1. */
export function viewSize(view: RasterView): { width: number; height: number } {
  if (view.kind === 'perspective') return { width: view.width, height: view.height };
  return { width: Math.max(1, Math.round((view.u1 - view.u0) * view.pxPerM)), height: Math.max(1, Math.round((view.v1 - view.v0) * view.pxPerM)) };
}

/**
 * Projects every vertex into the supersampled screen: x, y in samples (y down), w = view depth (1 for ortho; the
 * camera-space distance for perspective, > 0 in front), z = the depth compared in the z-buffer (smaller is nearer).
 */
function project(mesh: RasterMesh, view: RasterView, ss: number, W: number, H: number) {
  const n = mesh.positions.length / 3, X = new Float64Array(n), Y = new Float64Array(n), Z = new Float64Array(n), Wc = new Float64Array(n);
  const P = mesh.positions;
  if (view.kind === 'ortho') {
    const k = view.pxPerM * ss, { origin: o, right: r, normal: nn } = view;
    for (let v = 0; v < n; v++) {
      const dx = P[v * 3] - o[0], dy = P[v * 3 + 1] - o[1], dz = P[v * 3 + 2] - o[2];
      X[v] = (dx * r[0] + dy * r[1] + dz * r[2] - view.u0) * k;
      Y[v] = (view.v1 - dz) * k;
      Z[v] = -(dx * nn[0] + dy * nn[1] + dz * nn[2]);
      Wc[v] = 1;
    }
  } else {
    const f = norm(sub(view.target, view.eye)), side = norm(cross(f, [0, 0, 1])), up = cross(side, f);
    const focal = (H / 2) / Math.tan(view.fovDeg * Math.PI / 360);
    for (let v = 0; v < n; v++) {
      const d: Vec3 = [P[v * 3] - view.eye[0], P[v * 3 + 1] - view.eye[1], P[v * 3 + 2] - view.eye[2]];
      const z = dot(d, f);
      Wc[v] = z; Z[v] = z;
      X[v] = W / 2 + dot(d, side) / z * focal;
      Y[v] = H / 2 - dot(d, up) / z * focal;
    }
  }
  return { X, Y, Z, Wc };
}

/** Rasterise `mesh` with `atlas` from `view`. */
export function rasterise(mesh: RasterMesh, atlas: RasterAtlas, view: RasterView, options: RasterOptions = {}): RasterImage {
  const ss = Math.max(1, Math.round(options.supersample ?? 2));
  const { width, height } = viewSize(view), W = width * ss, H = height * ss;
  const { X, Y, Z, Wc } = project(mesh, view, ss, W, H);
  const near = view.kind === 'perspective' ? view.near ?? 0.5 : -Infinity;
  const zbuf = new Float64Array(W * H).fill(Infinity);
  const col = new Float32Array(W * H * 3), hit = new Uint8Array(W * H);
  const { colour, mask, size, total } = atlas, px = size * size;
  const I = mesh.indices, U = mesh.uvs, L = mesh.layers, T = mesh.tints, A = mesh.accents;
  const keep = options.keep, lit = options.lit, twoSided = !!options.twoSided;
  const s = new Float32Array(6), irr = [0, 0, 0];
  const P = mesh.positions;
  /** Bilinear, repeat-wrapped sample of colour (rgb 0..1) and mask (rg 0..1) on `layer` at (u, v): into s[0..4]. */
  const sample = (layer: number, u: number, v: number) => {
    const base = layer * px;
    const fx = (u - Math.floor(u)) * size - 0.5, fy = (v - Math.floor(v)) * size - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const xa = ((x0 % size) + size) % size, xb = (xa + 1) % size, ya = ((y0 % size) + size) % size, yb = (ya + 1) % size;
    const i00 = base + ya * size + xa, i10 = base + ya * size + xb, i01 = base + yb * size + xa, i11 = base + yb * size + xb;
    const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
    for (let c = 0; c < 3; c++) s[c] = (colour[i00 * 4 + c] * w00 + colour[i10 * 4 + c] * w10 + colour[i01 * 4 + c] * w01 + colour[i11 * 4 + c] * w11) / 255;
    for (let c = 0; c < 2; c++) s[3 + c] = (mask[i00 * 2 + c] * w00 + mask[i10 * 2 + c] * w10 + mask[i01 * 2 + c] * w01 + mask[i11 * 2 + c] * w11) / 255;
  };
  for (let t = 0; t + 2 < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    if (keep && !keep(a)) continue;
    if (Wc[a] < near || Wc[b] < near || Wc[c] < near) continue;
    const ax = X[a], ay = Y[a], bx = X[b], by = Y[b], cx = X[c], cy = Y[c];
    // Signed area in screen space (y down): a front face (counter-clockwise seen from outside in GL) is negative here.
    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    const back = area > 1e-9;
    if (!(area < -1e-9) && !(twoSided && back)) continue;
    if (lit) {
      // Face normal (counter-clockwise front), turned toward the viewer for a drawn back face.
      const e1: Vec3 = [P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]];
      const e2: Vec3 = [P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]];
      let nrm = norm(cross(e1, e2));
      if (back) nrm = [-nrm[0], -nrm[1], -nrm[2]];
      const ndl = Math.max(0, dot(nrm, lit.sunDir)), h = 0.5 * nrm[2] + 0.5;
      for (let k = 0; k < 3; k++) irr[k] = (lit.sun[k] * ndl + lit.ground[k] + (lit.sky[k] - lit.ground[k]) * h) / Math.PI;
    }
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    if (x0 > x1 || y0 > y1) continue;
    const layer = Math.min(L[c], total - 1); // GL's provoking vertex for `flat` varyings is the last one
    const RC = mesh.record, recIx = RC ? RC.recs[c] : RASTER_NO_RECORD, rec = recIx !== RASTER_NO_RECORD ? RC!.records[recIx] : undefined;
    const RW = RC?.walls, kindC = RC ? RC.wallKinds[c] : 0;
    /** Perspective-correct wall metres at sample (sx, sy) of this triangle. */
    const wallAt = (sx: number, sy: number, out: number[]) => {
      const w0 = ((bx - sx) * (cy - sy) - (cx - sx) * (by - sy)) / area, w1 = ((cx - sx) * (ay - sy) - (ax - sx) * (cy - sy)) / area, w2 = 1 - w0 - w1;
      const p0 = w0 / Wc[a], p1 = w1 / Wc[b], p2 = w2 / Wc[c], inv = 1 / (p0 + p1 + p2);
      for (let k = 0; k < 3; k++) out[k] = (p0 * RW![a * 3 + k] + p1 * RW![b * 3 + k] + p2 * RW![c * 3 + k]) * inv;
    };
    const wq = [0, 0, 0], wx = [0, 0, 0], wy = [0, 0, 0];
    const ia = 1 / Wc[a], ib = 1 / Wc[b], ic = 1 / Wc[c];
    for (let py = y0; py <= y1; py++) for (let qx = x0; qx <= x1; qx++) {
      const sx = qx + 0.5, sy = py + 0.5;
      const w0 = ((bx - sx) * (cy - sy) - (cx - sx) * (by - sy)) / area;
      const w1 = ((cx - sx) * (ay - sy) - (ax - sx) * (cy - sy)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-7 || w1 < -1e-7 || w2 < -1e-7) continue;
      const z = w0 * Z[a] + w1 * Z[b] + w2 * Z[c], i = py * W + qx;
      if (z >= zbuf[i] - 1e-5) continue;
      zbuf[i] = z;
      // Perspective-correct weights (ortho: w = 1, so these are the screen weights).
      const p0 = w0 * ia, p1 = w1 * ib, p2 = w2 * ic, inv = 1 / (p0 + p1 + p2), q0 = p0 * inv, q1 = p1 * inv, q2 = p2 * inv;
      const u = q0 * U[a * 2] + q1 * U[b * 2] + q2 * U[c * 2], v = q0 * U[a * 2 + 1] + q1 * U[b * 2 + 1] + q2 * U[c * 2 + 1];
      if (rec) {
        // The record shader's twin; fwidth = |d/dx| + |d/dy| of the wall metres over one sample.
        const sx1 = qx + 0.5, sy1 = py + 0.5;
        wallAt(sx1, sy1, wq); wallAt(sx1 + 1, sy1, wx); wallAt(sx1, sy1 + 1, wy);
        const fwu = Math.abs(wx[0] - wq[0]) + Math.abs(wy[0] - wq[0]), fwv = Math.abs(wx[1] - wq[1]) + Math.abs(wy[1] - wq[1]);
        const t = facadePixel(rec, [wq[0], wq[1], wq[2]], kindC, [fwu, fwv]);
        s[0] = t.rgb[0]; s[1] = t.rgb[1]; s[2] = t.rgb[2]; s[3] = t.m[0]; s[4] = t.m[1];
      } else sample(layer, u, v);
      const mr = s[3], mg = s[4];
      const shade = lit ? 1 : (q0 * T[a * 4 + 3] + q1 * T[b * 4 + 3] + q2 * T[c * 4 + 3]) / 255;
      for (let k = 0; k < 3; k++) {
        const tint = rec ? 1 : (q0 * T[a * 4 + k] + q1 * T[b * 4 + k] + q2 * T[c * 4 + k]) / 255;
        const accent = rec ? 1 : (q0 * A[a * 4 + k] + q1 * A[b * 4 + k] + q2 * A[c * 4 + k]) / 255;
        col[i * 3 + k] = s[k] * (1 + (tint - 1) * mr) * (1 + (accent - 1) * mg) * shade;
      }
      if (lit) {
        const g = 1 + (lit.wallGain - 1) * mr;
        const cr = col[i * 3] * g, cg = col[i * 3 + 1] * g, cb = col[i * 3 + 2] * g;
        const luma = 0.299 * cr + 0.587 * cg + 0.114 * cb, e = (1 - smoothstep(0.06, 0.2, luma)) * (1 - mr);
        col[i * 3] = srgbEncode(Math.min(1, Math.pow(Math.max(0, cr), 2.2) * irr[0] + lit.skyTint[0] * e));
        col[i * 3 + 1] = srgbEncode(Math.min(1, Math.pow(Math.max(0, cg), 2.2) * irr[1] + lit.skyTint[1] * e));
        col[i * 3 + 2] = srgbEncode(Math.min(1, Math.pow(Math.max(0, cb), 2.2) * irr[2] + lit.skyTint[2] * e));
      }
      hit[i] = 1;
    }
  }
  // Ground plane: a sample whose ray meets z = ground.z in front of the camera and nearer than the geometry.
  if (options.ground && view.kind === 'perspective') {
    const f = norm(sub(view.target, view.eye)), side = norm(cross(f, [0, 0, 1])), up = cross(side, f);
    const focal = (H / 2) / Math.tan(view.fovDeg * Math.PI / 360), gz = options.ground.z, rgb = options.ground.rgb;
    for (let py = 0; py < H; py++) for (let qx = 0; qx < W; qx++) {
      const sx = (qx + 0.5 - W / 2) / focal, sy = (H / 2 - py - 0.5) / focal;
      const dz = f[2] + side[2] * sx + up[2] * sy; // ray direction's z for camera depth 1
      if (dz >= -1e-9) continue;
      const depth = (gz - view.eye[2]) / dz, i = py * W + qx;
      if (depth <= 0 || depth >= zbuf[i]) continue;
      zbuf[i] = depth; hit[i] = 1;
      col[i * 3] = rgb[0] / 255; col[i * 3 + 1] = rgb[1] / 255; col[i * 3 + 2] = rgb[2] / 255;
    }
  }
  // Resolve the supersamples: box filter over each ss x ss block.
  const bg = options.background ?? [159, 184, 207];
  const rgba = new Uint8ClampedArray(width * height * 4), coverage = new Float32Array(width * height);
  const n = ss * ss;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let r = 0, g = 0, b = 0, h = 0;
    for (let dy = 0; dy < ss; dy++) for (let dx = 0; dx < ss; dx++) {
      const i = (y * ss + dy) * W + x * ss + dx;
      if (hit[i]) { r += col[i * 3] * 255; g += col[i * 3 + 1] * 255; b += col[i * 3 + 2] * 255; h++; }
      else { r += bg[0]; g += bg[1]; b += bg[2]; }
    }
    const o = (y * width + x) * 4;
    rgba[o] = r / n; rgba[o + 1] = g / n; rgba[o + 2] = b / n; rgba[o + 3] = h ? 255 : 0;
    coverage[y * width + x] = h / n;
  }
  return { width, height, rgba, coverage };
}
