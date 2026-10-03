// Street ensembles: which buildings along a street read as one design.
//
// Every building is styled on its own (hash of its id), so a shopping street reads as
// random. A real street is built in runs: one builder's terrace has one year, one eave
// line, one bay look and one wall colour family; a shop band runs under it; the corner
// building closes it. This module finds those groups from data the game already has
// (footprints, construction year, height, the shopfronts extract, street centrelines).
//
// Pure and deterministic, no DOM and no three, so the chunk worker can run it per tile
// (with a margin of neighbouring tiles) and a check script can measure it on named
// streets. It only GROUPS and reports; applying a shared bay look / eave / shop band is
// the caller's job (see `ensembleLook`).
//
// Units are metres in a flat local frame (x east, y north).

export type Pt = readonly [number, number];

export interface EnsembleBuilding {
  id: string;
  /** Outer ring, metres. */
  ring: readonly Pt[];
  heightM: number;
  /** Construction year, null when unknown. */
  year: number | null;
  /** True when the shopfronts extract puts a shop, café or bar on this building. */
  shop: boolean;
}

export interface EnsembleWay {
  id: string;
  /** Street name, '' when unnamed. Same-name ways that touch are chained into one street. */
  name: string;
  highway: string;
  points: readonly Pt[];
}

export interface EnsembleOptions {
  /** Farthest a building may be from a street centreline to be its frontage, m. */
  reachM: number;
  /** A building this far behind the face's building line is a back building, not frontage, m. */
  lineToleranceM: number;
  /** A gap in the frontage longer than this ends the block face (a cross street), m. */
  maxGapM: number;
  /** Adjacent buildings within this many years are one builder's run. */
  yearTolerance: number;
  /** ... and within this many metres of height (about one storey is 3 m). */
  heightToleranceM: number;
  /** A run never spans more than this many years end to end. */
  maxYearSpan: number;
  /** Eaves within this of their ensemble's median are snapped to it, m. */
  snapEavesM: number;
  /** A face is commercial when this share of its buildings carry a shopfront, over `minShopRunM`. */
  commercialShare: number;
  minShopRunM: number;
}

export const DEFAULT_ENSEMBLE_OPTIONS: EnsembleOptions = {
  reachM: 30, lineToleranceM: 6, maxGapM: 5, yearTolerance: 2, heightToleranceM: 1.6, maxYearSpan: 6,
  snapEavesM: 1.2, commercialShare: 0.35, minShopRunM: 40,
};

/** One street side a building fronts. A corner building has two. */
export interface Frontage {
  building: number;
  chain: number;
  side: 1 | -1;
  /** Arc length along the street chain of the wall's two ends, m. */
  startM: number;
  endM: number;
  /** Distance from the street centreline to the wall, m. */
  depthM: number;
  /** Direction of the street here, radians. */
  bearing: number;
  corner: boolean;
}

export interface BlockFace {
  id: string;
  chain: number;
  streetName: string;
  side: 1 | -1;
  /** Frontages in order along the street. */
  members: Frontage[];
  startM: number;
  endM: number;
  lengthM: number;
  shopShare: number;
  commercial: boolean;
  /** Stretches [startM, endM] of unbroken shopfronts (one non-shop building between two shops is bridged). */
  shopBands: Array<[number, number]>;
}

export interface Ensemble {
  id: string;
  faceId: string;
  /** Building indices, in order along the face. */
  buildings: number[];
  startM: number;
  endM: number;
  /** Median construction year of the members that have one; null when none do. */
  year: number | null;
  /** Median wall height: the ensemble's eave line, m. */
  eaveM: number;
  /** Every member's height after snapping to the eave line where it is within tolerance. */
  snappedM: number[];
  /** Stable hash seed shared by the members: bay look, wall colour family and cornice draw from it. */
  seed: string;
  /** Plot widths of the members, m. */
  plotWidthsM: number[];
}

export interface StreetAnalysis {
  chains: Array<{ name: string; highway: string; points: Pt[]; cumM: number[] }>;
  frontages: Frontage[];
  faces: BlockFace[];
  ensembles: Ensemble[];
  /** Building index -> ensemble index (the building's primary frontage), -1 when none. */
  ensembleOf: Int32Array;
}

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN;
};
const quantile = (xs: readonly number[], q: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN;
};

