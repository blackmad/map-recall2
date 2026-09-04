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
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
}

/**
 * Where the panorama's `heading` sits in the image.
 *
 * Publishers differ and rarely document it: some put the heading direction at
 * the horizontal centre of the equirectangular frame, others at the left edge.
 * The two differ by exactly half the image width — 180° — so guessing wrong
 * produces a confident, well-formed picture of whatever stands behind the
 * camera.
 *
 * Amsterdam's panoramas are `centre`: the heading direction sits at the
 * horizontal middle of the frame. That was settled by slicing one panorama into
 * eight 45° bands and finding which band held the wall known to be 4.2 m away —
 * it fell at u≈0.3, and `centre` predicts 0.305 while `edge` predicts 0.805.
 *
 * Worth recording how nearly the wrong answer won. Both conventions render
 * upright, plausible, entirely convincing canal frontages, because in Amsterdam
 * every direction is one. Judging by eye picked `edge`, and it was wrong. Only
 * a prediction checked against geometry known independently — where is the wall
 * we already measured — could tell them apart.
 */
export type YawConvention = 'centre' | 'edge';

export interface FacadePlane {
  /** Wall ends, in RD metres, ordered so the wall's outward normal is to the right. */
  start: ProjectedPoint;
  end: ProjectedPoint;
  /** NAP height of the ground at the wall. */
  baseZ: number;
  /** NAP height of the top of the sampled strip — ridge plus headroom. */
  topZ: number;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Rotate a world direction into the camera frame.
 *
 * Yaw about the vertical axis first, then pitch, then roll — the order a
 * vehicle-mounted head actually moves in. Pitch and roll are typically a degree
 * or two here, but at 25 m a single degree is 44 cm on the wall, which is a
 * whole window sill.
 */
function toCameraFrame(dx: number, dy: number, dz: number, pose: CameraPose): [number, number, number] {
  const yaw = toRadians(pose.headingDeg);
  const pitch = toRadians(pose.pitchDeg);
  const roll = toRadians(pose.rollDeg);

  // Yaw: rotate the world so the camera's forward axis is +y.
  const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
  let x = dx * cosYaw - dy * sinYaw;
  let y = dx * sinYaw + dy * cosYaw;
  let z = dz;

  const cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);
  const y1 = y * cosPitch + z * sinPitch;
  const z1 = -y * sinPitch + z * cosPitch;
  y = y1; z = z1;

  const cosRoll = Math.cos(roll), sinRoll = Math.sin(roll);
  const x2 = x * cosRoll - z * sinRoll;
  const z2 = x * sinRoll + z * cosRoll;
  x = x2; z = z2;

  return [x, y, z];
}

/** Camera-frame direction → pixel coordinates in the equirectangular frame. */
export function directionToPixel(
  direction: [number, number, number],
  image: { width: number; height: number },
  yaw: YawConvention,
): [number, number] {
  const [x, y, z] = direction;
  const length = Math.hypot(x, y, z) || 1;
  // Azimuth measured clockwise from the camera's forward axis.
  const azimuth = Math.atan2(x, y);
  const elevation = Math.asin(Math.max(-1, Math.min(1, z / length)));
  const turns = azimuth / (Math.PI * 2);
  const u = ((yaw === 'centre' ? turns + 0.5 : turns) % 1 + 1) % 1;
  const v = 0.5 - elevation / Math.PI;
  return [u * image.width, v * image.height];
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
  yaw?: YawConvention;
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
  options: RectifyOptions = {},
): RectifiedFacade {
  const pixelsPerMetre = options.pixelsPerMetre ?? 60;
  const yaw = options.yaw ?? 'centre';
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

      const direction = toCameraFrame(worldX - pose.x, worldY - pose.y, worldZ - pose.z, pose);
      if (!Number.isFinite(direction[0])) { missing++; continue; }
      const [su, sv] = directionToPixel(direction, image, yaw);
      if (sv < 0 || sv >= image.height) { missing++; continue; }
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
