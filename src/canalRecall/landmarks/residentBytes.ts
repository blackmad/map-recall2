/**
 * GPU bytes a landmark level holds (lane landmark-residency, 2026-11-27).
 *
 * The residency budget was a model count (72 desktop, 24 touch), but models differ by two orders of magnitude: a
 * street chunk's lod2 is tens of kB, a full Rijksmuseum several MB. GPU memory is the one red budget (#251), so the
 * budget is in bytes of what the models actually upload: vertex and index buffers plus their textures.
 *
 * Read from the attribute `count`, `itemSize` and the array's element size, never `array.byteLength`: once uploaded a
 * landmark's non-position arrays are released to empty arrays of the same type (releaseVertexData.ts), and `count`
 * stays. An interleaved buffer is counted once. Textures count their image at 4 bytes a texel (plus a third for
 * mipmaps when three generates them) or a compressed texture's mip data. Shared look textures (`skip`) belong to no
 * one model and are left out.
 */
import type * as THREE from 'three';

export interface GpuBytes {
  geometry: number;
  texture: number;
}

type AnyAttribute = {
  count: number;
  itemSize: number;
  array?: { BYTES_PER_ELEMENT?: number } | null;
  isInterleavedBufferAttribute?: boolean;
  data?: { count: number; stride: number; array?: { BYTES_PER_ELEMENT?: number } | null };
};

const elementBytes = (array: { BYTES_PER_ELEMENT?: number } | null | undefined): number => array?.BYTES_PER_ELEMENT ?? 4;

/** Bytes of one geometry's attributes and index; interleaved buffers through `seen` (counted once). */
export function geometryGpuBytes(geometry: THREE.BufferGeometry, seen: Set<object> = new Set()): number {
  let bytes = 0;
  const add = (attribute: AnyAttribute | null | undefined) => {
    if (!attribute || seen.has(attribute)) return;
    seen.add(attribute);
    if (attribute.isInterleavedBufferAttribute && attribute.data) {
      if (seen.has(attribute.data)) return;
      seen.add(attribute.data);
      bytes += attribute.data.count * attribute.data.stride * elementBytes(attribute.data.array);
      return;
    }
    bytes += attribute.count * attribute.itemSize * elementBytes(attribute.array);
  };
  for (const name of Object.keys(geometry.attributes || {})) add(geometry.attributes[name] as unknown as AnyAttribute);
  for (const list of Object.values(geometry.morphAttributes || {})) for (const attribute of list) add(attribute as unknown as AnyAttribute);
  add(geometry.index as unknown as AnyAttribute | null);
  return bytes;
}

type TextureLike = {
  isTexture?: boolean;
  isCompressedTexture?: boolean;
  isDataTexture?: boolean;
  generateMipmaps?: boolean;
  image?: { width?: number; height?: number; depth?: number; data?: { byteLength?: number } } | null;
  mipmaps?: Array<{ data?: { byteLength?: number }; width?: number; height?: number }>;
};

/** Bytes one texture uploads. */
export function textureGpuBytes(texture: TextureLike): number {
  if (texture.isCompressedTexture) {
    let bytes = 0;
    for (const mip of texture.mipmaps || []) bytes += mip.data?.byteLength ?? 0;
    return bytes;
  }
  const image = texture.image;
  if (!image) return 0;
  const base = image.data?.byteLength ?? (image.width ?? 0) * (image.height ?? 0) * Math.max(1, image.depth ?? 1) * 4;
  return Math.round(texture.generateMipmaps === false ? base : base * 4 / 3);
}

/** Textures a material reads: its own texture-valued fields and any texture uniform. */
function materialTextures(material: THREE.Material, out: Set<TextureLike>): void {
  for (const value of Object.values(material)) if ((value as TextureLike | null)?.isTexture) out.add(value as TextureLike);
  const uniforms = (material as { uniforms?: Record<string, { value?: unknown }> }).uniforms;
  if (uniforms) for (const u of Object.values(uniforms)) if ((u?.value as TextureLike | null)?.isTexture) out.add(u.value as TextureLike);
}

/** The geometry bytes and the textures of everything under `root` (one landmark level). */
export function objectGpuParts(root: THREE.Object3D, skipMaterial: (material: THREE.Material) => boolean = () => false): { geometry: number; textures: TextureLike[] } {
  const seen = new Set<object>(), textures = new Set<TextureLike>();
  let geometry = 0;
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh && !(object as THREE.Points).isPoints && !(object as THREE.Line).isLine) return;
    const g = mesh.geometry as THREE.BufferGeometry | undefined;
    if (g && !seen.has(g)) { seen.add(g); geometry += geometryGpuBytes(g, seen); }
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!material || skipMaterial(material)) continue;
      materialTextures(material, textures);
    }
  });
  return { geometry, textures: [...textures] };
}

/**
 * GPU bytes of everything under `root` (one landmark level). `skipMaterial` leaves out materials that are shared
 * page-wide (the recipe look's), whose textures no one model frees.
 */
export function objectGpuBytes(root: THREE.Object3D, skipMaterial?: (material: THREE.Material) => boolean): GpuBytes {
  const { geometry, textures } = objectGpuParts(root, skipMaterial);
  let texture = 0;
  for (const t of textures) texture += textureGpuBytes(t);
  return { geometry, texture };
}

/**
 * A level's bytes now. The walk runs once per level (its geometry and the list of its textures are kept on the level,
 * `userData.gpuParts`: buffers do not change size while resident); texture bytes are read live, because the texture
 * cap (landmarkTexCap.ts) swaps a texture between its full and its downscaled image as the camera moves.
 */
export function levelGpuBytes(level: THREE.Object3D | null | undefined, skipMaterial?: (material: THREE.Material) => boolean): number {
  if (!level) return 0;
  let parts = level.userData?.gpuParts as { geometry: number; textures: TextureLike[] } | undefined;
  if (!parts) {
    parts = objectGpuParts(level, skipMaterial);
    if (level.userData) level.userData.gpuParts = parts;
  }
  let bytes = parts.geometry;
  for (const t of parts.textures) bytes += textureGpuBytes(t);
  return bytes;
}