function hash(text: string): number {
  let h = 2166136261;
  for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---- 1. Streets: chain same-name ways that touch ------------------------------------------------

const key = (p: Pt) => `${Math.round(p[0] / 1.5)},${Math.round(p[1] / 1.5)}`;

/** Chain ways of one name and one carriageway class end to end, so a block face does not break where OSM split the way. */
export function chainWays(ways: readonly EnsembleWay[]): StreetAnalysis['chains'] {
  const out: StreetAnalysis['chains'] = [];
  const groups = new Map<string, EnsembleWay[]>();
  for (const w of ways) {
    if (w.points.length < 2) continue;
    const g = w.name ? `${w.name}|${w.highway === 'cycleway' ? 'c' : 'r'}` : `#${w.id}`;
    (groups.get(g) ?? groups.set(g, []).get(g)!).push(w);
  }
  for (const [g, list] of groups) {
    const ends = new Map<string, number[]>();
    list.forEach((w, i) => { for (const p of [w.points[0], w.points[w.points.length - 1]]) (ends.get(key(p)) ?? ends.set(key(p), []).get(key(p))!).push(i); });
    const used = new Set<number>();
    for (let seed = 0; seed < list.length; seed++) {
      if (used.has(seed)) continue;
      used.add(seed);
      let pts: Pt[] = [...list[seed].points];
      for (const dir of [1, -1]) {
        for (;;) {
          const tip = dir === 1 ? pts[pts.length - 1] : pts[0];
          const next = (ends.get(key(tip)) ?? []).filter(i => !used.has(i));
          if (next.length !== 1) break;
          used.add(next[0]);
          const w = list[next[0]].points;
          const forward = key(w[0]) === key(tip) ? w : [...w].reverse();
          pts = dir === 1 ? [...pts, ...forward.slice(1)] : [...[...forward].reverse().slice(0, -1), ...pts];
        }
      }
      const cumM = [0];
      for (let i = 1; i < pts.length; i++) cumM.push(cumM[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      out.push({ name: g.startsWith('#') ? '' : g.split('|')[0], highway: list[seed].highway, points: pts, cumM });
    }
  }
  return out;
}

// ---- 2. Frontage: which street a building fronts, which side, between which chainages ---------

interface Hit { chain: number; dist: number; along: number; side: 1 | -1; bearing: number }

function nearest(point: Pt, chains: StreetAnalysis['chains'], i: number): Hit | null {
  const { points, cumM } = chains[i];
  let best: Hit | null = null;
  for (let s = 1; s < points.length; s++) {
    const [ax, ay] = points[s - 1], [bx, by] = points[s];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    const t = Math.max(0, Math.min(1, ((point[0] - ax) * dx + (point[1] - ay) * dy) / len2));
    const d = Math.hypot(point[0] - (ax + t * dx), point[1] - (ay + t * dy));
    if (!best || d < best.dist) {
      const cross = dx * (point[1] - ay) - dy * (point[0] - ax);
      best = { chain: i, dist: d, along: cumM[s - 1] + t * Math.sqrt(len2), side: cross >= 0 ? 1 : -1, bearing: Math.atan2(dy, dx) };
    }
  }
  return best;
}

/** Points that sample a ring: its vertices and edge midpoints. */
function samples(ring: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < ring.length; i++) { out.push(ring[i]); out.push([(ring[i][0] + ring[i + 1][0]) / 2, (ring[i][1] + ring[i + 1][1]) / 2]); }
  return out;
}

class Grid {
  private readonly cells = new Map<string, number[]>();
  constructor(chains: StreetAnalysis['chains'], private readonly cell = 40) {
    chains.forEach((c, i) => {
      for (let s = 1; s < c.points.length; s++) {
        const [a, b] = [c.points[s - 1], c.points[s]];
        for (let gx = Math.floor(Math.min(a[0], b[0]) / cell); gx <= Math.floor(Math.max(a[0], b[0]) / cell); gx++)
          for (let gy = Math.floor(Math.min(a[1], b[1]) / cell); gy <= Math.floor(Math.max(a[1], b[1]) / cell); gy++) {
            const k = `${gx},${gy}`, list = this.cells.get(k) ?? this.cells.set(k, []).get(k)!;
            if (list[list.length - 1] !== i) list.push(i);
          }
      }
    });
  }
  near(x: number, y: number, r: number): Set<number> {
    const out = new Set<number>();
    for (let gx = Math.floor((x - r) / this.cell); gx <= Math.floor((x + r) / this.cell); gx++)
      for (let gy = Math.floor((y - r) / this.cell); gy <= Math.floor((y + r) / this.cell); gy++) for (const i of this.cells.get(`${gx},${gy}`) ?? []) out.add(i);
    return out;
  }
}

export function frontagesOf(buildings: readonly EnsembleBuilding[], chains: StreetAnalysis['chains'], opts: EnsembleOptions): Frontage[] {
  const grid = new Grid(chains);
  const out: Frontage[] = [];
  buildings.forEach((b, bi) => {
    const pts = samples(b.ring);
    if (pts.length < 6) return;
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const reach = opts.reachM + Math.max(...pts.map(p => Math.hypot(p[0] - cx, p[1] - cy)));
    const cand: Array<{ chain: number; dmin: number; start: number; end: number; side: 1 | -1; bearing: number; score: number }> = [];
    for (const ci of grid.near(cx, cy, reach)) {
      const hits = pts.map(p => nearest(p, chains, ci)!).filter(Boolean);
      if (!hits.length) continue;
      const dmin = Math.min(...hits.map(h => h.dist));
      if (dmin > opts.reachM) continue;
      // The wall facing the street: samples within a few metres of the nearest one.
      const front = hits.filter(h => h.dist <= dmin + 4);
      const alongs = front.map(h => h.along);
      const near = front.reduce((a, h) => (h.dist < a.dist ? h : a));
      cand.push({ chain: ci, dmin, start: Math.min(...alongs), end: Math.max(...alongs), side: near.side, bearing: near.bearing,
        // A cycle track beside the carriageway must not win the building: penalise it.
        score: dmin + (chains[ci].highway === 'cycleway' ? 6 : 0) });
    }
    if (!cand.length) return;
    cand.sort((a, b) => a.score - b.score);
    const [first] = cand;
    out.push({ building: bi, chain: first.chain, side: first.side, startM: first.start, endM: first.end, depthM: first.dmin, bearing: first.bearing, corner: false });
    // A second street, crossing the first at an angle, with a real wall on it: a corner building.
    for (const c of cand.slice(1)) {
      if (c.chain === first.chain || c.dmin > first.dmin + 12 || c.end - c.start < 4) continue;
      // The same street split into two chains (a way break, a cycle track) is not a crossing.
      if (chains[c.chain].name && chains[c.chain].name === chains[first.chain].name) continue;
      // A side street worth a corner is one the game can drive: not a service alley or a path.
      if (chains[c.chain].highway === 'cycleway' || chains[c.chain].highway === 'pedestrian') continue;
      const turn = Math.abs(((c.bearing - first.bearing + Math.PI * 3) % Math.PI) - Math.PI / 2);
      if (turn > Math.PI / 2 - 0.6) continue; // within ~35 degrees of parallel: the same street, not a crossing
      out.push({ building: bi, chain: c.chain, side: c.side, startM: c.start, endM: c.end, depthM: c.dmin, bearing: c.bearing, corner: true });
      out[out.length - 2].corner = true;
      break;
    }
  });
  return out;
}

// ---- 3. Block faces ---------------------------------------------------------------------------

export function blockFacesOf(frontages: readonly Frontage[], buildings: readonly EnsembleBuilding[], chains: StreetAnalysis['chains'], opts: EnsembleOptions): BlockFace[] {
  const byFace = new Map<string, Frontage[]>();
  for (const f of frontages) (byFace.get(`${f.chain}:${f.side}`) ?? byFace.set(`${f.chain}:${f.side}`, []).get(`${f.chain}:${f.side}`)!).push(f);
  const faces: BlockFace[] = [];
  for (const [k, all] of byFace) {
    // The building line: back buildings (courtyards, rear wings) stand well behind it.
    const line = quantile(all.map(f => f.depthM), 0.25);
    const list = all.filter(f => f.depthM <= line + opts.lineToleranceM).sort((a, b) => a.startM - b.startM);
    let run: Frontage[] = [], reach = -Infinity, n = 0;
    const flush = () => {
      if (run.length >= 2) {
        const shop = run.filter(f => buildings[f.building].shop);
        const bands = shopBands(run, buildings, opts);
        const startM = run[0].startM, endM = Math.max(...run.map(f => f.endM));
        faces.push({ id: `${k}.${n++}`, chain: run[0].chain, streetName: chains[run[0].chain].name, side: run[0].side, members: run, startM, endM, lengthM: endM - startM,
          shopShare: shop.length / run.length, commercial: false, shopBands: bands });
      }
      run = []; reach = -Infinity;
    };
    for (const f of list) {
      if (run.length && f.startM - reach > opts.maxGapM) flush();
      run.push(f); reach = Math.max(reach, f.endM);
    }
    flush();
  }
  for (const face of faces) face.commercial = face.shopShare >= opts.commercialShare && face.shopBands.some(([a, b]) => b - a >= opts.minShopRunM);
  return faces;
}

/** Unbroken shopfront stretches; one non-shop building between two shops is bridged (a shop with an upper-flat door, a gap in the extract). */
function shopBands(run: readonly Frontage[], buildings: readonly EnsembleBuilding[], opts: EnsembleOptions): Array<[number, number]> {
  const bands: Array<[number, number]> = [];
  let from = NaN, to = NaN, misses = 0;
  for (const f of run) {
    if (buildings[f.building].shop) {
      if (Number.isNaN(from)) from = f.startM;
      to = f.endM; misses = 0;
    } else if (!Number.isNaN(from)) {
      misses++;
      if (misses > 1) { bands.push([from, to]); from = NaN; misses = 0; }
    }
  }
  if (!Number.isNaN(from)) bands.push([from, to]);
  return bands.filter(([a, b]) => b - a >= Math.min(12, opts.minShopRunM));
}

// ---- 4. Ensembles: one builder's run ---------------------------------------------------------

export function ensemblesOf(face: BlockFace, buildings: readonly EnsembleBuilding[], opts: EnsembleOptions): Ensemble[] {
  const groups: Frontage[][] = [];
  let cur: Frontage[] = [];
  const joins = (a: EnsembleBuilding, b: EnsembleBuilding, firstYear: number | null): boolean => {
    if (a.year === null || b.year === null) return false;
    if (Math.abs(a.year - b.year) > opts.yearTolerance) return false;
    if (firstYear !== null && Math.abs(b.year - firstYear) > opts.maxYearSpan) return false;
    return Math.abs(a.heightM - b.heightM) <= opts.heightToleranceM;
  };
  for (const f of face.members) {
    const b = buildings[f.building];
    if (cur.length && joins(buildings[cur[cur.length - 1].building], b, buildings[cur[0].building].year)) cur.push(f);
    else { if (cur.length) groups.push(cur); cur = [f]; }
  }
  if (cur.length) groups.push(cur);
  return groups.map((g, i) => {
    const bs = g.map(f => buildings[f.building]);
    const years = bs.map(b => b.year).filter((y): y is number => y !== null);
    const eave = median(bs.map(b => b.heightM));
    return {
      id: `${face.id}#${i}`, faceId: face.id, buildings: g.map(f => f.building), startM: g[0].startM, endM: Math.max(...g.map(f => f.endM)),
      year: years.length ? median(years) : null, eaveM: eave,
      snappedM: bs.map(b => (Math.abs(b.heightM - eave) <= opts.snapEavesM ? eave : b.heightM)),
      seed: bs[0].id, plotWidthsM: g.map(f => f.endM - f.startM),
    };
  });
}

/** Everything in one call. */
export function analyseStreets(buildings: readonly EnsembleBuilding[], ways: readonly EnsembleWay[], options: Partial<EnsembleOptions> = {}): StreetAnalysis {
  const opts = { ...DEFAULT_ENSEMBLE_OPTIONS, ...options };
  const chains = chainWays(ways);
  const frontages = frontagesOf(buildings, chains, opts);
  const faces = blockFacesOf(frontages, buildings, chains, opts);
  const ensembles = faces.flatMap(face => ensemblesOf(face, buildings, opts));
  const ensembleOf = new Int32Array(buildings.length).fill(-1);
  ensembles.forEach((e, ei) => { for (const b of e.buildings) if (ensembleOf[b] < 0) ensembleOf[b] = ei; });
  return { chains, frontages, faces, ensembles, ensembleOf };
}

/**
 * What an ensemble hands each of its buildings, so the per-feature path can draw it: one
 * bay-look pick, one wall colour pick, one cornice height, for the whole run. Members keep
 * their own plot width, door and shop; only the choices that should agree are shared.
 */
export function ensembleLook(e: Ensemble): { seed: string; wallPick: number; bayPick: number; eaveM: number } {
  const h = hash(e.seed);
  return { seed: e.seed, wallPick: h >>> 7, bayPick: h >>> 4, eaveM: e.eaveM };
}
