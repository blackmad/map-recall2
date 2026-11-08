// Landmark texture cap (lane R4-G #250): the GPU-resident size of a textured model's images follows how fine they are
// on screen.
//
// The aerial pan's GPU peak held 109–115 MB of `landmarks:mesh_#` textures: the embedded facade atlases of the
// ordinary-building installs (`models/ordinary-buildings/*.glb`, PNGs of 2048 x 256 … 2048 x 1792, uploaded with a full
// mip chain) and the GVB metro (1024²). None of them has a lod1 or lod2, so from the air they stayed at full size while
// each covered a few dozen pixels. `?landmarkTexCap=1024|512` keeps a downscaled copy resident instead while the model's
// least dense texel is still at least `factor` texels per device pixel at the model's nearest point (factor = full side
// / capped side), so the capped image is never magnified past what the full image's mip chain would have sampled; the
// full image goes back up on approach (hysteresis). Off (no flag): nothing here runs, byte-identical.
//
// The density is measured once per texture at load: texels per metre of every triangle that samples it (UV area x
// texture area over world area), the area-weighted CAP_DENSITY_PERCENTILE taken so that a sliver with stretched UVs
// does not hold a whole atlas at full size, and triangles whose UVs collapse to a point (a flat colour) left out.

/** The sides `?landmarkTexCap=` accepts. */
export const LANDMARK_TEX_CAP_SIDES = [2048, 1024, 512, 256] as const;
/** Cap once the capped image would still be this many times finer than the screen at the model's nearest point... */
export const CAP_ENTER = 1.5;
/** ...and keep it capped until it would drop below this (hysteresis: the full image goes back up before it is needed). */
export const CAP_KEEP = 1.1;
/** Area-weighted percentile of a texture's texel density used as its "least dense" texel (0.05: the 5 % sparsest area). */
export const CAP_DENSITY_PERCENTILE = 0.05;
/** World area (m²) below which a triangle is ignored for the density (degenerate slivers). */
const MIN_WORLD_AREA_M2 = 1e-4;
/** UV area below which a triangle samples a point (one flat colour), not the image. */
const MIN_UV_AREA = 1e-9;

/** `?landmarkTexCap=1024` (or `window.__canalRecallLandmarkTexCap`): the capped side, null when off. */
export function landmarkTexCapFlag(search?: string, global: { __canalRecallLandmarkTexCap?: unknown } = globalThis as never): number | null {
  let asked: unknown = global?.__canalRecallLandmarkTexCap;
  if (asked == null) {
    try {
      const s = search ?? (globalThis as { location?: { search?: string } }).location?.search ?? '';
      asked = typeof URLSearchParams === 'function' ? new URLSearchParams(s).get('landmarkTexCap') : null;
    } catch { asked = null; }
  }
  const n = Number(asked);
  return (LANDMARK_TEX_CAP_SIDES as readonly number[]).includes(n) ? n : null;
}

/** The image's size halved until its longer side is at most `cap` (power-of-two steps keep the mip grid); null: already fits. */
export function cappedSize(width: number, height: number, cap: number): { width: number; height: number; factor: number } | null {
  if (!(width > 0 && height > 0 && cap > 0) || Math.max(width, height) <= cap) return null;
  let factor = 1;
  while (Math.max(width, height) / factor > cap) factor *= 2;
  return { width: Math.max(1, Math.round(width / factor)), height: Math.max(1, Math.round(height / factor)), factor };
}

/**
 * Texels per metre of a texture over the triangles that sample it: the area-weighted `percentile` of
 * sqrt(uvArea x texW x texH / worldArea). `positions` are world-space (metres) xyz triples, `uvs` uv pairs,
 * `index` optional (null: non-indexed). Null when no triangle samples an area of the image.
 */
