// Landmark vertex data the GPU already holds: drop the CPU copies once uploaded.
//
// A placed landmark's normals, uvs, tints and the like are read by nothing on
// the CPU after three.js uploads them (heap breakdown 2026-11-01: 11.6 MB of
// landmark geometry arrays retained under the shared frame on a desktop ride).
// Positions and the index stay: picking builds its BVH from them, the shadow
// stand-in welds them, bounds and the street-chunk lift read them.
//
// A released attribute's array becomes an empty array of the same type, not
// null: three's own `Mesh.raycast` (the picker's fallback until a mesh's BVH
// exists) interpolates uv and normal at a hit, and reading an empty typed
// array yields NaN where a null one would throw; the picker reads only the
// object, point, distance and face. `count` is a field, so draw ranges keep
// working. After a context loss three.js re-uploads every attribute from its
// array, so the owner must drop models whose data was released (see
// `hasReleasedVertexData`) and load them again.
//
// Interleaved attributes share one buffer with position and are left alone.

import type * as THREE from 'three';

const released = new WeakSet<object>();
const marked = new WeakSet<object>();

/** Attribute names kept on the CPU. */
export const KEEP_ON_CPU: ReadonlySet<string> = new Set(['position']);

function release(this: THREE.BufferAttribute): void {
  const array = this.array as unknown as { constructor: new (n: number) => THREE.TypedArray } | null;
  if (!array) return;
  (this as { array: unknown }).array = new array.constructor(0);
  released.add(this);
}

/** Marks one geometry's non-kept, non-interleaved attributes to drop their arrays on upload; returns how many were marked. */
export function releaseGeometryOnUpload(geometry: THREE.BufferGeometry, keep: ReadonlySet<string> = KEEP_ON_CPU): number {
  let n = 0;
  for (const name of Object.keys(geometry.attributes)) {
    if (keep.has(name)) continue;
    const attribute = geometry.attributes[name] as THREE.BufferAttribute;
    if ((attribute as { isInterleavedBufferAttribute?: boolean }).isInterleavedBufferAttribute || marked.has(attribute)) continue;
    marked.add(attribute);
    attribute.onUpload(release);
    n++;
  }
  return n;
}

/**
 * Marks every mesh under `root` (see `releaseGeometryOnUpload`). Geometries for
 * which `skip` returns true are left alone (street-chunk pands re-split their
 * attributes after placement). Returns how many attributes were marked.
 */
export function releaseVertexDataOnUpload(root: THREE.Object3D, skip: (geometry: THREE.BufferGeometry) => boolean = () => false): number {
  let n = 0;
  root.traverse(object => {
    const geometry = (object as THREE.Mesh).isMesh ? (object as THREE.Mesh).geometry as THREE.BufferGeometry : null;
    if (geometry?.attributes && !skip(geometry)) n += releaseGeometryOnUpload(geometry);
  });
  return n;
}

/** Whether any mesh under `root` has an attribute whose array was released (it cannot be uploaded again). */
export function hasReleasedVertexData(root: THREE.Object3D | null | undefined): boolean {
  let found = false;
  root?.traverse(object => {
    if (found || !(object as THREE.Mesh).isMesh) return;
    const geometry = (object as THREE.Mesh).geometry as THREE.BufferGeometry;
    for (const name of Object.keys(geometry?.attributes || {})) if (released.has(geometry.attributes[name])) { found = true; return; }
  });
  return found;
}
