// Cell tiles: one ground layer's triangles cut into an n×n grid of sub-meshes (pure, no THREE).
//
// CANAL-RECALL-7. A ground cell is 1 km square and each layer is one mesh, so its bounding sphere (~710 m) always
// meets the camera's frustum and the GPU draws the whole cell, though the iPad chase view shows about a 460 m wedge
// ahead of the rider. Cut into tiles, three.js frustum-culls the tiles off screen (behind the rider, beside the
// wedge) and the resident ring stays as wide as before, so a turn never waits for a build. The vertices are not
// copied: every tile indexes the layer's one vertex buffer; only the index list is partitioned. A triangle goes to the
// tile holding its centroid, so each triangle is drawn exactly once and the picture is unchanged.

export interface CellTile {
  /** The triangles' vertex indices (a subset of the layer's, same order). */
  indices: Uint16Array | Uint32Array;
  /** Bounding sphere of the vertices these triangles use. */
  center: [number, number, number];
  radius: number;
  /** Row-major grid cell (j·n + i) the tile covers. */
  cell: number;
}

/**
 * Partition `indices` (triangles over xyz `positions`, stride `stride` floats) into an `n`×`n` grid over the
 * vertices' x/y extent. Empty tiles are left out; with `n` ≤ 1 (or too few triangles to matter) the result is null and
 * the caller keeps one mesh.
 */
export function splitIntoTiles(positions: ArrayLike<number>, indices: Uint16Array | Uint32Array, n: number, minTriangles = 0, stride = 3, groups?: readonly { start: number; count: number }[]): CellTile[] | null {
  const plan = planTiles(positions, indices, n, minTriangles, stride, groups);
  return plan && finishTiles(positions, plan, stride);
}

/**
 * A tile before its heights are known: the partition and the x/y box of the vertices it uses. The partition reads
 * only x and y, so it can be cut where the mesh is built and finished after the ground lift (z only) on the main
 * thread (`finishTiles`), with exactly the result `splitIntoTiles` gives on the lifted positions.
 */
export interface PlannedTile { indices: Uint16Array | Uint32Array; cell: number; box: [number, number, number, number] }

