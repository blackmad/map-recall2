// Shadow stand-ins: one depth-only copy of a static model for the sun's shadow pass.
//
// A landmark GLB draws as ~7 meshes, one per material, and every one of them
// was also drawn into the shadow map: at the Dam 294 of the 317 shadow-pass
// draws were landmark meshes (lane D, 2026-10-31). The shadow pass needs only
// positions, so `buildShadowStandIn` merges the casting meshes of one model
// into a position-only geometry (one draw per shadow side), puts it on
// SHADOW_ONLY_LAYER, and stops the originals casting. `shadowOnlyLayerPass`
// lets the shadow pass see that layer while the main pass never does.
//
// The stand-in keeps every triangle, so the shadow it casts is the model's own
// (the brief's "walls only" variant would lose towers, spires and gables).
// Positions are quantised to normalised int16 over the model's largest half
// extent (2.3 mm steps on a 150 m model, far below a shadow texel) to keep the
// copy small: 6 bytes a vertex plus the index.
//
// Kept casting as they were (never merged): instanced, skinned and morphed
// meshes, multi-material meshes, and materials whose shadow is not a plain
// depth write (alpha-tested maps, displacement, clipping, alpha to coverage,
// invisible), and any mesh carrying a custom depth material.

/** Layer the shadow pass enables on the camera; nothing else draws it. Clear of TILE_OWNER_LAYER (31). */
export const SHADOW_ONLY_LAYER = 30;
/** userData flag on a source mesh whose shadow a stand-in casts: SharedFrame.setShadows keeps it from casting. */
export const SHADOW_STAND_IN_SOURCE = 'shadowStandInSource';

const FRONT = 0, BACK = 1, DOUBLE = 2;
const SHADOW_SIDE: Record<number, number> = { [FRONT]: BACK, [BACK]: FRONT, [DOUBLE]: DOUBLE };

/** The side three's (non-VSM) shadow pass draws a material with (WebGLShadowMap.getDepthMaterial). */
export function shadowSideOf(material: { side?: number; shadowSide?: number | null }): number {
  return material.shadowSide != null ? material.shadowSide : SHADOW_SIDE[material.side ?? FRONT] ?? BACK;
}

/** Whether a mesh's shadow is a plain depth write of its positions, i.e. a stand-in can cast it unchanged. */
export function canStandIn(mesh: any): boolean {
  if (!mesh?.isMesh || !mesh.castShadow || mesh.isInstancedMesh || mesh.isSkinnedMesh || mesh.isBatchedMesh) return false;
  if (mesh.customDepthMaterial || mesh.morphTargetInfluences?.length) return false;
  const material = mesh.material;
  if (!material || Array.isArray(material) || material.visible === false || material.wireframe) return false;
  if (material.alphaTest > 0 || material.alphaToCoverage || material.alphaHash) return false;
  if (material.displacementMap && material.displacementScale !== 0) return false;
  if (material.clipShadows && material.clippingPlanes?.length) return false;
  const geometry = mesh.geometry, position = geometry?.attributes?.position;
  if (!position?.array || position.itemSize !== 3 || geometry.morphAttributes?.position?.length) return false;
  if (geometry.drawRange && (geometry.drawRange.start !== 0 || Number.isFinite(geometry.drawRange.count))) return false;
  return true;
}

/** `mesh`'s matrix relative to `root`, from the local matrices (composed if they still auto-update). */
function matrixWithin(THREE: any, root: any, mesh: any): any {
  const out = new THREE.Matrix4();
  for (let object = mesh; object && object !== root; object = object.parent) {
    if (object.matrixAutoUpdate) object.updateMatrix();
    out.premultiply(object.matrix);
  }
  return out;
}

/** Visible within `root` (the root's own and its parents' visibility belong to the caller). */
function visibleWithin(root: any, mesh: any): boolean {
  for (let object = mesh; object && object !== root; object = object.parent) if (!object.visible) return false;
  return true;
}

export type ShadowStandIn = {
  /** Add under the model's parent with `matrix` = the root's local matrix; draws only on SHADOW_ONLY_LAYER. */
  object: any;
  /** Source meshes that stopped casting. */
  sources: any[];
  triangles: number;
  bytes: number;
};

const materials = new WeakMap<object, Map<number, any>>();
function standInMaterial(THREE: any, side: number): any {
  let bySide = materials.get(THREE);
  if (!bySide) materials.set(THREE, bySide = new Map());
  let material = bySide.get(side);
  if (!material) {
    // Never drawn in the main pass; the shadow pass reads only side/shadowSide/visible/wireframe.
    material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    material.side = side; material.shadowSide = side;
    material.name = `shadow-stand-in-${side}`;
    bySide.set(side, material);
  }
  return material;
}

/**
 * Merge `root`'s casting, visible meshes into one quantised position-only mesh
 * per shadow side, in `root`'s local frame. The sources stop casting (and are
 * flagged SHADOW_STAND_IN_SOURCE). Returns null when nothing qualifies.
 */
