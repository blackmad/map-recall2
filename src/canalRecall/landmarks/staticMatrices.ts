// Placed landmark models never move: their local matrices are composed once.
//
// three.js composes every object's local matrix from position/quaternion/scale
// and multiplies its world matrix on every `updateMatrixWorld`, i.e. on every
// render of every landmark scene (legacy layer: one scene per model per
// frame), although nothing in a placed model changes. `freezeStaticMatrices`
// composes each local matrix now and turns `matrixAutoUpdate` off, so a frame
// only walks the flags; world matrices still follow a parent that moves (the
// shared frame's root, a holder lifted onto the own ground), because
// `updateMatrixWorld` propagates a changed parent to its children regardless.
// Objects added later (highlight passes) keep `matrixAutoUpdate` and are
// updated as before. Whoever moves a frozen object afterwards must call
// `updateMatrix()` on it (as `_swapLevel` does by freezing the new level).

import type * as THREE from 'three';

/** Composes and freezes the local matrix of `root` and every descendant; returns how many were frozen. */
export function freezeStaticMatrices(root: THREE.Object3D): number {
  let frozen = 0;
  root.traverse(object => {
    if (!object.matrixAutoUpdate) return;
    object.updateMatrix(); // also flags the world matrix for the next update
    object.matrixAutoUpdate = false;
    frozen++;
  });
  return frozen;
}
