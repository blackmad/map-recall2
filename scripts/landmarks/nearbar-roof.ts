import * as T from 'three';

type Tri = T.Vector3[];
/** Cut a triangle by the plane y = level; returns [below, above] triangle lists. */
function cut(t: Tri, level: number): [Tri[], Tri[]] {
  const below: T.Vector3[] = [], above: T.Vector3[] = [];
  for (let i = 0; i < 3; i++) {
    const a = t[i], b = t[(i + 1) % 3], da = a.y - level, db = b.y - level;
    (da <= 0 ? below : above).push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const p = a.clone().lerp(b, da / (da - db)); below.push(p); above.push(p);
    }
  }
  const fan = (poly: T.Vector3[]): Tri[] => poly.length < 3 ? [] : Array.from({length: poly.length - 2}, (_, k) => [poly[0], poly[k + 1], poly[k + 2]]);
  return [fan(below), fan(above)];
}

/** Split a roof mesh into two geometries by alternating horizontal courses, cutting triangles exactly on the course lines (crisp slate rows). */
export function splitCourses(g: T.BufferGeometry, band = 0.5): [T.BufferGeometry, T.BufferGeometry] {
  const src = g.index ? g.toNonIndexed() : g, pos = src.getAttribute('position');
  const A: number[] = [], B: number[] = [];
  const emit = (t: Tri, parity: number) => { const dst = parity % 2 === 0 ? A : B; for (const p of t) dst.push(p.x, p.y, p.z); };
  for (let i = 0; i < pos.count; i += 3) {
    let rest: Tri[] = [[0, 1, 2].map(k => new T.Vector3().fromBufferAttribute(pos, i + k))];
    const ys = rest[0].map(p => p.y), lo = Math.min(...ys), hi = Math.max(...ys);
    for (let k = Math.floor(lo / band) + 1; k * band < hi; k++) {
      const next: Tri[] = [];
      for (const t of rest) {
        if (Math.max(...t.map(p => p.y)) <= k * band || Math.min(...t.map(p => p.y)) >= k * band) { next.push(t); continue; }
        const [below, above] = cut(t, k * band);
        for (const u of below) emit(u, k - 1);
        next.push(...above);
      }
      rest = next;
    }
    for (const t of rest) emit(t, Math.floor((Math.min(...t.map(p => p.y)) + 1e-6) / band));
  }
  const mk = (arr: number[]) => { const r = new T.BufferGeometry(); r.setAttribute('position', new T.Float32BufferAttribute(arr, 3)); r.computeVertexNormals(); return r; };
  return [mk(A), mk(B)];
}
