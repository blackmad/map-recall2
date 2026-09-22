/**
 * Roofline profile for a merged elevation, in the plan's §3 frame:
 * `along` in metres from `plane.start` towards `plane.end`, `up` in absolute
 * NAP metres, sampled every 0.10 m with `null` for a missing column.
 *
 * The cloud rasterisation and silhouette extraction are `rasteriseWall` /
 * `wallSilhouette` from `pointCloudGeometry.ts`, unchanged — this module only
 * builds the synthetic wall those functions expect from an elevation's plane,
 * and remaps their (frame-relative, arbitrarily-oriented) output into the
 * canonical start-to-end frame.
 */
import type { ProjectedPoint } from './sources.ts';
import {
  projectToWall,
  rasteriseWall,
  wallSilhouette,
  type CloudPoint,
  type WallRaster,
  type WallSilhouette,
} from './pointCloudGeometry.ts';

export const SAMPLE_M = 0.10;

export interface ElevationPlane {
  start: ProjectedPoint;
  end: ProjectedPoint;
  /** Absolute NAP metres. */
  baseZ: number;
  topZ: number;
}

/** A synthetic vertical quad spanning the plane, for `rasteriseWall`'s wall-shaped input. */
export function synthesiseElevationWall(plane: ElevationPlane) {
  const dx = plane.end.x - plane.start.x;
  const dy = plane.end.y - plane.start.y;
  const length = Math.hypot(dx, dy) || 1;
  // Outward normal: rotate the start->end direction -90°, matching elevations.ts's convention.
  const normal: readonly [number, number, number] = [dy / length, -dx / length, 0];
  const vertices: Array<readonly [number, number, number]> = [
    [plane.start.x, plane.start.y, plane.baseZ],
    [plane.end.x, plane.end.y, plane.baseZ],
    [plane.end.x, plane.end.y, plane.topZ],
    [plane.start.x, plane.start.y, plane.topZ],
  ];
  return { vertices, normal };
}

export interface ElevationRaster {
  raster: WallRaster;
  silhouette: WallSilhouette;
}

/** Rasterise the cloud against the elevation's own plane and extract its silhouette. */
export function rasteriseElevation(
  points: readonly CloudPoint[],
  plane: ElevationPlane,
  options: { cellSize?: number; maxPlaneDistance?: number; upwardSearch?: number; minimumPointsPerCell?: number } = {},
): ElevationRaster | null {
  const wall = synthesiseElevationWall(plane);
  const raster = rasteriseWall(points, wall, {
    cellSize: options.cellSize ?? 0.05,
    maxPlaneDistance: options.maxPlaneDistance ?? 0.35,
    upwardSearch: options.upwardSearch ?? 8,
  });
  if (!raster) return null;
  const silhouette = wallSilhouette(raster, { minimumPointsPerCell: options.minimumPointsPerCell ?? 2, tolerance: 0.08, minimumRun: 3, smoothWindow: 9 });
  return { raster, silhouette };
}

export interface CanonicalProfilePoint {
  along: number;
  /** Absolute NAP metres, or `null` when no column falls within half a sample of this `along`. */
  up: number | null;
}

export interface CanonicalProfile {
  sampleM: number;
  widthM: number;
  points: CanonicalProfilePoint[];
  coverage: number;
}

/**
 * Convert a `wallSilhouette` profile (in the synthetic wall's own frame,
 * whose `along` direction `wallMetricFrame` may have picked opposite to
 * `plane.start -> plane.end`) into the canonical §3 frame, resampled at
 * `sampleM`.
 */
export function canonicaliseProfile(
  rawProfile: ReadonlyArray<readonly [number, number]>,
  frame: { origin: readonly [number, number, number]; u: readonly [number, number, number] },
  plane: ElevationPlane,
  sampleM = SAMPLE_M,
): CanonicalProfile {
  const dx = plane.end.x - plane.start.x;
  const dy = plane.end.y - plane.start.y;
  const widthM = Math.hypot(dx, dy);
  const dirX = widthM > 1e-9 ? dx / widthM : 0;
  const dirY = widthM > 1e-9 ? dy / widthM : 0;
  const originZ = frame.origin[2];

  // Each raw sample's world (x, y): frame.origin + along * u, then re-projected
  // onto the canonical start->end axis, independent of which way `u` pointed.
  const canonicalSamples: Array<{ along: number; up: number }> = rawProfile.map(([along, up]) => {
    const worldX = frame.origin[0] + frame.u[0] * along;
    const worldY = frame.origin[1] + frame.u[1] * along;
    const canonicalAlong = (worldX - plane.start.x) * dirX + (worldY - plane.start.y) * dirY;
    return { along: canonicalAlong, up: originZ + up };
  });
  canonicalSamples.sort((a, b) => a.along - b.along);

  const steps = Math.max(1, Math.round(widthM / sampleM));
  const points: CanonicalProfilePoint[] = [];
  const half = sampleM / 2;
  let cursor = 0;
  for (let step = 0; step <= steps; step += 1) {
    const along = step * sampleM;
    const window: number[] = [];
    while (cursor < canonicalSamples.length && canonicalSamples[cursor].along < along - half) cursor += 1;
    for (let index = cursor; index < canonicalSamples.length && canonicalSamples[index].along <= along + half; index += 1) {
      if (canonicalSamples[index].along >= along - half) window.push(canonicalSamples[index].up);
    }
    points.push({ along, up: window.length ? median(window) : null });
  }
  const coverage = points.length ? points.filter((point) => point.up != null).length / points.length : 0;
  return { sampleM, widthM, points, coverage };
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Re-derive a canonical profile sample's raster (along, up), for drawing on the wall-frame image. */
export function toRasterPoint(frame: Parameters<typeof projectToWall>[0], plane: ElevationPlane, along: number, up: number) {
  const dx = plane.end.x - plane.start.x;
  const dy = plane.end.y - plane.start.y;
  const widthM = Math.hypot(dx, dy) || 1;
  const fraction = along / widthM;
  const worldX = plane.start.x + dx * fraction;
  const worldY = plane.start.y + dy * fraction;
  return projectToWall(frame, { x: worldX, y: worldY, z: up });
}
