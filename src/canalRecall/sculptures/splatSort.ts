// Back-to-front order for alpha-blended splats.
//
// A 16-bit counting sort on the view depth (clip w) — linear in the splat
// count, ~1 ms for 100k on a desktop core, no allocation after the first
// call. The renderer re-sorts only when the eye moved or turned enough to
// change the order visibly (SplatSorter.needsSort).

export type Mat4 = ArrayLike<number>;

export class SplatSorter {
  readonly order: Uint32Array;
  private readonly depthKeys: Uint32Array;
  private readonly counts = new Uint32Array(65536);
  private readonly starts = new Uint32Array(65536);
  private lastEye: [number, number, number] | null = null;
  private lastDir: [number, number, number] | null = null;
  sorts = 0;

  constructor(private readonly positions: Float32Array, readonly count = positions.length / 3) {
    this.order = new Uint32Array(count);
    this.depthKeys = new Uint32Array(count);
    for (let i = 0; i < count; i++) this.order[i] = i;
  }

  /**
   * Sort by clip w under `clipFromLocal` (column-major), far first. Returns
   * the order (also kept in `this.order`).
   */
  sort(clipFromLocal: Mat4): Uint32Array {
    const n = this.count, p = this.positions;
    const a = clipFromLocal[3], b = clipFromLocal[7], c = clipFromLocal[11], d = clipFromLocal[15];
    let lo = Infinity, hi = -Infinity;
    const keys = this.depthKeys;
    // First pass: depth range. Store depth as float bits temporarily via a Float32 view.
    const depth = new Float32Array(keys.buffer);
    for (let i = 0; i < n; i++) {
      const w = a * p[i * 3] + b * p[i * 3 + 1] + c * p[i * 3 + 2] + d;
      depth[i] = w;
      if (w < lo) lo = w;
      if (w > hi) hi = w;
    }
    const scale = hi > lo ? 65535 / (hi - lo) : 0;
    const counts = this.counts;
    counts.fill(0);
    for (let i = 0; i < n; i++) {
      // Far first: invert the key.
      const k = 65535 - ((depth[i] - lo) * scale) | 0;
      keys[i] = k;
      counts[k]++;
    }
    const starts = this.starts;
    starts[0] = 0;
    for (let k = 1; k < 65536; k++) starts[k] = starts[k - 1] + counts[k - 1];
    for (let i = 0; i < n; i++) this.order[starts[keys[i]]++] = i;
    this.sorts++;
    return this.order;
  }

  /**
   * Whether a re-sort is worth it: the eye moved by more than `moveM` (local
   * metres) or the view direction turned by more than `turnRad`.
   */
  needsSort(eye: ArrayLike<number>, dir: ArrayLike<number>, moveM = 0.05, turnRad = 0.02): boolean {
    const e = this.lastEye, v = this.lastDir;
    if (e && v) {
      const moved = Math.hypot(eye[0] - e[0], eye[1] - e[1], eye[2] - e[2]);
      const dot = dir[0] * v[0] + dir[1] * v[1] + dir[2] * v[2];
      if (moved <= moveM && dot >= Math.cos(turnRad)) return false;
    }
    this.lastEye = [eye[0], eye[1], eye[2]];
    this.lastDir = [dir[0], dir[1], dir[2]];
    return true;
  }

  /** Forget the last eye so the next needsSort() is true. */
  invalidate(): void { this.lastEye = null; this.lastDir = null; }
}
