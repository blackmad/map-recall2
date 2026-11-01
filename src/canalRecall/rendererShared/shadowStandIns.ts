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
// copy small: 6 bytes a vertex plus the index, vertices welded on that grid.
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

/** One casting mesh as the weld reads it: plain arrays, so it can cross to a worker (`weldStandInSide`). */
export type StandInPart = {
  /** xyz per vertex as `fromBufferAttribute` reads them (Float32 copied as is; normalised or interleaved read as doubles). */
  positions: Float32Array | Float64Array;
  /** The geometry's index array (copied), or null for a non-indexed mesh. */
  index: Uint16Array | Uint32Array | null;
  /** `geometry.index.count` (or the vertex count): sizes the weld's index, as before. */
  indexCount: number;
  /** The mesh's matrix within the root, column-major (Matrix4.elements). */
  matrix: number[];
  /** The matrix mirrors (determinant < 0): two corners swap to keep the cast side. */
  flip: boolean;
};
/** One shadow side's welded stand-in. */
export type WeldedSide = { side: number; positions: Int16Array; indices: Uint16Array | Uint32Array; centre: [number, number, number]; half: number };

/** A position attribute's xyz as `Vector3.fromBufferAttribute` reads it, copied. */
function positionsOf(position: any): Float32Array | Float64Array {
  const n = position.count;
  if (!position.isInterleavedBufferAttribute && !position.normalized && position.array instanceof Float32Array && position.array.length === n * 3) return position.array.slice();
  const out = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) { out[i * 3] = position.getX(i); out[i * 3 + 1] = position.getY(i); out[i * 3 + 2] = position.getZ(i); }
  return out;
}

/**
 * The main-thread half of a stand-in: `root`'s casting, visible meshes grouped by shadow side, their positions and
 * index copied out with their matrix within `root`. Cheap (copies); the weld (`weldStandInSide`) is the heavy part.
 */
export function collectStandInParts(THREE: any, root: any): { sides: { side: number; parts: StandInPart[] }[]; meshes: any[][] } {
  const bySide = new Map<number, any[]>();
  root.traverse((mesh: any) => {
    if (!canStandIn(mesh) || !visibleWithin(root, mesh)) return;
    const side = shadowSideOf(mesh.material);
    if (!bySide.has(side)) bySide.set(side, []);
    bySide.get(side)!.push(mesh);
  });
  const sides: { side: number; parts: StandInPart[] }[] = [], meshes: any[][] = [];
  for (const [side, list] of bySide) {
    sides.push({ side, parts: list.map(mesh => {
      const matrix = matrixWithin(THREE, root, mesh), geometry = mesh.geometry, position = geometry.attributes.position;
      return { positions: positionsOf(position), index: geometry.index ? geometry.index.array.slice() : null, indexCount: geometry.index ? geometry.index.count : position.count, matrix: [...matrix.elements], flip: matrix.determinant() < 0 };
    }) });
    meshes.push(list);
  }
  return { sides, meshes };
}

/**
 * Weld one shadow side's parts into a quantised position-only mesh (pure arrays; runs in the worker pool). Null when
 * the side has no vertices or index (its sources keep casting), `{ empty: true }` when welding left no triangle (its
 * sources still stop casting: they cast nothing visible), else the welded side.
 */
