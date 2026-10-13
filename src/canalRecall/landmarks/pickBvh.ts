// Nearest visible ray hit on a landmark model, with a per-mesh BVH.
//
// The label overlay asks "what is under this screen point" up to 40 times per
// plan, four plans a second, and a click asks the same. `Raycaster.intersectObject`
// tests a mesh triangle by triangle once the ray enters its bounding box, and
// builds a full intersection record (barycentre, uv, normal, face) for every
// triangle it crosses; on the Pulitzer (39k triangles) or the Westerkerk (21k)
// one pick took several milliseconds (docs/performance/desktop-20261014.md).
//
// `nearestVisibleHit(root, raycaster)` returns what
// `raycaster.intersectObject(root, true).find(hit => hit.object.visible)`
// returns in the fields the landmark picker reads (object, point, distance,
// faceIndex, instanceId): the same triangle set, the same `Ray.intersectTriangle`
// with the same side handling, the same world distance and near/far test and
// the same tie order (traversal order, then triangle order). Only how a
// mesh's triangles are found changes, and only for meshes whose BVH has been
// built (`buildPickBvhs`, run in idle time after a model is placed, so a pick
// never pays for a build); every other object goes through its own `raycast`,
// unchanged. A BVH is dropped when the position attribute, the index, the draw
// range, the groups or the material sides change.

import * as THREE from 'three';

export interface PickHit {
  object: THREE.Object3D;
  point: THREE.Vector3;
  distance: number;
  faceIndex?: number | null;
  instanceId?: number;
}

const FRONT = 0, BACK = 1, DOUBLE = 2;
const LEAF_SIZE = 8;
const BVH = Symbol('pickBvh');

/** Flat BVH: triangles reordered so every node owns a contiguous run. */
export interface TriangleBvh {
  /** Vertex positions as `Mesh.getVertexPosition` reads them (float32 when that is exact). */
  xyz: Float32Array | Float64Array;
  /** Three vertex numbers per triangle, in BVH order. */
  corners: Uint32Array;
  /** Original iteration order of each triangle (the tie-break). */
  order: Uint32Array;
  faceIndex: Uint32Array;
  side: Uint8Array;
  /** Per node: min xyz, max xyz. */
  bounds: Float64Array;
  /** Per node: first triangle and count (count 0 = inner node; children at left/right). */
  start: Uint32Array;
  count: Uint32Array;
  left: Int32Array;
  right: Int32Array;
  key: string;
  positionRef: unknown;
  indexRef: unknown;
}

const sideOf = (material: THREE.Material | undefined): number =>
  material?.side === THREE.BackSide ? BACK : material?.side === THREE.FrontSide ? FRONT : DOUBLE;

/** A mesh whose `raycast` is three's own and whose vertices are its position attribute. */
function plainMesh(object: THREE.Object3D): object is THREE.Mesh {
  const mesh = object as THREE.Mesh;
  if (!mesh.isMesh || (mesh as any).isInstancedMesh || (mesh as any).isSkinnedMesh || (mesh as any).isBatchedMesh) return false;
  if (mesh.raycast !== THREE.Mesh.prototype.raycast || mesh.material === undefined) return false;
  const g = mesh.geometry as THREE.BufferGeometry;
  if (!g?.attributes?.position || g.morphAttributes?.position?.length) return false;
  // Array materials whose groups do not all resolve stay on three's path (which throws, as it always did).
  const m = mesh.material;
  return !Array.isArray(m) || g.groups.every(group => !!m[group.materialIndex ?? 0]);
}

function bvhKey(mesh: THREE.Mesh): string {
  const g = mesh.geometry as THREE.BufferGeometry;
  const p = g.attributes.position as THREE.BufferAttribute;
  const m = mesh.material as THREE.Material | THREE.Material[];
  const sides = Array.isArray(m) ? m.map(x => x?.side).join(',') : String(m.side);
  return `${p.version}:${p.count}|${g.index ? `${g.index.version}:${g.index.count}` : '-'}|${g.drawRange.start}:${g.drawRange.count}|`
    + `${g.groups.map(x => `${x.start}/${x.count}/${x.materialIndex}`).join(';')}|${sides}`;
}

