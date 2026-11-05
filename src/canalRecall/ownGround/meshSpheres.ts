// Ground mesh bounding spheres measured in the build worker (lane E7, #220).
//
// The main thread's install (gameGround.ts packedGeometry) walked every vertex of every layer twice for three's
// bounding sphere: `boundingSphereOf` was 24 ms of a 35 ms `groundInstall` inside the iPhone profile's 100 ms frame two
// seconds into the cold start. The worker that built the mesh now measures it (the same function on the same Float32
// positions, so the sphere is identical) and sends it along; the install uses it. `?groundSphereWorker=0` measures on
// the main thread again. Tolerates a non-browser global (the worker, Node tests).
import { boundingSphereOf } from '../geometryBounds.js';
import type { MeshSphere } from './groundCell.js';

/** Set each mesh's `sphere` (in the worker, before the positions are transferred). */
export function measureSpheres(meshes: readonly ({ positions: Float32Array; sphere?: MeshSphere } | undefined)[]): void {
  for (const m of meshes) if (m && m.positions.length) m.sphere = boundingSphereOf(m.positions);
}

let workerSpheres: boolean | undefined;
/** `?groundSphereWorker=0`: ignore the worker's spheres. */
export function workerSpheresEnabled(): boolean {
  if (workerSpheres === undefined) {
    try { workerSpheres = !/[?&]groundSphereWorker=(0|off)(&|#|$)/.test((globalThis as { location?: { search?: string } }).location?.search ?? ''); } catch { workerSpheres = true; }
  }
  return workerSpheres;
}

/** The sphere the worker sent, else measured here. */
export function meshSphere(m: { positions: Float32Array; sphere?: MeshSphere }): MeshSphere {
  return m.sphere && workerSpheresEnabled() ? m.sphere : boundingSphereOf(m.positions);
}
