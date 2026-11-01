// The chase-frame busyness probe (#161 design note, "make the chase-cam frame less busy"): per horizontal third of
// a frame (top = far, bottom = near in the chase view), the Sobel edge energy (mean gradient magnitude of the sRGB
// luma, 0..255 scale) and the colour variance (mean squared distance of each pixel's RGB from its third's mean).
// Acceptance for a calming lever: the far third at most ~50 % of the near third, the near third unchanged within noise.

export type ThirdBusyness = { edge: number; variance: number };
export type FrameBusyness = { far: ThirdBusyness; mid: ThirdBusyness; near: ThirdBusyness; farOverNear: { edge: number; variance: number } };

/** `data` RGB(A) bytes, `channels` 3 or 4, row-major from the top. */
export function frameBusyness(data: ArrayLike<number>, width: number, height: number, channels: number): FrameBusyness {
  const luma = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) luma[i] = 0.2126 * data[i * channels] + 0.7152 * data[i * channels + 1] + 0.0722 * data[i * channels + 2];
  const third = (y0: number, y1: number): ThirdBusyness => {
    let edge = 0, n = 0;
    for (let y = Math.max(1, y0); y < Math.min(height - 1, y1); y++) for (let x = 1; x < width - 1; x++) {
      const i = y * width + x, L = (dx: number, dy: number) => luma[i + dy * width + dx];
      const gx = L(1, -1) + 2 * L(1, 0) + L(1, 1) - L(-1, -1) - 2 * L(-1, 0) - L(-1, 1);
      const gy = L(-1, 1) + 2 * L(0, 1) + L(1, 1) - L(-1, -1) - 2 * L(0, -1) - L(1, -1);
      edge += Math.hypot(gx, gy) / 4; n++;
    }
    const mean = [0, 0, 0]; let m = 0;
    for (let y = y0; y < y1; y++) for (let x = 0; x < width; x++) { const o = (y * width + x) * channels; for (let k = 0; k < 3; k++) mean[k] += data[o + k]; m++; }
    for (let k = 0; k < 3; k++) mean[k] /= Math.max(1, m);
    let variance = 0;
    for (let y = y0; y < y1; y++) for (let x = 0; x < width; x++) { const o = (y * width + x) * channels; for (let k = 0; k < 3; k++) variance += (data[o + k] - mean[k]) ** 2; }
    return { edge: edge / Math.max(1, n), variance: variance / Math.max(1, m) };
  };
  const h3 = Math.floor(height / 3);
  const far = third(0, h3), mid = third(h3, 2 * h3), near = third(2 * h3, height);
  return { far, mid, near, farOverNear: { edge: far.edge / Math.max(1e-9, near.edge), variance: far.variance / Math.max(1e-9, near.variance) } };
}
