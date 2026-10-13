// Street widths measured on BGT road-surface polygons (pure; DOM-free).
//
// BGT `wegdeel` polygons (Kadaster, via PDOK, CC0) partition the road surface
// by function: rijbaan, voetpad, fietspad, parkeervlak, woonerf, ... For an
// OSM way we cast a line across it at a few stations, intersect it with the
// polygons and read the extent of the way's own surface and of the footpath /
// cycle path next to it. Medians over the stations keep a junction from
// inflating a street. The result is stored per way in decimetres
// (`OsmWay.bw`, own-ground-osm-v1) and read by `crossSection`.
//
// Input rings are in metres (the game's local frame); callers project.

export type Vec2 = [number, number];
export type SurfaceClass = 'carriage' | 'foot' | 'cycle' | 'pedestrian' | 'parking' | 'driveway' | 'other';

export interface BgtPolygon { cls: SurfaceClass; /** relatieve_hoogteligging */ h: number; rings: Vec2[][]; bbox: [number, number, number, number] }

/** Decimetres: [own surface width, footpath per side, cycle path per side]; 0 = none found. */
export type BgtWayWidth = [number, number, number];

export interface SectionWidths { widthM: number; sidewalkM: number; cycleM: number }

export function classOf(functie: string): SurfaceClass {
  if (/^(rijbaan|woonerf|overweg|OV-baan)/.test(functie)) return 'carriage';
  if (/^voetpad/.test(functie)) return 'foot';
  if (/^fietspad/.test(functie)) return 'cycle';
  if (/^voetgangersgebied/.test(functie)) return 'pedestrian';
  if (/^parkeervlak/.test(functie)) return 'parking';
  if (/^inrit/.test(functie)) return 'driveway';
  return 'other';
}

/** Surface classes that make up the way's own width, by OSM highway value. */
export function ownClasses(highway: string, tags: Record<string, string> = {}): ReadonlySet<SurfaceClass> {
  switch (highway) {
    case 'cycleway': return new Set<SurfaceClass>(['cycle']);
    case 'footway': case 'steps': return new Set<SurfaceClass>(['foot', 'pedestrian']);
    case 'path': case 'track': case 'bridleway': return new Set<SurfaceClass>(tags.bicycle === 'designated' ? ['cycle', 'foot'] : ['foot', 'cycle']);
    case 'pedestrian': return new Set<SurfaceClass>(['pedestrian', 'foot', 'carriage']);
    case 'service': return new Set<SurfaceClass>(['carriage', 'driveway']);
    case 'living_street': return new Set<SurfaceClass>(['carriage', 'pedestrian']);
    default: return new Set<SurfaceClass>(['carriage']);
  }
}

/** Tried only when `ownClasses` finds nothing: a service way that is a parking aisle runs over parkeervlak. */
export function fallbackClasses(highway: string): ReadonlySet<SurfaceClass> | null {
  return highway === 'service' ? new Set<SurfaceClass>(['parking']) : null;
}

export function polygonBox(rings: readonly Vec2[][]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of rings[0] ?? []) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1, y1];
}

/** Coarse grid over polygon bboxes for ray queries. */
export class BgtIndex {
  private readonly cells = new Map<string, BgtPolygon[]>();
  constructor(polys: readonly BgtPolygon[], private readonly g = 50) {
    for (const p of polys) {
      for (let i = Math.floor(p.bbox[0] / g); i <= Math.floor(p.bbox[2] / g); i++) for (let j = Math.floor(p.bbox[1] / g); j <= Math.floor(p.bbox[3] / g); j++) {
        const k = `${i}_${j}`; (this.cells.get(k) ?? this.cells.set(k, []).get(k)!).push(p);
      }
    }
  }
  /** Polygons whose bbox meets the segment's bbox (deduplicated). */
  near(a: Vec2, b: Vec2): BgtPolygon[] {
    const out = new Set<BgtPolygon>();
    for (let i = Math.floor(Math.min(a[0], b[0]) / this.g); i <= Math.floor(Math.max(a[0], b[0]) / this.g); i++) for (let j = Math.floor(Math.min(a[1], b[1]) / this.g); j <= Math.floor(Math.max(a[1], b[1]) / this.g); j++) for (const p of this.cells.get(`${i}_${j}`) ?? []) out.add(p);
    return [...out];
  }
}

export interface Interval { a: number; b: number; cls: SurfaceClass }

/** Intervals of t along the line p + t·n inside each polygon (even-odd over its rings). */
export function crossIntervals(polys: readonly BgtPolygon[], p: Vec2, n: Vec2, reach: number): Interval[] {
  const out: Interval[] = [];
  const a: Vec2 = [p[0] - n[0] * reach, p[1] - n[1] * reach], b: Vec2 = [p[0] + n[0] * reach, p[1] + n[1] * reach];
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
  for (const poly of polys) {
    if (poly.bbox[2] < x0 || poly.bbox[0] > x1 || poly.bbox[3] < y0 || poly.bbox[1] > y1) continue;
    const ts: number[] = [];
    for (const ring of poly.rings) for (let i = 0; i < ring.length; i++) {
      const c = ring[i], d = ring[(i + 1) % ring.length];
      // Solve p + t·n = c + u·(d − c), unit n.
      const ex = d[0] - c[0], ey = d[1] - c[1], den = n[0] * ey - n[1] * ex;
      if (Math.abs(den) < 1e-12) continue;
      const wx = c[0] - p[0], wy = c[1] - p[1];
      const t = (wx * ey - wy * ex) / den, u = (wx * n[1] - wy * n[0]) / den;
      if (u >= 0 && u < 1 && t >= -reach && t <= reach) ts.push(t);
    }
    ts.sort((s, t) => s - t);
    for (let k = 0; k + 1 < ts.length; k += 2) if (ts[k + 1] - ts[k] > 0.02) out.push({ a: ts[k], b: ts[k + 1], cls: poly.cls });
  }
  return out;
}