/** The mesh's BVH if it is built and still matches the mesh; never builds. */
function currentBvh(mesh: THREE.Mesh): TriangleBvh | null {
  const bvh = (mesh as any)[BVH] as TriangleBvh | undefined;
  if (!bvh) return null;
  const g = mesh.geometry as THREE.BufferGeometry;
  if (bvh.positionRef !== g.attributes.position || bvh.indexRef !== g.index || bvh.key !== bvhKey(mesh)) return null;
  return bvh;
}

/** Builds (or returns the current) BVH of a plain mesh; null when it is not one. */
export function meshBvh(mesh: THREE.Mesh): TriangleBvh | null {
  if (!plainMesh(mesh)) return null;
  const current = currentBvh(mesh);
  if (current) return current;
  const bvh = buildBvh(mesh);
  (mesh as any)[BVH] = bvh;
  return bvh;
}

/**
 * Builds the BVH of every plain mesh under `root` that lacks a current one,
 * stopping once `budgetMs` has passed (a mesh is built whole). Returns true when
 * nothing is left to build.
 */
export function buildPickBvhs(root: THREE.Object3D, budgetMs = 4, now: () => number = () => performance.now()): boolean {
  const t0 = now();
  let done = true;
  root.traverse(object => {
    if (!done || !plainMesh(object) || currentBvh(object)) return;
    if (now() - t0 > budgetMs) { done = false; return; }
    meshBvh(object);
  });
  return done;
}

