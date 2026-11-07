// The landmark batch (lane R4-B #244): every landmark drawn at lod2 in one draw.
//
// From the air the landmarks were 1,327 of 1,654 desktop draws (R3-F #241): ~8 meshes per model, one per material.
// A lod2 (landmarkLod.ts) is one geometry with its colours in COLOR_0, so all lod2 models can share one material and
// one THREE.BatchedMesh: a geometry per model, an instance per model with its placement matrix, per-instance
// visibility and frustum culling, drawn with one multi-draw call. One batch per material key (the depth fade's
// landmark opt-out is a material with fog off, so 'fade' and 'noFade' are two batches, two draws at most).
//
// Precision: the landmark root is Mercator space (a metre is ~4e-8 units, Amsterdam sits at x ~0.51). Instance
// matrices live in a float32 texture, where 0.51 has 6e-8 steps, i.e. 1.5 m. So each batch is placed at an `origin`
// (a model's anchor) and its instance matrices are stored relative to it: 10 km from the origin is 4e-4, with
// sub-millimetre float32 steps. The subtraction happens in float64 here.
//
// The JS adapter (signature-landmarks-source.js) only calls add / remove / setMatrix / setVisible / setDepthBias.

export interface BatchStats {
  batches: number;
  instances: number;
  visible: number;
  vertexCapacity: number;
  indexCapacity: number;
  verticesUsed: number;
  indicesUsed: number;
  /** Times a batch's buffers were reallocated larger (setGeometrySize) or its instance texture grown. */
  reallocations: number;
  /** Times a batch was compacted (optimize) to reuse removed models' space. */
  compactions: number;
}

export interface LandmarkBatchOptions {
  /** The parent the batches join (the landmark root: Mercator space). */
  parent: any;
  /** Batch origin in the parent's space; instance matrices are stored relative to it. */
  origin: readonly [number, number, number];
  /** The material for a key (one per batch). */
  material(key: string): any;
  /** Called once per new batch mesh (shadows, precompile). */
  configure?(mesh: any, key: string): void;
  /** First reservation; grows by reallocation (sized from modelLods.json lod2 totals for the resident cap). */
  initialInstances?: number;
  initialVertices?: number;
  initialIndices?: number;
}

interface Slot { key: string; geometry: any; geometryId: number; instanceId: number; vertices: number; indices: number; visible: boolean }
interface Batch { mesh: any; vertices: number; indices: number }

/** Room a batch needs for `vertices`/`indices` more: grow to 1.5x what is then live, at least 1.5x today. */
export function grownCapacity(current: number, live: number, need: number): number {
  return Math.max(Math.ceil((live + need) * 1.5), Math.ceil(current * 1.5));
}

export class LandmarkBatch {
  private readonly THREE: any;
  private readonly o: Required<Omit<LandmarkBatchOptions, 'configure'>> & Pick<LandmarkBatchOptions, 'configure'>;
  private readonly batches = new Map<string, Batch>();
  private readonly slots = new Map<string, Slot>();
  private readonly scratch: any;
  private depthBias = 0;
  private reallocations = 0;
  private compactions = 0;

  constructor(THREE: any, options: LandmarkBatchOptions) {
    this.THREE = THREE;
    this.o = { initialInstances: 64, initialVertices: 65_536, initialIndices: 131_072, ...options };
    this.scratch = new THREE.Matrix4();
  }

  has(id: string): boolean { return this.slots.has(id); }
  /** The geometry a model was added with (the adapter re-adds when its level's geometry changes). */
  geometryOf(id: string): any { return this.slots.get(id)?.geometry ?? null; }
  get size(): number { return this.slots.size; }
  /** The batch meshes, one per key in use. */
  meshes(): any[] { return [...this.batches.values()].map(b => b.mesh); }

  /**
   * Add (or re-add) a model: its one geometry and its matrix in the parent's space. A model already in the batch with
   * the same geometry and key only takes the new matrix. Returns false when the geometry does not fit the batch's
   * attribute layout (the adapter then draws the model's own mesh).
   */
  add(id: string, key: string, geometry: any, matrixInParent: any): boolean {
    const had = this.slots.get(id);
    if (had && had.geometry === geometry && had.key === key) { this.setMatrix(id, matrixInParent); return true; }
    if (had) this.remove(id);
    const vertices = geometry.getAttribute('position').count, indices = geometry.getIndex()?.count ?? 0;
    const batch = this.batchFor(key, geometry);
    if (!this.compatible(batch.mesh, geometry)) return false;
    this.ensureRoom(batch, vertices, indices);
    const geometryId = batch.mesh.addGeometry(geometry);
    if (batch.mesh.instanceCount >= batch.mesh.maxInstanceCount) {
      batch.mesh.setInstanceCount(Math.max(batch.mesh.maxInstanceCount * 2, 16));
      this.reallocations++;
    }
    const instanceId = batch.mesh.addInstance(geometryId);
    batch.vertices += vertices; batch.indices += indices;
    this.slots.set(id, { key, geometry, geometryId, instanceId, vertices, indices, visible: true });
    this.setMatrix(id, matrixInParent);
    return true;
  }

