// Ground v2 pose index (lane G2a #372; design "The riding surface"): the rider stands on what is drawn. A bucket grid
// of the baked surface's triangle ids, built once per decoded cell, answers the drawn height under a point. G2b wires it
// into surface.ts riderPose / footprintBase; G2a lands it and measures its cost (bake hand-back).
//
// Pure: positions are game-frame xyz floats (grd2Layers), indices the surface triangles only (no step strips).

export const POSE_BUCKET_M = 4;

export interface PoseIndex {
  x0: number; y0: number; nx: number; ny: number;
  /** CSR: bucket b's triangles are ids[start[b] .. start[b + 1]). */
  start: Uint32Array; ids: Uint32Array;
  positions: Float32Array; indices: Uint32Array;
}

export function buildPoseIndex(positions: Float32Array, indices: Uint32Array, rect: readonly [number, number, number, number], bucketM = POSE_BUCKET_M): PoseIndex {
  const nx = Math.ceil((rect[2] - rect[0]) / bucketM), ny = Math.ceil((rect[3] - rect[1]) / bucketM), T = indices.length / 3;
  const count = new Uint32Array(nx * ny + 1);
  const range = (t: number, f: (b: number) => void) => {
    const a = indices[3 * t] * 3, b = indices[3 * t + 1] * 3, c = indices[3 * t + 2] * 3;
    const i0 = Math.max(0, Math.floor((Math.min(positions[a], positions[b], positions[c]) - rect[0]) / bucketM)), i1 = Math.min(nx - 1, Math.floor((Math.max(positions[a], positions[b], positions[c]) - rect[0]) / bucketM));
    const j0 = Math.max(0, Math.floor((Math.min(positions[a + 1], positions[b + 1], positions[c + 1]) - rect[1]) / bucketM)), j1 = Math.min(ny - 1, Math.floor((Math.max(positions[a + 1], positions[b + 1], positions[c + 1]) - rect[1]) / bucketM));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) f(j * nx + i);
  };
  for (let t = 0; t < T; t++) range(t, b => { count[b + 1]++; });
  for (let b = 0; b < nx * ny; b++) count[b + 1] += count[b];
  const ids = new Uint32Array(count[nx * ny]), fill = count.slice(0, nx * ny);
  for (let t = 0; t < T; t++) range(t, b => { ids[fill[b]++] = t; });
  return { x0: rect[0], y0: rect[1], nx, ny, start: count, ids, positions, indices };
}

/** The drawn height at (x, y), or NaN off the baked surface (water, outside the cell): the caller falls back. */
export function poseHeight(p: PoseIndex, x: number, y: number, bucketM = POSE_BUCKET_M): number {
  const i = Math.floor((x - p.x0) / bucketM), j = Math.floor((y - p.y0) / bucketM);
  if (i < 0 || j < 0 || i >= p.nx || j >= p.ny) return NaN;
  const b = j * p.nx + i, P = p.positions;
  for (let k = p.start[b]; k < p.start[b + 1]; k++) {
    const t = p.ids[k], a = p.indices[3 * t] * 3, bb = p.indices[3 * t + 1] * 3, c = p.indices[3 * t + 2] * 3;
    const ax = P[a], ay = P[a + 1], bx = P[bb], by = P[bb + 1], cx = P[c], cy = P[c + 1];
    const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay); if (!d) continue;
    const w1 = ((bx - x) * (cy - y) - (cx - x) * (by - y)) / d, w2 = ((cx - x) * (ay - y) - (ax - x) * (cy - y)) / d, w3 = 1 - w1 - w2;
    if (w1 < -1e-9 || w2 < -1e-9 || w3 < -1e-9) continue;
    return w1 * P[a + 2] + w2 * P[bb + 2] + w3 * P[c + 2];
  }
  return NaN;
}

/** CPU bytes the index keeps (the copy of positions and indices plus the grid). */
export const poseIndexBytes = (p: PoseIndex): number => p.start.byteLength + p.ids.byteLength + p.positions.byteLength + p.indices.byteLength;
