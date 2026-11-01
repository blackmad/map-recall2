// A bespoke bridge's own frame (lane landmarks-bridges-20261101, #175): builders author a bridge in
// metres along its axis (`along`, the compass bearing), up (`y`, scene z = NAP − 1.37) and to the right of
// the bearing (`right`), and this maps it into the landmark exporter's native frame (x east, y up, z south,
// origin at the surveyed anchor). The basis is a proper rotation (determinant +1), so face winding survives.
// The ride profile keeps the model's deck under the game's deck: GroundSurface.height sampled along the axis
// (scripts/landmarks/bridge-deck-probe.ts) is the height the rider is drawn at.

export type Vec3 = [number, number, number];

/** Column-major 3×3: model = M · [along, y, right]. */
export interface BridgeBasis { along: Vec3; up: Vec3; right: Vec3 }

export function bridgeBasis(bearingDegrees: number): BridgeBasis {
  const t = bearingDegrees * Math.PI / 180, ue = Math.sin(t), un = Math.cos(t);
  // East/north of the bearing is (ue, un); to its right is (un, −ue). Model z is south (−north).
  return { along: [ue, 0, -un], up: [0, 1, 0], right: [un, 0, ue] };
}

export function toModel(b: BridgeBasis, along: number, y: number, right: number): Vec3 {
  return [b.along[0] * along + b.right[0] * right, y, b.along[2] * along + b.right[2] * right];
}

/** The row-major 4×4 (three.js Matrix4.set order) of the basis. */
export function basisMatrix(b: BridgeBasis): number[] {
  return [b.along[0], b.up[0], b.right[0], 0, b.along[1], b.up[1], b.right[1], 0, b.along[2], b.up[2], b.right[2], 0, 0, 0, 0, 1];
}

export function determinant(b: BridgeBasis): number {
  const [a, u, r] = [b.along, b.up, b.right];
  return a[0] * (u[1] * r[2] - u[2] * r[1]) - u[0] * (a[1] * r[2] - a[2] * r[1]) + r[0] * (a[1] * u[2] - a[2] * u[1]);
}

/** Linear interpolation of a sampled [along, z] profile, clamped at its ends. */
export function profileZ(profile: readonly (readonly [number, number])[], along: number): number {
  if (along <= profile[0][0]) return profile[0][1];
  for (let i = 1; i < profile.length; i++) {
    const [a1, z1] = profile[i];
    if (along <= a1) { const [a0, z0] = profile[i - 1]; return z0 + (z1 - z0) * (along - a0) / (a1 - a0); }
  }
  return profile[profile.length - 1][1];
}

/**
 * A segmental arch from `a0` to `a1` springing at `spring` with its intrados crown at `crown`: `n + 1`
 * points [along, y] from a0 to a1 on the circle through the three.
 */
export function segmentalArc(a0: number, a1: number, spring: number, crown: number, n: number): [number, number][] {
  const half = (a1 - a0) / 2, rise = crown - spring, mid = (a0 + a1) / 2;
  if (rise <= 0 || half <= 0) throw Error('segmentalArc: rise and span must be positive');
  const radius = (half * half + rise * rise) / (2 * rise), cy = crown - radius, sweep = Math.asin(Math.min(1, half / radius));
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) { const t = -sweep + 2 * sweep * i / n; out.push([mid + radius * Math.sin(t), cy + radius * Math.cos(t)]); }
  out[0] = [a0, spring]; out[n] = [a1, spring];
  return out;
}

/** The arc `offset` metres outside a segmental arc (the extrados of an arch ring), same stations. */
export function offsetArc(a0: number, a1: number, spring: number, crown: number, n: number, offset: number): [number, number][] {
  const half = (a1 - a0) / 2, rise = crown - spring, mid = (a0 + a1) / 2;
  const radius = (half * half + rise * rise) / (2 * rise), cy = crown - radius, sweep = Math.asin(Math.min(1, half / radius));
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) { const t = -sweep + 2 * sweep * i / n; out.push([mid + (radius + offset) * Math.sin(t), cy + (radius + offset) * Math.cos(t)]); }
  return out;
}
