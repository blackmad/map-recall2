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
}

/**
 * Partition `indices` (triangles over xyz `positions`, stride `stride` floats) into an `n`×`n` grid over the
 * vertices' x/y extent. Empty tiles are left out; with `n` ≤ 1 (or too few triangles to matter) the result is null and
 * the caller keeps one mesh.
 */
export function splitIntoTiles(positions: ArrayLike<number>, indices: Uint16Array | Uint32Array, n: number, minTriangles = 0, stride = 3): CellTile[] | null {
  const triangles = indices.length / 3;
  if (n <= 1 || triangles < Math.max(2, minTriangles)) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < indices.length; i++) {
    const o = indices[i] * stride, x = positions[o], y = positions[o + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const w = Math.max(1e-6, x1 - x0), h = Math.max(1e-6, y1 - y0);
  const tileOf = new Uint16Array(triangles), counts = new Uint32Array(n * n);
  for (let t = 0; t < triangles; t++) {
    const a = indices[3 * t] * stride, b = indices[3 * t + 1] * stride, c = indices[3 * t + 2] * stride;
    const cx = (positions[a] + positions[b] + positions[c]) / 3, cy = (positions[a + 1] + positions[b + 1] + positions[c + 1]) / 3;
    const i = Math.min(n - 1, Math.max(0, Math.floor((cx - x0) / w * n))), j = Math.min(n - 1, Math.max(0, Math.floor((cy - y0) / h * n)));
    tileOf[t] = j * n + i;
    counts[j * n + i]++;
  }
  const out: CellTile[] = [];
  const Ctor = indices instanceof Uint16Array ? Uint16Array : Uint32Array;
  for (let k = 0; k < n * n; k++) {
    if (!counts[k]) continue;
    const idx = new Ctor(counts[k] * 3);
    let m = 0, bx0 = Infinity, by0 = Infinity, bz0 = Infinity, bx1 = -Infinity, by1 = -Infinity, bz1 = -Infinity;
    for (let t = 0; t < triangles; t++) {
      if (tileOf[t] !== k) continue;
      for (let v = 0; v < 3; v++) {
        const vi = indices[3 * t + v], o = vi * stride;
        idx[m++] = vi;
        const x = positions[o], y = positions[o + 1], z = positions[o + 2];
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; if (z < bz0) bz0 = z; if (z > bz1) bz1 = z;
      }
    }
    const center: [number, number, number] = [(bx0 + bx1) / 2, (by0 + by1) / 2, (bz0 + bz1) / 2];
    // The box's half-diagonal: a sphere round every vertex the tile uses (looser than the tightest, never smaller).
    out.push({ indices: idx, center, radius: Math.hypot(bx1 - bx0, by1 - by0, bz1 - bz0) / 2 });
  }
  return out;
}