  /** Take a model out (its level changed, it was evicted, or the card lights it). */
  remove(id: string): boolean {
    const slot = this.slots.get(id);
    if (!slot) return false;
    const batch = this.batches.get(slot.key)!;
    batch.mesh.deleteGeometry(slot.geometryId); // deletes its instance too
    batch.vertices -= slot.vertices; batch.indices -= slot.indices;
    this.slots.delete(id);
    return true;
  }

  setMatrix(id: string, matrixInParent: any): void {
    const slot = this.slots.get(id);
    if (!slot) return;
    const m = this.scratch.copy(matrixInParent), e = m.elements, [ox, oy, oz] = this.o.origin;
    // T(-origin) * M: an affine M's translation column, in float64, before the float32 texture.
    e[12] -= ox * e[15]; e[13] -= oy * e[15]; e[14] -= oz * e[15];
    this.batches.get(slot.key)!.mesh.setMatrixAt(slot.instanceId, m);
  }

  setVisible(id: string, visible: boolean): void {
    const slot = this.slots.get(id);
    if (!slot || slot.visible === visible) return;
    slot.visible = visible;
    this.batches.get(slot.key)!.mesh.setVisibleAt(slot.instanceId, visible);
  }

  /** The suppression depth bias (signature-landmarks-source.js `_applySuppression`), as the per-model materials take it. */
  setDepthBias(bias: number): void {
    this.depthBias = bias;
    for (const batch of this.batches.values()) this.applyDepthBias(batch.mesh.material);
  }

  stats(): BatchStats {
    let vertexCapacity = 0, indexCapacity = 0, verticesUsed = 0, indicesUsed = 0;
    for (const b of this.batches.values()) {
      vertexCapacity += b.mesh._maxVertexCount ?? 0; indexCapacity += b.mesh._maxIndexCount ?? 0;
      verticesUsed += b.vertices; indicesUsed += b.indices;
    }
    let visible = 0;
    for (const s of this.slots.values()) if (s.visible) visible++;
    return { batches: this.batches.size, instances: this.slots.size, visible, vertexCapacity, indexCapacity, verticesUsed, indicesUsed,
      reallocations: this.reallocations, compactions: this.compactions };
  }

  dispose(): void {
    for (const batch of this.batches.values()) {
      batch.mesh.parent?.remove(batch.mesh);
      batch.mesh.dispose();
      batch.mesh.material?.dispose?.();
    }
    this.batches.clear();
    this.slots.clear();
  }

  private batchFor(key: string, geometry: any): Batch {
    let batch = this.batches.get(key);
    if (batch) return batch;
    const THREE = this.THREE;
    const index = geometry.getIndex();
    const vertices = Math.max(this.o.initialVertices, geometry.getAttribute('position').count);
    const indices = Math.max(this.o.initialIndices, index?.count ?? 0);
    const material = this.o.material(key);
    this.applyDepthBias(material);
    const mesh = new THREE.BatchedMesh(this.o.initialInstances, vertices, indices, material);
    mesh.name = `landmark-batch ${key}`;
    mesh.position.set(this.o.origin[0], this.o.origin[1], this.o.origin[2]);
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    // Instances are culled one by one; the batch's own bounds would need recomputing on every add.
    mesh.frustumCulled = false;
    mesh.perObjectFrustumCulled = true;
    this.o.configure?.(mesh, key);
    this.o.parent.add(mesh);
    batch = { mesh, vertices: 0, indices: 0 };
    this.batches.set(key, batch);
    return batch;
  }

  /** BatchedMesh needs one attribute layout (names, item sizes, normalisation, index or not) for every geometry. */
  private compatible(mesh: any, geometry: any): boolean {
    const own = mesh.geometry;
    if (!own.getAttribute('position')) return true; // first geometry sets the layout
    if (!!own.getIndex() !== !!geometry.getIndex()) return false;
    const names = Object.keys(own.attributes);
    if (names.length !== Object.keys(geometry.attributes).length) return false;
    for (const name of names) {
      const a = own.getAttribute(name), b = geometry.getAttribute(name);
      if (!b || a.itemSize !== b.itemSize || a.normalized !== b.normalized || a.array.constructor !== b.array.constructor) return false;
    }
    return true;
  }