/** The x/y half of `splitIntoTiles` (same arguments). */
export function planTiles(positions: ArrayLike<number>, indices: Uint16Array | Uint32Array, n: number, minTriangles = 0, stride = 3, groups?: readonly { start: number; count: number }[]): PlannedTile[] | null {
  const triangles = indices.length / 3;
  if (n <= 1 || triangles < Math.max(2, minTriangles)) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < indices.length; i++) {
    const o = indices[i] * stride, x = positions[o], y = positions[o + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const w = Math.max(1e-6, x1 - x0), h = Math.max(1e-6, y1 - y0);
  const tileOf = new Uint16Array(triangles), counts = new Uint32Array(n * n);
  const cellOf = (cx: number, cy: number) => Math.min(n - 1, Math.max(0, Math.floor((cy - y0) / h * n))) * n + Math.min(n - 1, Math.max(0, Math.floor((cx - x0) / w * n)));
  // With `groups` (vertex ranges, e.g. one per building), a triangle goes with its first vertex's group, to the tile of
  // that group's centre: a building is never split, so its coplanar overlays keep their draw order exactly.
  let groupTile: Int32Array | null = null;
  if (groups?.length) {
    let vertices = 0;
    for (const g of groups) vertices = Math.max(vertices, g.start + g.count);
    groupTile = new Int32Array(vertices).fill(-1);
    for (const g of groups) {
      if (!g.count) continue;
      let gx0 = Infinity, gy0 = Infinity, gx1 = -Infinity, gy1 = -Infinity;
      for (let v = g.start; v < g.start + g.count; v++) { const x = positions[v * stride], y = positions[v * stride + 1]; if (x < gx0) gx0 = x; if (x > gx1) gx1 = x; if (y < gy0) gy0 = y; if (y > gy1) gy1 = y; }
      groupTile.fill(cellOf((gx0 + gx1) / 2, (gy0 + gy1) / 2), g.start, g.start + g.count);
    }
  }
  for (let t = 0; t < triangles; t++) {
    const ia = indices[3 * t], a = ia * stride, b = indices[3 * t + 1] * stride, c = indices[3 * t + 2] * stride;
    const grouped = groupTile && ia < groupTile.length ? groupTile[ia] : -1;
    const k = grouped >= 0 ? grouped : cellOf((positions[a] + positions[b] + positions[c]) / 3, (positions[a + 1] + positions[b + 1] + positions[c + 1]) / 3);
    tileOf[t] = k;
    counts[k]++;
  }
  const out: PlannedTile[] = [];
  const Ctor = indices instanceof Uint16Array ? Uint16Array : Uint32Array;
  // One pass scatters every triangle into its tile, in triangle order (each tile used to rescan all triangles: n² passes,
  // #130). A NaN centroid's tile is stored as 0 but never counted (as before): its writes past a tile's end are dropped.
  const tileIdx: (Uint16Array | Uint32Array)[] = [], fill = new Uint32Array(n * n), box = new Float64Array(n * n * 4);
  for (let k = 0; k < n * n; k++) { tileIdx.push(new Ctor(counts[k] * 3)); box.fill(Infinity, k * 4, k * 4 + 2); box.fill(-Infinity, k * 4 + 2, k * 4 + 4); }
  for (let t = 0; t < triangles; t++) {
    const k = tileOf[t], idx = tileIdx[k], b = k * 4;
    for (let v = 0; v < 3; v++) {
      const vi = indices[3 * t + v], o = vi * stride;
      idx[fill[k]++] = vi;
      const x = positions[o], y = positions[o + 1];
      if (x < box[b]) box[b] = x; if (x > box[b + 2]) box[b + 2] = x;
      if (y < box[b + 1]) box[b + 1] = y; if (y > box[b + 3]) box[b + 3] = y;
    }
  }
  for (let k = 0; k < n * n; k++) {
    if (!counts[k]) continue;
    const b = k * 4;
    out.push({ indices: tileIdx[k], cell: k, box: [box[b], box[b + 1], box[b + 2], box[b + 3]] });
  }
  return out;
}

/** The planned tiles' bounding spheres over `positions` as they are now (the heights read here, the x/y box kept). */
export function finishTiles(positions: ArrayLike<number>, plan: readonly PlannedTile[], stride = 3): CellTile[] {
  return plan.map(({ indices: idx, cell, box: [bx0, by0, bx1, by1] }) => {
    let bz0 = Infinity, bz1 = -Infinity;
    for (let i = 0; i < idx.length; i++) { const z = positions[idx[i] * stride + 2]; if (z < bz0) bz0 = z; if (z > bz1) bz1 = z; }
    const center: [number, number, number] = [(bx0 + bx1) / 2, (by0 + by1) / 2, (bz0 + bz1) / 2];
    // The box's half-diagonal: a sphere round every vertex the tile uses (looser than the tightest, never smaller).
    return { indices: idx, center, radius: Math.hypot(bx1 - bx0, by1 - by0, bz1 - bz0) / 2, cell };
  });
}

/** The planned tiles' index buffers, to transfer. */
export function plannedTransferables(plan: readonly PlannedTile[] | null | undefined): ArrayBuffer[] {
  return (plan ?? []).map(t => t.indices.buffer as ArrayBuffer);
}

/**
 * Every layer's tiles of a built cell, computed where the cell is built (the ground worker), so the main thread's
 * install only wraps them (#129: `splitIntoTiles` in `cutMesh` was a > 16 ms streaming task at 1x on the Jordaan ride).
 * The same call `rawTiles` makes on the main thread for a ground layer (a Float32 xyz position, offset 0, stride 3,
 * no groups, the whole draw range): the result is identical. Null for a layer the main thread would keep whole.
 */
export function layerTiles(layers: Readonly<Record<string, { positions: ArrayLike<number>; indices: Uint16Array | Uint32Array } | undefined>>, n: number, minTriangles: number): Record<string, CellTile[] | null> {
  const out: Record<string, CellTile[] | null> = {};
  for (const [layer, m] of Object.entries(layers)) {
    if (!m) continue;
    out[layer] = m.positions instanceof Float32Array && m.indices ? splitIntoTiles(m.positions, m.indices, n, minTriangles, 3) : null;
  }
  return out;
}

/** The tiles' index buffers, to transfer with the cell. */
export function tileTransferables(tiles: Readonly<Record<string, CellTile[] | null>> | undefined): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  for (const list of Object.values(tiles ?? {})) for (const t of list ?? []) out.push(t.indices.buffer as ArrayBuffer);
  return out;
}
