/**
 * Compiling a source-pixel gable/roofline contour into a bounded, low-poly
 * silhouette in wall-metric space.
 *
 * The top visual failure on a rectified façade is the roofline silhouette: a
 * gable that is traced, e.g., as a jagged pixel run but needs to become a small
 * set of metric vertices a mesh can consume. Hand-editing every building does
 * not scale, so this module turns the traced contour into clean metric vertices
 * deterministically.
 *
 * Pixel→wall conversion is the same affine mapping used by the review preview
 * (`scripts/review/source-to-owner-candidate.ts`): the sampling plane spans the
 * full source width, and height runs downward from `topZ` to `baseZ`. Each
 * output vertex is `[alongM, heightM]` in the plane's own frame, so a caller can
 * place it against the BAG-derived façade width without further registration.
 *
 * Pure and deterministic: no I/O, no clock, no randomness.
 */

/** The rectified sampling plane a contour was traced on, in RD metres / NAP. */
export interface SourcePlane {
  start: { x: number; y: number };
  end: { x: number; y: number };
  baseZ: number;
  topZ: number;
}

type Point = [number, number];

function clone(point: Point): Point {
  return [point[0], point[1]];
}

/** Perpendicular distance from `p` to the segment `a`–`b`, all in input space. */
function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared;
  const cx = a[0] + t * dx;
  const cy = a[1] + t * dy;
  return Math.hypot(p[0] - cx, p[1] - cy);
}