  private ensureRoom(batch: Batch, vertices: number, indices: number): void {
    const mesh = batch.mesh;
    if (!mesh.geometry.getAttribute('position')) return; // the first addGeometry allocates at the constructor's size
    if (mesh.unusedVertexCount >= vertices && mesh.unusedIndexCount >= indices) return;
    const maxV = mesh._maxVertexCount, maxI = mesh._maxIndexCount;
    // Removed models leave holes until a compaction; compact first when what is live would fit.
    if (batch.vertices + vertices <= maxV && batch.indices + indices <= maxI) {
      mesh.optimize();
      this.compactions++;
      if (mesh.unusedVertexCount >= vertices && mesh.unusedIndexCount >= indices) return;
    } else {
      mesh.optimize();
      this.compactions++;
    }
    mesh.setGeometrySize(grownCapacity(maxV, batch.vertices, vertices), grownCapacity(maxI, batch.indices, indices));
    this.reallocations++;
  }

  private applyDepthBias(material: any): void {
    if (!material) return;
    material.polygonOffset = this.depthBias !== 0;
    material.polygonOffsetFactor = 0;
    material.polygonOffsetUnits = this.depthBias * 4096;
    material.needsUpdate = true;
  }
}

/** Material properties that decide a Lambert landmark mesh's look apart from its colour (the merge's group key). */
const LOOK_KEYS = ['type', 'side', 'shadowSide', 'transparent', 'opacity', 'alphaTest', 'depthWrite', 'depthTest', 'fog', 'flatShading',
  'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'visible', 'toneMapped', 'wireframe'] as const;

function lookKey(THREE: any, material: any): string | null {
  if (!material || material.type !== 'MeshLambertMaterial' || material.vertexColors) return null;
  for (const k of ['map', 'alphaMap', 'aoMap', 'lightMap', 'emissiveMap', 'bumpMap', 'normalMap']) if (material[k]) return null;
  // A shader hook (city look, highlight passes) is per material: leave those meshes alone.
  if (material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return null;
  return JSON.stringify([...LOOK_KEYS.map(k => material[k] ?? null), material.emissive?.getHex?.() ?? 0, material.emissiveIntensity ?? 1,
    Object.keys(material.userData ?? {}).sort().filter(k => typeof material.userData[k] === 'boolean' && material.userData[k])]);
}

/**
 * `?landmarkMergeLod1=1` (lane R4-B #244 step 5, a prototype): a lod1 keeps the full model's ~8 materials, so ~8 draws.
 * Merge every plain Lambert mesh of a level into one mesh per look (same material apart from colour), the colour
 * moved into a `color` attribute: identical shading by construction (Lambert multiplies the material colour, now
 * white, by the vertex colour), one draw per look (one, or two with glass's sky tint). Positions and normals come out
 * float32 in the root's space; only the vertices a mesh's triangles use are copied. Returns meshes before and after.
 */
export function mergeLevelByLook(THREE: any, root: any, options: { single?: boolean } = {}): { before: number; after: number } {
  const groups = new Map<string, any[]>();
  let before = 0;
  root.updateMatrixWorld(true);
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  root.traverse((child: any) => {
    if (!child.isMesh) return;
    before++;
    if (child.isInstancedMesh || child.isSkinnedMesh || child.isBatchedMesh || Array.isArray(child.material)) return;
    const g = child.geometry;
    if (!g?.attributes?.position || !g.attributes.normal || g.morphAttributes?.position?.length || g.attributes.color) return;
    const key = lookKey(THREE, child.material);
    if (!key) return;
    let list = groups.get(key);
    if (!list) groups.set(key, list = []);
    list.push(child);
  });
  let after = before;
  for (const meshes of groups.values()) {
    // `single` (a lod2 for the batch): a lone mesh is rewritten too, so every plain look ends vertex-coloured.
    if (meshes.length < (options.single ? 1 : 2)) continue;
    const used = meshes.map(m => usedVertices(m.geometry));
    let vertices = 0, indices = 0;
    for (const u of used) { vertices += u.vertices.length; indices += u.index.length; }
    const position = new Float32Array(vertices * 3), normal = new Float32Array(vertices * 3), color = new Float32Array(vertices * 3);
    const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
    const v = new THREE.Vector3(), matrix = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3();
    let vo = 0, io = 0;
    meshes.forEach((m, k) => {
      const g = m.geometry, p = g.attributes.position, n = g.attributes.normal, c = m.material.color, u = used[k];
      matrix.multiplyMatrices(rootInverse, m.matrixWorld);
      normalMatrix.getNormalMatrix(matrix);
      u.vertices.forEach((src, i) => {
        v.fromBufferAttribute(p, src).applyMatrix4(matrix); v.toArray(position, (vo + i) * 3);
        v.fromBufferAttribute(n, src).applyMatrix3(normalMatrix).normalize(); v.toArray(normal, (vo + i) * 3);
        color[(vo + i) * 3] = c.r; color[(vo + i) * 3 + 1] = c.g; color[(vo + i) * 3 + 2] = c.b;
      });
      for (let i = 0; i < u.index.length; i++) index[io + i] = vo + u.index[i];
      io += u.index.length; vo += u.vertices.length;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    const material = meshes[0].material.clone();
    material.color.setRGB(1, 1, 1);
    material.vertexColors = true;
    material.userData = { ...meshes[0].material.userData, landmarkMergedLook: true };
    const merged = new THREE.Mesh(geometry, material);
    merged.name = `merged ${meshes.length}`;
    merged.castShadow = meshes.some(m => m.castShadow); merged.receiveShadow = meshes.some(m => m.receiveShadow);
    root.add(merged);
    for (const m of meshes) {
      m.parent?.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
    after -= meshes.length - 1;
  }
  return { before, after };
}

/**
 * The vertices a geometry's triangles use, in first-use order, and its index list renumbered onto them. A lod2's
 * primitives share one vertex stream (build-landmark-lods.ts shareVertexStreams), so each mesh draws only part of it.
 */
export function usedVertices(geometry: any): { vertices: number[]; index: number[] } {
  const count = geometry.getAttribute('position').count, idx = geometry.getIndex();
  const map = new Int32Array(count).fill(-1), vertices: number[] = [], index: number[] = [];
  const n = idx ? idx.count : count;
  for (let i = 0; i < n; i++) {
    const src = idx ? idx.getX(i) : i;
    if (map[src] < 0) { map[src] = vertices.length; vertices.push(src); }
    index.push(map[src]);
  }
  return { vertices, index };
}

/** Attribute layouts two geometries must agree on to be concatenated (names, item sizes, array types, normalisation). */
function layoutOf(geometry: any): string {
  return Object.keys(geometry.attributes).sort().map(name => {
    const a = geometry.getAttribute(name);
    return name === 'position' || name === 'normal' ? `${name}:${a.itemSize}` : `${name}:${a.itemSize}:${a.normalized}:${a.isInterleavedBufferAttribute ? 'i' : a.array.constructor.name}`;
  }).join(',');
}

/**
 * A lod2 under the city look (lane R4-B #244): the look (look/cityLook.ts) gave each of its per-material meshes a
 * shared city material and `layer`/`tint` attributes. Merge the meshes that share a material object into one mesh
 * (position and normal moved into `root`'s frame as float32, the other attributes copied), so a lod2 is one mesh per
 * city material (one or two) and joins the batch as such. Materials are kept (they are shared), geometries freed.
 */
export function mergeLevelByMaterial(THREE: any, root: any): { before: number; after: number } {
  const groups = new Map<any, any[]>();
  let before = 0;
  root.updateMatrixWorld(true);
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  root.traverse((child: any) => {
    if (!child.isMesh) return;
    before++;
    if (child.isInstancedMesh || child.isSkinnedMesh || child.isBatchedMesh || Array.isArray(child.material) || !child.material) return;
    const g = child.geometry;
    if (!g?.attributes?.position || !g.attributes.normal || g.morphAttributes?.position?.length) return;
    let list = groups.get(child.material);
    if (!list) groups.set(child.material, list = []);
    list.push(child);
  });
  let after = before;
  for (const [material, all] of groups) {
    // One layout per merged mesh; a stray layout keeps its own mesh.
    const layout = layoutOf(all[0].geometry), meshes = all.filter(m => layoutOf(m.geometry) === layout);
    if (meshes.length < 2 && !meshes[0].geometry.getIndex()) continue;
    const used = meshes.map(m => usedVertices(m.geometry));
    let vertices = 0, indices = 0;
    for (const u of used) { vertices += u.vertices.length; indices += u.index.length; }
    if (meshes.length < 2 && vertices === meshes[0].geometry.getAttribute('position').count) continue;
    const first = meshes[0].geometry, names = Object.keys(first.attributes);
    const out: Record<string, any> = {};
    for (const name of names) {
      const a = first.getAttribute(name);
      out[name] = name === 'position' || name === 'normal' ? new Float32Array(vertices * 3) : new a.array.constructor(vertices * a.itemSize);
    }
    const index = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
    const v = new THREE.Vector3(), matrix = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3();
    let vo = 0, io = 0;
    meshes.forEach((m, k) => {
      const g = m.geometry, u = used[k];
      matrix.multiplyMatrices(rootInverse, m.matrixWorld);
      normalMatrix.getNormalMatrix(matrix);
      for (const name of names) {
        const a = g.getAttribute(name), dst = out[name];
        if (name === 'position') u.vertices.forEach((src, i) => { v.fromBufferAttribute(a, src).applyMatrix4(matrix); v.toArray(dst, (vo + i) * 3); });
        else if (name === 'normal') u.vertices.forEach((src, i) => { v.fromBufferAttribute(a, src).applyMatrix3(normalMatrix).normalize(); v.toArray(dst, (vo + i) * 3); });
        else {
          const size = a.itemSize;
          u.vertices.forEach((src, i) => { for (let c = 0; c < size; c++) dst[(vo + i) * size + c] = a.isInterleavedBufferAttribute ? a.data.array[src * a.data.stride + a.offset + c] : a.array[src * size + c]; });
        }
      }
      for (let i = 0; i < u.index.length; i++) index[io + i] = vo + u.index[i];
      io += u.index.length; vo += u.vertices.length;
    });
    const geometry = new THREE.BufferGeometry();
    for (const name of names) {
      const a = first.getAttribute(name);
      geometry.setAttribute(name, name === 'position' || name === 'normal' ? new THREE.BufferAttribute(out[name], 3) : new THREE.BufferAttribute(out[name], a.itemSize, a.normalized));
    }
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    const merged = new THREE.Mesh(geometry, material);
    merged.name = `merged ${meshes.length}`;
    merged.castShadow = meshes.some(m => m.castShadow); merged.receiveShadow = meshes.some(m => m.receiveShadow);
    merged.userData = { ...meshes[0].userData };
    root.add(merged);
    const freed = new Set<any>();
    for (const m of meshes) { m.parent?.remove(m); freed.add(m.geometry); }
    for (const g of freed) g.dispose();
    after -= meshes.length - 1;
  }
  return { before, after };
}

/**
 * A material for a batch of meshes that drew with `source`: the same program inputs (defines, shared uniforms, hooks)
 * with the city look's own model-matrix terms made batching-aware. three.js applies `batchingMatrix` in its own
 * chunks; the city look's box UV scale (`length(modelMatrix[0].xyz)`) and fade distance (`modelViewMatrix *
 * position`) read the model matrix directly, which in a BatchedMesh is the batch's, not the instance's.
 */
export function batchingMaterial(THREE: any, source: any): any {
  const material = source.clone();
  material.defines = { ...(source.defines ?? {}) };
  if ((source as any).uniforms) (material as any).uniforms = (source as any).uniforms;
  if (source.defaultAttributeValues) material.defaultAttributeValues = { ...source.defaultAttributeValues };
  material.userData = { ...source.userData, landmarkBatch: true };
  const hook = source.onBeforeCompile, key = source.customProgramCacheKey?.bind(source);
  material.onBeforeCompile = (shader: any, renderer: any) => {
    hook.call(source, shader, renderer);
    shader.vertexShader = batchingAware(shader.vertexShader);
  };
  material.customProgramCacheKey = () => `${key ? key() : ''}|landmark-batch`;
  return material;
}

/** The city look's direct model-matrix terms, rewritten to include the instance's batching matrix. */
export function batchingAware(vertexShader: string): string {
  return vertexShader
    .replace(/length\(modelMatrix\[0\]\.xyz\)/g, 'cityBatchScale')
    .replace(/modelViewMatrix \* vec4\(position, 1\.0\)/g, 'cityBatchModelView * vec4(position, 1.0)')
    .replace('#include <begin_vertex>', `#ifdef USE_BATCHING
  float cityBatchScale = length((modelMatrix * batchingMatrix)[0].xyz);
  mat4 cityBatchModelView = modelViewMatrix * batchingMatrix;
#else
  float cityBatchScale = length(modelMatrix[0].xyz);
  mat4 cityBatchModelView = modelViewMatrix;
#endif
#include <begin_vertex>`);
}
