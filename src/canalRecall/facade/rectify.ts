/**
 * Rectifying a façade out of an equirectangular street panorama.
 *
 * This is the step the whole project turns on. The build prompt's measurement
 * recipe starts "rectify the façade to an orthographic elevation using the BAG
 * footprint edge as the ground-truth width", and the reason it starts there is
 * that a perspective photograph cannot be measured: a window near the edge of
 * frame is not the same width in pixels as an identical window at the centre.
 * Rectified into the façade's own plane, it is — and because the plot width is
 * already known exactly from BAG, the image arrives with a metre scale on it.
 *
 * The projection is a resampling of the source pixels, not a derived asset: it
 * exists to be measured and then discarded. What ships is the numbers taken off
 * it.
 *
 * World frame is RD New metres with NAP heights: X east, Y north, Z up.
 */
import type { ProjectedPoint } from './sources.ts';

export interface EquirectangularImage {
  width: number;
  height: number;
  /** RGBA, row-major, 4 bytes per pixel. */
  data: Uint8Array | Uint8ClampedArray;
}

export interface CameraPose {
  /** Camera position in RD metres, with NAP height. */
  x: number;
  y: number;
  z: number;
  /**
   * The vehicle's attitude at capture.
   *
   * Whether these rotate the *image* is a property of the publisher, not of the
   * pose — see `CameraModel`. For a world-aligned publisher they are metadata
   * describing the van, and applying them is a bug.
   */
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
}

/** World-frame offset from the camera to a point: east, north, up, in metres. */
export type WorldDelta = readonly [number, number, number];

/**
 * How a publisher's equirectangular frame relates to the world.
 *
 * This is the question that cost this project every street-level measurement it
 * had, twice, and both times because it was asked in too small a form. The
 * first form was "where does azimuth zero sit, the centre of the frame or the
 * left edge?" — which silently assumes the frame turns with the vehicle. The
 * answer to the *larger* question, for Amsterdam, is that it does not:
 *
 *   - Two cameras standing 9–14 cm apart with headings 180° opposed produce raw
 *     images that agree at 0.0° ± 0.5° under normalised cross-correlation. If
 *     the frame turned with the vehicle they would differ by half a frame.
 *   - The optical-flow expansion centre between consecutive frames of a track —
 *     which is the direction of travel, and is known independently from the two
 *     published positions — lands at `world bearing + 180°` in image columns,
 *     with the anticlockwise alternative ruled out (concentration R = 0.84
 *     against 0.05).
 *
 * So Amsterdam's frames are *world-aligned*: north sits at the horizontal
 * centre, the horizon is level, and `heading`/`pitch`/`roll` describe the van.
 * The pipeline was rotating every projection by the van's heading, which is why
 * two panoramas of one pand landed on two different houses, and why the whole
 * `centre`/`edge` argument was unwinnable: both were wrong by `heading`, and
 * `edge` looked right only on the views where heading happened to be near 180°.
 *
 * A model is therefore a named object, not a string, and it is always required.
 */
export interface CameraModel {
  readonly id: string;
  /**
   * Whether the pose's orientation fields are inputs to the projection.
   *
   * This is what decides whether a panorama with no published orientation is
   * unusable or merely undescribed. Under a world-aligned model it is the
   * latter, so validity has to be asked of the model rather than assumed.
   */
  readonly usesOrientation: boolean;
  /** Where a world-frame offset from the camera lands in the frame. */
  project(delta: WorldDelta, pose: CameraPose, image: { width: number; height: number }): [number, number];
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Direction (east, north, up) → pixel, given where north sits horizontally. */
function equirectangular(
  dx: number, dy: number, dz: number,
  image: { width: number; height: number },
  northAtU: number,
): [number, number] {
  const length = Math.hypot(dx, dy, dz) || 1;
  // Azimuth clockwise from north; elevation positive upward.
  const azimuth = Math.atan2(dx, dy);
  const elevation = Math.asin(Math.max(-1, Math.min(1, dz / length)));
  const u = (((azimuth / (Math.PI * 2)) + northAtU) % 1 + 1) % 1;
  return [u * image.width, (0.5 - elevation / Math.PI) * image.height];
}

/**
 * A publisher who has already rotated the frame into the world.
 *
 * The image is north-aligned and level; the pose's orientation fields are
 * ignored deliberately, and that is the whole content of the model.
 */
export const worldAlignedFrame = (id: string, northAtU: number): CameraModel => ({
  id,
  usesOrientation: false,
  project: (delta, _pose, image) => equirectangular(delta[0], delta[1], delta[2], image, northAtU),
});

/**
 * A publisher whose frame turns with the vehicle.
 *
 * Yaw about the vertical axis first, then pitch, then roll — the order a
 * vehicle-mounted head actually moves in. Kept because it is the other real
 * convention and the distinction is the lesson; no Amsterdam code path uses it.
 */
export const bodyAlignedFrame = (id: string, forwardAtU: number): CameraModel => ({
  id,
  usesOrientation: true,
  project: (delta, pose, image) => {
    const yaw = toRadians(pose.headingDeg), pitch = toRadians(pose.pitchDeg), roll = toRadians(pose.rollDeg);
    const [dx, dy, dz] = delta;
    // Rotate the world so the camera's forward axis is +y.
    let x = dx * Math.cos(yaw) - dy * Math.sin(yaw);
    let y = dx * Math.sin(yaw) + dy * Math.cos(yaw);
    let z = dz;
    const y1 = y * Math.cos(pitch) + z * Math.sin(pitch);
    const z1 = -y * Math.sin(pitch) + z * Math.cos(pitch);
    y = y1; z = z1;
    const x2 = x * Math.cos(roll) - z * Math.sin(roll);
    const z2 = x * Math.sin(roll) + z * Math.cos(roll);
    return equirectangular(x2, y, z2, image, forwardAtU);
  },
});

export interface FacadePlane {
  /** Wall ends, in RD metres, ordered so the wall's outward normal is to the right. */
  start: ProjectedPoint;
  end: ProjectedPoint;
  /** NAP height of the ground at the wall. */
  baseZ: number;
  /** NAP height of the top of the sampled strip — ridge plus headroom. */
  topZ: number;
}

/** Bilinear sample, wrapping horizontally because the panorama is a cylinder. */
function sample(image: EquirectangularImage, u: number, v: number, out: number[]): void {
  const x0 = Math.floor(u), y0 = Math.floor(v);
  const fx = u - x0, fy = v - y0;
  const wrap = (x: number) => ((x % image.width) + image.width) % image.width;
  const clamp = (y: number) => Math.max(0, Math.min(image.height - 1, y));
  const x1 = wrap(x0 + 1), y1 = clamp(y0 + 1), xa = wrap(x0), ya = clamp(y0);

  for (let channel = 0; channel < 3; channel++) {
    const p00 = image.data[(ya * image.width + xa) * 4 + channel];
    const p10 = image.data[(ya * image.width + x1) * 4 + channel];
    const p01 = image.data[(y1 * image.width + xa) * 4 + channel];
    const p11 = image.data[(y1 * image.width + x1) * 4 + channel];
    out[channel] = p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) + p01 * (1 - fx) * fy + p11 * fx * fy;
  }
}