export function buildShadowStandIn(THREE: any, root: any): ShadowStandIn | null {
  const bySide = new Map<number, { mesh: any; matrix: any }[]>();
  root.traverse((mesh: any) => {
    if (!canStandIn(mesh) || !visibleWithin(root, mesh)) return;
    const side = shadowSideOf(mesh.material);
    if (!bySide.has(side)) bySide.set(side, []);
    bySide.get(side)!.push({ mesh, matrix: matrixWithin(THREE, root, mesh) });
  });
  if (!bySide.size) return null;
  const object = new THREE.Group();
  object.name = 'shadow-stand-in';
  object.matrixAutoUpdate = false;
  const sources: any[] = [];
  let triangles = 0, bytes = 0;
  const v = new THREE.Vector3();
  for (const [side, parts] of bySide) {
    // Bounds of the transformed vertices, then quantise over the largest half extent.
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    let vertexCount = 0, indexCount = 0;
    for (const { mesh, matrix } of parts) {
      const position = mesh.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        v.fromBufferAttribute(position, i).applyMatrix4(matrix);
        if (v.x < min[0]) min[0] = v.x; if (v.y < min[1]) min[1] = v.y; if (v.z < min[2]) min[2] = v.z;
        if (v.x > max[0]) max[0] = v.x; if (v.y > max[1]) max[1] = v.y; if (v.z > max[2]) max[2] = v.z;
      }
      vertexCount += position.count;
      indexCount += mesh.geometry.index ? mesh.geometry.index.count : position.count;
    }
    if (!vertexCount || !indexCount) continue;
    const centre = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const half = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 1e-6) / 2;
    const q = 32767 / half;
    const positions = new Int16Array(vertexCount * 3);
    const index = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
    let vo = 0, io = 0;
    for (const { mesh, matrix } of parts) {
      const geometry = mesh.geometry, position = geometry.attributes.position;
      // A mirrored part turns its triangles inside out: swap two corners to keep the cast side.
      const flip = matrix.determinant() < 0;
      for (let i = 0; i < position.count; i++) {
        v.fromBufferAttribute(position, i).applyMatrix4(matrix);
        positions[(vo + i) * 3] = Math.round((v.x - centre[0]) * q);
        positions[(vo + i) * 3 + 1] = Math.round((v.y - centre[1]) * q);
        positions[(vo + i) * 3 + 2] = Math.round((v.z - centre[2]) * q);
      }
      const source = geometry.index ? geometry.index.array : null;
      const count = source ? source.length : position.count;
      for (let i = 0; i + 2 < count; i += 3) {
        const a = source ? source[i] : i, b = source ? source[i + 1] : i + 1, c = source ? source[i + 2] : i + 2;
        index[io++] = vo + a; index[io++] = vo + (flip ? c : b); index[io++] = vo + (flip ? b : c);
      }
      vo += position.count;
      mesh.castShadow = false;
      mesh.userData[SHADOW_STAND_IN_SOURCE] = true;
      sources.push(mesh);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3, true));
    geometry.setIndex(new THREE.BufferAttribute(index.subarray(0, io), 1));
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    // The CPU copies are not needed once uploaded.
    for (const attribute of [geometry.attributes.position, geometry.index]) attribute.onUpload(function (this: any) { this.array = null; });
    const mesh = new THREE.Mesh(geometry, standInMaterial(THREE, side));
    mesh.name = `shadow-stand-in-${side}`;
    mesh.layers.set(SHADOW_ONLY_LAYER);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.matrixAutoUpdate = false;
    // Normalised int16 reads back as [-1, 1]: scale by the half extent.
    mesh.matrix.makeScale(half, half, half).setPosition(centre[0], centre[1], centre[2]);
    mesh.raycast = () => {};
    object.add(mesh);
    triangles += io / 3;
    bytes += positions.byteLength + io * index.BYTES_PER_ELEMENT;
  }
  return object.children.length ? { object, sources, triangles, bytes } : null;
}

/** Free a stand-in's geometry and let its sources cast again (they cast nothing while flagged otherwise). */
export function disposeShadowStandIn(standIn: ShadowStandIn, restoreSources = false): void {
  standIn.object.parent?.remove(standIn.object);
  for (const mesh of standIn.object.children) mesh.geometry?.dispose();
  if (!restoreSources) return;
  for (const mesh of standIn.sources) { delete mesh.userData[SHADOW_STAND_IN_SOURCE]; mesh.castShadow = true; }
}

/**
 * Let the shadow pass draw SHADOW_ONLY_LAYER: the layer is enabled on the
 * camera three tests casters against (`object.layers.test(camera.layers)` in
 * WebGLShadowMap.renderObject) for the pass only. Idempotent per renderer.
 */
export function shadowOnlyLayerPass(renderer: any): void {
  const shadowMap = renderer?.shadowMap;
  if (!shadowMap || shadowMap.__shadowOnlyLayer) return;
  const render = shadowMap.render;
  shadowMap.render = function (this: any, lights: unknown, scene: unknown, camera: any, ...rest: unknown[]) {
    const layers = camera?.layers;
    if (!layers || layers.isEnabled(SHADOW_ONLY_LAYER)) return render.call(this, lights, scene, camera, ...rest);
    layers.enable(SHADOW_ONLY_LAYER);
    try { return render.call(this, lights, scene, camera, ...rest); }
    finally { layers.disable(SHADOW_ONLY_LAYER); }
  };
  shadowMap.__shadowOnlyLayer = true;
}
