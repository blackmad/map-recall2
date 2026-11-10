/**
 * GLB -> flat primitives for the Node rasteriser (lane H12, docs/house-line.md §8). Node only: @gltf-transform/core with
 * the meshopt decoder (EXT_meshopt_compression) and KHR_mesh_quantization (accessors are read de-normalised), the node
 * hierarchy flattened to world positions, normals by the inverse transpose, TEXCOORD_0, COLOR_0, and per primitive its
 * material: base colour factor and texture (KHR_texture_transform offset/scale/rotation applied to the uvs), emissive,
 * alpha mode and cutoff, doubleSided, KHR_materials_unlit and the extras three.js's GLTFLoader copies into
 * material.userData (materialSlot, tint, tintSource, ...). Images decode through sharp. No DOM, no globals.
 */
import { NodeIO, type Material, type Texture } from '@gltf-transform/core';
import { ALL_EXTENSIONS, type Transform } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

export type GlbImage = { width: number; height: number; rgba: Uint8Array };
export type GlbMaterial = {
  name: string;
  /** linear RGBA (glTF base colour factors are linear). */
  baseColor: [number, number, number, number];
  baseColorTexture: GlbImage | null;
  emissive: [number, number, number];
  alphaMode: 'OPAQUE' | 'MASK' | 'BLEND';
  alphaCutoff: number;
  doubleSided: boolean;
  unlit: boolean;
  metallic: number; roughness: number;
  /** glTF material extras (three.js userData). */
  extras: Record<string, unknown>;
};
export type GlbPrimitive = {
  positions: Float32Array; normals: Float32Array | null; uvs: Float32Array | null;
  /** COLOR_0 as linear RGBA, or null. */
  colors: Float32Array | null;
  indices: Uint32Array; material: number;
};
export type GlbScene = { primitives: GlbPrimitive[]; materials: GlbMaterial[]; bytes: number };

let io: NodeIO | null = null;
async function nodeIO(): Promise<NodeIO> {
  if (io) return io;
  await MeshoptDecoder.ready;
  io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  return io;
}

