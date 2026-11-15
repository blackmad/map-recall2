/**
 * The world-frame rasteriser (lane node-world-frames, 2026-11-15): a deferred software renderer for a whole street
 * scene (tens of thousands of draws, a few million triangles) at the game's 2880 x 1800 likeness frame. Pure: no DOM,
 * no GL, no globals; the same inputs give the same bytes.
 *
 * Where glbRaster/raster.ts shades every covered sample of every triangle in draw order (right for one GLB), a street
 * has 5-20x overdraw, so this renders a visibility buffer first and shades once per pixel and visible triangle:
 *
 *   1. visibility: every triangle is clipped against the near plane, projected and scan-converted at the standard 4x
 *      MSAA sample positions (raster.ts's pattern, which SwiftShader and desktop GPUs use) into a depth and a
 *      triangle-id buffer (2 x 4 bytes a sample);
 *   2. resolve: per pixel, the distinct triangles among its four samples are shaded once each at the pixel centre
 *      (extrapolated when the centre is off the triangle, as MSAA does) and averaged by coverage; samples nobody
 *      covered take the background (the sky) at that pixel;
 *   3. blend: transparent draws are drawn after, far to near per triangle, at the pixel centre, depth-tested against the
 *      pixel's nearest opaque sample, without writing depth.
 *
 * Attributes are interpolated by casting the pixel's ray onto the triangle's plane in world space (exact perspective-
 * correct barycentrics, and a clipped triangle shades from its original vertices).
 *
 * Frame: world x east, y north, z up (metres about the camera); the camera is mapCamera.ts's CameraFrame (eye, right,
 * up, forward, focal in output px). Front faces are counter-clockwise seen from the camera (three's default, after
 * three's own mirror-matrix flip of the game's Mercator transform).
 */

export type V3 = [number, number, number];

export type WorldCamera = {
  eye: readonly number[]; right: readonly number[]; up: readonly number[]; forward: readonly number[];
  /** Focal length in output pixels. */
  focal: number; width: number; height: number;
  near?: number; far?: number;
  /** The game camera's near plane, metres, for polygon offsets' depth units (fpsCamera: centre distance / 120). */
  glNear?: number;
};

/** What a shader gets per shaded pixel and triangle. */
export type ShadeInput = {
  /** Vertex indices of the triangle in the draw's arrays. */
  i0: number; i1: number; i2: number;
  /** Perspective-correct barycentrics at the pixel centre (may be slightly outside [0, 1] at an edge). */
  b0: number; b1: number; b2: number;
  /** World position at the pixel centre. */
  px: number; py: number; pz: number;
  /** Distance from the eye, metres. */
  dist: number;
  /** Unit geometric normal of the triangle, turned toward the viewer when `back`. */
  nx: number; ny: number; nz: number;
  back: boolean;
  /** Output pixel. */
  x: number; y: number;
  /** |cos| of the angle between the view ray and the surface normal (1 = square on). */
  cosView: number;
};

export interface WorldMaterial {
  /** Write sRGB 0..1 (r, g, b) and alpha into out; return false to discard (a MASK cutout, a hidden vertex). */
  shade(s: ShadeInput, out: Float64Array): boolean;
}

export type WorldDraw = {
  /** World positions (x east, y north, z up), 3 per vertex. */
  positions: Float32Array | Float64Array;
  indices: Uint32Array | Uint16Array;
  material: WorldMaterial;
  /** 'back' culls back faces (FrontSide), 'none' draws both (DoubleSide). */
  cull?: 'back' | 'none';
  /** Drawn in the blend pass (alpha from the shader), after every opaque draw. */
  blend?: boolean;
  /** Skipped by the visibility pass but still shading (unused): a debugging aid. */
  name?: string;
  /** Optional per-triangle filter: false drops the triangle (a hidden building's range). */
  keep?: (tri: number) => boolean;
  /**
   * three's polygonOffset with factor -k and units -2k (the own ground's coplanar layer ranks): the triangle's window
   * depth is pulled toward the camera by k x (its depth slope per framebuffer pixel + 2 depth units).
   */
  offset?: number;
  /** A per-sample discard by world position (the ground's water cut): true drops the sample before the depth write. */
  cut?: (x: number, y: number, z: number) => boolean;
};

