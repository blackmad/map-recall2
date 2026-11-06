/**
 * Splits the edges of a footprint ring into runs of constant wall height read from 3DBAG LoD2.2 roof pieces, so a cut
 * street front (street-front-kit.ts) can follow a stepped modern block storey line by storey line instead of one height
 * per chord. Each run carries the chord (outward normal n = (-tz, tx)), its span [s0, s1] along the chord, the measured top
 * and the miter extension at each end, so offset fronts meet at convex corners and stop short at concave ones.
 */
import type {Chord} from './street-front-kit';

export type P2 = [number, number];
export type Piece = number[][];            // a roof ring of [x, y, z]
export type Run = {edge: number; chord: Chord; L: number; s0: number; s1: number; top: number; bearing: number};
export type Edge = {edge: number; chord: Chord; L: number; bearing: number; ext0: number; ext1: number; runs: Run[]};

const signedArea = (r: P2[]) => r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

/** The ring wound so that n = (-tz, tx) of every edge points outward (x east, z south frame). */
export function outwardRing(r: P2[]): P2[] {
  // n = (-tz, tx) is outward when the shoelace sum in (x, z) is negative
  return signedArea(r) < 0 ? r.slice() : r.slice().reverse();
}

export function inside(p: P2, ring: number[][], xi = 0, zi = 2): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[zi] > p[1]) !== (b[zi] > p[1]) && p[0] < ((b[xi] - a[xi]) * (p[1] - a[zi])) / (b[zi] - a[zi]) + a[xi]) c = !c;
  }
  return c;
}

/** Least-squares plane y = a x + b z + c through a roof piece, evaluated at p. */
export function planeAt(piece: Piece, p: P2): number {
  const n = piece.length;
  let sx = 0, sz = 0, sy = 0, sxx = 0, szz = 0, sxz = 0, sxy = 0, szy = 0;
  for (const [x, y, z] of piece) { sx += x; sz += z; sy += y; sxx += x * x; szz += z * z; sxz += x * z; sxy += x * y; szy += z * y; }
  const mx = sx / n, mz = sz / n, my = sy / n;
  const cxx = sxx / n - mx * mx, czz = szz / n - mz * mz, cxz = sxz / n - mx * mz, cxy = sxy / n - mx * my, czy = szy / n - mz * my;
  const det = cxx * czz - cxz * cxz;
  if (Math.abs(det) < 1e-9) return my;
  const a = (cxy * czz - czy * cxz) / det, b = (czy * cxx - cxy * cxz) / det;
  const ys = piece.map(q => q[1]);
  return Math.min(Math.max(...ys), Math.max(Math.min(...ys), my + a * (p[0] - mx) + b * (p[1] - mz)));
}

/** A roof piece with holes: outer ring first, then the holes (3DBAG cuts the higher pieces out of a lower one). */
export type HoledPiece = Piece[];
const asHoled = (pc: Piece | HoledPiece): HoledPiece => (Array.isArray(pc[0][0]) ? pc as HoledPiece : [pc as Piece]);
const insideHoled = (p: P2, pc: HoledPiece) => inside(p, pc[0]) && !pc.slice(1).some(h => inside(p, h));

/** Highest roof surface over p (pieces may overlap at their seams), or null outside every piece; holes are not roof. */
export function roofAt(pieces: (Piece | HoledPiece)[], p: P2): number | null {
  let best: number | null = null;
  for (const raw of pieces) { const pc = asHoled(raw); if (insideHoled(p, pc)) { const y = planeAt(pc[0], p); if (best === null || y > best) best = y; } }
  return best;
}

export type RunOpts = {probe?: number; step?: number; tol?: number; minRun?: number; off?: number; minEdge?: number};

/**
 * Edges of the ring (wound outward) with their height runs. The wall top at s is the roof surface `probe` metres inside the
 * edge; consecutive samples within `tol` join one run, runs shorter than `minRun` merge into the neighbour of nearest
 * height, and each run's top is the median of its samples. `ext0`/`ext1` are the miter lengths for a front `off` outside
 * the chord (positive = extend at a convex corner, negative = stop short at a concave one).
 */