function buildBvh(mesh: THREE.Mesh): TriangleBvh {
  const g = mesh.geometry as THREE.BufferGeometry;
  const material = mesh.material as THREE.Material | THREE.Material[];
  const index = g.index, position = g.attributes.position as THREE.BufferAttribute;
  const { groups, drawRange } = g;
  // The triangles `Mesh._computeIntersections` visits, in its order.
  const total = index ? index.count : position.count;
  const ranges: Array<[number, number, number]> = [];
  if (Array.isArray(material)) {
    for (const group of groups) {
      const start = Math.max(group.start, drawRange.start);
      const end = Math.min(total, Math.min(group.start + group.count, drawRange.start + drawRange.count));
      ranges.push([start, end, sideOf(material[group.materialIndex ?? 0])]);
    }
  } else ranges.push([Math.max(0, drawRange.start), Math.min(total, drawRange.start + drawRange.count), sideOf(material)]);
  let n = 0;
  for (const [s, e] of ranges) if (e > s) n += Math.ceil((e - s) / 3);
  const tri = new Uint32Array(n * 3), faces = new Uint32Array(n), sides = new Uint8Array(n);
  let t = 0;
  for (const [s, e, side] of ranges) {
    for (let j = s; j < e; j += 3) {
      for (let k = 0; k < 3; k++) tri[t * 3 + k] = index ? index.getX(j + k) : j + k;
      faces[t] = Math.floor(j / 3); sides[t] = side; t++;
    }
  }
  // Every vertex through the attribute's accessors once (glTF attributes may be interleaved or quantized),
  // exactly as `Mesh.getVertexPosition` reads them.
  // Plain float32 positions are exact in float32; quantized (normalized) ones are not, so keep doubles for those.
  const v = new THREE.Vector3(), vertexCount = position.count;
  const exact32 = !position.normalized && (position as any).isInterleavedBufferAttribute !== true && position.array instanceof Float32Array;
  const xyz = exact32 ? new Float32Array(vertexCount * 3) : new Float64Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) { v.fromBufferAttribute(position, i); xyz[i * 3] = v.x; xyz[i * 3 + 1] = v.y; xyz[i * 3 + 2] = v.z; }
  // Per-triangle bounds and centroids.
  const tb = new Float64Array(n * 6), cen = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = tri[i * 3] * 3, b = tri[i * 3 + 1] * 3, c = tri[i * 3 + 2] * 3;
    for (let k = 0; k < 3; k++) {
      const pa = xyz[a + k], pb = xyz[b + k], pc = xyz[c + k];
      tb[i * 6 + k] = Math.min(pa, pb, pc); tb[i * 6 + 3 + k] = Math.max(pa, pb, pc);
      cen[i * 3 + k] = (pa + pb + pc) / 3;
    }
  }
  const perm = new Uint32Array(n); for (let i = 0; i < n; i++) perm[i] = i;
  const maxNodes = Math.max(1, 2 * n);
  const bounds = new Float64Array(maxNodes * 6), start = new Uint32Array(maxNodes), count = new Uint32Array(maxNodes);
  const left = new Int32Array(maxNodes), right = new Int32Array(maxNodes);
  let nodes = 0;
  // Explicit stack: lo, hi, node per pending range.
  const work: number[] = [];
  if (n) work.push(0, n, nodes++);
  while (work.length) {
    const node = work.pop()!, hi = work.pop()!, lo = work.pop()!;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    let c0x = Infinity, c0y = Infinity, c0z = Infinity, c1x = -Infinity, c1y = -Infinity, c1z = -Infinity;
    for (let i = lo; i < hi; i++) {
      const p = perm[i], b = p * 6, c = p * 3;
      if (tb[b] < x0) x0 = tb[b]; if (tb[b + 3] > x1) x1 = tb[b + 3];
      if (tb[b + 1] < y0) y0 = tb[b + 1]; if (tb[b + 4] > y1) y1 = tb[b + 4];
      if (tb[b + 2] < z0) z0 = tb[b + 2]; if (tb[b + 5] > z1) z1 = tb[b + 5];
      const px = cen[c], py = cen[c + 1], pz = cen[c + 2];
      if (px < c0x) c0x = px; if (px > c1x) c1x = px;
      if (py < c0y) c0y = py; if (py > c1y) c1y = py;
      if (pz < c0z) c0z = pz; if (pz > c1z) c1z = pz;
    }
    const o = node * 6;
    bounds[o] = x0; bounds[o + 1] = y0; bounds[o + 2] = z0; bounds[o + 3] = x1; bounds[o + 4] = y1; bounds[o + 5] = z1;
    const ex = c1x - c0x, ey = c1y - c0y, ez = c1z - c0z;
    if (hi - lo <= LEAF_SIZE || !(Math.max(ex, ey, ez) > 0)) { start[node] = lo; count[node] = hi - lo; continue; }
    const axis = ex >= ey && ex >= ez ? 0 : ey >= ez ? 1 : 2;
    const split = axis === 0 ? c0x + ex / 2 : axis === 1 ? c0y + ey / 2 : c0z + ez / 2;
    // In-place partition at the centroid midpoint of the widest axis: linear per level, no sort.
    let i = lo, j = hi - 1;
    while (i <= j) {
      if (cen[perm[i] * 3 + axis] < split) i++;
      else { const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp; j--; }
    }
    let mid = i;
    if (mid === lo || mid === hi) mid = (lo + hi) >> 1;
    const l = nodes++, r = nodes++;
    left[node] = l; right[node] = r; count[node] = 0;
    work.push(lo, mid, l, mid, hi, r);
  }
  const corners = new Uint32Array(n * 3), order = new Uint32Array(n), faceIndex = new Uint32Array(n), side = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = perm[i];
    corners[i * 3] = tri[p * 3]; corners[i * 3 + 1] = tri[p * 3 + 1]; corners[i * 3 + 2] = tri[p * 3 + 2];
    order[i] = p; faceIndex[i] = faces[p]; side[i] = sides[p];
  }
  return { xyz, corners, order, faceIndex, side, bounds: bounds.slice(0, nodes * 6), start: start.slice(0, nodes), count: count.slice(0, nodes),
    left: left.slice(0, nodes), right: right.slice(0, nodes), key: bvhKey(mesh), positionRef: position, indexRef: index };
}

const _sphere = new THREE.Sphere(), _ray = new THREE.Ray(), _local = new THREE.Ray(), _inverse = new THREE.Matrix4();
const _box = new THREE.Box3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _point = new THREE.Vector3(), _world = new THREE.Vector3(), _hitAt = new THREE.Vector3();

interface Best { hit: PickHit | null; rank: number; tri: number }

