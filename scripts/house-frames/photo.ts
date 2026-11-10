/**
 * house:frames photo half (lane H10, #358): a pinhole cut from an Amsterdam equirectangular panorama with exactly the
 * game pose's camera frame (pose.ts frameFor), plus the wall rectified out of either half for measureFacade.
 *
 * The panorama is world-aligned on the RD grid (facade/rectify.ts AMSTERDAM_WORLD_ALIGNED: north at the image centre,
 * the published heading/pitch/roll not applied); every ray is turned from true north to the grid (pose.ts
 * toPanoDirection) before it is looked up. Panoramas come through scripts/pand-reference/core.ts cachedBytes (the shared
 * cache, PAND_REFERENCE_CACHE); `small` (2000 px) is used for the foliage pre-pass, `medium` (4000 px) for the cut by
 * default.
 */
import sharp from 'sharp';
import { directionToPixel } from '../../src/canalRecall/facade/rectify.ts';
import { cachedBytes } from '../pand-reference/core.ts';
import type { CameraFrame } from '../../src/canalRecall/ownMap/mapCamera.ts';
import { rayFor, toPanoDirection, wallPoint, type FramePose, type WallQuad } from './pose.ts';

export type Rgb8 = { width: number; height: number; data: Uint8Array }; // RGB, 3 bytes per pixel
export type PanoSize = 'small' | 'medium' | 'full';

const decoded = new Map<string, Rgb8>();
export async function loadEquirect(record: any, size: PanoSize = 'medium'): Promise<Rgb8 | null> {
  const order = size === 'full' ? ['equirectangular_full', 'equirectangular_medium'] : size === 'small' ? ['equirectangular_small', 'equirectangular_medium'] : ['equirectangular_medium', 'equirectangular_full'];
  for (const key of order) {
    const href = record._links?.[key]?.href;
    if (!href) continue;
    const hit = decoded.get(href);
    if (hit) return hit;
    try {
      const bytes = await cachedBytes(href, '.jpg');
      const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const img = { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
      decoded.set(href, img);
      if (decoded.size > 3) decoded.delete(decoded.keys().next().value!);
      return img;
    } catch { /* next size */ }
  }
  return null;
}

/** Bilinear RGB lookup, wrapping horizontally (the panorama is a cylinder). */
function sample(img: Rgb8, u: number, v: number, out: Uint8Array, o: number) {
  const W = img.width, H = img.height;
  const x0 = Math.floor(u - 0.5), y0 = Math.floor(v - 0.5), fx = u - 0.5 - x0, fy = v - 0.5 - y0;
  const xa = ((x0 % W) + W) % W, xb = (xa + 1) % W, ya = Math.max(0, Math.min(H - 1, y0)), yb = Math.max(0, Math.min(H - 1, y0 + 1));
  const d = img.data;
  for (let c = 0; c < 3; c++) {
    const p = d[(ya * W + xa) * 3 + c] * (1 - fx) + d[(ya * W + xb) * 3 + c] * fx;
    const q = d[(yb * W + xa) * 3 + c] * (1 - fx) + d[(yb * W + xb) * 3 + c] * fx;
    out[o + c] = p * (1 - fy) + q * fy;
  }
}

/** The panorama cut to the pose: `pose.width` x `pose.height` RGB, the same camera frame as the game half. */
export function cutPerspective(img: Rgb8, frame: CameraFrame, convergenceDeg: number): Rgb8 {
  const W = frame.viewport.width, H = frame.viewport.height, out = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = toPanoDirection(rayFor(frame, x + 0.5, y + 0.5), convergenceDeg);
    const [u, v] = directionToPixel(d, img, 'centre');
    sample(img, u, v, out, (y * W + x) * 3);
  }
  return { width: W, height: H, data: out };
}

/** Bilinear RGB lookup in a perspective frame; false outside it. */
function sampleFrame(img: Rgb8, x: number, y: number, out: Uint8Array, o: number): boolean {
  if (x < 0 || y < 0 || x > img.width - 1 || y > img.height - 1) return false;
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(img.width - 1, x0 + 1), y1 = Math.min(img.height - 1, y0 + 1), fx = x - x0, fy = y - y0, d = img.data, W = img.width;
  for (let c = 0; c < 3; c++) {
    const p = d[(y0 * W + x0) * 3 + c] * (1 - fx) + d[(y0 * W + x1) * 3 + c] * fx;
    const q = d[(y1 * W + x0) * 3 + c] * (1 - fx) + d[(y1 * W + x1) * 3 + c] * fx;
    out[o + c] = p * (1 - fy) + q * fy;
  }
  return true;
}

/**
 * The wall rectified out of a perspective half (either one: they share the pose): `ppm` px per metre, u along the wall
 * from `a`, row 0 at `topM` over the ground. measureFacade's FacadeImage, with `valid` 0 where the wall falls off frame.
 */
export function rectifyFromFrame(img: Rgb8, frame: CameraFrame, pose: FramePose, wall: WallQuad, ppm = 25, topM = wall.heightM) {
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  const width = Math.max(1, Math.round(len * ppm)), height = Math.max(1, Math.round(topM * ppm));
  const rgb = new Uint8Array(width * height * 3), valid = new Uint8Array(width * height);
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const s = wallPoint(frame, pose, wall, (i + 0.5) / ppm, topM - (j + 0.5) / ppm);
    if (s.depth > 0 && sampleFrame(img, s.x, s.y, rgb, (j * width + i) * 3)) valid[j * width + i] = 255;
  }
  return { width, height, rgb, valid, ppm, topM };
}
