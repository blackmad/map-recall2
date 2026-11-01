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
  const out: CellTile[] = [];
  const Ctor = indices instanceof Uint16Array ? Uint16Array : Uint32Array;
  // One pass scatters every triangle into its tile, in triangle order (each tile used to rescan all triangles: n² passes).
  // A NaN centroid's tile is stored as 0 but never counted (as before): its writes past a tile's end are dropped.
  const tileIdx: (Uint16Array | Uint32Array)[] = [], fill = new Uint32Array(n * n);
  const box = new Float64Array(n * n * 6);
  for (let k = 0; k < n * n; k++) { tileIdx.push(new Ctor(counts[k] * 3)); box.fill(Infinity, k * 6, k * 6 + 3); box.fill(-Infinity, k * 6 + 3, k * 6 + 6); }
  for (let t = 0; t < triangles; t++) {
    const k = tileOf[t], idx = tileIdx[k], b = k * 6;
    for (let v = 0; v < 3; v++) {
      const vi = indices[3 * t + v], o = vi * stride;
      idx[fill[k]++] = vi;
      const x = positions[o], y = positions[o + 1], z = positions[o + 2];
      if (x < box[b]) box[b] = x; if (x > box[b + 3]) box[b + 3] = x;
      if (y < box[b + 1]) box[b + 1] = y; if (y > box[b + 4]) box[b + 4] = y;
      if (z < box[b + 2]) box[b + 2] = z; if (z > box[b + 5]) box[b + 5] = z;
    }
  }
  for (let k = 0; k < n * n; k++) {
    if (!counts[k]) continue;
    const idx = tileIdx[k], b = k * 6;
    const bx0 = box[b], by0 = box[b + 1], bz0 = box[b + 2], bx1 = box[b + 3], by1 = box[b + 4], bz1 = box[b + 5];
    const center: [number, number, number] = [(bx0 + bx1) / 2, (by0 + by1) / 2, (bz0 + bz1) / 2];
    // The box's half-diagonal: a sphere round every vertex the tile uses (looser than the tightest, never smaller).
    out.push({ indices: idx, center, radius: Math.hypot(bx1 - bx0, by1 - by0, bz1 - bz0) / 2, cell: k });
  }
  return out;
}
