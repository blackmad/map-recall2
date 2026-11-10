/**
 * Pure logic of the crop pipeline: quality flags, the one-place usability thresholds, the planStrip span cut, and the
 * grouping of collinear street-facing walls into block faces. No network, no disk: unit-tested in flags.test.ts.
 */
import type { Rd } from '../pand-reference/core.ts';

/** Every threshold that decides `usable`, in one place (docs/house-line.md section 4a lists the same numbers). */
export const THRESHOLDS = {
  /** share of invalid (behind the camera / off the panorama) pixels in the body band; auto-place.ts caps the strip void share at the same 0.35 */
  voidShare: 0.35,
  /** share of leaf-coloured pixels (isLeaf); auto-place.ts caps foliage at 0.3 */
  foliage: 0.3,
  /** H4c: HIGHLIGHT CLIPPING, the share of mid-wall pixels with a channel at 255 (CLIP_LEVEL in measure.ts); a blown-out sky, sheet or overexposed wall clips, a white-painted wall that is exposed correctly does not. Calibrated on the labels, see evaluate.ts --sweep */
  washedOut: 0.25,
  /** largest connected dark blob in the lower third (a PROXY for a parked van or scaffold; dark shopfront glass can also trip it) */
  occluderShare: 0.35,
  /** H4c: a crop is usable up to 55 degrees (select.ts FACADE_WINDOW); narrow Jordaan streets only have oblique views, and on the AB07 labels 35 -> 55 raised recall for good from 0.84 to 0.97 at the same precision */
  obliquityDeg: 55,
  fallbackObliquityDeg: 55,
  /** a view up to this angle is a straight one: the year picker ranks it first and wider angles take the planStrip route (a wall crop is stretched at a steep angle) */
  straightDeg: 35,
  cameraDistanceM: [5, 35] as const,
  /** H4b: the wall is at least this wide (slivers and single-window close-ups) */
  minWallM: 3.5,
  /** H4b: the valid rows, counted up from the ground, reach at least this share of the crop height (eaves included) */
  minHeightCover: 0.85,
  /** H4b: share of mid-crop pixels with a luma gradient over EDGE_GRADIENT; below it the crop is a blank wall (calibrated on labels, see evaluate.ts) */
  minEdgeDensity: 0.04,
  /** a wall under this falls back to planStrip (a narrow front is a few hundred pixels wide and a single parked car covers it) */
  narrowWallM: 4,
} as const;

export type CropFlags = {
  /** foliage share on the white-balanced leaf test (a1's stripWhiteBalance.ts); foliagePlain is the unbalanced isLeaf share */
  foliage: number; foliagePlain: number; wbApplied: boolean;
  washedOut: number; /** H4c remeasure: the pre-H4c brightness measure, kept for the sweep */ washedBrightness?: number; missing: number; voidShare: number; occluderShare: number;
  obliquity: number; cameraDistance: number;
  /** the camera ray to the wall centre crosses another BAG footprint (alley / neighbour case) */
  rayBlocked: boolean;
  wallWidthM: number; heightCover: number; edgeDensity: number; seamStep: number;
  /** the crop came from the planStrip route (the seam check applies) */
  strip: boolean;
};
export type Usability = { usable: boolean; reasons: string[] };

/** `reasons` names every threshold the flags break, in a fixed order (the report counts the first as the primary reason). */
export function usability(f: CropFlags, t: typeof THRESHOLDS = THRESHOLDS): Usability {
  const reasons: string[] = [];
  if (f.voidShare > t.voidShare) reasons.push('void');
  if (f.foliage > t.foliage) reasons.push('foliage');
  if (f.washedOut > t.washedOut) reasons.push('washed-out');
  if (f.occluderShare > t.occluderShare) reasons.push('occluder');
  if (f.obliquity > t.obliquityDeg) reasons.push('oblique');
  if (f.cameraDistance < t.cameraDistanceM[0] || f.cameraDistance > t.cameraDistanceM[1]) reasons.push('distance');
  if (f.rayBlocked) reasons.push('blocked');
  if (f.wallWidthM < t.minWallM) reasons.push('narrow');
  if (f.heightCover < t.minHeightCover) reasons.push('short');
  if (f.edgeDensity < t.minEdgeDensity) reasons.push('blank');
  // seamStep is recorded but not a gate: on the AB07 labels a luma step does not separate good from bad strip crops (evaluate.ts)
  return { usable: reasons.length === 0, reasons };
}

/**
 * H4c: the reasons that are geometry and content facts about the crop (wrong wall, sliver, blank, off-panorama, too oblique or
 * too far): they stay hard gates. foliage, washed-out and occluder are pixel PROXIES for "something hides the front"; the Jev
 * judge (judge.ts) replaces them as the picker, and they remain as `usable` for crops that were never judged.
 */
