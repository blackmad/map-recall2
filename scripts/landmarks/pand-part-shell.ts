/**
 * A split landmark's share of its 3DBAG shell (src/canalRecall/landmarks/pandParts.ts).
 *
 * bag-shell-prepare.ts writes the whole pand's LoD2.2 shell. A landmark standing on part of the pand keeps only its share:
 * `clipShell` clips every face to the declared ring and closes the cut with party walls under the clipped roof edges.
 * `inPart` (face centre inside the ring) and `cutSegments` (the cut line in plan) serve the builder's own geometry.
 * Native frame as bag-shell-prepare: x east, z south, metres from anchorRD; y up from the 3DBAG ground.
 */
import polygonClipping from 'polygon-clipping';
import {lngLatToRd, rdToLngLat} from '../../src/canalRecall/facade/rdNew';
import {clipToParts, type LngLat, type PandPart} from '../../src/canalRecall/landmarks/pandParts';
import type {Surface} from './worship-shell';

export type PartSource = {anchorRD: [number, number]; nativeRing: number[][]; surfaces: Surface[]};

export const nativeToLngLat = (src: PartSource, x: number, z: number): LngLat => rdToLngLat({x: src.anchorRD[0] + x, y: src.anchorRD[1] - z});
export const lngLatToNative = (src: PartSource, p: LngLat): [number, number] => { const rd = lngLatToRd(p); return [rd.x - src.anchorRD[0], src.anchorRD[1] - rd.y]; };

const inRing = (p: [number, number], ring: readonly [number, number][]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > p[1]) !== (zj > p[1]) && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};

/** The declared ring in the native frame. */
export const partRingNative = (src: PartSource, part: PandPart): [number, number][] => part.ring.map(p => lngLatToNative(src, p));

/** Whether a shell face belongs to the part (its vertex centre inside the ring). */
export function inPart(src: PartSource, part: PandPart): (s: Surface) => boolean {
  const ring = partRingNative(src, part);
  return s => {
    const pts = s.rings[0];
    const c: [number, number] = [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[2], 0) / pts.length];
    return inRing(c, ring);
  };
}

/** The pand outline clipped to the part, in the native frame (x, z), open ring. */
export function clippedOutline(src: PartSource, part: PandPart): [number, number][] {
  const ll = clipToParts([src.nativeRing.map(([x, z]) => nativeToLngLat(src, x, z))], [part])[0] ?? [];
  const out = ll.map(p => lngLatToNative(src, p));
  if (out.length > 1 && out[0][0] === out.at(-1)![0] && out[0][1] === out.at(-1)![1]) out.pop();
  return out;
}

/**
 * Segments of the clipped outline that are the cut line, not the pand's own walls: an edge whose midpoint lies more
 * than `tolM` from every edge of the native ring.
 */
export function cutSegments(src: PartSource, part: PandPart, tolM = 0.3): Array<[[number, number], [number, number]]> {
  const outline = clippedOutline(src, part), ring = src.nativeRing;
  const distToSeg = (p: [number, number], a: number[], b: number[]) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-9;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
  };
  const out: Array<[[number, number], [number, number]]> = [];
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length];
    const m: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const near = ring.some((p, k) => distToSeg(m, p, ring[(k + 1) % ring.length]) < tolM);
    if (!near && Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.2) out.push([a, b]);
  });
  return out;
}

type V3 = [number, number, number];
const EPS = 1e-6;
const newell = (pts: number[][]): V3 => {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], c = pts[(i + 1) % pts.length];
    nx += (a[1] - c[1]) * (a[2] + c[2]); ny += (a[2] - c[2]) * (a[0] + c[0]); nz += (a[0] - c[0]) * (a[1] + c[1]);
  }
  return [nx, ny, nz];
};
/** Rings wound so their normal agrees with `want` (the clip loses the source face's winding). */
const facing = (rings: number[][][], want: V3): number[][][] => {
  const n = newell(rings[0]);
  return n[0] * want[0] + n[1] * want[1] + n[2] * want[2] >= 0 ? rings : rings.map(r => [...r].reverse());
};

/** Plane through a face (least-squares normal by Newell): y at (x, z), or null for a vertical face. */
function planeY(pts: number[][]): ((x: number, z: number) => number) | null {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], c = pts[(i + 1) % pts.length];
    nx += (a[1] - c[1]) * (a[2] + c[2]); ny += (a[2] - c[2]) * (a[0] + c[0]); nz += (a[0] - c[0]) * (a[1] + c[1]);
  }
  const L = Math.hypot(nx, ny, nz) || 1;
  if (Math.abs(ny / L) < 0.05) return null;
  const p = pts[0];
  return (x, z) => p[1] - (nx * (x - p[0]) + nz * (z - p[2])) / ny;
}

