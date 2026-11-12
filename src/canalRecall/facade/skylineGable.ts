/**
 * F3 (#381): a gable-shape reading from the skyline of a rectified facade crop. The photo judges are no better than the register for the gable
 * (J3: Jev 0.68, crown-only crop 0.48, register 0.60 on 50 hand-read fronts), so this reads the one thing a model sees badly and a profile
 * shows plainly: the outline of the building against the sky. `skyline` finds, per column, the first solid (non-sky) row, `classifySkyline`
 * reads the profile as cornice | plain | step | neck | bell, or null (no sky in the crop, a ragged profile). `agreeGable` stores a gable only
 * when two of register, Jev and skyline agree. Pure; scored on the hand set by scripts/house-crops/f3/score-gable.mjs.
 */
export type RgbCrop = {width: number; height: number; rgb: Uint8Array; ppm: number};
export type GableClass = 'cornice' | 'plain' | 'step' | 'neck' | 'bell';

const lum = (c: RgbCrop, p: number) => 0.299 * c.rgb[p * 3] + 0.587 * c.rgb[p * 3 + 1] + 0.114 * c.rgb[p * 3 + 2];
/** Sky: light, low-gradient and blue-white or grey (not a pale wall: those have texture). */
function skyMask(c: RgbCrop): Uint8Array {
  const {width: W, height: H} = c, m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, L = lum(c, p), r = c.rgb[p * 3], b = c.rgb[p * 3 + 2];
    const gx = x + 1 < W ? Math.abs(L - lum(c, p + 1)) : 0, gy = y + 1 < H ? Math.abs(L - lum(c, p + W)) : 0;
    if (L >= 150 && gx + gy < 14 && b >= r - 12) m[p] = 1;
  }
  return m;
}

/** Height (m above the crop bottom) of the first solid row of each column, `null` where the column is sky all the way or has no sky above the building. */
export function skyline(c: RgbCrop, minSolidPx = 6): {top: (number | null)[]; skyShare: number} {
  const {width: W, height: H} = c, sky = skyMask(c), top: (number | null)[] = [];
  let skyCols = 0;
  for (let x = 0; x < W; x++) {
    let run = 0, first = -1;
    for (let y = 0; y < H; y++) { if (!sky[y * W + x]) { run++; if (run >= minSolidPx) { first = y - minSolidPx + 1; break; } } else run = 0; }
    if (first < 0) top.push(null); else if (first < 2) top.push(null); else { top.push((H - first) / c.ppm); skyCols++; }
  }
  return {top, skyShare: skyCols / W};
}

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const N = 32;
/** Idealised outlines on [0, 1] x [0, 1] (1 = the apex), symmetric: what each gable family looks like against the sky. */
export const TEMPLATES: Record<Exclude<GableClass, 'cornice'>, number[]> = (() => {
  const xs = Array.from({length: N}, (_, i) => (i + 0.5) / N), d = (x: number) => Math.abs(2 * x - 1); // 0 at the centre, 1 at the sides
  return {
    plain: xs.map(x => 1 - 0.85 * d(x)),
    step: xs.map(x => 1 - 0.85 * Math.min(1, Math.ceil(d(x) * 3) / 3)),
    neck: xs.map(x => (d(x) < 0.32 ? 1 : 0.42 - 0.35 * (d(x) - 0.32) / 0.68)),
    bell: xs.map(x => 0.12 + 0.88 * (0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, d(x) * 1.15)))),
  };
})();
export type SkylineRead = {cls: GableClass | null; why: string; rangeM: number; features: Record<string, number>};
/** The apex-centred outline: the gable is the raised part of the front, so the profile is cut at the apex's side and mirrored by the mean of both flanks. */
export function classifySkyline(c: RgbCrop): SkylineRead {
  const {top, skyShare} = skyline(c), W = top.length, trim = Math.round(W * 0.05), mid = top.slice(trim, W - trim);
  if (skyShare < 0.6 || mid.filter(v => v === null).length > mid.length * 0.25) return {cls: null, why: 'no sky above the front', rangeM: 0, features: {skyShare}};
  let last = median(mid.filter((v): v is number => v !== null));
  const filled = mid.map(v => (v === null ? last : (last = v)));
  const k = Math.max(2, Math.round(0.12 * c.ppm)), prof = filled.map((_, i) => median(filled.slice(Math.max(0, i - k), i + k + 1)));
  const lo = Math.min(...prof), hi = Math.max(...prof), range = hi - lo, n = prof.length, features: Record<string, number> = {skyShare, range, widthM: n / c.ppm};
  // a front that reaches the crop's top edge has its crown cut off: no reading
  if (top.some((v, x) => v !== null && x >= trim && x < W - trim && v * c.ppm >= c.height - 3)) return {cls: null, why: 'crown cut by the crop', rangeM: range, features};
  if (range < 1.5) return {cls: 'cornice', why: 'flat top', rangeM: range, features};
  const norm = Array.from({length: N}, (_, i) => { const a = Math.floor(i / N * n), b = Math.max(a + 1, Math.floor((i + 1) / N * n)); return (median(prof.slice(a, b)) - lo) / range; });
  if (norm.filter(v => v > 0.85).length >= N * 0.7) return {cls: 'cornice', why: 'broad top', rangeM: range, features};
  let best: GableClass | null = null, bd = Infinity; const dist: Record<string, number> = {};
  for (const [cls, t] of Object.entries(TEMPLATES)) {
    // the template is symmetric, the facade's apex is not always central: try the template against the profile and its mirror image, keep the better
    const d1 = norm.reduce((s, v, i) => s + Math.abs(v - t[i]), 0) / N, d2 = norm.reduce((s, v, i) => s + Math.abs(v - t[N - 1 - i]), 0) / N, dd = Math.min(d1, d2);
    dist[cls] = +dd.toFixed(3); if (dd < bd) { bd = dd; best = cls as GableClass; }
  }
  Object.assign(features, dist, {bestDist: bd});
  if (bd > 0.3) return {cls: null, why: `no template within 0.3 (best ${best} ${bd.toFixed(2)})`, rangeM: range, features};
  return {cls: best, why: `template distance ${bd.toFixed(2)}`, rangeM: range, features};
}

/** Store a gable only when two of the three sources name the same class (null = a source that abstains). */
export function agreeGable(register: string | null | undefined, jev: string | null | undefined, skylineCls: string | null | undefined): string | null {
  const v = [register, jev, skylineCls].filter((x): x is string => !!x), count = new Map<string, number>();
  for (const x of v) count.set(x, (count.get(x) ?? 0) + 1);
  for (const [k, n] of count) if (n >= 2) return k;
  return null;
}