const imageCache = new WeakMap<Texture, Promise<GlbImage | null>>();
async function decodeTexture(t: Texture | null): Promise<GlbImage | null> {
  if (!t) return null;
  let p = imageCache.get(t);
  if (!p) {
    p = (async () => {
      const img = t.getImage();
      if (!img) return null;
      try {
        const { data, info } = await sharp(Buffer.from(img)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        return { width: info.width, height: info.height, rgba: new Uint8Array(data) };
      } catch { return null; }
    })();
    imageCache.set(t, p);
  }
  return p;
}

/** KHR_texture_transform of the base colour texture as a uv map, or null. */
function uvTransform(m: Material): ((u: number, v: number) => [number, number]) | null {
  const info = m.getBaseColorTextureInfo();
  const ext = info?.getExtension<Transform>('KHR_texture_transform');
  if (!ext) return null;
  const [ox, oy] = ext.getOffset(), [sx, sy] = ext.getScale(), r = ext.getRotation(), c = Math.cos(r), s = Math.sin(r);
  // glTF: uv' = T * R * S * uv with R = [c, s; -s, c]
  return (u, v) => { const a = u * sx, b = v * sy; return [c * a + s * b + ox, -s * a + c * b + oy]; };
}

export async function readMaterial(m: Material): Promise<GlbMaterial> {
  const f = m.getBaseColorFactor(), em = m.getEmissiveFactor();
  return {
    name: m.getName() || 'unnamed',
    baseColor: [f[0], f[1], f[2], f[3]],
    baseColorTexture: await decodeTexture(m.getBaseColorTexture()),
    emissive: [em[0], em[1], em[2]],
    alphaMode: m.getAlphaMode() as GlbMaterial['alphaMode'],
    alphaCutoff: m.getAlphaCutoff(),
    doubleSided: m.getDoubleSided(),
    unlit: !!m.getExtension('KHR_materials_unlit'),
    metallic: m.getMetallicFactor(), roughness: m.getRoughnessFactor(),
    extras: { ...((m.getExtras() ?? {}) as Record<string, unknown>) },
  };
}

/** Load a GLB (bytes) into world-space primitives (triangles only). */
export async function loadGlb(bytes: Uint8Array): Promise<GlbScene> {
  const doc = await (await nodeIO()).readBinary(bytes);
  const root = doc.getRoot(), mats = root.listMaterials();
  const materials = await Promise.all(mats.map(readMaterial));
  const defaultIndex = materials.length;
  let needDefault = false;
  const primitives: GlbPrimitive[] = [];
  // Only nodes reachable from the default scene draw (GLTFLoader adds gltf.scene).
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const nodes: ReturnType<typeof root.listNodes> = [];
  if (scene) scene.traverse(n => { nodes.push(n); });
  else nodes.push(...root.listNodes());
  const v = [0, 0, 0, 0];
  for (const node of nodes) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    // Inverse transpose of the upper 3x3 (column-major m).
    const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], k = m[10];
    const A = e * k - f * h, B = -(d * k - f * g), C = d * h - e * g, det = a * A + b * B + c * C || 1;
    const it = [A / det, B / det, C / det, -(b * k - c * h) / det, (a * k - c * g) / det, -(a * h - b * g) / det, (b * f - c * e) / det, -(a * f - c * d) / det, (a * e - b * d) / det];
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) continue;
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const count = pos.getCount(), positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos.getElement(i, v);
        positions[i * 3] = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12];
        positions[i * 3 + 1] = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13];
        positions[i * 3 + 2] = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
      }
      const na = prim.getAttribute('NORMAL');
      let normals: Float32Array | null = null;
      if (na) {
        normals = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          na.getElement(i, v);
          const x = it[0] * v[0] + it[1] * v[1] + it[2] * v[2], y = it[3] * v[0] + it[4] * v[1] + it[5] * v[2], z = it[6] * v[0] + it[7] * v[1] + it[8] * v[2], l = Math.hypot(x, y, z) || 1;
          normals[i * 3] = x / l; normals[i * 3 + 1] = y / l; normals[i * 3 + 2] = z / l;
        }
      }
      const mat = prim.getMaterial(), mi = mat ? mats.indexOf(mat) : -1;
      if (mi < 0) needDefault = true;
      const ta = prim.getAttribute('TEXCOORD_0');
      let uvs: Float32Array | null = null;
      if (ta) {
        uvs = new Float32Array(count * 2);
        const tf = mat ? uvTransform(mat) : null;
        for (let i = 0; i < count; i++) {
          ta.getElement(i, v);
          const [uu, vv] = tf ? tf(v[0], v[1]) : [v[0], v[1]];
          uvs[i * 2] = uu; uvs[i * 2 + 1] = vv;
        }
      }
      const ca = prim.getAttribute('COLOR_0');
      let colors: Float32Array | null = null;
      if (ca) {
        colors = new Float32Array(count * 4);
        const size = ca.getElementSize();
        for (let i = 0; i < count; i++) { v[3] = 1; ca.getElement(i, v); colors.set([v[0], v[1], v[2], size === 4 ? v[3] : 1], i * 4); }
      }
      const idx = prim.getIndices(), n = idx ? idx.getCount() : count, indices = new Uint32Array(n - (n % 3));
      for (let i = 0; i < indices.length; i++) indices[i] = idx ? idx.getScalar(i) : i;
      primitives.push({ positions, normals, uvs, colors, indices, material: mi < 0 ? defaultIndex : mi });
    }
  }
  if (needDefault) materials.push({ name: 'default', baseColor: [1, 1, 1, 1], baseColorTexture: null, emissive: [0, 0, 0], alphaMode: 'OPAQUE', alphaCutoff: 0.5, doubleSided: false, unlit: false, metallic: 1, roughness: 1, extras: {} });
  return { primitives, materials, bytes: bytes.byteLength };
}