export const HARD_REASONS = ['void', 'oblique', 'distance', 'blocked', 'narrow', 'short', 'blank'] as const;
export const hardPass = (reasons: string[]): boolean => !reasons.some(r => (HARD_REASONS as readonly string[]).includes(r));
/** The deployed judge threshold on `quality`. In-sample on the 150 labels: 0.3 gives precision 0.907, 0.35 gives 0.889, 0.4 gives 0.941 (recall 0.50); 0.4 is the lowest round value with a margin over the 0.9 gate (split-half thresholds ranged 0.285-0.367, so the held-out precision is lower: docs section 4a). */
export const JUDGE_GOOD = 0.4;
/** H4c decision: passes the hard flags and the judge score reaches `threshold`. */
export const judgedGood = (reasons: string[], score: number | undefined, threshold: number): boolean => hardPass(reasons) && score !== undefined && score >= threshold;

/** Sum of how far each flag exceeds its cap (0 = within all caps): picks the better of two attempts when neither is usable. */
export function penalty(f: CropFlags, t: typeof THRESHOLDS = THRESHOLDS): number {
  const over = (v: number, cap: number) => Math.max(0, v - cap) / cap;
  return over(f.voidShare, t.voidShare) + over(f.foliage, t.foliage) + over(f.washedOut, t.washedOut) + over(f.occluderShare, t.occluderShare);
}

/** Share of crop-wide pixels that are invalid (alpha 0) in the body band: rows 10 % .. 90 % of the crop height. */
export function voidShare(alpha: Uint8Array, width: number, height: number): number {
  const y0 = Math.floor(height * 0.1), y1 = Math.floor(height * 0.9);
  let bad = 0, n = 0;
  for (let y = y0; y < y1; y += 2) for (let x = 0; x < width; x += 2) { n++; if (alpha[y * width + x] !== 255) bad++; }
  return n ? bad / n : 1;
}

/**
 * Van / scaffold PROXY: the largest 4-connected blob of dark pixels (luma < 50) in the lower third of the crop, as a
 * share of the lower third's valid pixels, measured on a 4x downsampled grid. Dark shopfront glass is dark too, so
 * this over-flags glazed ground floors; it is a cheap screen, not a detector.
 */
export function occluderShare(rgba: Uint8ClampedArray | Uint8Array, alpha: Uint8Array, width: number, height: number, lumaMax = 50): number {
  const step = 4, gw = Math.floor(width / step), top = Math.floor(height * 2 / 3), gh = Math.floor((height - top) / step);
  if (gw < 2 || gh < 2) return 0;
  const dark = new Uint8Array(gw * gh), valid = new Uint8Array(gw * gh);
  let nValid = 0;
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const px = gx * step + 2, py = top + gy * step + 2, p = py * width + px;
    if (alpha[p] !== 255) continue;
    valid[gy * gw + gx] = 1; nValid++;
    const i = p * 4;
    if (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2] < lumaMax) dark[gy * gw + gx] = 1;
  }
  if (!nValid) return 0;
  let best = 0;
  const stack: number[] = [];
  for (let s = 0; s < dark.length; s++) {
    if (dark[s] !== 1) continue;
    let size = 0; dark[s] = 2; stack.push(s);
    while (stack.length) {
      const c = stack.pop()!, cx = c % gw, cy = (c / gw) | 0; size++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const n = ny * gw + nx;
        if (dark[n] === 1) { dark[n] = 2; stack.push(n); }
      }
    }
    if (size > best) best = size;
  }
  return best / nValid;
}

// ---- planStrip span cut ---------------------------------------------------------------

/** Pixel columns [left, right) of a span [x0M, x1M] in a strip that starts at `stripX0M`, at `ppm` pixels per metre (intake.ts: left = round((x0-X0)*ppm), width = round((x1-x0)*ppm)). */
export function spanPixels(x0M: number, x1M: number, stripX0M: number, ppm: number): [number, number] {
  const left = Math.round((x0M - stripX0M) * ppm);
  return [left, left + Math.round((x1M - x0M) * ppm)];
}

/** Cut the columns `px` out of an RGBA strip; columns outside the strip come back mid-grey with alpha 0. */
export function cutSpan(strip: Uint8ClampedArray, width: number, height: number, px: [number, number]): { data: Uint8ClampedArray; width: number; height: number } {
  const w = Math.max(0, px[1] - px[0]), data = new Uint8ClampedArray(w * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < w; x++) {
    const sx = px[0] + x, d = (y * w + x) * 4;
    if (sx < 0 || sx >= width) { data[d] = data[d + 1] = data[d + 2] = 128; continue; }
    const s = (y * width + sx) * 4;
    data[d] = strip[s]; data[d + 1] = strip[s + 1]; data[d + 2] = strip[s + 2]; data[d + 3] = strip[s + 3];
  }
  return { data, width: w, height };
}

