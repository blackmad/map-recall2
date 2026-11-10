// Frustum culling for an InstancedMesh (#129, the trees: every instance in the padded view box was drawn, 1,600
// trees and ~490 k triangles a desktop frame, most of them off screen on a pitched chase view).
//
// The mesh keeps its full instance arrays on the CPU; the GPU buffers hold only the instances whose bounding sphere
// meets the view, in their original order (so overlapping instances draw in the same order and the picture is the
// same), with `count` set to how many. The kept set is chosen with a margin round the view and only re-chosen when
// an instance the view needs is missing from it (or it has grown far bigger than needed), so a ride uploads a few
// times a second, not every frame. Shadows are cast by a twin over the full arrays on the shadow-only layer
// (shadowStandIns.ts SHADOW_ONLY_LAYER): off-screen instances still shade the screen. THREE is injected.

import { SHADOW_ONLY_LAYER } from './shadowStandIns.js';

/** Margin (local units, metres) round the view when the kept set is chosen. */
export const CULL_MARGIN = 30;
/** Re-choose a kept set this many times bigger than needed (at most once a second). */
export const CULL_SHRINK = 2;

export type CullStats = { instances: number; kept: number; needed: number; uploads: number };

export class InstanceCull {
  private readonly matrices: Float32Array;
  private readonly colours: Float32Array | null;
  /** Per-instance attributes on the mesh's own geometry (lane P5 `treeFade`): full copies, compacted like the colours. */
  private readonly extras: { attr: any; full: Float32Array; size: number }[];
  /** Per instance: centre x, y, z and radius (local frame). */
  private readonly spheres: Float32Array;
  private readonly keptFlags: Uint8Array;
  private keptCount = -1;
  private shrinkAt = 0;
  readonly shadow: any;
  readonly stats: CullStats;

  constructor(private readonly THREE: any, readonly mesh: any, options: { castShadow?: boolean } = {}) {
    const n = mesh.count;
    this.matrices = Float32Array.from(mesh.instanceMatrix.array.subarray(0, n * 16));
    this.colours = mesh.instanceColor ? Float32Array.from(mesh.instanceColor.array.subarray(0, n * 3)) : null;
    this.extras = Object.values(mesh.geometry?.attributes ?? {}).filter((a: any) => a?.isInstancedBufferAttribute)
      .map((attr: any) => ({ attr, size: attr.itemSize, full: Float32Array.from(attr.array.subarray(0, n * attr.itemSize)) }));
    for (const e of this.extras) e.attr.setUsage?.(THREE.DynamicDrawUsage);
    this.spheres = instanceSpheres(THREE, mesh.geometry, this.matrices, n);
    this.keptFlags = new Uint8Array(n);
    this.stats = { instances: n, kept: n, needed: n, uploads: 0 };
    // The shadow twin: the full arrays, drawn only by the shadow pass.
    this.shadow = null;
    if (options.castShadow) {
      const twin = new THREE.InstancedMesh(mesh.geometry, mesh.material, n);
      twin.instanceMatrix.array.set(this.matrices);
      if (this.colours) { twin.setColorAt(0, new THREE.Color()); twin.instanceColor.array.set(this.colours); }
      twin.frustumCulled = false; twin.castShadow = true; twin.receiveShadow = false;
      twin.layers.set(SHADOW_ONLY_LAYER);
      twin.name = `${mesh.name || 'instances'}/shadow`;
      twin.userData.shadowTwin = true;
      this.shadow = twin;
      mesh.castShadow = false;
    }
    mesh.instanceMatrix.setUsage?.(THREE.DynamicDrawUsage);
    mesh.instanceColor?.setUsage?.(THREE.DynamicDrawUsage);
  }

