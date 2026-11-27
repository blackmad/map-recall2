// Bounds and position copies without three's per-vertex accessors.
//
// Desktop-perf 2026-11-27: every landmark level that arrives (or swaps) had its bounding box computed in
// `Box3.setFromObject`, its bounding sphere in the first frustum test, and its positions copied for the shadow
// stand-in, each through `Vector3.fromBufferAttribute` → `getX/getY/getZ` → `denormalize`. On quantised (normalised
// int16) GLBs those calls box every coordinate as a heap number: ~12 MB/s of the ride's ~84 MB/s allocation. These
// read the typed array directly and do the same arithmetic in the same order, so the results are three's, bit for bit
// (fastBounds.test.ts pins that against three itself).

type Attr = {
  array: ArrayLike<number> & { constructor: unknown };
  count: number;
  itemSize: number;
  normalized?: boolean;
  isInterleavedBufferAttribute?: boolean;
  isGLBufferAttribute?: boolean;
  data?: { array: ArrayLike<number> & { constructor: unknown }; stride: number };
  offset?: number;
};

/** three's MathUtils.denormalize divisor (and whether the result is clamped at -1); null for float arrays. */
function normaliser(array: { constructor: unknown }): { div: number; signed: boolean } | null {
  switch (array.constructor) {
    case Uint32Array: return { div: 4294967295.0, signed: false };
    case Uint16Array: return { div: 65535.0, signed: false };
    case Uint8Array: return { div: 255.0, signed: false };
    case Int32Array: return { div: 2147483647.0, signed: true };
    case Int16Array: return { div: 32767.0, signed: true };
    case Int8Array: return { div: 127.0, signed: true };
    default: return null;
  }
}

/** Where component 0 of vertex `i` sits is `offset + i * stride`; null when the attribute cannot be read directly. */
function layout(attr: Attr): { array: ArrayLike<number>; stride: number; offset: number; div: number; signed: boolean; norm: boolean } | null {
  if (!attr || attr.isGLBufferAttribute) return null;
  const array = attr.isInterleavedBufferAttribute ? attr.data?.array : attr.array;
  if (!array) return null;
  const stride = attr.isInterleavedBufferAttribute ? attr.data!.stride : attr.itemSize, offset = attr.isInterleavedBufferAttribute ? attr.offset ?? 0 : 0;
  // getX/getY/getZ fall back to 0-filled reads only for itemSize 3+ positions; anything else goes through three.
  if (attr.itemSize < 3) return null;
  const n = attr.normalized ? normaliser(array) : null;
  return { array, stride, offset, div: n?.div ?? 1, signed: !!n?.signed, norm: !!n };
}

/**
 * xyz per vertex as `Vector3.fromBufferAttribute` reads them, as a Float64Array (Float32 positions that are plain,
 * tightly packed, unnormalised: copied as Float32Array, as rendererShared/shadowStandIns.ts always did).
 */
