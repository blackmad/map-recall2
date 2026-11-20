// The host's own ground-storey openings, read off its glass (lane retail-fit-20261120). A placed model (bespoke
// landmark, block face, recipe house) draws its ground storey with its own arches and shop windows, and the shown model
// hides the pand under it, so the template front a tenant had there is hidden too: today every arch of the
// Hirschgebouw is the same dark glass and no tenant shows at all. The fit puts the tenant back inside those openings,
// which first have to be found: the glass faces (materialSlot 'glass') of the ground storey, one connected flat face per
// opening, outward facing.
//
// Pure geometry over triangle soups in model space (glTF axes: y up); Node and browser share it.
import type { FitHead, HostOpening } from './types.js';

export type GlassSoup = { positions: ArrayLike<number>; indices?: ArrayLike<number> | null };

export const OPENING_FIND = {
  /** A ground-storey opening: glass that starts this low (m) ... */
  maxSillM: 1.6,
  /** ... and every triangle of it under this (m): the first-floor windows start above. */
  maxTopM: 7.5,
  /** Vertical faces only: |normal.y| under this. */
  maxNy: 0.25,
  minAreaM2: 1.0, minWidthM: 0.6,
  /** Plane grouping: bearing bucket (deg) and plane offset (m). */
  bearingStepDeg: 4, planeStepM: 0.06,
  /** The head's springing: the highest glass vertex within this distance (m) of either jamb (the straight sides). */
  jambM: 0.02,
} as const;

const key3 = (x: number, y: number, z: number) => `${Math.round(x * 100)},${Math.round(y * 100)},${Math.round(z * 100)}`;
/** Compass bearing (deg, 0 = north, 90 = east) of a model-space horizontal direction (x east, z south). */
export const bearingOf = (nx: number, nz: number) => ((Math.atan2(nx, -nz) * 180) / Math.PI + 360) % 360;

type Tri = { a: number[]; b: number[]; c: number[]; nx: number; nz: number; area: number };

/**
 * The ground-storey openings in `soups` (the model's glass), outward from `centre` (the model's plan centre, x/z).
 * Each opening is one connected flat glass face; the head is read from the outline (flat, segmental, round).
 */
export function glassOpenings(soups: readonly GlassSoup[], centre: [number, number], o = OPENING_FIND): HostOpening[] {
  const tris: Tri[] = [];
  for (const s of soups) {
    const P = s.positions, I = s.indices, n = I ? I.length : P.length / 3;
    for (let i = 0; i + 2 < n; i += 3) {
      const v = [0, 1, 2].map(k => { const j = I ? I[i + k] : i + k; return [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]]; });
      const [a, b, c] = v;
      if (Math.max(a[1], b[1], c[1]) > o.maxTopM) continue;
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
      const Nx = uy * wz - uz * wy, Ny = uz * wx - ux * wz, Nz = ux * wy - uy * wx, len = Math.hypot(Nx, Ny, Nz);
      if (len < 2e-4 || Math.abs(Ny / len) > o.maxNy) continue;
      const h = Math.hypot(Nx, Nz);
      tris.push({ a, b, c, nx: Nx / h, nz: Nz / h, area: len / 2 });
    }
  }
  // Group by plane, then split each plane into connected faces.
  const planes = new Map<string, Tri[]>();
  for (const t of tris) {
    const brg = Math.round(bearingOf(t.nx, t.nz) / o.bearingStepDeg) % Math.round(360 / o.bearingStepDeg);
    const d = Math.round((t.a[0] * t.nx + t.a[2] * t.nz) / o.planeStepM);
    const k = `${brg}|${d}`;
    let l = planes.get(k); if (!l) planes.set(k, l = []); l.push(t);
  }
  const out: HostOpening[] = [];
  for (const list of planes.values()) {
    // Union-find over shared vertices.
    const parent = list.map((_, i) => i), find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]));
    const owner = new Map<string, number>();
    list.forEach((t, i) => { for (const p of [t.a, t.b, t.c]) { const k = key3(p[0], p[1], p[2]), j = owner.get(k); if (j === undefined) owner.set(k, i); else parent[find(i)] = find(j); } });
    const groups = new Map<number, Tri[]>();
    list.forEach((t, i) => { const r = find(i); let g = groups.get(r); if (!g) groups.set(r, g = []); g.push(t); });
    // A face triangulated with T-junctions falls apart into pieces over the same span: pieces whose spans overlap by
    // more than half the narrower one, AND that touch vertically (a gap under 0.15 m), are one opening. Without the
    // vertical test a shop window and the first-floor window over it (a street chunk's glass) became one 7 m opening.
    const span = (g: Tri[]) => { const t = g[0], tx = t.nz, tz = -t.nx; let a = Infinity, b = -Infinity, y0 = Infinity, y1 = -Infinity; for (const q of g) for (const p of [q.a, q.b, q.c]) { const u = p[0] * tx + p[2] * tz; a = Math.min(a, u); b = Math.max(b, u); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); } return [a, b, y0, y1]; };
    const merged: Array<{ g: Tri[]; s: number[] }> = [];
    for (const g of [...groups.values()].map(g => ({ g, s: span(g) })).sort((p, q) => p.s[0] - q.s[0])) {
      const m = merged.find(m => Math.min(m.s[1], g.s[1]) - Math.max(m.s[0], g.s[0]) > 0.5 * Math.min(m.s[1] - m.s[0], g.s[1] - g.s[0])
        && Math.max(m.s[2], g.s[2]) - Math.min(m.s[3], g.s[3]) < 0.15);
      if (m) { m.g.push(...g.g); m.s = [Math.min(m.s[0], g.s[0]), Math.max(m.s[1], g.s[1]), Math.min(m.s[2], g.s[2]), Math.max(m.s[3], g.s[3])]; } else merged.push(g);
    }
    for (const { g } of merged) {
      const op = openingOf(g, centre, o);
      if (op) out.push(op);
    }
  }
  return dedupe(out).sort((p, q) => p.bearing - q.bearing || p.id.localeCompare(q.id));
}

