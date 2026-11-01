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
  // One pass over the triangles (a counting sort), not one per tile: each tile's triangles keep their order and its
  // box takes the same min/max over the same vertices, so the tiles are unchanged; the 8×8 overview cut was 64 scans.
  const Ctor = indices instanceof Uint16Array ? Uint16Array : Uint32Array;
  const tiles: (Uint16Array | Uint32Array | null)[] = new Array(n * n).fill(null), fill = new Uint32Array(n * n);
  const box = new Float64Array(n * n * 6);
  for (let k = 0; k < n * n; k++) {
    if (counts[k]) tiles[k] = new Ctor(counts[k] * 3);
    box[k * 6] = box[k * 6 + 1] = box[k * 6 + 2] = Infinity; box[k * 6 + 3] = box[k * 6 + 4] = box[k * 6 + 5] = -Infinity;
  }
  for (let t = 0; t < triangles; t++) {
    const k = tileOf[t], idx = tiles[k]!, b = k * 6;
    let m = fill[k];
    for (let v = 0; v < 3; v++) {
      const vi = indices[3 * t + v], o = vi * stride;
      idx[m++] = vi;
      const x = positions[o], y = positions[o + 1], z = positions[o + 2];
      if (x < box[b]) box[b] = x; if (x > box[b + 3]) box[b + 3] = x; if (y < box[b + 1]) box[b + 1] = y; if (y > box[b + 4]) box[b + 4] = y; if (z < box[b + 2]) box[b + 2] = z; if (z > box[b + 5]) box[b + 5] = z;
    }
    fill[k] = m;
  }
  const out: CellTile[] = [];
  for (let k = 0; k < n * n; k++) {
    const idx = tiles[k];
    if (!idx) continue;
    const b = k * 6, bx0 = box[b], by0 = box[b + 1], bz0 = box[b + 2], bx1 = box[b + 3], by1 = box[b + 4], bz1 = box[b + 5];
    const center: [number, number, number] = [(bx0 + bx1) / 2, (by0 + by1) / 2, (bz0 + bz1) / 2];
    // The box's half-diagonal: a sphere round every vertex the tile uses (looser than the tightest, never smaller).
    out.push({ indices: idx, center, radius: Math.hypot(bx1 - bx0, by1 - by0, bz1 - bz0) / 2, cell: k });
  }
  return out;
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