/** Parameter intervals of segment a->c (plan) inside the ring. */
function insideIntervals(a: number[], c: number[], ring: readonly [number, number][]): Array<[number, number]> {
  const ts = [0, 1];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    const dx = c[0] - a[0], dz = c[1] - a[1], ex = q[0] - p[0], ez = q[1] - p[1];
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < EPS) continue;
    const t = ((p[0] - a[0]) * ez - (p[1] - a[1]) * ex) / den, u = ((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / den;
    if (t > EPS && t < 1 - EPS && u >= -EPS && u <= 1 + EPS) ts.push(t);
  }
  ts.sort((x, y) => x - y);
  const out: Array<[number, number]> = [];
  for (let i = 0; i + 1 < ts.length; i++) {
    const m = (ts[i] + ts[i + 1]) / 2;
    if (ts[i + 1] - ts[i] > EPS && inRing([a[0] + (c[0] - a[0]) * m, a[1] + (c[1] - a[1]) * m], ring)) out.push([ts[i], ts[i + 1]]);
  }
  return out;
}

/**
 * The part's own shell, watertight along the cut: roof faces clipped to the ring in plan (y from each face's plane),
 * vertical faces clipped to the ring along their run, and a party wall under every roof edge the clip made, down to
 * the ground. Ground faces are left out, as addShell does.
 */
export function clipShell(src: PartSource, part: PandPart): Surface[] {
  const ring = partRingNative(src, part);
  const cutPoly = [[...ring, ring[0]].map(([x, z]) => [x, z] as [number, number])];
  const out: Surface[] = [];
  const onBoundary = (p: number[], pts: number[][]) => pts.some((a, i) => {
    const c = pts[(i + 1) % pts.length], dx = c[0] - a[0], dz = c[2] - a[2], L2 = dx * dx + dz * dz;
    if (L2 < EPS) return false;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / L2));
    return Math.hypot(p[0] - a[0] - t * dx, p[2] - a[2] - t * dz) < 0.01;
  });
  for (const s of src.surfaces) {
    if (s.type === 'GroundSurface') continue;
    const pts = s.rings[0];
    const y = planeY(pts);
    if (y) {
      const plan = s.rings.map(r => r.map(p => [p[0], p[2]] as [number, number]));
      const clipped = polygonClipping.intersection(plan as never, cutPoly as never) as unknown as [number, number][][][];
      for (const poly of clipped) {
        const rings3 = poly.map(r => r.slice(0, -1).map(([x, z]) => [x, y(x, z), z]));
        if (rings3[0].length < 3) continue;
        out.push({type: s.type, rings: facing(rings3, newell(pts))});
        // Party wall under each edge the clip made (not on the face's own outline).
        const r = rings3[0];
        r.forEach((a, i) => {
          const c = r[(i + 1) % r.length];
          const m = [(a[0] + c[0]) / 2, 0, (a[2] + c[2]) / 2];
          if (Math.hypot(c[0] - a[0], c[2] - a[2]) < 0.01 || onBoundary(m, pts)) return;
          // Facing out of the part (towards the rest), which stands against it.
          const dx = c[0] - a[0], dz = c[2] - a[2], L = Math.hypot(dx, dz);
          const probe: [number, number] = [m[0] + (-dz / L) * 0.3, m[2] + (dx / L) * 0.3];
          const outward: V3 = inRing(probe, ring) ? [dz / L, 0, -dx / L] : [-dz / L, 0, dx / L];
          out.push({type: 'WallSurface', rings: facing([[[a[0], 0, a[2]], [c[0], 0, c[2]], c, a]], outward)});
        });
      }
      continue;
    }
    // Vertical face: keep the run inside the ring.
    let lo = 0, far = 0;
    pts.forEach((p, i) => { const d = Math.hypot(p[0] - pts[0][0], p[2] - pts[0][2]); if (d > far) { far = d; lo = i; } });
    const a = pts[0], c = pts[lo];
    if (far < EPS) continue;
    const ux = (c[0] - a[0]) / far, uz = (c[2] - a[2]) / far;
    const uv = s.rings.map(rr => rr.map(p => [(p[0] - a[0]) * ux + (p[2] - a[2]) * uz, p[1]] as [number, number]));
    for (const [t0, t1] of insideIntervals([a[0], a[2]], [c[0], c[2]], ring)) {
      const box = [[[t0 * far, -1e3], [t1 * far, -1e3], [t1 * far, 1e3], [t0 * far, 1e3], [t0 * far, -1e3]]];
      const kept = polygonClipping.intersection(uv.map(r => [...r, r[0]]) as never, box as never) as unknown as [number, number][][][];
      const want = newell(pts);
      for (const poly of kept) out.push({type: s.type, rings: facing(poly.map(r => r.slice(0, -1).map(([u, yy]) => [a[0] + ux * u, yy, a[2] + uz * u] as V3)), want)});
    }
  }
  return out;
}