  /**
   * Keep what `clipFromLocal` (clip ← the mesh's local frame) sees. Call before the frame is projected (a
   * participant's beforeRender): three uploads instance buffers while projecting. Returns true when it uploaded.
   */
  update(clipFromLocal: any, frustum = new this.THREE.Frustum(), now = performance.now()): boolean {
    frustum.setFromProjectionMatrix(clipFromLocal);
    const planes = frustum.planes, s = this.spheres, n = this.stats.instances;
    let needed = 0, missing = false;
    for (let i = 0; i < n; i++) {
      if (!meets(planes, s[4 * i], s[4 * i + 1], s[4 * i + 2], s[4 * i + 3])) continue;
      needed++;
      if (!this.keptFlags[i]) missing = true;
    }
    this.stats.needed = needed;
    const bloated = this.keptCount > CULL_SHRINK * Math.max(needed, 16) && now - this.shrinkAt > 1000;
    if (this.keptCount >= 0 && !missing && !bloated) return false;
    this.shrinkAt = now;
    const m = this.mesh.instanceMatrix.array as Float32Array, c = this.mesh.instanceColor?.array as Float32Array | undefined;
    let k = 0;
    for (let i = 0; i < n; i++) {
      const keep = meets(planes, s[4 * i], s[4 * i + 1], s[4 * i + 2], s[4 * i + 3] + CULL_MARGIN);
      this.keptFlags[i] = keep ? 1 : 0;
      if (!keep) continue;
      m.set(this.matrices.subarray(16 * i, 16 * i + 16), 16 * k);
      if (c && this.colours) c.set(this.colours.subarray(3 * i, 3 * i + 3), 3 * k);
      for (const e of this.extras) e.attr.array.set(e.full.subarray(e.size * i, e.size * i + e.size), e.size * k);
      k++;
    }
    this.keptCount = k;
    this.mesh.count = k;
    this.stats.kept = k;
    this.stats.uploads++;
    upload(this.mesh.instanceMatrix, k * 16);
    if (this.mesh.instanceColor) upload(this.mesh.instanceColor, k * 3);
    for (const e of this.extras) upload(e.attr, k * e.size);
    return true;
  }

  /** The full (uncompacted) instance arrays: matrices, colours and each extra attribute by name. */
  full(): { matrices: Float32Array; colours: Float32Array | null; extras: Record<string, Float32Array> } {
    const extras: Record<string, Float32Array> = {};
    for (const [name, attr] of Object.entries(this.mesh.geometry?.attributes ?? {})) {
      const e = this.extras.find(x => x.attr === attr);
      if (e) extras[name] = e.full;
    }
    return { matrices: this.matrices, colours: this.colours, extras };
  }

  /** Every instance back in the buffers (the opt-out, a context loss). */
  restore(): void {
    const n = this.stats.instances;
    (this.mesh.instanceMatrix.array as Float32Array).set(this.matrices);
    if (this.colours) (this.mesh.instanceColor.array as Float32Array).set(this.colours);
    for (const e of this.extras) { e.attr.array.set(e.full); upload(e.attr, n * e.size); }
    this.mesh.count = n;
    this.keptFlags.fill(1);
    this.keptCount = -1;
    this.stats.kept = n;
    upload(this.mesh.instanceMatrix, n * 16);
    if (this.mesh.instanceColor) upload(this.mesh.instanceColor, n * 3);
  }
}

function upload(attribute: any, count: number): void {
  attribute.clearUpdateRanges?.();
  if (count > 0) attribute.addUpdateRange?.(0, count);
  attribute.needsUpdate = true;
}

/** Whether a sphere meets all six planes (three Frustum.intersectsSphere, unrolled over plain numbers). */
function meets(planes: any[], x: number, y: number, z: number, r: number): boolean {
  for (let p = 0; p < 6; p++) {
    const pl = planes[p], nrm = pl.normal;
    if (nrm.x * x + nrm.y * y + nrm.z * z + pl.constant < -r) return false;
  }
  return true;
}

/** Each instance's bounding sphere in the mesh's local frame: the geometry's sphere through the instance matrix. */
export function instanceSpheres(THREE: any, geometry: any, matrices: Float32Array, n: number): Float32Array {
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  const base = geometry.boundingSphere, out = new Float32Array(4 * n), m = new THREE.Matrix4(), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    m.fromArray(matrices, 16 * i);
    v.copy(base.center).applyMatrix4(m);
    out[4 * i] = v.x; out[4 * i + 1] = v.y; out[4 * i + 2] = v.z;
    out[4 * i + 3] = base.radius * m.getMaxScaleOnAxis() * 1.0001 + 1e-4;
  }
  return out;
}

/** `?treeCull=0` (or `window.__canalRecallTreeCull = false`) draws every resident tree, as before. */
export function treeCullFlag(): boolean {
  const g = globalThis as { __canalRecallTreeCull?: boolean; location?: { search?: string } };
  if (g.__canalRecallTreeCull === false) return false;
  return new URLSearchParams(g.location?.search ?? '').get('treeCull') !== '0';
}
