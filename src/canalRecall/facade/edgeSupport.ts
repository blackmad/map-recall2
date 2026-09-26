/** Edge support along projected lines, for automatic panorama alignment.
 *
 * Pure pixel math over a single-channel image, so it can be unit-tested with a
 * synthetic image and reused by the boresight estimator without pulling in an
 * image decoder. Gradients are split by orientation: a building corner is a
 * vertical edge, so its evidence is the horizontal gradient only. Using the
 * orientation-blind magnitude let the search latch onto window sills and other
 * horizontal clutter. The panorama wraps horizontally, so sampling wraps in x
 * and clamps in y.
 */

export interface GrayImage { data: Uint8Array; width: number; height: number }
export interface EdgeMaps { gx: Float32Array; gy: Float32Array; width: number; height: number }
export type Orientation = 'vertical' | 'horizontal' | 'any';

/** Absolute Sobel components. gx responds to vertical edges, gy to horizontal. */
export function edgeMaps(image: GrayImage): EdgeMaps {
  const { data, width, height } = image;
  const gx = new Float32Array(width * height);
  const gy = new Float32Array(width * height);
  const at = (x: number, y: number) => {
    const wrappedX = ((x % width) + width) % width;
    const clampedY = Math.max(0, Math.min(height - 1, y));
    return data[clampedY * width + wrappedX];
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)
        + at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
      const sy = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)
        + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
      gx[y * width + x] = Math.abs(sx) / 4;
      gy[y * width + x] = Math.abs(sy) / 4;
    }
  }
  return { gx, gy, width, height };
}

/** Orientation-blind magnitude, kept for callers that do not care. */
export function gradientMagnitude(image: GrayImage): Float32Array {
  const { gx, gy } = edgeMaps(image);
  const out = new Float32Array(gx.length);
  for (let i = 0; i < gx.length; i++) out[i] = Math.hypot(gx[i], gy[i]);
  return out;
}

const sample = (map: Float32Array, width: number, height: number, x: number, y: number): number => {
  const wrappedX = ((Math.round(x) % width) + width) % width;
  const clampedY = Math.max(0, Math.min(height - 1, Math.round(y)));
  return map[clampedY * width + wrappedX];
};

/**
 * Mean edge response along a segment, taking the strongest value in a
 * perpendicular band at each sample. Robust to a line being a pixel or two off,
 * which is the tolerance a boresight search needs.
 */
export function segmentSupport(
  maps: EdgeMaps,
  a: [number, number],
  b: [number, number],
  orientation: Orientation = 'any',
  bandPx = 2,
): number {
  const map = orientation === 'vertical' ? maps.gx : orientation === 'horizontal' ? maps.gy : null;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const steps = Math.max(2, Math.ceil(length));
  const nx = length > 0 ? -(b[1] - a[1]) / length : 0;
  const ny = length > 0 ? (b[0] - a[0]) / length : 0;
  let total = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = a[0] + (b[0] - a[0]) * t;
    const py = a[1] + (b[1] - a[1]) * t;
    let best = 0;
    for (let offset = -bandPx; offset <= bandPx; offset++) {
      const x = px + nx * offset, y = py + ny * offset;
      const value = map
        ? sample(map, maps.width, maps.height, x, y)
        : Math.hypot(sample(maps.gx, maps.width, maps.height, x, y), sample(maps.gy, maps.width, maps.height, x, y));
      if (value > best) best = value;
    }
    total += best;
  }
  return total / (steps + 1);
}