export function ringHeightRuns(ring: P2[], pieces: Piece[], o: RunOpts = {}): Edge[] {
  const probe = o.probe ?? 0.4, step = o.step ?? 0.5, tol = o.tol ?? 0.6, minRun = o.minRun ?? 1.6, off = o.off ?? 0.3, minEdge = o.minEdge ?? 0.8;
  const r = outwardRing(ring), N = r.length, out: Edge[] = [];
  const dir = (i: number) => { const a = r[i], b = r[(i + 1) % N], L = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / L, (b[1] - a[1]) / L] as P2; };
  for (let i = 0; i < N; i++) {
    const a = r[i], b = r[(i + 1) % N], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < minEdge) continue;
    const t = dir(i), n: P2 = [-t[1], t[0]];
    const miter = (u: P2, v: P2) => {   // corner from direction u into v: turn angle, convex when the turn is to the outward side
      const cross = u[0] * v[1] - u[1] * v[0], dot = u[0] * v[0] + u[1] * v[1], th = Math.atan2(cross, dot);
      return -off * Math.tan(th / 2);
    };
    const ext0 = miter(dir((i - 1 + N) % N), t), ext1 = miter(t, dir((i + 1) % N));
    const chord: Chord = {a, b};
    const bearing = ((Math.atan2(n[0], -n[1]) * 180) / Math.PI + 360) % 360;
    const k = Math.max(2, Math.round(L / step));
    const samples: {s: number; y: number}[] = [];
    for (let j = 0; j <= k; j++) {
      const s = Math.min(L - 0.05, Math.max(0.05, (L * j) / k));
      const y = roofAt(pieces, [a[0] + t[0] * s - n[0] * probe, a[1] + t[1] * s - n[1] * probe]);
      if (y !== null) samples.push({s, y});
    }
    if (!samples.length) continue;
    let groups: {s0: number; s1: number; ys: number[]}[] = [];
    for (const q of samples) {
      const g = groups.at(-1);
      if (g && Math.abs(q.y - median(g.ys)) <= tol) { g.ys.push(q.y); g.s1 = q.s; }
      else groups.push({s0: q.s, s1: q.s, ys: [q.y]});
    }
    // boundaries halfway between groups; the first and last reach the edge ends
    groups.forEach((g, j) => { if (j > 0) { const m = (groups[j - 1].s1 + g.s0) / 2; groups[j - 1].s1 = m; g.s0 = m; } });
    groups[0].s0 = 0; groups[groups.length - 1].s1 = L;
    for (let pass = 0; pass < 8; pass++) {
      const j = groups.findIndex(g => g.s1 - g.s0 < minRun);
      if (j < 0 || groups.length === 1) break;
      const h = median(groups[j].ys), lft = groups[j - 1], rgt = groups[j + 1];
      const into = !lft ? rgt : !rgt ? lft : Math.abs(median(lft.ys) - h) <= Math.abs(median(rgt.ys) - h) ? lft : rgt;
      into.ys.push(...groups[j].ys); into.s0 = Math.min(into.s0, groups[j].s0); into.s1 = Math.max(into.s1, groups[j].s1);
      groups = groups.filter((_, q) => q !== j);
    }
    const runs = groups.map(g => ({edge: i, chord, L, s0: g.s0, s1: g.s1, top: +median(g.ys).toFixed(2), bearing}));
    out.push({edge: i, chord, L, bearing, ext0, ext1, runs});
  }
  return out;
}

function median(a: number[]): number { const s = [...a].sort((p, q) => p - q); return s[s.length >> 1]; }

/** An exposed wall band of one roof piece: the stretch [s0, s1] of a piece edge whose wall shows from `bottom` (the roof or
 *  street outside it) to `top` (the piece's own roof at the edge). */
export type Band = {piece: number; edge: number; chord: Chord; L: number; s0: number; s1: number; bottom: number; top: number; bearing: number};
export type PieceEdge = {piece: number; edge: number; chord: Chord; L: number; bearing: number; ext0: number; ext1: number; bands: Band[]};

/**
 * The visible walls of a stepped 3DBAG block: every edge of every roof piece (wound outward), sampled `probe` metres
 * inside (its own roof plane) and outside (the highest other piece there, or the street at 0). Where the outside is at
 * least `minBand` lower the edge shows a wall; samples join into bands of constant (bottom, top) within `tol`, and bands
 * shorter than `minRun` merge into the neighbour of nearest height. Corner miters as in ringHeightRuns.
 */
