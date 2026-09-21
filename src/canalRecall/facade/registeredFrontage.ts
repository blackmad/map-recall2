/**
 * The registered frontage as a fallback drawing plane.
 *
 * An observation's frontage (`localStart` -> `localEnd`) is the extraction's own
 * registered wall line. Normally the compiler draws on the matching 3DBAG wall
 * polygon, but 3DBAG fragments some frontages into slivers, skewed pieces or
 * non-planar rings, so no surface supplies a usable rectangular frame. In that
 * case the registered frontage is the only defensible plane: the crop plane is
 * already coplanar with it, and the source transform is built from it.
 *
 * This module builds a synthetic rectangular wall surface on that line. It
 * invents no position (the frontage is registered) and no height beyond the
 * building's own wall extent. Callers must still validate it with
 * `facadeWallFrame` before compiling, so a frontage that does not sit on the
 * building boundary abstains rather than rendering a floating facade.
 */

export interface WallRingSurface {
  type: string;
  rings: number[][][];
}

export interface FrontageWallSurface extends WallRingSurface {
  type: 'wall';
}

/**
 * Build a rectangular wall surface spanning the registered frontage and the
 * building's own wall height. Returns null when the frontage is too short or
 * no wall height is available, so the caller abstains instead of guessing.
 */
export function registeredFrontageWallSurface(
  start: readonly [number, number],
  end: readonly [number, number],
  wallSurfaces: readonly WallRingSurface[],
): FrontageWallSurface | null {
  const [sx, sz] = start;
  const [ex, ez] = end;
  const width = Math.hypot(ex - sx, ez - sz);
  if (!Number.isFinite(width) || width < 1.5) return null;
  let bottom = Infinity;
  let top = -Infinity;
  for (const surface of wallSurfaces) {
    if (surface.type !== 'wall') continue;
    for (const point of surface.rings?.[0] ?? []) {
      const y = point?.[1];
      if (!Number.isFinite(y)) continue;
      bottom = Math.min(bottom, y);
      top = Math.max(top, y);
    }
  }
  if (!Number.isFinite(bottom) || !Number.isFinite(top) || top - bottom < 2.5) return null;
  return {
    type: 'wall',
    rings: [
      [
        [sx, bottom, sz],
        [ex, bottom, ez],
        [ex, top, ez],
        [sx, top, sz],
      ],
    ],
  };
}
