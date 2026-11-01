// The shadow pass's depth programs, linked in the first shadow redraw instead of whenever the first caster of a
// kind turns up mid-ride (P4 counters gate, #129: an iPad-profile ride linked the double-sided depth program when
// the first hedge came into the shadow box, 10+ s into the ride; every later double-sided caster shares it).
//
// three draws casters with one shared MeshDepthMaterial whose `side` follows the caster's (WebGLShadowMap
// getDepthMaterial: front -> back, back -> front, double -> double) and whose program also keys on instancing, so
// the primer holds one zero-area caster per side, plain and instanced. Zero area rasterises nothing: the shadow
// map is the same with or without it. It sits on SHADOW_ONLY_LAYER, which only the shadow pass tests, so the main
// pass neither draws it nor compiles its (never used) colour material.

import { SHADOW_ONLY_LAYER } from './shadowStandIns.js';

export const PRIMER_NAME = 'shadow-depth-primer';

/** One zero-area caster per depth-program variant (3 sides x plain/instanced), on the shadow-only layer. */
export function shadowPrimer(THREE: any): any {
  const group = new THREE.Group();
  group.name = PRIMER_NAME;
  const geometry = new THREE.BufferGeometry();
  // Three coincident points: a triangle with no area.
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  for (const side of [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide]) {
    const material = new THREE.MeshBasicMaterial({ side });
    const plain = new THREE.Mesh(geometry, material);
    const instanced = new THREE.InstancedMesh(geometry, material, 1);
    instanced.setMatrixAt(0, new THREE.Matrix4());
    for (const mesh of [plain, instanced]) {
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      mesh.layers.set(SHADOW_ONLY_LAYER);
      group.add(mesh);
    }
  }
  return group;
}

/** Free a primer's geometry and materials after its one shadow pass. */
export function disposeShadowPrimer(group: any): void {
  group.parent?.remove(group);
  const seen = new Set<any>();
  group.traverse((o: any) => {
    if (!o.isMesh) return;
    for (const r of [o.geometry, o.material]) if (r && !seen.has(r)) { seen.add(r); r.dispose?.(); }
    o.dispose?.();
  });
}
