import * as T from 'three';

/** Shared helpers for the nightlife lane: local metres from a WGS84 ring and oriented-rectangle fitting. */
export type Ring = number[][];

/** East/south metres from an anchor [lng, lat]. */
export function toLocal(ringLngLat: Ring, anchor: number[]): Ring {
  const mx = 111320 * Math.cos(anchor[1] * Math.PI / 180);
  return ringLngLat.map(p => [(p[0] - anchor[0]) * mx, -(p[1] - anchor[1]) * 111320]);
}

export interface Obb {cx: number; cz: number; ang: number; hl: number; hw: number}

/** Minimum-area oriented rectangle. Local z is the long axis, x the short; ang is the rotateY that maps local to world. */
export function fitObb(ring: Ring): Obb {
  const pts = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
  let best: Obb & {area: number} | null = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const th = Math.atan2(b[1] - a[1], b[0] - a[0]), c = Math.cos(th), s = Math.sin(th);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of pts) { const u = p[0] * c + p[1] * s, v = -p[0] * s + p[1] * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area - 1e-6) {
      const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
      const long = (u1 - u0) >= (v1 - v0);
      // unit axis along the long side
      const ax = long ? [c, s] : [-s, c];
      const hl = long ? (u1 - u0) / 2 : (v1 - v0) / 2, hw = long ? (v1 - v0) / 2 : (u1 - u0) / 2;
      best = {area, cx: uc * c - vc * s, cz: uc * s + vc * c, ang: Math.atan2(ax[0], ax[1]), hl, hw};
    }
  }
  return best!;
}

/** Flip triangles of a convex solid so every face points away from its centroid. */
export function outward(g: T.BufferGeometry): T.BufferGeometry {
  const pos = g.getAttribute('position') as T.BufferAttribute, n = pos.count;
  const c = new T.Vector3();
  for (let i = 0; i < n; i++) c.add(new T.Vector3().fromBufferAttribute(pos, i));
  c.divideScalar(n);
  for (let i = 0; i < n; i += 3) {
    const a = new T.Vector3().fromBufferAttribute(pos, i), b = new T.Vector3().fromBufferAttribute(pos, i + 1), d = new T.Vector3().fromBufferAttribute(pos, i + 2);
    const nrm = b.clone().sub(a).cross(d.clone().sub(a)), mid = a.clone().add(b).add(d).divideScalar(3).sub(c);
    if (nrm.dot(mid) < 0) { pos.setXYZ(i + 1, d.x, d.y, d.z); pos.setXYZ(i + 2, b.x, b.y, b.z); }
  }
  g.computeVertexNormals();
  return g;
}

/** Closed frustum between two centred rectangles (half-width x, half-length z), outward-facing, with a top cap. Local frame. */
export function frustum(hw0: number, hl0: number, y0: number, hw1: number, hl1: number, y1: number, cap = true): T.BufferGeometry {
  const v = [[-hw0, y0, -hl0], [hw0, y0, -hl0], [hw0, y0, hl0], [-hw0, y0, hl0], [-hw1, y1, -hl1], [hw1, y1, -hl1], [hw1, y1, hl1], [-hw1, y1, hl1]];
  const q = (a: number, b: number, c: number, d: number) => [a, b, c, a, c, d];
  // sides then top; wound counter-clockwise seen from outside
  const f = [...q(0, 1, 5, 4), ...q(1, 2, 6, 5), ...q(2, 3, 7, 6), ...q(3, 0, 4, 7), ...(cap ? [4, 5, 6, 4, 6, 7] : [])];
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(f.flatMap(i => v[i]), 3));
  return outward(g);
}

/** Hipped roof with a ridge along local z; ridge half-length rl. */
export function ridgedHip(hw: number, hl: number, y: number, h: number, rl: number): T.BufferGeometry {
  const v = [[-hw, y, -hl], [hw, y, -hl], [hw, y, hl], [-hw, y, hl], [0, y + h, -rl], [0, y + h, rl]];
  const idx = [0, 1, 4, 1, 5, 4, 1, 2, 5, 2, 3, 5, 3, 0, 4, 3, 4, 5, 0, 2, 1, 0, 3, 2];
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(idx.flatMap(i => v[i]), 3));
  return outward(g);
}