export interface RectifyOptions {
  /** Output resolution, in pixels per metre of wall. */
  pixelsPerMetre?: number;
  /**
   * Required. How this publisher's frame relates to the world.
   *
   * Not optional and never defaulted. The wrong model produces an upright,
   * well-lit, entirely convincing picture of a different building, because in
   * Amsterdam whatever you point at is a canal house. Take it from the imagery
   * adapter, which is where the fact about the publisher belongs.
   */
  camera: CameraModel;
  /** Cap on output size, so a long warehouse wall cannot allocate unboundedly. */
  maxPixels?: number;
}

export interface RectifiedFacade {
  width: number;
  height: number;
  /** RGBA. */
  data: Uint8ClampedArray;
  pixelsPerMetre: number;
  /** Metres of wall spanned, and metres of height, so a measurement can scale. */
  wallWidthM: number;
  wallHeightM: number;
  /** Share of output pixels whose ray fell behind the camera or outside the image. */
  missingFraction: number;
}

/**
 * Project the panorama onto the façade plane.
 *
 * Output x runs from `start` to `end` along the wall; output y runs downward
 * from `topZ` to `baseZ`. Every output pixel is one fixed patch of wall, so a
 * measurement taken in pixels converts to metres by a single constant — which
 * is the entire point.
 */
export function rectifyFacade(
  image: EquirectangularImage,
  pose: CameraPose,
  plane: FacadePlane,
  options: RectifyOptions,
): RectifiedFacade {
  const pixelsPerMetre = options.pixelsPerMetre ?? 60;
  const camera = options.camera;
  const maxPixels = options.maxPixels ?? 12e6;

  const wallWidthM = Math.hypot(plane.end.x - plane.start.x, plane.end.y - plane.start.y);
  const wallHeightM = plane.topZ - plane.baseZ;
  let scale = pixelsPerMetre;
  if (wallWidthM * scale * wallHeightM * scale > maxPixels) {
    scale = Math.sqrt(maxPixels / (wallWidthM * wallHeightM));
  }

  const width = Math.max(1, Math.round(wallWidthM * scale));
  const height = Math.max(1, Math.round(wallHeightM * scale));
  const data = new Uint8ClampedArray(width * height * 4);

  const ux = (plane.end.x - plane.start.x) / wallWidthM;
  const uy = (plane.end.y - plane.start.y) / wallWidthM;
  const rgb = [0, 0, 0];
  let missing = 0;

  for (let py = 0; py < height; py++) {
    const worldZ = plane.topZ - ((py + 0.5) / height) * wallHeightM;
    for (let px = 0; px < width; px++) {
      const along = ((px + 0.5) / width) * wallWidthM;
      const worldX = plane.start.x + ux * along;
      const worldY = plane.start.y + uy * along;

      const [su, sv] = camera.project([worldX - pose.x, worldY - pose.y, worldZ - pose.z], pose, image);
      if (!Number.isFinite(su) || sv < 0 || sv >= image.height) { missing++; continue; }
      sample(image, su, sv, rgb);

      const offset = (py * width + px) * 4;
      data[offset] = rgb[0];
      data[offset + 1] = rgb[1];
      data[offset + 2] = rgb[2];
      data[offset + 3] = 255;
    }
  }

  return { width, height, data, pixelsPerMetre: scale, wallWidthM, wallHeightM, missingFraction: missing / (width * height) };
}
