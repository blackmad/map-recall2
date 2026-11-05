// Window sharpness of a frozen frame (lane R1-B #224, "windows and trim look fuzzy", user shot at Da Costakade): the
// same shape as look/busyness.ts, measured inside a rectangle that holds the facade band (the walls with their
// window grid, no sky, no street). Three numbers on the sRGB luma (0..255):
//   laplacianVar  variance of the 4-neighbour Laplacian: high-frequency energy, the classic focus measure;
//   edge          mean Sobel magnitude /4 (as busyness.ts): how much edge there is;
//   acutance      mean Sobel magnitude /4 of the strongest 10 % of pixels: how hard the edges that exist are, so a
//                 frame with fewer but crisper window frames still scores higher (softening lowers it even when the
//                 window count is the same).
// Report only; no gate yet (brief). A sharper frame raises all three; noise (sparkle) raises laplacianVar alone, so
// read them together, and against the busyness probe's far/near if the far third gets busier.

export type Rect = { x0: number; y0: number; x1: number; y1: number };
export type FrameSharpness = { laplacianVar: number; edge: number; acutance: number; pixels: number };

/** `data` RGB(A) bytes, row-major from the top; `rect` in fractions of the frame (default: the whole frame). */
export function frameSharpness(data: ArrayLike<number>, width: number, height: number, channels: number, rect: Rect = { x0: 0, y0: 0, x1: 1, y1: 1 }): FrameSharpness {
  const X0 = Math.max(1, Math.floor(rect.x0 * width)), X1 = Math.min(width - 1, Math.ceil(rect.x1 * width));
  const Y0 = Math.max(1, Math.floor(rect.y0 * height)), Y1 = Math.min(height - 1, Math.ceil(rect.y1 * height));
  const luma = (x: number, y: number) => { const o = (y * width + x) * channels; return 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]; };
  let n = 0, sum = 0, sum2 = 0, edge = 0;
  const grads: number[] = [];
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
    const c = luma(x, y);
    const lap = luma(x - 1, y) + luma(x + 1, y) + luma(x, y - 1) + luma(x, y + 1) - 4 * c;
    sum += lap; sum2 += lap * lap;
    const gx = luma(x + 1, y - 1) + 2 * luma(x + 1, y) + luma(x + 1, y + 1) - luma(x - 1, y - 1) - 2 * luma(x - 1, y) - luma(x - 1, y + 1);
    const gy = luma(x - 1, y + 1) + 2 * luma(x, y + 1) + luma(x + 1, y + 1) - luma(x - 1, y - 1) - 2 * luma(x, y - 1) - luma(x + 1, y - 1);
    const g = Math.hypot(gx, gy) / 4;
    edge += g; grads.push(g); n++;
  }
  if (!n) return { laplacianVar: 0, edge: 0, acutance: 0, pixels: 0 };
  grads.sort((a, b) => b - a);
  const top = Math.max(1, Math.floor(n * 0.1));
  let acc = 0;
  for (let i = 0; i < top; i++) acc += grads[i];
  const mean = sum / n;
  return { laplacianVar: sum2 / n - mean * mean, edge: edge / n, acutance: acc / top, pixels: n };
}
