import earcut from 'earcut';
import type { RoofDims, RoofTri } from './roofMesh.js';
import { RoofSink, type V2, type V3 } from './roofSink.js';

/** Source-admitted front is measured about the native outline's first vertex. */
export type RepeatedTerraceRoof = {
  front: { start: V2; end: V2; normal: V2 };
  widthM: number;
  gable: 'spout' | 'step';
  wallHex?: string; frameHex?: string; sashHex?: string;
  /** Negative/positive frontage end; contiguous neighbours hide party-wall ends. */
  exposedEnds?: [boolean, boolean];
};

function clip(poly: V2[], distance: (p: V2) => number): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], da = distance(a), db = distance(b);
    if (da >= -1e-9) out.push(a);
    if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
      const t = da / (da - db); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

/** Pitched terrace roof with one cross-gable, never a whole-front canal-house crown.
 * Native polygon triangles are split at the ridge and valleys, so neither the
 * main slope nor a bounding-box cap can cover the stair-bay attic aperture.
 */
export function repeatedTerraceRoofTriangles(
  outer: readonly number[][], origin: { lng: number; lat: number },
  plan: RepeatedTerraceRoof, eavesM: number, riseM: number, dims: RoofDims, kx: number,
): RoofTri[] {
  if (outer.length < 4 || !Number.isFinite(eavesM) || !(riseM > 0)) return [];
  const latScale = 110_540, sx = kx / (111_320 * Math.cos(outer[0][1] * Math.PI / 180));
  const first: V2 = [(outer[0][0] - origin.lng) * kx, (outer[0][1] - origin.lat) * latScale];
  const front = [plan.front.start, plan.front.end].map(p => [first[0] + p[0] * sx, first[1] + p[1]] as V2);
  const dx = front[1][0] - front[0][0], dy = front[1][1] - front[0][1], length = Math.hypot(dx, dy);
  if (length < 4) return [];
  // A right-handed frame: choose the along-front direction so +v is inward.
  let ux = dx / length, uy = dy / length;
  if (-uy * plan.front.normal[0] + ux * plan.front.normal[1] > 0) { ux = -ux; uy = -uy; }
  const cx = (front[0][0] + front[1][0]) / 2, cy = (front[0][1] + front[1][1]) / 2;
  const local = outer.map(p => {
    const x = (p[0] - origin.lng) * kx - cx, y = (p[1] - origin.lat) * latScale - cy;
    return [x * ux + y * uy, -x * uy + y * ux] as V2;
  });
  if (Math.hypot(local[0][0] - local.at(-1)![0], local[0][1] - local.at(-1)![1]) < 1e-7) local.pop();
  const depth = Math.max(...local.map(p => p[1])), ridge = depth / 2;
  if (ridge < 1 || Math.min(...local.map(p => p[1])) < -.08) return [];
  const g = Math.min(plan.widthM, length * .35) / 2;
  if (!(g > .65)) return [];
  const sink = new RoofSink({ cx, cy, ux, uy, len: length, wid: depth, coverage: 1, maxDev: 0 }, eavesM, dims);
  const roofRise = riseM * .92, shoulder = riseM * .36;
  const indices = earcut(local.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const base = indices.slice(i, i + 3).map(j => local[j]);
    for (const rear of [false, true]) {
      const half = clip(base, p => rear ? p[1] - ridge : ridge - p[1]);
      const main = (p: V2) => roofRise * (rear ? (depth - p[1]) : p[1]) / ridge;
      if (rear) { sink.slopePoly(half.map(p => [...p, main(p)] as V3), [0, 0, 1]); continue; }
      for (const sign of [-1, 1]) {
        const side = clip(half, p => sign * p[0]);
        const cross = (p: V2) => roofRise - (roofRise - shoulder) * sign * p[0] / g;
        const outside = clip(side, p => sign * p[0] - g);
        sink.slopePoly(outside.map(p => [...p, main(p)] as V3), [0, 0, 1]);
        const inside = clip(side, p => g - sign * p[0]);
        sink.slopePoly(clip(inside, p => main(p) - cross(p)).map(p => [...p, main(p)] as V3), [0, 0, 1]);
        sink.slopePoly(clip(inside, p => cross(p) - main(p)).map(p => [...p, cross(p)] as V3), [0, 0, 1]);
      }
    }
  }
  // Close the native roof volume at party edges too. Adjacent surveyed parents
  // can have different heights/depths; an omitted end exposes sky through the
  // higher roof. Neighbor geometry occludes shared interior portions naturally.
  for (let i = 0; i < local.length; i++) {
    const a = local[i], b = local[(i + 1) % local.length];
    const middleU = (a[0] + b[0]) / 2;
    if (Math.abs(middleU) < length * .3) continue;
    const pieces = [a];
    if ((a[1] - ridge) * (b[1] - ridge) < 0) { const t = (ridge - a[1]) / (b[1] - a[1]); pieces.push([a[0] + t * (b[0] - a[0]), ridge]); }
    pieces.push(b);
    for (let j = 0; j < pieces.length - 1; j++) {
      const p = pieces[j], q = pieces[j + 1], height = (v: number) => roofRise * Math.max(0, Math.min(v, depth - v)) / ridge;
      sink.flatPoly([[...p, 0], [...q, 0], [...q, height(q[1])], [...p, height(p[1])]], 'plate', [Math.sign(middleU), 0, 0], plan.wallHex);
    }
  }
  // Profile and true hole. Glass is recessed inward; no masonry/roof lies in front.
  const profile: V2[] = plan.gable === 'spout'
    ? [[-g, 0], [g, 0], [g, shoulder], [.18, riseM * .88], [.18, riseM], [-.18, riseM], [-.18, riseM * .88], [-g, shoulder]]
    : [[-g, 0], [g, 0], [g, shoulder], [g * .72, shoulder], [g * .72, riseM * .62], [g * .42, riseM * .62], [g * .42, riseM * .85], [.18, riseM * .85], [.18, riseM], [-.18, riseM], [-.18, riseM * .85], [-g * .42, riseM * .85], [-g * .42, riseM * .62], [-g * .72, riseM * .62], [-g * .72, shoulder], [-g, shoulder]];
  const w = .48, bottom = riseM * .16, top = riseM * .55;
  const hole: V2[] = [[-w, bottom], [-w, top], [w, top], [w, bottom]];
  const points = [...profile, ...hole], face = earcut(points.flat(), [profile.length]);
  // Masonry crowns have a rear face and edge returns. A single front-facing
  // plane vanishes from the game's oblique roof camera wherever it rises
  // above the cross-roof, exposing the street through the crown.
  for (let i = 0; i < face.length; i += 3) {
    const triangle = face.slice(i, i + 3);
    sink.flatPoly(triangle.map(j => [points[j][0], .002, points[j][1]]), 'plate', [0, -1, 0], plan.wallHex);
    sink.flatPoly(triangle.map(j => [points[j][0], .15, points[j][1]]), 'plate', [0, 1, 0], plan.wallHex);
  }
  for (const contour of [profile, hole]) for (let i = 0; i < contour.length; i++) {
    const a = contour[i], b = contour[(i + 1) % contour.length];
    sink.flatPoly([[a[0], .002, a[1]], [b[0], .002, b[1]], [b[0], .15, b[1]], [a[0], .15, a[1]]], 'plate', [b[1] - a[1], 0, a[0] - b[0]], plan.wallHex);
  }
  const rect = (a: number, b: number, c: number, d: number, inset: number, hex: string) => sink.flatPoly([[a, inset, c], [b, inset, c], [b, inset, d], [a, inset, d]], 'decal', [0, -1, 0], hex);
  rect(-w, w, bottom, top, .06, '#354b50');
  const frame = plan.frameHex ?? '#e4ddbf', sash = plan.sashHex ?? '#30463b', t = .055;
  rect(-w, -w + t, bottom, top, .01, frame); rect(w - t, w, bottom, top, .01, frame);
  rect(-w, w, bottom, bottom + t, .01, frame); rect(-w, w, top - t, top, .01, frame);
  rect(-.02, .02, bottom + t, top - t, .025, sash);
  // Narrow, subdued masonry coping; a white canal-house crown is unsupported.
  for (let i = 2; i < profile.length - 1; i++) {
    const a = profile[i], b = profile[i + 1], vx = b[0] - a[0], vz = b[1] - a[1], l = Math.hypot(vx, vz);
    if (!l) continue;
    // Inset band: trim must stay within the admitted native crest envelope.
    const nx = -vz / l * .045, nz = vx / l * .045;
    sink.flatPoly([[a[0], .001, a[1]], [b[0], .001, b[1]], [b[0] + nx, .001, b[1] + nz], [a[0] + nx, .001, a[1] + nz]], 'trim', [0, -1, 0], '#b5a884');
  }
  return sink.out;
}
