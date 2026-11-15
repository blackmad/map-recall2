/**
 * Browser frame vs node frame (lane node-world-frames): per-pixel CIE76 dE in Lab (D65), the sky silhouette IoU
 * (pixels within a dE of the clear colour are sky), and the edge IoU (Sobel magnitude over a threshold on L,
 * each edge map dilated by one pixel before the intersection so a one-pixel shift is not a miss). Pure.
 */
export type Rgba = { width: number; height: number; data: Uint8Array | Uint8ClampedArray; channels: number };
export type FrameDiff = { meanDE: number; p90DE: number; shareOver10: number; skyIoU: number; edgeIoU: number };

const lin = (c: number) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);

export function lab(r: number, g: number, b: number): [number, number, number] {
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labImage(img: Rgba): Float32Array {
  const n = img.width * img.height, out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const o = i * img.channels, l = lab(img.data[o], img.data[o + 1], img.data[o + 2]); out[i * 3] = l[0]; out[i * 3 + 1] = l[1]; out[i * 3 + 2] = l[2]; }
  return out;
}

function edges(L: Float32Array, w: number, h: number, threshold: number): Uint8Array {
  const e = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = (yy: number, xx: number) => L[((y + yy) * w + x + xx) * 3];
    const gx = p(-1, 1) + 2 * p(0, 1) + p(1, 1) - p(-1, -1) - 2 * p(0, -1) - p(1, -1);
    const gy = p(1, -1) + 2 * p(1, 0) + p(1, 1) - p(-1, -1) - 2 * p(-1, 0) - p(-1, 1);
    if (Math.hypot(gx, gy) > threshold) e[y * w + x] = 1;
  }
  return e;
}

function dilate(m: Uint8Array, w: number, h: number): Uint8Array {
  const o = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h) o[Y * w + X] = 1; }
  return o;
}

/** Both images the same size. `sky` the clear colour (sRGB bytes). */
export function compareFrames(a: Rgba, b: Rgba, sky: readonly [number, number, number] = [0x9e, 0xc3, 0xed], edgeThreshold = 40): FrameDiff {
  if (a.width !== b.width || a.height !== b.height) throw new Error(`size ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  const w = a.width, h = a.height, n = w * h, A = labImage(a), B = labImage(b), S = lab(...sky);
  const de = new Float32Array(n);
  let sum = 0, over = 0, inter = 0, union = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(A[i * 3] - B[i * 3], A[i * 3 + 1] - B[i * 3 + 1], A[i * 3 + 2] - B[i * 3 + 2]);
    de[i] = d; sum += d; if (d > 10) over++;
    const sa = Math.hypot(A[i * 3] - S[0], A[i * 3 + 1] - S[1], A[i * 3 + 2] - S[2]) < 3, sb = Math.hypot(B[i * 3] - S[0], B[i * 3 + 1] - S[1], B[i * 3 + 2] - S[2]) < 3;
    if (sa && sb) inter++; if (sa || sb) union++;
  }
  const ea = edges(A, w, h, edgeThreshold), eb = edges(B, w, h, edgeThreshold), da = dilate(ea, w, h), db = dilate(eb, w, h);
  let ei = 0, eu = 0;
  for (let i = 0; i < n; i++) { if ((ea[i] && db[i]) || (eb[i] && da[i])) ei++; if (ea[i] || eb[i]) eu++; }
  const sorted = Float32Array.from(de).sort();
  return { meanDE: sum / n, p90DE: sorted[Math.floor(n * 0.9)], shareOver10: over / n, skyIoU: union ? inter / union : 1, edgeIoU: eu ? ei / eu : 1 };
}