export function weldStandInSide(side: number, parts: readonly StandInPart[]): WeldedSide | { empty: true } | null {
  // Vector3.applyMatrix4, on doubles exactly as three computes it.
  const at = (p: StandInPart, i: number, out: number[]) => {
    const e = p.matrix, x = p.positions[i * 3], y = p.positions[i * 3 + 1], z = p.positions[i * 3 + 2];
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    out[0] = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    out[1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    out[2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
  };
  const v = [0, 0, 0];
  // Bounds of the transformed vertices, then quantise over the largest half extent.
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let vertexCount = 0, indexCount = 0;
  for (const p of parts) {
    const count = p.positions.length / 3;
    for (let i = 0; i < count; i++) {
      at(p, i, v);
      if (v[0] < min[0]) min[0] = v[0]; if (v[1] < min[1]) min[1] = v[1]; if (v[2] < min[2]) min[2] = v[2];
      if (v[0] > max[0]) max[0] = v[0]; if (v[1] > max[1]) max[1] = v[1]; if (v[2] > max[2]) max[2] = v[2];
    }
    vertexCount += count;
    indexCount += p.indexCount;
  }
  if (!vertexCount || !indexCount) return null;
  const centre: [number, number, number] = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const half = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 1e-6) / 2;
  const q = 32767 / half;
  // Weld on the quantised position: GLB vertices are split by normal and uv, the depth pass needs neither
  // (a flat-shaded box's 24 corners are 8). Key: three 16-bit fields in one exact double.
  const welded = new Map<number, number>();
  const quantised = new Int16Array(vertexCount * 3);
  const remap = new Uint32Array(vertexCount);
  const index = new Uint32Array(indexCount);
  let vo = 0, unique = 0, io = 0;
  for (const p of parts) {
    const count = p.positions.length / 3;
    for (let i = 0; i < count; i++) {
      at(p, i, v);
      const x = Math.round((v[0] - centre[0]) * q), y = Math.round((v[1] - centre[1]) * q), z = Math.round((v[2] - centre[2]) * q);
      const key = ((x + 32768) * 65536 + (y + 32768)) * 65536 + (z + 32768);
      let k = welded.get(key);
      if (k === undefined) {
        k = unique++;
        welded.set(key, k);
        quantised[k * 3] = x; quantised[k * 3 + 1] = y; quantised[k * 3 + 2] = z;
      }
      remap[vo + i] = k;
    }
    const source = p.index, n = source ? source.length : count;
    for (let i = 0; i + 2 < n; i += 3) {
      const a = remap[vo + (source ? source[i] : i)], b = remap[vo + (source ? source[i + 1] : i + 1)], c = remap[vo + (source ? source[i + 2] : i + 2)];
      // Welding can collapse a sliver to a line or point: it casts nothing, drop it.
      if (a === b || b === c || a === c) continue;
      index[io++] = a; index[io++] = p.flip ? c : b; index[io++] = p.flip ? b : c;
    }
    vo += count;
  }
  if (!io) return { empty: true };
  const positions = quantised.slice(0, unique * 3);
  const indices = unique > 65535 ? index.slice(0, io) : Uint16Array.from(index.subarray(0, io));
  return { side, positions, indices, centre, half };
}

/**
 * The main-thread end: the sources of every side that welded (or welded to nothing) stop casting and are flagged;
 * one stand-in mesh per welded side. Null when no side produced a mesh (as before: its sources still stop casting).
 */
export function assembleStandIn(THREE: any, sides: readonly (WeldedSide | { empty: true } | null)[], meshes: readonly any[][]): ShadowStandIn | null {
  const object = new THREE.Group();
  object.name = 'shadow-stand-in';
  object.matrixAutoUpdate = false;
  const sources: any[] = [];
  let triangles = 0, bytes = 0;
  sides.forEach((w, k) => {
    if (!w) return;
    for (const mesh of meshes[k]) {
      mesh.castShadow = false;
      mesh.userData[SHADOW_STAND_IN_SOURCE] = true;
      sources.push(mesh);
    }
    if ('empty' in w) return;
    const { side, positions, indices, centre, half } = w;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3, true));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
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
    triangles += indices.length / 3;
    bytes += positions.byteLength + indices.byteLength;
  });
  return object.children.length ? { object, sources, triangles, bytes } : null;
}

/**
 * Merge `root`'s casting, visible meshes into one quantised position-only mesh
 * per shadow side, in `root`'s local frame. The sources stop casting (and are
 * flagged SHADOW_STAND_IN_SOURCE). Returns null when nothing qualifies.
 * On the main thread; `shadowStandInFor` welds in the worker pool.
 */
export function buildShadowStandIn(THREE: any, root: any): ShadowStandIn | null {
  const { sides, meshes } = collectStandInParts(THREE, root);
  if (!sides.length) return null;
  return assembleStandIn(THREE, sides.map(s => weldStandInSide(s.side, s.parts)), meshes);
}

// ------------------------------------------------------------------ the weld in the worker pool (#129)
// Request: { type: 'standIn', id, sides: [{ side, parts }] }   Reply: { type: 'standIn', id, welded: (WeldedSide | { empty } | null)[] }
export type StandInRequest = { type: 'standIn'; id: number; sides: { side: number; parts: StandInPart[] }[] };
export type StandInReply = { type: 'standIn'; id: number; welded?: (WeldedSide | { empty: true } | null)[]; error?: string };
export const isStandInRequest = (data: unknown): data is StandInRequest => !!data && typeof data === 'object' && (data as { type?: unknown }).type === 'standIn' && Array.isArray((data as { sides?: unknown }).sides);
const isStandInReply = (data: unknown): data is StandInReply => !!data && typeof data === 'object' && (data as { type?: unknown }).type === 'standIn' && !Array.isArray((data as { sides?: unknown }).sides);

