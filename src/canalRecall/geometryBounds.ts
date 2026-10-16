// Plain-array geometry bounds for the streaming installs (docs/perf-motion-stutter-20261016.md).

/** three.js `computeBoundingSphere` for a plain xyz Float32Array: the same box centre and radius, without attribute accessors. */
export function boundingSphereOf(positions: Float32Array): { center: [number, number, number]; radius: number } {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  const n = positions.length;
  for (let i = 0; i < n; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z;
    if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z;
  }
  // Box3.getCenter: (min + max) * 0.5, in doubles as three does.
  const cx = (x0 + x1) * 0.5, cy = (y0 + y1) * 0.5, cz = (z0 + z1) * 0.5;
  let r2 = 0;
  for (let i = 0; i < n; i += 3) {
    const dx = cx - positions[i], dy = cy - positions[i + 1], dz = cz - positions[i + 2];
    const d = dx * dx + dy * dy + dz * dz;
    if (d > r2) r2 = d;
  }
  return { center: [cx, cy, cz], radius: Math.sqrt(r2) };
}
