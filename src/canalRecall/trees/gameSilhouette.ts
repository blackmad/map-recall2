/**
 * The silhouette the game draws for one tree typology (lane T-shape #371), measured analytically so it compares with
 * the panorama measurements in `silhouetteMeasure.ts` on the same terms.
 *
 * A crown is the union of its lobes: each lobe is an instanced unit icosahedron (detail 0 below zoom 18) scaled to an
 * ellipsoid. Its mean side-on silhouette half-width is ~0.9 of the vertex radius (vertices at 1, face centres at
 * 0.79), the ICOSA_SILHOUETTE factor. Width is the crown's extent seen broadside, averaged over eight view yaws; the
 * base is the lowest lobe point, the top the highest.
 */

export const ICOSA_SILHOUETTE = 0.9;

export interface Lobe { offset: [number, number, number]; scale: [number, number, number]; rotation?: number; }
export interface TypologyLike { height: number; lobes: Lobe[]; rotation: number; crownGeometry?: string; }

export interface GameSilhouette {
  top: number;
  base: number;
  width: number;
  widestAt: number;
  /** Width every 10 % of crown height (base → top), metres. */
  profile: number[];
}

/** Half-width (along view-perpendicular `ux, uz`) of a lobe's horizontal slice at height `z`, and its centre. */
function sliceAt(l: Lobe, rot: number, z: number, ux: number, uz: number, cone: boolean): [number, number] | null {
  const [ox, oy, oz] = l.offset, [sx, sy, sz] = l.scale;
  const t = (z - oy) / sy;
  if (t < -1 || t > 1) return null;
  // A cone (ConeGeometry(1,2) along +z): radius 1 at the bottom (t=-1), 0 at the apex (t=1); facets ~8 → ~0.96.
  const k = cone ? (1 - t) / 2 * 0.96 : Math.sqrt(1 - t * t) * ICOSA_SILHOUETTE;
  const co = Math.cos(rot), si = Math.sin(rot);
  const cx = ox * co - oz * si, cz = ox * si + oz * co;
  const a = rot + (l.rotation ?? 0), ca = Math.cos(a), sa = Math.sin(a);
  // Direction u in the lobe's own frame.
  const lx = ux * ca + uz * sa, lz = -ux * sa + uz * ca;
  return [cx * ux + cz * uz, k * Math.hypot(sx * lx, sz * lz)];
}

function widthAt(t: TypologyLike, z: number, cone: boolean): number {
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    const yaw = (i * Math.PI) / 8, ux = Math.cos(yaw), uz = Math.sin(yaw);
    let lo = Infinity, hi = -Infinity;
    for (const l of t.lobes) {
      const s = sliceAt(l, t.rotation, z, ux, uz, cone);
      if (!s) continue;
      lo = Math.min(lo, s[0] - s[1]); hi = Math.max(hi, s[0] + s[1]);
    }
    if (hi > lo) sum += hi - lo;
  }
  return sum / 8;
}

export function gameSilhouette(t: TypologyLike): GameSilhouette {
  const cone = t.crownGeometry === 'cone';
  let top = -Infinity, base = Infinity;
  for (const l of t.lobes) { top = Math.max(top, l.offset[1] + l.scale[1]); base = Math.min(base, l.offset[1] - l.scale[1]); }
  let width = 0, widestAt = base;
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const z = base + ((top - base) * i) / steps, w = widthAt(t, z, cone);
    if (w > width) { width = w; widestAt = z; }
  }
  const profile: number[] = [];
  for (let k = 0; k < 10; k++) {
    let w = 0;
    for (let j = 0; j <= 4; j++) w = Math.max(w, widthAt(t, base + (top - base) * ((k + j / 4) / 10), cone));
    profile.push(+w.toFixed(2));
  }
  return { top: +top.toFixed(2), base: +base.toFixed(2), width: +width.toFixed(2), widestAt: +widestAt.toFixed(2), profile };
}