/** Worker side: weld every side; the arrays go back transferred. */
export function answerStandIn(msg: StandInRequest, post: (reply: StandInReply, transfer: Transferable[]) => void): void {
  try {
    const welded = msg.sides.map(s => weldStandInSide(s.side, s.parts));
    post({ type: 'standIn', id: msg.id, welded }, welded.flatMap(w => (w && !('empty' in w) ? [w.positions.buffer as ArrayBuffer, w.indices.buffer as ArrayBuffer] : [])));
  } catch (error) {
    post({ type: 'standIn', id: msg.id, error: String((error as Error)?.message ?? error) }, []);
  }
}

type PoolLike = { live: number; size: number; alive(worker: number): boolean; post(worker: number, message: unknown, transfer?: Transferable[]): boolean; subscribe(on: (data: unknown, worker: number) => boolean, fail?: (worker: number, error: unknown) => void): () => void };
/** Pending welds of the page, per pool (the landmark layer and the chunk layer may sit in different bundles). */
const PENDING_KEY = '__canalRecallStandIns';
type Pending = { next: number; turn: number; waiting: Map<number, { done: (welded: StandInReply['welded'] | null) => void; worker: number }> };
function pendingFor(pool: PoolLike): Pending {
  const p = pool as unknown as Record<string, Pending | undefined>;
  let pending = p[PENDING_KEY];
  if (pending) return pending;
  const made: Pending = { next: 0, turn: 0, waiting: new Map() };
  pool.subscribe(data => {
    if (!isStandInReply(data)) return false;
    const w = made.waiting.get(data.id);
    if (!w) return false;
    made.waiting.delete(data.id);
    w.done(data.welded ?? null);
    return true;
  }, worker => { for (const [id, w] of made.waiting) if (w.worker === worker) { made.waiting.delete(id); w.done(null); } });
  return p[PENDING_KEY] = made;
}

/** userData key of a weld in flight on a level (cleared to cancel it: dispose, context restore). */
export const SHADOW_STAND_IN_PENDING = 'shadowStandInPending';

/**
 * `root`'s stand-in (`root.userData.shadowStandIn`): built (or null: nothing qualifies), or started when not yet
 * asked. With a live pool the weld runs there (#129: `buildShadowStandIn` was 1.1 s per minute of landmark arrivals
 * at 4x, on the main thread); the parts are copied now, so the stand-in is the one the main thread would have built
 * at this moment, and `ready` is called once it is in `root.userData` (not when the weld was cancelled by clearing
 * `root.userData[SHADOW_STAND_IN_PENDING]`). Until then the sources keep casting their own shadow. Returns the
 * stand-in when it already exists, else null.
 */
export function shadowStandInFor(THREE: any, root: any, pool: PoolLike | null, ready: (standIn: ShadowStandIn | null) => void): ShadowStandIn | null {
  if (root.userData.shadowStandIn !== undefined) return root.userData.shadowStandIn;
  if (root.userData[SHADOW_STAND_IN_PENDING]) return null;
  if (!pool?.live) return root.userData.shadowStandIn = buildShadowStandIn(THREE, root);
  const { sides, meshes } = collectStandInParts(THREE, root);
  if (!sides.length) return root.userData.shadowStandIn = null;
  const pending = pendingFor(pool);
  let worker = -1;
  for (let i = 0; i < pool.size && worker < 0; i++) { const w = (pending.turn + i) % pool.size; if (pool.alive(w)) worker = w; }
  if (worker < 0) return root.userData.shadowStandIn = assembleStandIn(THREE, sides.map(s => weldStandInSide(s.side, s.parts)), meshes);
  pending.turn = worker + 1;
  const id = ++pending.next, token = { id };
  root.userData[SHADOW_STAND_IN_PENDING] = token;
  pending.waiting.set(id, { worker, done: welded => {
    if (root.userData[SHADOW_STAND_IN_PENDING] !== token) return; // cancelled
    delete root.userData[SHADOW_STAND_IN_PENDING];
    // A failed worker or weld: build here, as without a pool (the parts went to the worker: collect them again).
    root.userData.shadowStandIn = welded ? assembleStandIn(THREE, welded, meshes) : buildShadowStandIn(THREE, root);
    ready(root.userData.shadowStandIn);
  } });
  const transfer = sides.flatMap(s => s.parts.flatMap(p => [p.positions.buffer as ArrayBuffer, ...(p.index ? [p.index.buffer as ArrayBuffer] : [])]));
  let posted = false;
  try { posted = pool.post(worker, { type: 'standIn', id, sides } satisfies StandInRequest, transfer); } catch { posted = false; }
  if (!posted) {
    pending.waiting.delete(id); delete root.userData[SHADOW_STAND_IN_PENDING];
    return root.userData.shadowStandIn = buildShadowStandIn(THREE, root);
  }
  return null;
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