/** Pieces of one opening that landed in neighbouring plane buckets (a face 0.07 m proud of another, a rounding edge):
 *  same facing, centres within half the narrower width along the face and 0.3 m across it; the larger keeps the head,
 *  the extents are the union. */
function dedupe(list: HostOpening[]): HostOpening[] {
  const kept: HostOpening[] = [];
  for (const op of [...list].sort((p, q) => q.areaM2 - p.areaM2)) {
    const m = kept.find(k => k.n[0] * op.n[0] + k.n[1] * op.n[1] > 0.99
      && Math.abs((op.base[0] - k.base[0]) * k.t[0] + (op.base[2] - k.base[2]) * k.t[1]) < 0.5 * Math.min(k.widthM, op.widthM)
      && Math.abs((op.base[0] - k.base[0]) * k.n[0] + (op.base[2] - k.base[2]) * k.n[1]) < 0.3);
    if (!m) { kept.push(op); continue; }
    m.areaM2 += op.areaM2; m.sillM = Math.min(m.sillM, op.sillM); m.crownM = Math.max(m.crownM, op.crownM);
  }
  return kept;
}

function openingOf(g: readonly Tri[], centre: [number, number], o: typeof OPENING_FIND): HostOpening | null {
  let area = 0, nx = 0, nz = 0;
  for (const t of g) { area += t.area; nx += t.nx * t.area; nz += t.nz * t.area; }
  if (area < o.minAreaM2) return null;
  const h = Math.hypot(nx, nz); nx /= h; nz /= h;
  const tx = nz, tz = -nx;
  let u0 = Infinity, u1 = -Infinity, y0 = Infinity, y1 = -Infinity, d = 0, cx = 0, cz = 0, cnt = 0;
  const pts: number[][] = [];
  for (const t of g) for (const p of [t.a, t.b, t.c]) {
    const u = p[0] * tx + p[2] * tz;
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
    d += p[0] * nx + p[2] * nz; cx += p[0]; cz += p[2]; cnt++; pts.push([u, p[1]]);
  }
  d /= cnt; cx /= cnt; cz /= cnt;
  const width = u1 - u0;
  if (y0 > o.maxSillM || width < o.minWidthM) return null;
  // Outward: the face looks away from the model's plan centre (the glass slab's back face looks in).
  if ((cx - centre[0]) * nx + (cz - centre[1]) * nz <= 0) return null;
  const jamb = o.jambM;
  let spring = y0;
  for (const [u, y] of pts) if (u <= u0 + jamb || u >= u1 - jamb) spring = Math.max(spring, y);
  const rise = y1 - spring;
  const head: FitHead = rise < 0.05 ? 'flat' : rise >= 0.3 * width ? 'round' : 'segmental';
  const um = (u0 + u1) / 2, bearing = bearingOf(nx, nz);
  return {
    id: `${Math.round(bearing)}:${um.toFixed(1)}`,
    base: [nx * d + tx * um, y0, nz * d + tz * um], n: [nx, nz], t: [tx, tz],
    widthM: width, sillM: y0, springM: head === 'flat' ? y1 : spring, crownM: y1, head, bearing, areaM2: area,
  };
}

/** The opening nearest a model-space plan point (x, z): the distance to its bottom edge, within `maxM`. */
export function openingAt(openings: readonly HostOpening[], x: number, z: number, maxM = 4): HostOpening | null {
  let best: HostOpening | null = null, bd = maxM;
  for (const op of openings) {
    const dx = x - op.base[0], dz = z - op.base[2];
    const along = Math.max(-op.widthM / 2, Math.min(op.widthM / 2, dx * op.t[0] + dz * op.t[1]));
    const ex = dx - along * op.t[0], ez = dz - along * op.t[1], dist = Math.hypot(ex, ez);
    if (dist < bd) { bd = dist; best = op; }
  }
  return best;
}
