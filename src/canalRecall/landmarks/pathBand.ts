/**
 * Facade bands that follow an open plan polyline: a wall skin, a glass ribbon, a fascia or a projecting ledge that runs
 * round a curved or faceted front at a fixed offset, and a wall frame at any arc length so flat trims (signs, windows,
 * posters) can be placed on a curved front.
 *
 * Why (2026-11-14, venues round 3): Theater Bellevue's yellow-brick corner drum on the Leidsekade (radius ~4 m, 127 BAG
 * vertices) carries its tile plinth, ribbon windows, canopy fascia and coping round the curve unbroken; Q-Factory's
 * dark panel bands and the Muziekgebouw's curved glass hall do the same on larger radii. The kit had plan outlines for
 * slabs round corners (`wrapBand.ts`, `slabBandPlan.ts`) and elevation bands on one flat wall (`bandedCurtain.ts`),
 * but nothing that lays a vertical band or a ledge with front, top and bottom faces along a polyline; builders drew
 * curves as one chord (a flat front where the photo shows a drum) or box per segment (gaps and overlaps at each
 * vertex).
 *
 * Pure geometry, no three.js. Plan points are [x, z] (native east/south); y is up. A segment a -> b has its outward
 * normal n = (-tz, tx), the street-front kit's convention. Offsets are mitred at every vertex (scaled so both adjacent
 * segments move by the offset, capped at 3x on sharp corners), so consecutive quads share their edges exactly.
 */
export type XZ = [number, number];
export type V3 = [number, number, number];
/** A planar quad (4 corners in order) with the unit normal its front face should have. */
export type BandQuad = {pts: [V3, V3, V3, V3]; n: V3};

const dedupe = (path: XZ[]) => path.filter((p, i) => i === 0 || Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]) > 1e-6);

/** Unit tangents and outward normals per segment. */
export function segmentFrames(path: XZ[]): {t: XZ; n: XZ; len: number}[] {
  const p = dedupe(path);
  if (p.length < 2) throw Error('pathBand: path needs two distinct points');
  const out: {t: XZ; n: XZ; len: number}[] = [];
  for (let i = 0; i + 1 < p.length; i++) {
    const dx = p[i + 1][0] - p[i][0], dz = p[i + 1][1] - p[i][1], L = Math.hypot(dx, dz);
    out.push({t: [dx / L, dz / L], n: [-dz / L, dx / L], len: L});
  }
  return out;
}

/** The path offset by `off` metres along its outward normals, mitred at every inner vertex (same vertex count). */
export function offsetPath(path: XZ[], off: number): XZ[] {
  const p = dedupe(path), fr = segmentFrames(p);
  return p.map((q, i) => {
    if (i === 0) return [q[0] + fr[0].n[0] * off, q[1] + fr[0].n[1] * off];
    if (i === p.length - 1) { const n = fr[fr.length - 1].n; return [q[0] + n[0] * off, q[1] + n[1] * off]; }
    const a = fr[i - 1].n, c = fr[i].n, k = 1 / Math.max(1 / 3, (1 + a[0] * c[0] + a[1] * c[1]) / 2);
    return [q[0] + (a[0] + c[0]) / 2 * k * off, q[1] + (a[1] + c[1]) / 2 * k * off];
  });
}