export function texelDensity(positions: ArrayLike<number>, uvs: ArrayLike<number>, index: ArrayLike<number> | null, texW: number, texH: number, percentile = CAP_DENSITY_PERCENTILE): number | null {
  const samples: { rho: number; area: number }[] = [];
  const count = index ? index.length : positions.length / 3;
  const at = (k: number) => (index ? index[k] : k);
  for (let k = 0; k + 2 < count; k += 3) {
    const a = at(k), b = at(k + 1), c = at(k + 2);
    const ux = positions[b * 3] - positions[a * 3], uy = positions[b * 3 + 1] - positions[a * 3 + 1], uz = positions[b * 3 + 2] - positions[a * 3 + 2];
    const vx = positions[c * 3] - positions[a * 3], vy = positions[c * 3 + 1] - positions[a * 3 + 1], vz = positions[c * 3 + 2] - positions[a * 3 + 2];
    const area = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    if (!(area > MIN_WORLD_AREA_M2)) continue;
    const su = uvs[b * 2] - uvs[a * 2], sv = uvs[b * 2 + 1] - uvs[a * 2 + 1], tu = uvs[c * 2] - uvs[a * 2], tv = uvs[c * 2 + 1] - uvs[a * 2 + 1];
    const uvArea = 0.5 * Math.abs(su * tv - sv * tu);
    if (!(uvArea > MIN_UV_AREA)) continue;
    samples.push({ rho: Math.sqrt(uvArea * texW * texH / area), area });
  }
  if (!samples.length) return null;
  samples.sort((x, y) => x.rho - y.rho);
  const total = samples.reduce((s, x) => s + x.area, 0), want = total * Math.min(1, Math.max(0, percentile));
  let run = 0;
  for (const s of samples) { run += s.area; if (run >= want) return s.rho; }
  return samples[samples.length - 1].rho;
}

/**
 * Device pixels per metre at a model's nearest point, from the frame's clip-from-world matrix (column-major, world in
 * metres) at the model's centre: the longest projected unit axis there (at least sqrt(2/3) of the frontal scale, so it
 * is divided by that to stay an upper bound), scaled from the centre's depth to `radiusM` nearer. 0: the whole
 * bounding sphere is behind the eye (nothing of it is drawn); Infinity: the nearest point is within 1 m of the eye's
 * plane (or the matrix is unusable), so the model counts as near.
 */
export function nearestPixelsPerMetre(clipFromWorld: ArrayLike<number>, centre: readonly [number, number, number], radiusM: number, widthPx: number, heightPx: number): number {
  const m = clipFromWorld, [cx, cy, cz] = centre;
  const w = m[3] * cx + m[7] * cy + m[11] * cz + m[15];
  if (!Number.isFinite(w)) return Infinity;
  if (w < -Math.max(0, radiusM)) return 0;
  if (!(w > 1e-9)) return Infinity;
  const nx = (m[0] * cx + m[4] * cy + m[8] * cz + m[12]) / w, ny = (m[1] * cx + m[5] * cy + m[9] * cz + m[13]) / w;
  let best = 0;
  for (const [dx, dy, dz] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
    const x = cx + dx, y = cy + dy, z = cz + dz;
    const pw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (!(pw > 1e-9)) continue;
    best = Math.max(best, Math.hypot(((m[0] * x + m[4] * y + m[8] * z + m[12]) / pw - nx) * widthPx / 2, ((m[1] * x + m[5] * y + m[9] * z + m[13]) / pw - ny) * heightPx / 2));
  }
  const near = w - Math.max(0, radiusM);
  if (!(near > 1) || !(best > 0)) return Infinity;
  return best / Math.sqrt(2 / 3) * (w / near);
}

export interface CapDecisionInput {
  /** The texture's least dense texels per metre (`texelDensity`). */
  density: number;
  /** Device px per metre at the model's nearest point (`nearestPixelsPerMetre`: 0 behind the eye, Infinity near). */
  pixelsPerMetre: number;
  /** Full side / capped side (2, 4, ...). */
  factor: number;
  /** Capped now (hysteresis). */
  capped: boolean;
}

/** Whether the capped image is wanted: texels per device px at the nearest point stays >= factor (with hysteresis). */
export function wantsCap(i: CapDecisionInput): boolean {
  if (!(i.factor > 1) || !(i.density > 0) || Number.isNaN(i.pixelsPerMetre)) return false;
  if (i.pixelsPerMetre <= 0) return true;
  const texelsPerPx = i.density / i.pixelsPerMetre;
  return texelsPerPx >= i.factor * (i.capped ? CAP_KEEP : CAP_ENTER);
}