/** Mesh.raycast's early-outs and local ray, then the BVH walk; updates `best` if a nearer hit is found. */
function raycastMesh(mesh: THREE.Mesh, tree: TriangleBvh, raycaster: THREE.Raycaster, rank: number, best: Best): void {
  const geometry = mesh.geometry as THREE.BufferGeometry;
  if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
  _sphere.copy(geometry.boundingSphere!).applyMatrix4(mesh.matrixWorld);
  _ray.copy(raycaster.ray).recast(raycaster.near);
  if (_sphere.containsPoint(_ray.origin) === false) {
    if (_ray.intersectSphere(_sphere, _hitAt) === null) return;
    if (_ray.origin.distanceToSquared(_hitAt) > (raycaster.far - raycaster.near) ** 2) return;
  }
  _inverse.copy(mesh.matrixWorld).invert();
  _local.copy(raycaster.ray).applyMatrix4(_inverse);
  if (geometry.boundingBox !== null && _local.intersectsBox(geometry.boundingBox) === false) return;
  if (!tree.count.length) return;
  const { bounds, xyz, corners } = tree;
  const stack = [0];
  while (stack.length) {
    const node = stack.pop()!;
    const o = node * 6;
    // A hair of slack: the box must never reject a triangle the exact test would accept.
    const slack = 1e-9 * (1 + Math.abs(bounds[o]) + Math.abs(bounds[o + 3]) + Math.abs(bounds[o + 1]) + Math.abs(bounds[o + 4]) + Math.abs(bounds[o + 2]) + Math.abs(bounds[o + 5]));
    _box.min.set(bounds[o] - slack, bounds[o + 1] - slack, bounds[o + 2] - slack);
    _box.max.set(bounds[o + 3] + slack, bounds[o + 4] + slack, bounds[o + 5] + slack);
    if (!_local.intersectsBox(_box)) continue;
    const n = tree.count[node];
    if (!n) { stack.push(tree.right[node], tree.left[node]); continue; }
    for (let i = tree.start[node], end = i + n; i < end; i++) {
      const a = corners[i * 3] * 3, b = corners[i * 3 + 1] * 3, c = corners[i * 3 + 2] * 3;
      _a.set(xyz[a], xyz[a + 1], xyz[a + 2]);
      _b.set(xyz[b], xyz[b + 1], xyz[b + 2]);
      _c.set(xyz[c], xyz[c + 1], xyz[c + 2]);
      const side = tree.side[i];
      const hit = side === BACK ? _local.intersectTriangle(_c, _b, _a, true, _point) : _local.intersectTriangle(_a, _b, _c, side === FRONT, _point);
      if (hit === null) continue;
      _world.copy(_point).applyMatrix4(mesh.matrixWorld);
      const distance = raycaster.ray.origin.distanceTo(_world);
      if (distance < raycaster.near || distance > raycaster.far) continue;
      const tri = tree.order[i];
      if (best.hit && (distance > best.hit.distance || (distance === best.hit.distance && (rank > best.rank || (rank === best.rank && tri > best.tri))))) continue;
      best.hit = { object: mesh, point: _world.clone(), distance, faceIndex: tree.faceIndex[i] };
      best.rank = rank; best.tri = tri;
    }
  }
}

/**
 * `raycaster.intersectObject(root, true).find(hit => hit.object.visible)`,
 * with plain meshes whose BVH is built walked through it. `unbuilt.count` is
 * raised for each visible plain mesh that had no current BVH (queue a build).
 */
export function nearestVisibleHit(root: THREE.Object3D, raycaster: THREE.Raycaster, unbuilt?: { count: number }): PickHit | null {
  const best: Best = { hit: null, rank: 0, tri: 0 };
  let rank = 0;
  const others: THREE.Intersection[] = [];
  const visit = (object: THREE.Object3D) => {
    const objectRank = rank++;
    let propagate = true;
    // An invisible object's hits are all dropped by `.find(hit => hit.object.visible)`: skip its test.
    // (Only a custom `raycast` returning false stops propagation; no landmark object has one.)
    if (object.visible && object.layers.test(raycaster.layers)) {
      const plain = plainMesh(object);
      const tree = plain ? currentBvh(object) : null;
      if (plain && !tree && unbuilt) unbuilt.count++;
      if (tree) raycastMesh(object as THREE.Mesh, tree, raycaster, objectRank, best);
      else {
        others.length = 0;
        if ((object.raycast as any)(raycaster, others) === false) propagate = false;
        // three sorts stably by distance: of equal distances the first pushed wins.
        for (let i = 0; i < others.length; i++) {
          const h = others[i];
          if (best.hit && (h.distance > best.hit.distance || (h.distance === best.hit.distance && (objectRank > best.rank || (objectRank === best.rank && i >= best.tri))))) continue;
          best.hit = h as PickHit; best.rank = objectRank; best.tri = i;
        }
      }
    }
    if (propagate) for (const child of object.children) visit(child);
  };
  visit(root);
  return best.hit;
}