/** Cumulative arc length at each vertex of the (deduplicated) path. */
export function arcStations(path: XZ[]): number[] {
  const p = dedupe(path), at = [0];
  for (let i = 1; i < p.length; i++) at.push(at[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  return at;
}

/**
 * Wall frame at arc length `s` along the path, `off` metres out: origin on the offset line at s, tangent and normal of
 * the segment holding s (the last segment past the end). With nearbar-kit's `slab(b, frame, 0, ...)` a trim centred at
 * t = 0 then sits at s, square to that segment.
 */
export function frameAtArc(path: XZ[], s: number, off = 0): {origin: XZ; tangent: XZ; n: XZ} {
  const p = dedupe(path), at = arcStations(p), fr = segmentFrames(p);
  let i = 0;
  while (i + 1 < fr.length && at[i + 1] <= s) i++;
  const u = s - at[i], {t, n} = fr[i];
  return {origin: [p[i][0] + t[0] * u + n[0] * off, p[i][1] + t[1] * u + n[1] * off], tangent: t, n};
}

/** Sub-path between arc lengths s0 < s1 (clamped to the path), with interpolated end points. */
export function subPath(path: XZ[], s0: number, s1: number): XZ[] {
  const p = dedupe(path), at = arcStations(p), total = at[at.length - 1];
  const a = Math.max(0, Math.min(total, s0)), b = Math.max(0, Math.min(total, s1));
  if (b - a < 1e-6) return [];
  const pt = (s: number): XZ => {
    let i = 0;
    while (i + 2 < p.length && at[i + 1] <= s) i++;
    const L = at[i + 1] - at[i] || 1e-12, u = (s - at[i]) / L;
    return [p[i][0] + (p[i + 1][0] - p[i][0]) * u, p[i][1] + (p[i + 1][1] - p[i][1]) * u];
  };
  const out: XZ[] = [pt(a)];
  for (let i = 1; i + 1 < p.length; i++) if (at[i] > a + 1e-6 && at[i] < b - 1e-6) out.push(p[i]);
  out.push(pt(b));
  return out;
}

/** Vertical skin from y0 to y1 on the path offset by `off`: one quad per segment, facing outward. */
export function bandQuads(path: XZ[], y0: number, y1: number, off = 0): BandQuad[] {
  if (!(y1 > y0)) return [];
  const q = offsetPath(path, off), fr = segmentFrames(path), out: BandQuad[] = [];
  for (let i = 0; i + 1 < q.length; i++) {
    const a = q[i], b = q[i + 1], n = fr[i].n;
    out.push({pts: [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], n: [n[0], 0, n[1]]});
  }
  return out;
}

/**
 * A ledge (canopy, coping, fascia, cornice slab) along the path: from `back` to `front` metres out of it, y to y + h.
 * Returns the front face, the top and the soffit per segment, plus the two end caps; `back` is normally inside the wall
 * (negative) so the ledge stays attached.
 */
export function ledgeQuads(path: XZ[], y: number, h: number, back: number, front: number): BandQuad[] {
  if (!(h > 0) || !(front > back)) return [];
  const qf = offsetPath(path, front), qb = offsetPath(path, back), fr = segmentFrames(path), out: BandQuad[] = [];
  const y1 = y + h;
  for (let i = 0; i + 1 < qf.length; i++) {
    const [f0, f1, b0, b1] = [qf[i], qf[i + 1], qb[i], qb[i + 1]], n = fr[i].n;
    out.push({pts: [[f0[0], y, f0[1]], [f1[0], y, f1[1]], [f1[0], y1, f1[1]], [f0[0], y1, f0[1]]], n: [n[0], 0, n[1]]});
    out.push({pts: [[b0[0], y1, b0[1]], [b1[0], y1, b1[1]], [f1[0], y1, f1[1]], [f0[0], y1, f0[1]]], n: [0, 1, 0]});
    out.push({pts: [[b0[0], y, b0[1]], [b1[0], y, b1[1]], [f1[0], y, f1[1]], [f0[0], y, f0[1]]], n: [0, -1, 0]});
  }
  const t0 = fr[0].t, t1 = fr[fr.length - 1].t, L = qf.length - 1;
  out.push({pts: [[qb[0][0], y, qb[0][1]], [qf[0][0], y, qf[0][1]], [qf[0][0], y1, qf[0][1]], [qb[0][0], y1, qb[0][1]]], n: [-t0[0], 0, -t0[1]]});
  out.push({pts: [[qb[L][0], y, qb[L][1]], [qf[L][0], y, qf[L][1]], [qf[L][0], y1, qf[L][1]], [qb[L][0], y1, qb[L][1]]], n: [t1[0], 0, t1[1]]});
  return out;
}