// ---- block faces ----------------------------------------------------------------------

export type WallRef = { id: string; a: Rd; b: Rd; nx: number; ny: number };
const mid = (w: WallRef): Rd => ({ x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 });

/** Two walls belong to one face: same outward side, near-parallel (< 8 deg), on one line (< 1.5 m off) and touching or < 2 m apart along it. */
export function sameFace(p: WallRef, q: WallRef): boolean {
  if (p.nx * q.nx + p.ny * q.ny < Math.cos(8 * Math.PI / 180)) return false;
  const ux = -p.ny, uy = p.nx; // direction of p (a -> b): outward normal = (dy, -dx)/len
  const off = Math.abs((mid(q).x - mid(p).x) * p.nx + (mid(q).y - mid(p).y) * p.ny);
  if (off > 1.5) return false;
  const along = (r: Rd) => (r.x - mid(p).x) * ux + (r.y - mid(p).y) * uy;
  const [p0, p1] = [along(p.a), along(p.b)].sort((x, y) => x - y), [q0, q1] = [along(q.a), along(q.b)].sort((x, y) => x - y);
  return Math.max(p0, q0) - Math.min(p1, q1) < 2;
}

/** Group walls into faces (transitive `sameFace`), each ordered left to right along the face as seen from the street. Deterministic. */
export function groupFaces(walls: WallRef[]): WallRef[][] {
  const parent = walls.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < walls.length; i++) for (let j = i + 1; j < walls.length; j++) if (sameFace(walls[i], walls[j])) parent[find(j)] = find(i);
  const groups = new Map<number, WallRef[]>();
  walls.forEach((w, i) => { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), w]); });
  return [...groups.values()].map(g => {
    const ux = -g[0].ny, uy = g[0].nx;
    return g.sort((p, q) => (mid(p).x * ux + mid(p).y * uy) - (mid(q).x * ux + mid(q).y * uy) || p.id.localeCompare(q.id));
  }).sort((p, q) => p[0].id.localeCompare(q[0].id));
}

// ---- wall-choice: camera ray against other footprints ---------------------------------------------

const cross = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
function segHit(p: Rd, q: Rd, a: Rd, b: Rd) {
  const d1 = cross(p.x, p.y, q.x, q.y, a.x, a.y), d2 = cross(p.x, p.y, q.x, q.y, b.x, b.y), d3 = cross(a.x, a.y, b.x, b.y, p.x, p.y), d4 = cross(a.x, a.y, b.x, b.y, q.x, q.y);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
/** The segment p-q crosses an edge of one of the rings (a camera ray through a neighbouring building). */
export function segmentHitsRings(p: Rd, q: Rd, rings: Rd[][]): boolean {
  const x0 = Math.min(p.x, q.x), x1 = Math.max(p.x, q.x), y0 = Math.min(p.y, q.y), y1 = Math.max(p.y, q.y);
  for (const ring of rings) {
    if (Math.max(...ring.map(r => r.x)) < x0 || Math.min(...ring.map(r => r.x)) > x1 || Math.max(...ring.map(r => r.y)) < y0 || Math.min(...ring.map(r => r.y)) > y1) continue;
    for (let i = 0; i + 1 < ring.length; i++) if (segHit(p, q, ring[i], ring[i + 1])) return true;
  }
  return false;
}
/** Is the view from `camera` to the wall centre (stepped 0.5 m outward so the wall itself is not hit) blocked by one of `others`? */
export function rayBlocked(camera: Rd, wallMid: Rd, normal: [number, number], others: Rd[][]): boolean {
  return segmentHitsRings(camera, { x: wallMid.x + normal[0] * 0.5, y: wallMid.y + normal[1] * 0.5 }, others);
}

// ---- disk rule (H4c) -------------------------------------------------------------------------------

/** A crops run must leave at least this much free (docs/house-line.md section 4a). */
export const DISK_FLOOR_BYTES = 15 * 1024 ** 3;
/** Bytes one request of the panorama API adds to the cache on average (AB07: 3.8 GB over 1,719 requests, mostly 8k equirectangular JPEGs). */
export const BYTES_PER_REQUEST = 2.3e6;
/** Refuse to start when the free space minus the run's estimated downloads is under the floor. */
export function diskGate(freeBytes: number, estimatedRequests: number, floor = DISK_FLOOR_BYTES): { ok: boolean; afterBytes: number; estimatedBytes: number } {
  const estimatedBytes = Math.round(estimatedRequests * BYTES_PER_REQUEST);
  return { ok: freeBytes - estimatedBytes >= floor, afterBytes: freeBytes - estimatedBytes, estimatedBytes };
}