export function positionsOf(position: Attr): Float32Array | Float64Array {
  const n = position.count;
  if (!position.isInterleavedBufferAttribute && !position.normalized && position.array instanceof Float32Array && position.array.length === n * 3) return position.array.slice();
  const l = layout(position);
  const out = new Float64Array(n * 3);
  if (!l) {
    const p = position as unknown as { getX(i: number): number; getY(i: number): number; getZ(i: number): number };
    for (let i = 0; i < n; i++) { out[i * 3] = p.getX(i); out[i * 3 + 1] = p.getY(i); out[i * 3 + 2] = p.getZ(i); }
    return out;
  }
  const { array, stride, offset, div, signed, norm } = l;
  for (let i = 0, o = offset; i < n; i++, o += stride) {
    let x = array[o], y = array[o + 1], z = array[o + 2];
    if (norm) { x /= div; y /= div; z /= div; if (signed) { x = Math.max(x, -1.0); y = Math.max(y, -1.0); z = Math.max(z, -1.0); } }
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
  return out;
}

/**
 * Fill a geometry's missing boundingBox and boundingSphere as three's computeBoundingBox / computeBoundingSphere
 * would. Geometries with morph targets or positions that cannot be read directly are left for three. Returns
 * whether anything was filled.
 */
export function ensureGeometryBounds(THREE: any, geometry: any): boolean {
  if (!geometry || (geometry.boundingBox && geometry.boundingSphere)) return false;
  const position = geometry.attributes?.position;
  if (!position || geometry.morphAttributes?.position?.length) return false;
  const l = layout(position);
  if (!l) return false;
  const { array, stride, offset, div, signed, norm } = l, n = position.count;
  // Box3.makeEmpty + expandByPoint (Math.min / Math.max, component by component).
  let minX = +Infinity, minY = +Infinity, minZ = +Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0, o = offset; i < n; i++, o += stride) {
    let x = array[o], y = array[o + 1], z = array[o + 2];
    if (norm) { x /= div; y /= div; z /= div; if (signed) { x = Math.max(x, -1.0); y = Math.max(y, -1.0); z = Math.max(z, -1.0); } }
    minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
  }
  if (!geometry.boundingBox) {
    const box = geometry.boundingBox = new THREE.Box3();
    box.min.set(minX, minY, minZ); box.max.set(maxX, maxY, maxZ);
  }
  if (!geometry.boundingSphere) {
    const sphere = geometry.boundingSphere = new THREE.Sphere();
    // Box3.getCenter: (0,0,0) when empty, else (min + max) * 0.5.
    const empty = maxX < minX || maxY < minY || maxZ < minZ;
    const cx = empty ? 0 : (minX + maxX) * 0.5, cy = empty ? 0 : (minY + maxY) * 0.5, cz = empty ? 0 : (minZ + maxZ) * 0.5;
    sphere.center.set(cx, cy, cz);
    let maxRadiusSq = 0;
    for (let i = 0, o = offset; i < n; i++, o += stride) {
      let x = array[o], y = array[o + 1], z = array[o + 2];
      if (norm) { x /= div; y /= div; z /= div; if (signed) { x = Math.max(x, -1.0); y = Math.max(y, -1.0); z = Math.max(z, -1.0); } }
      // Vector3.distanceToSquared(center → vertex): dx = center - v.
      const dx = cx - x, dy = cy - y, dz = cz - z;
      maxRadiusSq = Math.max(maxRadiusSq, dx * dx + dy * dy + dz * dz);
    }
    sphere.radius = Math.sqrt(maxRadiusSq);
  }
  return true;
}

/** `ensureGeometryBounds` on every mesh geometry under `root`; returns how many geometries it filled. */
export function ensureBounds(THREE: any, root: any): number {
  if (!root?.traverse) return 0;
  const seen = new Set<unknown>();
  let filled = 0;
  root.traverse((object: any) => {
    const g = object.geometry;
    if (!g || seen.has(g)) return;
    seen.add(g);
    if (ensureGeometryBounds(THREE, g)) filled++;
  });
  return filled;
}

/** `?fastBounds=0` (or `window.__canalRecallFastBounds = false`) leaves landmark bounds to three. */
export function fastBoundsOn(search = typeof location !== 'undefined' ? location.search : '', global: unknown = (globalThis as any).__canalRecallFastBounds): boolean {
  try { if (new URLSearchParams(search).get('fastBounds') === '0') return false; } catch { /* no location */ }
  return global !== false;
}

let urlFastBounds: boolean | undefined;
/** fastBoundsOn for the page: the URL read once, the global on every call (an in-page A/B flips it). */
export function pageFastBounds(): boolean {
  if ((globalThis as any).__canalRecallFastBounds === false) return false;
  return urlFastBounds ??= fastBoundsOn(typeof location !== 'undefined' ? location.search : '', undefined);
}