export type Background = (x: number, y: number, dir: V3, out: Float64Array) => void;

export type WorldRasterOptions = { background: Background };

export type WorldImage = {
  width: number; height: number; rgba: Uint8ClampedArray;
  /** Per pixel, the nearest opaque depth (distance along the view axis), Infinity for sky. */
  depth: Float32Array;
  /** Per pixel, the global id of the triangle at the pixel centre's nearest sample (-1: sky), for picks. */
  ids: Int32Array;
  stats: { triangles: number; drawn: number; visibilityMs: number; resolveMs: number; blendMs: number };
  /** Global triangle id → [draw index, triangle index]. */
  locate(id: number): [number, number];
};

/** Distance from the eye to a draw's bounding box (0 inside). */
function boxDistance(P: ArrayLike<number>, ex: number, ey: number, ez: number): number {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  return Math.hypot(Math.max(x0 - ex, 0, ex - x1), Math.max(y0 - ey, 0, ey - y1), Math.max(z0 - ez, 0, ez - z1));
}

/** A draw's bounding box against the view frustum: false when all eight corners are outside one plane. */
function drawVisible(P: ArrayLike<number>, ex: number, ey: number, ez: number, rx: number, ry: number, rz: number, ux: number, uy: number, uz: number, fx: number, fy: number, fz: number, focal: number, cxs: number, cys: number, near: number, far: number): boolean {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) { const x = P[i], y = P[i + 1], z = P[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  if (!(x0 <= x1)) return false;
  const out = [0, 0, 0, 0, 0, 0];
  for (let k = 0; k < 8; k++) {
    const dx = (k & 1 ? x1 : x0) - ex, dy = (k & 2 ? y1 : y0) - ey, dz = (k & 4 ? z1 : z0) - ez;
    const x = (dx * rx + dy * ry + dz * rz) * focal, y = (dx * ux + dy * uy + dz * uz) * focal, z = dx * fx + dy * fy + dz * fz;
    if (z < near) out[0]++; if (z > far) out[1]++; if (x < -cxs * z) out[2]++; if (x > cxs * z) out[3]++; if (y > cys * z) out[4]++; if (y < -cys * z) out[5]++;
  }
  return !out.some(n => n === 8);
}

const MSX = [0.375, 0.875, 0.125, 0.625], MSY = [0.125, 0.375, 0.625, 0.875];

/** Rasterise `draws` from `camera`. */
export function rasteriseWorld(draws: readonly WorldDraw[], camera: WorldCamera, options: WorldRasterOptions): WorldImage {
  const width = Math.round(camera.width), height = Math.round(camera.height);
  const W = width * 2, H = height * 2, N = W * H;
  const near = camera.near ?? 0.25, far = camera.far ?? 20000;
  const ex = camera.eye[0], ey = camera.eye[1], ez = camera.eye[2];
  const [rx, ry, rz] = camera.right, [ux, uy, uz] = camera.up, [fx, fy, fz] = camera.forward;
  const focal = camera.focal * 2, cxs = W / 2, cys = H / 2, glNear = camera.glNear ?? 0.2;
  const depth = new Float32Array(N).fill(Infinity), ids = new Int32Array(N).fill(-1);
  const base: number[] = [];
  let total = 0;
  for (const d of draws) { base.push(total); total += Math.floor(d.indices.length / 3); }
  const locate = (id: number): [number, number] => {
    let lo = 0, hi = draws.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (base[mid] <= id) lo = mid; else hi = mid - 1; }
    return [lo, id - base[lo]];
  };

  // ---- 1. visibility -------------------------------------------------------------------------------------------
  const t0 = performance.now();
  let drawn = 0;
  // Camera-space vertex: x right, y up, z forward (depth).
  const cv = new Float64Array(9), poly = new Float64Array(5 * 3 * 2), out2 = new Float64Array(5 * 3 * 2);
  const sx = new Float64Array(6), sy = new Float64Array(6), sw = new Float64Array(6);
  const blendTris: Array<{ d: number; t: number; depth: number }> = [];
  // Near draws first (by their boxes' nearest point): later, farther samples fail the depth test before any write or cut.
  const order = draws.map((d, i) => ({ i, d: boxDistance(d.positions, ex, ey, ez) })).sort((a, b) => a.d - b.d).map(o => o.i);
  for (const di of order) {
    const d = draws[di], P = d.positions, I = d.indices, cull = d.cull !== 'none', nt = Math.floor(I.length / 3), keep = d.keep, cut = d.cut, offK = d.offset ?? 0;
    if (!drawVisible(P, ex, ey, ez, rx, ry, rz, ux, uy, uz, fx, fy, fz, focal, cxs, cys, near, far)) continue;
    for (let t = 0; t < nt; t++) {
      if (keep && !keep(t)) continue;
      let allNear = true, allFar = true;
      for (let k = 0; k < 3; k++) {
        const v = I[t * 3 + k] * 3, dx = P[v] - ex, dy = P[v + 1] - ey, dz = P[v + 2] - ez;
        const x = dx * rx + dy * ry + dz * rz, y = dx * ux + dy * uy + dz * uz, z = dx * fx + dy * fy + dz * fz;
        cv[k * 3] = x; cv[k * 3 + 1] = y; cv[k * 3 + 2] = z;
        if (z >= near) allNear = false;
        if (z <= far) allFar = false;
      }
      if (allNear || allFar) continue;
      // Frustum side rejection (all three outside one side plane).
      let outL = 0, outR = 0, outT = 0, outB = 0;
      for (let k = 0; k < 3; k++) {
        const x = cv[k * 3] * focal, y = cv[k * 3 + 1] * focal, z = cv[k * 3 + 2];
        if (x < -cxs * z) outL++; if (x > cxs * z) outR++; if (y > cys * z) outT++; if (y < -cys * z) outB++;
      }
      if (outL === 3 || outR === 3 || outT === 3 || outB === 3) continue;
      // Near clip (Sutherland-Hodgman on z >= near).
      let n = 3;
      if (cv[2] < near || cv[5] < near || cv[8] < near) {
        let m = 0;
        for (let k = 0; k < 3; k++) {
          const a = k * 3, b = ((k + 1) % 3) * 3, da = cv[a + 2] - near, db = cv[b + 2] - near;
          if (da >= 0) { poly[m * 3] = cv[a]; poly[m * 3 + 1] = cv[a + 1]; poly[m * 3 + 2] = cv[a + 2]; m++; }
          if ((da >= 0) !== (db >= 0)) { const s = da / (da - db); for (let c = 0; c < 3; c++) poly[m * 3 + c] = cv[a + c] + (cv[b + c] - cv[a + c]) * s; m++; }
        }
        n = m;
        for (let k = 0; k < n * 3; k++) out2[k] = poly[k];
      } else for (let k = 0; k < 9; k++) out2[k] = cv[k];
      if (n < 3) continue;
      for (let k = 0; k < n; k++) { const z = out2[k * 3 + 2]; sw[k] = 1 / z; sx[k] = cxs + out2[k * 3] * focal * sw[k]; sy[k] = cys - out2[k * 3 + 1] * focal * sw[k]; }
      // Signed area with y down: negative = counter-clockwise on screen = front face.
      let area2 = 0;
      for (let k = 0; k < n; k++) { const j = (k + 1) % n; area2 += sx[k] * sy[j] - sx[j] * sy[k]; }
      if (Math.abs(area2) < 1e-12) continue;
      const back = area2 > 0;
      if (back && cull) continue;
      const id = base[di] + t;
      if (d.blend) { let zs = 0; for (let k = 0; k < n; k++) zs += out2[k * 3 + 2]; blendTris.push({ d: di, t, depth: zs / n }); continue; }
      drawn++;
      for (let k = 1; k + 1 < n; k++) {
        const Ax = sx[0], Ay = sy[0], Bx = sx[k], By = sy[k], Cx = sx[k + 1], Cy = sy[k + 1];
        const area = (Bx - Ax) * (Cy - Ay) - (Cx - Ax) * (By - Ay);
        if (Math.abs(area) < 1e-12) continue;
        let x0 = Math.floor(Math.min(Ax, Bx, Cx)), x1 = Math.ceil(Math.max(Ax, Bx, Cx));
        let y0 = Math.floor(Math.min(Ay, By, Cy)), y1 = Math.ceil(Math.max(Ay, By, Cy));
        if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > W - 1) x1 = W - 1; if (y1 > H - 1) y1 = H - 1;
        if (x0 > x1 || y0 > y1) continue;
        const inv = 1 / area;
        const w0x = -(Cy - By) * inv, w0y = (Cx - Bx) * inv, w0c = (Bx * Cy - Cx * By) * inv;
        const w1x = -(Ay - Cy) * inv, w1y = (Ax - Cx) * inv, w1c = (Cx * Ay - Ax * Cy) * inv;
        const Aw = sw[0], Bw = sw[k], Cw = sw[k + 1];
        // 1/w is affine in screen space.
        const qx = w0x * Aw + w1x * Bw - (w0x + w1x) * Cw, qy = w0y * Aw + w1y * Bw - (w0y + w1y) * Cw, qc = w0c * Aw + w1c * Bw + (1 - w0c - w1c) * Cw;
        // Window depth is 1 - n q (far >> near), affine on screen: polygonOffset moves q by k (slope x 2 samples a
        // framebuffer pixel + 2 units of 2^-24) / n.
        const bias = offK ? offK * (2 * Math.max(Math.abs(qx), Math.abs(qy)) + 2 * 2 ** -24 / glNear) : 0;
        const w2x = -w0x - w1x, w2y = -w0y - w1y, w2c = 1 - w0c - w1c;
        for (let py = y0; py <= y1; py++) {
          const half = (py & 1) * 2, ry0 = ((py >> 1) + MSY[half]) * 2, ry1 = ((py >> 1) + MSY[half + 1]) * 2;
          const row = py * W;
          // This row's span: each edge's half-plane cut at both sample heights, widened a pixel (conservative).
          let lo = x0, hi = x1;
          for (let e = 0; e < 3; e++) {
            const ex_ = e === 0 ? w0x : e === 1 ? w1x : w2x, ey_ = e === 0 ? w0y : e === 1 ? w1y : w2y, ec = e === 0 ? w0c : e === 1 ? w1c : w2c;
            if (Math.abs(ex_) < 1e-12) { if (ec + ey_ * ry0 < -1e-6 && ec + ey_ * ry1 < -1e-6) { lo = 1; hi = 0; } continue; }
            const xa = -(ec + ey_ * ry0) / ex_, xb = -(ec + ey_ * ry1) / ex_;
            if (ex_ > 0) { const b = Math.floor(Math.min(xa, xb)) - 2; if (b > lo) lo = b; } else { const b = Math.ceil(Math.max(xa, xb)) + 1; if (b < hi) hi = b; }
          }
          for (let px = lo; px <= hi; px++) {
            const j = half + (px & 1), mx = ((px >> 1) + MSX[j]) * 2, my = (px & 1) ? ry1 : ry0;
            const w0 = w0c + w0y * my + w0x * mx;
            if (w0 < -1e-9) continue;
            const w1 = w1c + w1y * my + w1x * mx;
            if (w1 < -1e-9 || 1 - w0 - w1 < -1e-9) continue;
            const q = qc + qy * my + qx * mx, z = 1 / (q + bias);
            const i = row + px;
            if (z < near || z >= depth[i]) continue;
            if (cut) {
              const zt = 1 / q, X = (mx - cxs) * zt / focal, Y = -(my - cys) * zt / focal;
              if (cut(ex + rx * X + ux * Y + fx * zt, ey + ry * X + uy * Y + fy * zt, ez + rz * X + uz * Y + fz * zt)) continue;
            }
            depth[i] = z; ids[i] = id;
          }
        }
      }
    }
  }
  const t1 = performance.now();

  // ---- 2. resolve ----------------------------------------------------------------------------------------------
  const rgba = new Uint8ClampedArray(width * height * 4), pixDepth = new Float32Array(width * height).fill(Infinity), pixIds = new Int32Array(width * height).fill(-1);
  const col = new Float64Array(4), bg = new Float64Array(4), dir: V3 = [0, 0, 0];
  const s: ShadeInput = { i0: 0, i1: 0, i2: 0, b0: 0, b1: 0, b2: 0, px: 0, py: 0, pz: 0, dist: 0, nx: 0, ny: 0, nz: 0, back: false, x: 0, y: 0, cosView: 1 };
  const cid = [0, 0, 0, 0], cnt = [0, 0, 0, 0];
  const pixFocal = camera.focal;
  /** Cast the pixel ray onto triangle `id`; fill `s`; false when degenerate. */
  const setup = (id: number, dX: number, dY: number, dZ: number): WorldDraw | null => {
    const [di, t] = locate(id), d = draws[di], P = d.positions, I = d.indices;
    const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const e1x = P[b * 3] - ax, e1y = P[b * 3 + 1] - ay, e1z = P[b * 3 + 2] - az, e2x = P[c * 3] - ax, e2y = P[c * 3 + 1] - ay, e2z = P[c * 3 + 2] - az;
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const nl = Math.hypot(nx, ny, nz);
    if (nl === 0) return null;
    nx /= nl; ny /= nl; nz /= nl;
    const ox = ex - ax, oy = ey - ay, oz = ez - az;
    const denom = nx * dX + ny * dY + nz * dZ;
    let tt = Math.abs(denom) > 1e-12 ? -(nx * ox + ny * oy + nz * oz) / denom : 0;
    if (!(tt > 0)) tt = 0;
    const qx = ox + dX * tt, qy = oy + dY * tt, qz = oz + dZ * tt;
    // Barycentrics of q in (a, b, c).
    const d00 = e1x * e1x + e1y * e1y + e1z * e1z, d01 = e1x * e2x + e1y * e2y + e1z * e2z, d11 = e2x * e2x + e2y * e2y + e2z * e2z;
    const d20 = qx * e1x + qy * e1y + qz * e1z, d21 = qx * e2x + qy * e2y + qz * e2z, den = d00 * d11 - d01 * d01;
    if (den === 0) return null;
    const v = (d11 * d20 - d01 * d21) / den, w = (d00 * d21 - d01 * d20) / den;
    const back = denom > 0;
    s.i0 = a; s.i1 = b; s.i2 = c; s.b0 = 1 - v - w; s.b1 = v; s.b2 = w;
    s.px = ax + qx; s.py = ay + qy; s.pz = az + qz;
    const dl = Math.hypot(dX, dY, dZ);
    s.dist = tt * dl;
    if (back) { nx = -nx; ny = -ny; nz = -nz; }
    s.nx = nx; s.ny = ny; s.nz = nz; s.back = back;
    s.cosView = Math.abs(denom) / dl;
    return d;
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sxp = (x + 0.5 - width / 2) / pixFocal, syp = -(y + 0.5 - height / 2) / pixFocal;
    const dX = fx + rx * sxp + ux * syp, dY = fy + ry * sxp + uy * syp, dZ = fz + rz * sxp + uz * syp;
    let nU = 0, sky = 0, nearest = Infinity, nearId = -1;
    for (let q = 0; q < 4; q++) {
      const i = (y * 2 + (q >> 1)) * W + x * 2 + (q & 1), id = ids[i];
      if (id < 0) { sky++; continue; }
      if (depth[i] < nearest) { nearest = depth[i]; nearId = id; }
      let k = 0;
      while (k < nU && cid[k] !== id) k++;
      if (k === nU) { cid[nU] = id; cnt[nU] = 0; nU++; }
      cnt[k]++;
    }
    let r = 0, g = 0, b = 0, wsum = 0;
    s.x = x; s.y = y;
    for (let k = 0; k < nU; k++) {
      const d = setup(cid[k], dX, dY, dZ);
      if (!d || !d.material.shade(s, col)) { sky += cnt[k]; continue; }
      r += col[0] * cnt[k]; g += col[1] * cnt[k]; b += col[2] * cnt[k]; wsum += cnt[k];
    }
    if (sky) {
      dir[0] = dX; dir[1] = dY; dir[2] = dZ;
      options.background(x, y, dir, bg);
      r += bg[0] * sky; g += bg[1] * sky; b += bg[2] * sky; wsum += sky;
    }
    const o = (y * width + x) * 4;
    rgba[o] = Math.round(r / wsum * 255); rgba[o + 1] = Math.round(g / wsum * 255); rgba[o + 2] = Math.round(b / wsum * 255); rgba[o + 3] = 255;
    pixDepth[y * width + x] = nearest; pixIds[y * width + x] = nearId;
  }
  const t2 = performance.now();

  // ---- 3. blend ------------------------------------------------------------------------------------------------
  blendTris.sort((a, b) => b.depth - a.depth);
  for (const bt of blendTris) {
    const d = draws[bt.d], P = d.positions, I = d.indices;
    // Project the (unclipped; blend draws are small and in front) triangle at pixel resolution.
    let ok = true;
    for (let k = 0; k < 3; k++) {
      const v = I[bt.t * 3 + k] * 3, dx = P[v] - ex, dy = P[v + 1] - ey, dz = P[v + 2] - ez;
      const z = dx * fx + dy * fy + dz * fz;
      if (z < near) { ok = false; break; }
      sx[k] = width / 2 + (dx * rx + dy * ry + dz * rz) * pixFocal / z; sy[k] = height / 2 - (dx * ux + dy * uy + dz * uz) * pixFocal / z;
    }
    if (!ok) continue;
    const Ax = sx[0], Ay = sy[0], Bx = sx[1], By = sy[1], Cx = sx[2], Cy = sy[2];
    const area = (Bx - Ax) * (Cy - Ay) - (Cx - Ax) * (By - Ay);
    if (Math.abs(area) < 1e-12) continue;
    const x0 = Math.max(0, Math.floor(Math.min(Ax, Bx, Cx))), x1 = Math.min(width - 1, Math.ceil(Math.max(Ax, Bx, Cx)));
    const y0 = Math.max(0, Math.floor(Math.min(Ay, By, Cy))), y1 = Math.min(height - 1, Math.ceil(Math.max(Ay, By, Cy)));
    const inv = 1 / area;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((Bx - px) * (Cy - py) - (Cx - px) * (By - py)) * inv, w1 = ((Cx - px) * (Ay - py) - (Ax - px) * (Cy - py)) * inv;
      if (w0 < 0 || w1 < 0 || 1 - w0 - w1 < 0) continue;
      const sxp = (px - width / 2) / pixFocal, syp = -(py - height / 2) / pixFocal;
      const dX = fx + rx * sxp + ux * syp, dY = fy + ry * sxp + uy * syp, dZ = fz + rz * sxp + uz * syp;
      if (!setup(base[bt.d] + bt.t, dX, dY, dZ)) continue;
      const along = s.dist / Math.hypot(dX, dY, dZ);
      if (along >= pixDepth[y * width + x]) continue;
      s.x = x; s.y = y;
      if (!d.material.shade(s, col)) continue;
      const a = Math.max(0, Math.min(1, col[3])), o = (y * width + x) * 4;
      rgba[o] = Math.round(rgba[o] * (1 - a) + col[0] * 255 * a); rgba[o + 1] = Math.round(rgba[o + 1] * (1 - a) + col[1] * 255 * a); rgba[o + 2] = Math.round(rgba[o + 2] * (1 - a) + col[2] * 255 * a);
    }
  }
  const t3 = performance.now();
  return { width, height, rgba, depth: pixDepth, ids: pixIds, locate, stats: { triangles: total, drawn, visibilityMs: t1 - t0, resolveMs: t2 - t1, blendMs: t3 - t2 } };
}
