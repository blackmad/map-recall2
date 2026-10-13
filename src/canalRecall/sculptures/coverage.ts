// Camera-pose maths for sculpture photo sets: where the cameras look, which
// way is up, and how evenly they ring the statue. Pure functions over COLMAP
// poses (world ← camera), so the coverage numbers in docs/sculptures.md are
// reproducible and testable.

export type V3 = [number, number, number];
export type Pose = { name: string; centre: V3; forward: V3; up: V3 };

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => scale(a, 1 / (norm(a) || 1));
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Rotation matrix (row-major 3×3) of a unit quaternion (w, x, y, z). */
export function quatToMatrix([w, x, y, z]: [number, number, number, number]): number[][] {
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
}

/** COLMAP image pose (camera ← world: q, t) → camera centre and axes in world. COLMAP cameras look down +z with +y down. */
export function poseFromColmap(name: string, q: [number, number, number, number], t: V3): Pose {
  const R = quatToMatrix(q);
  const Rt = (v: V3): V3 => [R[0][0] * v[0] + R[1][0] * v[1] + R[2][0] * v[2], R[0][1] * v[0] + R[1][1] * v[1] + R[2][1] * v[2], R[0][2] * v[0] + R[1][2] * v[1] + R[2][2] * v[2]];
  return { name, centre: scale(Rt(t), -1), forward: Rt([0, 0, 1]), up: Rt([0, -1, 0]) };
}

/** World up: the dominant direction of the cameras' up vectors (most photos are held upright). */
export function estimateUp(poses: Pose[]): V3 {
  // Power iteration on Σ u uᵀ.
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of poses) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i][j] += p.up[i] * p.up[j];
  let v: V3 = [0.3, 0.9, 0.2];
  for (let it = 0; it < 100; it++) v = unit([dot(m[0] as V3, v), dot(m[1] as V3, v), dot(m[2] as V3, v)]);
  const s = poses.reduce((acc, p) => acc + dot(p.up, v), 0);
  return s < 0 ? scale(v, -1) : v;
}

function solve3(A: number[][], b: number[]): V3 {
  const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det(A);
  const col = (k: number) => A.map((row, i) => row.map((v, j) => (j === k ? b[i] : v)));
  return [det(col(0)) / d, det(col(1)) / d, det(col(2)) / d];
}

/**
 * The point the cameras look at: least-squares intersection of the optical
 * axes, re-weighted to the better-aimed half (crowd shots and wide views
 * miss it).
 */
export function estimateFocus(poses: Pose[], iterations = 10): V3 {
  let w = poses.map(() => 1);
  let x: V3 = [0, 0, 0];
  for (let it = 0; it < iterations; it++) {
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
    poses.forEach((p, k) => {
      const d = p.forward;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const P = (i === j ? 1 : 0) - d[i] * d[j];
        A[i][j] += w[k] * P;
        b[i] += w[k] * P * p.centre[j];
      }
    });
    x = solve3(A, b);
    const rel = poses.map(p => {
      const v = sub(x, p.centre), along = dot(v, p.forward);
      return norm(sub(v, scale(p.forward, along))) / (norm(v) || 1);
    });
    const median = [...rel].sort((a, c) => a - c)[Math.floor(rel.length / 2)];
    w = rel.map(r => (r <= median ? 1 : 0.01));
  }
  return x;
}

/** Azimuth (degrees, 0–360, counter-clockwise about `up` from `ref`) of each camera around `focus`. */
export function azimuths(poses: Pose[], focus: V3, up: V3, ref?: V3): number[] {
  const e1 = unit(ref ? sub(ref, scale(up, dot(ref, up))) : cross(up, Math.abs(up[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
  const e2 = cross(up, e1);
  return poses.map(p => {
    const v = sub(p.centre, focus);
    const a = Math.atan2(dot(v, e2), dot(v, e1)) * 180 / Math.PI;
    return (a + 360) % 360;
  });
}

/** Counts per `binDeg` sector, and the widest empty arc in degrees. */
export function sectorCoverage(az: number[], binDeg = 30): { bins: number[]; widestGapDeg: number } {
  const n = Math.round(360 / binDeg);
  const bins = new Array(n).fill(0);
  for (const a of az) bins[Math.floor(((a % 360) + 360) % 360 / binDeg) % n]++;
  const sorted = [...az].map(a => ((a % 360) + 360) % 360).sort((a, b) => a - b);
  let widest = sorted.length ? 360 - (sorted[sorted.length - 1] - sorted[0]) : 360;
  for (let i = 1; i < sorted.length; i++) widest = Math.max(widest, sorted[i] - sorted[i - 1]);
  return { bins, widestGapDeg: +widest.toFixed(1) };
}
