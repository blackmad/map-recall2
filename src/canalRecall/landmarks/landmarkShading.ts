// Landmark shading: diffuse only, like the city around it.
//
// User report 2026-10-10 ("what's with the weird specular highlights on our
// landmark buildings?"): Hotel Jakarta wore a soft white blob across its glazed
// facade and slate roof, and the Muziekgebouw (4'33 Grand Café) roof a smeared
// spotlight. The GLB materials were not the cause — every in-game landmark is
// metallic 0 / roughness 0.9. The legacy landmark layer bakes MapLibre's whole
// view-projection (times the model transform) into `camera.projectionMatrix`
// and leaves the camera at the identity. three.js therefore believes the eye
// sits at the model's origin — its footprint centre, on the ground — and every
// GGX highlight is computed for a viewer standing inside the building: a fixed
// blob that slides over walls and roofs as the real camera moves, brightest on
// dark materials at the grazing angles Fresnel amplifies.
//
// Fixing the eye would make the highlight physically placed but still a sheen
// the rest of the city does not have: MapLibre extrusions and the recipe look
// (buildingRecipe/recipeLook.ts) are flat diffuse. So landmark materials are
// normalised to MeshLambertMaterial: the same diffuse response under the same
// lights, no view-dependent term at all. Glass stays legible through its own
// colour (the catalogue's glass overrides are a distinct blue-grey), plus a
// small constant sky tint that reads as "reflective" without any hotspot.
//
// The GLB-side convention is kept honest by `auditGltfMaterials`: metallic must
// be ~0 (Lambert ignores metalness, so a metal would change colour in game) and
// no specular/transmission/clearcoat extensions (they would be dropped).

/** The agreed range for exported landmark/recipe materials. */
export const LANDMARK_MATERIAL_RANGE = {
  /** Above this the material is a metal: its in-game (diffuse) colour would not match the author's intent. */
  maxMetallic: 0.05,
  /** Below this a material is "glossy". Irrelevant at runtime (diffuse only) but flagged so exporters keep to the convention. */
  minRoughness: 0.8,
} as const;

/** glTF material extensions whose look a diffuse-only renderer cannot honour. */
export const UNSUPPORTED_MATERIAL_EXTENSIONS = [
  'KHR_materials_specular', 'KHR_materials_transmission', 'KHR_materials_clearcoat', 'KHR_materials_sheen',
  'KHR_materials_iridescence', 'KHR_materials_volume', 'KHR_materials_ior', 'KHR_materials_anisotropy',
  'KHR_materials_pbrSpecularGlossiness',
] as const;

/** Constant sky tint added to glass (emissive, linear): view-independent "reflection", never a hotspot. */
export const GLASS_SKY_TINT = { r: 0.035, g: 0.05, b: 0.07 } as const;

/** Materials whose name marks them as glazing. */
export const GLASS_NAME = /glass|glaz|window|vitr|ruit/i;

export type GltfMaterialJson = {
  name?: string;
  pbrMetallicRoughness?: { metallicFactor?: number; roughnessFactor?: number; metallicRoughnessTexture?: unknown };
  extensions?: Record<string, unknown>;
};

export type MaterialIssue = { material: string; severity: 'error' | 'warning'; problem: string };

/**
 * Check a GLB's material JSON against the agreed range. Errors change the
 * in-game look (metals, specular extensions, unlit is fine); warnings are
 * convention drift with no runtime effect (low roughness).
 */