/** Merge intervals (any order) whose gap is at most `gap`. */
function merge(iv: readonly { a: number; b: number }[], gap: number): { a: number; b: number }[] {
  const s = [...iv].sort((x, y) => x.a - y.a), out: { a: number; b: number }[] = [];
  for (const i of s) {
    const last = out[out.length - 1];
    if (last && i.a <= last.b + gap) last.b = Math.max(last.b, i.b); else out.push({ a: i.a, b: i.b });
  }
  return out;
}

/**
 * Widths at one cross-line. The own surface is the merged run of `own`-class
 * intervals containing the centreline or within `snapM` of it; footpath and
 * cycle path are summed outward from its edges (per side, allowing small gaps).
 */
export function sectionWidths(polys: readonly BgtPolygon[], p: Vec2, n: Vec2, own: ReadonlySet<SurfaceClass>, opts: { reach?: number; snapM?: number; gapM?: number } = {}): SectionWidths | null {
  const reach = opts.reach ?? 22, snap = opts.snapM ?? 2.5, gap = opts.gapM ?? 0.6;
  const iv = crossIntervals(polys, p, n, reach);
  const runs = merge(iv.filter(i => own.has(i.cls)), gap);
  let best: { a: number; b: number } | null = null, bestD = Infinity;
  for (const r of runs) {
    const d = r.a <= 0 && r.b >= 0 ? 0 : Math.min(Math.abs(r.a), Math.abs(r.b));
    if (d < bestD) { bestD = d; best = r; }
  }
  if (!best || bestD > snap) return null;
  const run = best.b - best.a;
  // A way drawn on one half of a dual carriageway (or beside a tram bed) sits near one edge of the merged
  // run: its own width is twice the distance to the nearer edge, not the whole run.
  const lopsided = best.a < 0 && best.b > 0 && Math.abs(best.a + best.b) / run > 0.35;
  const width = lopsided ? 2 * Math.min(Math.abs(best.a), Math.abs(best.b)) : run;
  if (width < 0.8 || width > 45) return null;
  const sideWidths = (dir: 1 | -1) => {
    const edge = dir > 0 ? best!.b : -best!.a;
    let foot = 0, cycle = 0, pos = edge;
    const tagged = iv.filter(i => i.cls === 'foot' || i.cls === 'cycle').map(i => dir > 0 ? { a: i.a, b: i.b, cls: i.cls } : { a: -i.b, b: -i.a, cls: i.cls });
    for (const i of tagged.sort((x, y) => x.a - y.a)) {
      if (i.b <= pos + 0.02) continue;
      if (i.a > pos + 1.0) break;
      const w = i.b - Math.max(i.a, pos);
      if (i.cls === 'foot') foot += w; else cycle += w;
      pos = Math.max(pos, i.b);
    }
    return { foot, cycle };
  };
  const l = sideWidths(1), r = sideWidths(-1);
  const per = (a: number, b: number) => { const n2 = (a > 0.3 ? 1 : 0) + (b > 0.3 ? 1 : 0); return n2 ? (a + b) / n2 : 0; };
  return { widthM: width, sidewalkM: Math.min(per(l.foot, r.foot), 8), cycleM: Math.min(per(l.cycle, r.cycle), 5) };
}

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };

/** Stations at 25 / 50 / 75 % of a polyline's length (50 % only when short), with the local unit normal. */
export function stationsOf(line: readonly Vec2[], fractions: readonly number[]): { p: Vec2; n: Vec2 }[] {
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  const total = cum[cum.length - 1];
  if (!(total > 0)) return [];
  const out: { p: Vec2; n: Vec2 }[] = [];
  for (const f of total < 14 ? [0.5] : fractions) {
    const s = f * total;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const seg = cum[i] - cum[i - 1] || 1, t = (s - cum[i - 1]) / seg;
    const a = line[i - 1], b = line[i], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    out.push({ p: [a[0] + dx * t, a[1] + dy * t], n: [-dy / len, dx / len] });
  }
  return out;
}

/** Median widths over a way's stations (null: no station found the way's own surface). */
export function wayWidths(index: BgtIndex, line: readonly Vec2[], own: ReadonlySet<SurfaceClass>, usable: (poly: BgtPolygon) => boolean = () => true): { widths: SectionWidths; stations: number } | null {
  const rows: SectionWidths[] = [];
  for (const { p, n } of stationsOf(line, [0.25, 0.5, 0.75])) {
    const polys = index.near([p[0] - 24, p[1] - 24], [p[0] + 24, p[1] + 24]).filter(usable);
    const s = sectionWidths(polys, p, n, own);
    if (s) rows.push(s);
  }
  if (!rows.length) return null;
  return { widths: { widthM: median(rows.map(r => r.widthM)), sidewalkM: median(rows.map(r => r.sidewalkM)), cycleM: median(rows.map(r => r.cycleM)) }, stations: rows.length };
}

export const toDm = (m: number) => Math.max(0, Math.min(255, Math.round(m * 10)));
