// The chase-frame busyness probe (#161 design note, "make the chase-cam frame less busy"): per horizontal third of
// a frame (top = far, bottom = near in the chase view), the Sobel edge energy (mean gradient magnitude of the sRGB
// luma, 0..255 scale) and the colour variance (mean squared distance of each pixel's RGB from its third's mean).
// Acceptance for a calming lever: the far third at most ~50 % of the near third, the near third unchanged within noise.
// `chroma` is the same Sobel on OKLab a/b (the gradient magnitude of the a and b channels together, x255 so it reads on
// the luma's scale): colour noise a luma probe misses, such as far red cycle strands on grey asphalt (#161 review).

export type ThirdBusyness = { edge: number; variance: number; chroma: number };
export type FrameBusyness = { far: ThirdBusyness; mid: ThirdBusyness; near: ThirdBusyness; farOverNear: { edge: number; variance: number; chroma: number } };

/** `data` RGB(A) bytes, `channels` 3 or 4, row-major from the top. */
export function frameBusyness(data: ArrayLike<number>, width: number, height: number, channels: number): FrameBusyness {
  const luma = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) luma[i] = 0.2126 * data[i * channels] + 0.7152 * data[i * channels + 1] + 0.0722 * data[i * channels + 2];
  const oa = new Float32Array(width * height), ob = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) { const [, a, b] = oklabOf(data[i * channels], data[i * channels + 1], data[i * channels + 2]); oa[i] = a; ob[i] = b; }
  const sobel = (c: Float32Array, i: number): [number, number] => {
    const L = (dx: number, dy: number) => c[i + dy * width + dx];
    return [L(1, -1) + 2 * L(1, 0) + L(1, 1) - L(-1, -1) - 2 * L(-1, 0) - L(-1, 1), L(-1, 1) + 2 * L(0, 1) + L(1, 1) - L(-1, -1) - 2 * L(0, -1) - L(1, -1)];
  };
  const third = (y0: number, y1: number): ThirdBusyness => {
    let edge = 0, chroma = 0, n = 0;
    for (let y = Math.max(1, y0); y < Math.min(height - 1, y1); y++) for (let x = 1; x < width - 1; x++) {
      const i = y * width + x, L = (dx: number, dy: number) => luma[i + dy * width + dx];
      const gx = L(1, -1) + 2 * L(1, 0) + L(1, 1) - L(-1, -1) - 2 * L(-1, 0) - L(-1, 1);
      const gy = L(-1, 1) + 2 * L(0, 1) + L(1, 1) - L(-1, -1) - 2 * L(0, -1) - L(1, -1);
      edge += Math.hypot(gx, gy) / 4; n++;
      const [ax, ay] = sobel(oa, i), [bx, by] = sobel(ob, i);
      chroma += Math.hypot(ax, ay, bx, by) * 255 / 4;
    }
    const mean = [0, 0, 0]; let m = 0;
    for (let y = y0; y < y1; y++) for (let x = 0; x < width; x++) { const o = (y * width + x) * channels; for (let k = 0; k < 3; k++) mean[k] += data[o + k]; m++; }
    for (let k = 0; k < 3; k++) mean[k] /= Math.max(1, m);
    let variance = 0;
    for (let y = y0; y < y1; y++) for (let x = 0; x < width; x++) { const o = (y * width + x) * channels; for (let k = 0; k < 3; k++) variance += (data[o + k] - mean[k]) ** 2; }
    return { edge: edge / Math.max(1, n), variance: variance / Math.max(1, m), chroma: chroma / Math.max(1, n) };
  };
  const h3 = Math.floor(height / 3);
  const far = third(0, h3), mid = third(h3, 2 * h3), near = third(2 * h3, height);
  return { far, mid, near, farOverNear: { edge: far.edge / Math.max(1e-9, near.edge), variance: far.variance / Math.max(1e-9, near.variance), chroma: far.chroma / Math.max(1e-9, near.chroma) } };
}

const lin = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
/** OKLab of an sRGB byte colour (Ottosson 2020). */
export function oklabOf(r8: number, g8: number, b8: number): [number, number, number] {
  const r = lin(r8), g = lin(g8), b = lin(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