export function pieceFacadeBands(input: (Piece | HoledPiece)[], o: RunOpts & {minBand?: number} = {}): PieceEdge[] {
  const pieces = input.map(asHoled);
  const probe = o.probe ?? 0.4, step = o.step ?? 0.5, tol = o.tol ?? 0.6, minRun = o.minRun ?? 1.6, off = o.off ?? 0.3, minEdge = o.minEdge ?? 0.8, minBand = o.minBand ?? 2.0;
  const out: PieceEdge[] = [];
  pieces.forEach((holed, pi) => {
    const pc = holed[0];
    const r = outwardRing(pc.map(p => [p[0], p[2]] as P2)).filter((p, i, a) => Math.hypot(p[0] - a[(i + 1) % a.length][0], p[1] - a[(i + 1) % a.length][1]) > 1e-3);
    const N = r.length;
    if (N < 3) return;
    const others = pieces.filter((_, q) => q !== pi);
    const dir = (i: number) => { const a = r[i], b = r[(i + 1) % N], L = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / L, (b[1] - a[1]) / L] as P2; };
    const miter = (u: P2, v: P2) => -off * Math.tan(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]) / 2);
    for (let i = 0; i < N; i++) {
      const a = r[i], b = r[(i + 1) % N], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < minEdge) continue;
      const t = dir(i), n: P2 = [-t[1], t[0]], chord: Chord = {a, b};
      const bearing = ((Math.atan2(n[0], -n[1]) * 180) / Math.PI + 360) % 360;
      const k = Math.max(2, Math.round(L / step)), S: {s: number; top: number; bot: number}[] = [];
      for (let j = 0; j <= k; j++) {
        const s = Math.min(L - 0.05, Math.max(0.05, (L * j) / k));
        const top = planeAt(pc, [a[0] + t[0] * s - n[0] * probe, a[1] + t[1] * s - n[1] * probe]);
        const bot = Math.max(0, roofAt(others, [a[0] + t[0] * s + n[0] * probe, a[1] + t[1] * s + n[1] * probe]) ?? 0);
        S.push({s, top, bot});
      }
      let groups: {s0: number; s1: number; tops: number[]; bots: number[]; show: boolean}[] = [];
      for (const q of S) {
        const show = q.top - q.bot >= minBand, g = groups.at(-1);
        if (g && g.show === show && (!show || (Math.abs(q.top - median(g.tops)) <= tol && Math.abs(q.bot - median(g.bots)) <= tol))) { g.tops.push(q.top); g.bots.push(q.bot); g.s1 = q.s; }
        else groups.push({s0: q.s, s1: q.s, tops: [q.top], bots: [q.bot], show});
      }
      groups.forEach((g, j) => { if (j > 0) { const m = (groups[j - 1].s1 + g.s0) / 2; groups[j - 1].s1 = m; g.s0 = m; } });
      groups[0].s0 = 0; groups[groups.length - 1].s1 = L;
      for (let pass = 0; pass < 12; pass++) {
        const j = groups.findIndex(g => g.s1 - g.s0 < minRun);
        if (j < 0 || groups.length === 1) break;
        const g = groups[j], lft = groups[j - 1], rgt = groups[j + 1], h = median(g.bots);
        const into = !lft ? rgt : !rgt ? lft : Math.abs(median(lft.bots) - h) <= Math.abs(median(rgt.bots) - h) ? lft : rgt;
        if (into.show) { into.tops.push(...g.tops); into.bots.push(...g.bots); }
        into.s0 = Math.min(into.s0, g.s0); into.s1 = Math.max(into.s1, g.s1);
        groups = groups.filter((_, q) => q !== j);
      }
      const bands = groups.filter(g => g.show).map(g => ({piece: pi, edge: i, chord, L, s0: g.s0, s1: g.s1, bottom: +median(g.bots).toFixed(2), top: +median(g.tops).toFixed(2), bearing}));
      out.push({piece: pi, edge: i, chord, L, bearing, ext0: miter(dir((i - 1 + N) % N), t), ext1: miter(t, dir((i + 1) % N)), bands});
    }
  });
  return out;
}