export function auditGltfMaterials(materials: readonly GltfMaterialJson[]): MaterialIssue[] {
  const issues: MaterialIssue[] = [];
  materials.forEach((m, i) => {
    const name = m.name || `#${i}`;
    const pbr = m.pbrMetallicRoughness || {};
    // glTF defaults: metallic 1, roughness 1.
    const metallic = pbr.metallicFactor ?? 1, roughness = pbr.roughnessFactor ?? 1;
    const unlit = Boolean(m.extensions?.KHR_materials_unlit);
    if (!unlit && metallic > LANDMARK_MATERIAL_RANGE.maxMetallic) issues.push({ material: name, severity: 'error', problem: `metallic ${metallic} > ${LANDMARK_MATERIAL_RANGE.maxMetallic}` });
    if (!unlit && pbr.metallicRoughnessTexture) issues.push({ material: name, severity: 'warning', problem: 'metallicRoughnessTexture is ignored in game' });
    if (!unlit && roughness < LANDMARK_MATERIAL_RANGE.minRoughness) issues.push({ material: name, severity: 'warning', problem: `roughness ${roughness} < ${LANDMARK_MATERIAL_RANGE.minRoughness}` });
    for (const ext of Object.keys(m.extensions || {})) {
      if ((UNSUPPORTED_MATERIAL_EXTENSIONS as readonly string[]).includes(ext)) issues.push({ material: name, severity: 'error', problem: `${ext} is not rendered` });
    }
  });
  return issues;
}

/** The JSON chunk of a binary glTF. */
export function glbJson(bytes: Uint8Array): { materials?: GltfMaterialJson[] } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67) return null;
  const length = view.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length)));
}

/** Properties a MeshStandardMaterial shares with MeshLambertMaterial and that GLTFLoader can set. */
const COPIED = [
  'name', 'color', 'map', 'lightMap', 'lightMapIntensity', 'aoMap', 'aoMapIntensity',
  'emissive', 'emissiveMap', 'emissiveIntensity', 'bumpMap', 'bumpScale', 'normalMap', 'normalMapType', 'normalScale',
  'alphaMap', 'transparent', 'opacity', 'alphaTest', 'alphaHash', 'side', 'shadowSide', 'vertexColors', 'flatShading',
  'depthTest', 'depthWrite', 'colorWrite', 'blending', 'premultipliedAlpha', 'polygonOffset', 'polygonOffsetFactor',
  'polygonOffsetUnits', 'visible', 'toneMapped', 'fog', 'wireframe',
] as const;

const SPECULAR_TYPES = new Set(['MeshStandardMaterial', 'MeshPhysicalMaterial', 'MeshPhongMaterial']);

/** Whether a three.js material has a view-dependent (specular) term. */
export function hasSpecular(material: { type?: string } | null | undefined): boolean {
  return Boolean(material && SPECULAR_TYPES.has(material.type as string));
}

/**
 * Diffuse-only copy of a lit three.js material. Unlit (Basic), custom
 * (Shader) and already-diffuse materials come back unchanged.
 */
export function toDiffuseMaterial(THREE: any, source: any): any {
  if (!hasSpecular(source)) return source;
  const target = new THREE.MeshLambertMaterial();
  for (const key of COPIED) {
    const value = source[key];
    if (value === undefined || !(key in target)) continue;
    if (value && typeof value.clone === 'function' && !value.isTexture) target[key] = value.clone();
    else target[key] = value;
  }
  target.userData = { ...source.userData, canalRecallDiffuseFrom: source.type };
  if (GLASS_NAME.test(source.name || '')) {
    target.emissive.r += GLASS_SKY_TINT.r; target.emissive.g += GLASS_SKY_TINT.g; target.emissive.b += GLASS_SKY_TINT.b;
  }
  return target;
}

/**
 * Swap every specular material under `root` for its diffuse copy, once per
 * source material (meshes that shared a material keep sharing). Disposes the
 * replaced materials but not their textures, which the copies now hold.
 * Returns the number of materials replaced.
 */
export function normaliseLandmarkMaterials(THREE: any, root: any): number {
  const swapped = new Map<any, any>();
  const swap = (material: any) => {
    if (!hasSpecular(material)) return material;
    let next = swapped.get(material);
    if (!next) { next = toDiffuseMaterial(THREE, material); swapped.set(material, next); }
    return next;
  };
  root.traverse((child: any) => {
    if (!child.isMesh || !child.material) return;
    child.material = Array.isArray(child.material) ? child.material.map(swap) : swap(child.material);
  });
  for (const material of swapped.keys()) material.dispose();
  return swapped.size;
}