/** Ramer–Douglas–Peucker over an open polyline. Keeps the two endpoints. */
function simplifyOpen(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points.slice();
  const first = points[0];
  const last = points[points.length - 1];
  let furthest = -1;
  let furthestIndex = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], first, last);
    if (distance > furthest) {
      furthest = distance;
      furthestIndex = i;
    }
  }
  // Strict comparison: a point exactly at the tolerance is dropped, which keeps
  // the reduction deterministic across callers.
  if (furthest > tolerance && furthestIndex > 0) {
    const left = simplifyOpen(points.slice(0, furthestIndex + 1), tolerance);
    const right = simplifyOpen(points.slice(furthestIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

/**
 * Ramer–Douglas–Peucker simplification in the input space.
 *
 * Deterministic, endpoints preserved. `toleranceM` is measured in the units of
 * the input points (metres for metric contours, pixels for pixel contours).
 * `closed` treats the input as a ring: the first vertex is duplicated to close
 * it, simplified, and the duplicate removed from the result.
 */
export function simplifyContour(
  points: Point[],
  options: { toleranceM?: number; closed?: boolean } = {},
): Point[] {
  if (!Array.isArray(points) || points.length < 2) {
    throw new Error('simplifyContour requires at least two points');
  }
  for (const point of points) {
    if (!Array.isArray(point) || point.length !== 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
      throw new Error('simplifyContour points must be finite [x, y] pairs');
    }
  }
  const tolerance = options.toleranceM ?? 0.1;
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new Error('simplifyContour toleranceM must be finite and non-negative');
  }
  if (points.length === 2) return [clone(points[0]), clone(points[1])];

  if (!options.closed) return simplifyOpen(points, tolerance).map(clone);

  const ring = points.map(clone);
  const first = ring[0];
  const last = ring[ring.length - 1];
  const alreadyClosed = first[0] === last[0] && first[1] === last[1];
  if (!alreadyClosed) ring.push(clone(first));
  const simplified = simplifyOpen(ring, tolerance).map(clone);
  const head = simplified[0];
  const tail = simplified[simplified.length - 1];
  if (simplified.length > 2 && head[0] === tail[0] && head[1] === tail[1]) simplified.pop();
  return simplified;
}

export interface SilhouetteOptions {
  /**
   * Rectification resolution of the source, in pixels per metre. Accepted so
   * callers can pass the value they rectified at; validated but otherwise not
   * required, because the pixel→metre scale is fully determined by the plane
   * span and the source dimensions.
   */
  pixelsPerMetre?: number;
  /** Hard cap on output vertices; the tolerance is doubled until the cap fits. */
  maxVertices?: number;
  /** RDP tolerance in wall metres; defaults to 0.1 m. */
  simplifyToleranceM?: number;
}

export interface CompiledSilhouette {
  vertices: [number, number][];
  wallWidthM: number;
  wallHeightM: number;
  sourceWidthPx: number;
  sourceHeightPx: number;
  vertexCount: number;
}

/**
 * Compile a source-pixel contour into bounded wall-metric vertices.
 *
 * `contour` is the traced gable/roofline as `[x, y]` source pixels, ordered
 * left to right (or right to left) across the whole façade. Output vertices are
 * `[alongM, heightM]`, where `alongM` runs from the plane's `start` end and
 * `heightM` is NAP height above `baseZ`.
 *
 * Throws when the contour does not span the façade, when the plane is
 * degenerate, or when `maxVertices` is below the two endpoints that can never
 * be removed.
 */
export function compileSilhouette(
  contour: Point[],
  source: { width: number; height: number },
  plane: SourcePlane,
  options: SilhouetteOptions = {},
): CompiledSilhouette {
  if (!Array.isArray(contour) || contour.length < 2) {
    throw new Error('compileSilhouette requires a contour of at least two points');
  }
  for (const point of contour) {
    if (!Array.isArray(point) || point.length !== 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
      throw new Error('compileSilhouette contour points must be finite [x, y] pairs');
    }
  }
  if (!(source.width > 0) || !(source.height > 0) || !Number.isFinite(source.width) || !Number.isFinite(source.height)) {
    throw new Error('compileSilhouette source dimensions must be finite and positive');
  }
  if (!Number.isFinite(plane.start.x) || !Number.isFinite(plane.start.y) || !Number.isFinite(plane.end.x) || !Number.isFinite(plane.end.y)) {
    throw new Error('compileSilhouette plane endpoints must be finite');
  }

  const wallWidthM = Math.hypot(plane.end.x - plane.start.x, plane.end.y - plane.start.y);
  const wallHeightM = plane.topZ - plane.baseZ;
  if (!(wallWidthM > 0)) throw new Error('compileSilhouette plane spans zero wall width');
  if (!(wallHeightM > 0)) throw new Error('compileSilhouette plane has non-positive height');

  const leftX = contour[0][0];
  const rightX = contour[contour.length - 1][0];
  const spansFacade = (leftX === 0 && rightX === source.width) || (leftX === source.width && rightX === 0);
  if (!spansFacade) {
    throw new Error(
      `compileSilhouette contour must span the facade: expected first/last x at 0 and ${source.width}, got ${leftX} and ${rightX}`,
    );
  }

  const pixelsPerMetre = options.pixelsPerMetre;
  if (pixelsPerMetre !== undefined && (!Number.isFinite(pixelsPerMetre) || pixelsPerMetre <= 0)) {
    throw new Error('compileSilhouette pixelsPerMetre must be finite and positive');
  }
  const maxVertices = options.maxVertices;
  if (maxVertices !== undefined && (!Number.isInteger(maxVertices) || maxVertices < 2)) {
    throw new Error('compileSilhouette maxVertices must be an integer of at least 2');
  }

  const scaleX = wallWidthM / source.width;
  const scaleY = wallHeightM / source.height;
  const toWall = (point: Point): Point => [point[0] * scaleX, plane.topZ - point[1] * scaleY];
  const metric = contour.map(toWall);

  let tolerance = options.simplifyToleranceM ?? 0.1;
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new Error('compileSilhouette simplifyToleranceM must be finite and non-negative');
  }

  let vertices = simplifyContour(metric, { toleranceM: tolerance });
  if (maxVertices !== undefined) {
    // Double the tolerance until the vertex cap fits. RDP always terminates at
    // the two preserved endpoints, so a cap of two is always reachable; the
    // guard is a belt-and-braces bound on pathological floating point.
    let guard = 0;
    while (vertices.length > maxVertices && guard < 64) {
      tolerance *= 2;
      vertices = simplifyContour(metric, { toleranceM: tolerance });
      guard++;
    }
    if (vertices.length > maxVertices) {
      throw new Error(`compileSilhouette could not reach maxVertices ${maxVertices}`);
    }
  }

  return {
    vertices,
    wallWidthM,
    wallHeightM,
    sourceWidthPx: source.width,
    sourceHeightPx: source.height,
    vertexCount: vertices.length,
  };
}
