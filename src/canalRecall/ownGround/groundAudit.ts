// Ground defect audit (lane G0 of the Ground v2 plan, 2026-11-10; pure, Node-only, no runtime import).
//
// Measures one built cell (groundCell.ts BuiltCell) for the defects the user found by eye: torn shards, one layer poking
// through another, coplanar layers that z-fight, cracks, ground floating over the DTM. Everything is metres and square
// metres in the game frame. The detector runs on the cell's own meshes: a raster of every surface layer's height
// (RES_M samples) answers poke-through, z-fight, crack and float; the triangles answer slivers; welded boundary edges
// answer T-junction cracks. G2 (one clipped partition per cell) must take every one of these to zero.
//
// Definitions (documented in docs/reports/ground-audit-20261110.md):
//   sliver      triangle with aspect (longest edge² / 2·area) > 20 and area > 0.05 m²
//   thin        a sliver whose height over its longest edge is under 0.5 m (a road ribbon is wider; this is the torn kind)
//   poke        a lower-precedence layer above a higher one by more than 5 mm (and at most 1 m: more is another level)
//   zfight      two different layers within ±5 mm of each other at a sample
//   crack       raster sample inside the cell covered by no surface layer, in a hole at most 6 m wide (wider: void, not summed)
//   float       a natural-ground layer more than 0.10 m over the DTM
//   shard area  flagged raster samples (poke ∪ zfight ∪ crack ∪ float); plain slivers are reported, not summed

import type { BuiltCell, GroundLayer } from './groundCell.js';

export type Vec2 = [number, number];

export const DEFECTS = ['sliver', 'thin', 'poke', 'zfight', 'crack', 'float', 'void', 'pokeS', 'floatS'] as const;
export type Defect = (typeof DEFECTS)[number];

/** Thresholds, as the plan states them. */
export const AUDIT = { sliverAspect: 20, sliverMinM2: 0.05, pokeM: 0.005, pokeMaxM: 1, zfightM: 0.005, floatM: 0.10, resM: 0.5, tileM: 125, thinHeightM: 0.5, crackMaxM: 6, tJoinM: 0.03, tJoinDzM: 0.005 } as const;

/**
 * Intended precedence of the surface layers, higher draws over lower (plan G2: carriageway > cycle > footway > rail bed >
 * parking > courtyard > park > open ground > OSM fill > land). Overlays (paint, kerb, bollard, furniture, hedge, tram,
 * water, quay, deckBody) are not part of the surface and are left out.
 */
export const SURFACE_RANK: Partial<Record<GroundLayer, number>> = {
  land: 0, bare: 1, sand: 1, garden: 1.5, shrub: 2, bark: 2, bed: 2, lawn: 2, park: 2, wood: 2, parkGravel: 2.2, parkPath: 2.4,
  square: 3, parking: 3, ballast: 4, track: 4.5, gravel: 5, paving: 5, klinker: 6, brick: 6, asphalt: 6, cycle: 7, deckTop: 8,
};
export const SURFACE_LAYERS = Object.keys(SURFACE_RANK) as GroundLayer[];
/** Layers that are the natural ground: they stay on the DTM, so any float over it is a defect. */
export const NATURAL_LAYERS: ReadonlySet<GroundLayer> = new Set<GroundLayer>(['land', 'bare', 'sand', 'garden', 'shrub', 'bark', 'bed', 'lawn', 'park', 'wood', 'parkGravel', 'parkPath', 'square', 'parking']);
/** Layers that cover the cell for the crack test beyond the surface: water and the deck body are ground too. */
const COVER_ONLY: GroundLayer[] = ['water', 'deckBody', 'quay'];
/** Layers whose presence at a sample means the DTM is not the ground there (a deck, a rail bed): no float test. */
const RAISED: ReadonlySet<GroundLayer> = new Set<GroundLayer>(['deckTop', 'deckBody', 'ballast', 'track']);

export interface Window { id: string; x: number; y: number; r: number }
export interface OpenRing { pts: Vec2[]; holes: Vec2[][]; bb: [number, number, number, number] }

export interface Defects { sliverN: number; sliverM2: number; thinM2: number; pokeM2: number; zfightM2: number; crackM2: number; floatM2: number; voidM2: number; /** Subsets: poke more than 5 cm, float more than 30 cm (visible, not offset-resolved). */ pokeSevereM2: number; floatSevereM2: number; /** T-junction cracks (same-layer vertex on a boundary edge, 5 mm or more off it) and those 5 cm or more: counts, not areas. */ tjN: number; tjSevereN: number; shardM2: number }
export const emptyDefects = (): Defects => ({ sliverN: 0, sliverM2: 0, thinM2: 0, pokeM2: 0, zfightM2: 0, crackM2: 0, floatM2: 0, voidM2: 0, pokeSevereM2: 0, floatSevereM2: 0, tjN: 0, tjSevereN: 0, shardM2: 0 });
export function addDefects(a: Defects, b: Defects): Defects {
  return { sliverN: a.sliverN + b.sliverN, sliverM2: a.sliverM2 + b.sliverM2, thinM2: a.thinM2 + b.thinM2, pokeM2: a.pokeM2 + b.pokeM2, zfightM2: a.zfightM2 + b.zfightM2, crackM2: a.crackM2 + b.crackM2, floatM2: a.floatM2 + b.floatM2, voidM2: a.voidM2 + b.voidM2, pokeSevereM2: a.pokeSevereM2 + b.pokeSevereM2, floatSevereM2: a.floatSevereM2 + b.floatSevereM2, tjN: a.tjN + b.tjN, tjSevereN: a.tjSevereN + b.tjSevereN, shardM2: a.shardM2 + b.shardM2 };
}

/** A defect total plus where it comes from: per layer (the offender) and how much lies inside open-ground polygons. */
export interface Tally {
  d: Defects;
  /** Offender layer → m² per defect kind. */
  byLayer: Record<string, Record<Defect, number>>;
  /** Shard area (flagged samples + slivers) inside an open-ground-v1 polygon. */
  openGroundShardM2: number;
  /** With AuditInput.pairs (lane G1): m² per "kind:lower<higher" layer pair (poke, zfight), which pair fights. */
  pairs?: Record<string, number>;
}
const emptyTally = (): Tally => ({ d: emptyDefects(), byLayer: {}, openGroundShardM2: 0 });
function bump(t: Tally, kind: Defect, layer: string, m2: number, inOpen: boolean): void {
  const row = (t.byLayer[layer] ??= { sliver: 0, thin: 0, poke: 0, zfight: 0, crack: 0, float: 0, void: 0, pokeS: 0, floatS: 0 });
  row[kind] += m2;
  if (kind === 'sliver') t.d.sliverM2 += m2; else if (kind === 'thin') t.d.thinM2 += m2; else if (kind === 'poke') t.d.pokeM2 += m2; else if (kind === 'zfight') t.d.zfightM2 += m2; else if (kind === 'crack') t.d.crackM2 += m2; else if (kind === 'void') t.d.voidM2 += m2; else if (kind === 'pokeS') t.d.pokeSevereM2 += m2; else if (kind === 'floatS') t.d.floatSevereM2 += m2; else t.d.floatM2 += m2;
  if (kind !== 'sliver' && kind !== 'void' && kind !== 'pokeS' && kind !== 'floatS') t.d.shardM2 += m2;
  if (inOpen && kind !== 'sliver' && kind !== 'void' && kind !== 'pokeS' && kind !== 'floatS') t.openGroundShardM2 += m2;
}

export interface TJunctions { n: number; lengthM: number; worstDzM: number; hits: { x: number; y: number; dz: number }[] }

export interface CellAudit {
  key: string;
  triangles: number;
  tiles: Map<string, Tally>;
  total: Tally;
  windows: Record<string, Tally>;
  tjunctions: TJunctions;
}

export interface AuditInput {
  cell: BuiltCell;
  /** The DTM (surface.relief), scene z. */
  dtm: (x: number, y: number) => number;
  windows?: readonly Window[];
  openRings?: readonly OpenRing[];
  resM?: number;
  /** Skip the T-junction pass (it is the slowest). */
  noTJunctions?: boolean;
  /** Tally poke and z-fight per layer pair (Tally.pairs; diagnostics, lane G1). */
  pairs?: boolean;
}

const inRing = (x: number, y: number, ring: readonly Vec2[]): boolean => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const inOpenRing = (x: number, y: number, rings: readonly OpenRing[]): boolean => {
  for (const r of rings) {
    if (x < r.bb[0] || x > r.bb[2] || y < r.bb[1] || y > r.bb[3]) continue;
    if (inRing(x, y, r.pts) && !r.holes.some(h => inRing(x, y, h))) return true;
  }
  return false;
};
export const ringBox = (pts: readonly Vec2[]): [number, number, number, number] => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
};

/** Aspect of a triangle: longest edge squared over twice the area (a 1 : 1 : 1 triangle is 1.15, a sliver is large). */
export function aspect(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): { aspect: number; area: number } {
  const area = Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
  const l = Math.max((bx - ax) ** 2 + (by - ay) ** 2, (cx - bx) ** 2 + (cy - by) ** 2, (ax - cx) ** 2 + (ay - cy) ** 2);
  return { aspect: area > 0 ? l / (2 * area) : Infinity, area };
}

export function auditCell(input: AuditInput): CellAudit {
  const { cell, dtm } = input, res = input.resM ?? AUDIT.resM, tileM = AUDIT.tileM;
  const [rx0, ry0, rx1, ry1] = cell.rect;
  const windows = input.windows ?? [], openRings = input.openRings ?? [];
  const tiles = new Map<string, Tally>(), total = emptyTally(), win: Record<string, Tally> = Object.fromEntries(windows.map(w => [w.id, emptyTally()]));
  const tileAt = (x: number, y: number) => `${Math.floor((x - rx0) / tileM)}_${Math.floor((y - ry0) / tileM)}`;
  const tallies = (x: number, y: number): Tally[] => {
    const k = tileAt(x, y);
    let t = tiles.get(k); if (!t) tiles.set(k, t = emptyTally());
    const out = [total, t];
    for (const w of windows) if ((x - w.x) ** 2 + (y - w.y) ** 2 <= w.r * w.r) out.push(win[w.id]);
    return out;
  };
  const record = (kind: Defect, layer: string, x: number, y: number, m2: number) => {
    const open = openRings.length > 0 && inOpenRing(x, y, openRings);
    for (const t of tallies(x, y)) bump(t, kind, layer, m2, open);
  };
  const pair = (key: string, x: number, y: number, m2: number) => { if (input.pairs) for (const t of tallies(x, y)) { const p = (t.pairs ??= {}); p[key] = (p[key] ?? 0) + m2; } };

  // Slivers: every surface triangle.
  let triangles = 0;
  const meshes: { layer: GroundLayer; rank: number; p: Float32Array; ix: Uint32Array }[] = [];
  for (const layer of SURFACE_LAYERS) {
    const m = cell.layers[layer]; if (!m) continue;
    meshes.push({ layer, rank: SURFACE_RANK[layer]!, p: m.positions, ix: m.indices });
  }
  const coverOnly = COVER_ONLY.flatMap(layer => { const m = cell.layers[layer]; return m ? [{ layer, p: m.positions, ix: m.indices }] : []; });
  for (const { layer, p, ix } of meshes) {
    for (let i = 0; i < ix.length; i += 3) {
      triangles++;
      const a = ix[i] * 3, b = ix[i + 1] * 3, c = ix[i + 2] * 3;
      const t = aspect(p[a], p[a + 1], p[b], p[b + 1], p[c], p[c + 1]);
      if (t.aspect > AUDIT.sliverAspect && t.area > AUDIT.sliverMinM2) {
        const cx = (p[a] + p[b] + p[c]) / 3, cy = (p[a + 1] + p[b + 1] + p[c + 1]) / 3;
        if (cx < rx0 || cx >= rx1 || cy < ry0 || cy >= ry1) continue;
        record('sliver', layer, cx, cy, t.area);
        for (const tl of tallies(cx, cy)) tl.d.sliverN++;
        const longest = Math.sqrt(Math.max((p[b] - p[a]) ** 2 + (p[b + 1] - p[a + 1]) ** 2, (p[c] - p[b]) ** 2 + (p[c + 1] - p[b + 1]) ** 2, (p[a] - p[c]) ** 2 + (p[a + 1] - p[c + 1]) ** 2));
        if ((2 * t.area) / longest < AUDIT.thinHeightM) record('thin', layer, cx, cy, t.area);
      }
    }
  }

  // Raster: per tile, a height buffer per layer.
  const n = Math.ceil(tileM / res), nn = n * n, sample = res * res;
  const rasterLayers = [...meshes.map(m => ({ layer: m.layer, rank: m.rank, p: m.p, ix: m.ix, surface: true })), ...coverOnly.map(m => ({ layer: m.layer, rank: -1, p: m.p, ix: m.ix, surface: false }))];
  const bufs = rasterLayers.map(() => new Float32Array(nn));
  // Bin triangles by tile.
  const tx = Math.ceil((rx1 - rx0) / tileM), ty = Math.ceil((ry1 - ry0) / tileM);
  const bins: Uint32Array[][] = rasterLayers.map(() => []);
  rasterLayers.forEach((L, li) => {
    const lists: number[][] = Array.from({ length: tx * ty }, () => []);
    for (let i = 0; i < L.ix.length; i += 3) {
      const a = L.ix[i] * 3, b = L.ix[i + 1] * 3, c = L.ix[i + 2] * 3;
      const x0 = Math.min(L.p[a], L.p[b], L.p[c]), x1 = Math.max(L.p[a], L.p[b], L.p[c]), y0 = Math.min(L.p[a + 1], L.p[b + 1], L.p[c + 1]), y1 = Math.max(L.p[a + 1], L.p[b + 1], L.p[c + 1]);
      const i0 = Math.max(0, Math.floor((x0 - rx0) / tileM)), i1 = Math.min(tx - 1, Math.floor((x1 - rx0) / tileM)), j0 = Math.max(0, Math.floor((y0 - ry0) / tileM)), j1 = Math.min(ty - 1, Math.floor((y1 - ry0) / tileM));
      for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) lists[j * tx + k].push(i);
    }
    bins[li] = lists.map(l => Uint32Array.from(l));
  });
  const nSurface = meshes.length;
  for (let tj = 0; tj < ty; tj++) for (let ti = 0; ti < tx; ti++) {
    const ox = rx0 + ti * tileM, oy = ry0 + tj * tileM;
    let any = false;
    rasterLayers.forEach((L, li) => {
      const buf = bufs[li]; buf.fill(NaN);
      const list = bins[li][tj * tx + ti];
      if (list.length) any = true;
      for (const i of list) {
        const a = L.ix[i] * 3, b = L.ix[i + 1] * 3, c = L.ix[i + 2] * 3;
        const ax = L.p[a], ay = L.p[a + 1], az = L.p[a + 2], bx = L.p[b], by = L.p[b + 1], bz = L.p[b + 2], cx = L.p[c], cy = L.p[c + 1], cz = L.p[c + 2];
        const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
        if (Math.abs(det) < 1e-9) continue;
        const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - ox) / res)), i1 = Math.min(n - 1, Math.floor((Math.max(ax, bx, cx) - ox) / res));
        const j0 = Math.max(0, Math.floor((Math.min(ay, by, cy) - oy) / res)), j1 = Math.min(n - 1, Math.floor((Math.max(ay, by, cy) - oy) / res));
        for (let j = j0; j <= j1; j++) {
          const py = oy + (j + 0.5) * res;
          for (let k = i0; k <= i1; k++) {
            const px = ox + (k + 0.5) * res;
            const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / det, l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / det, l3 = 1 - l1 - l2;
            if (l1 < -1e-7 || l2 < -1e-7 || l3 < -1e-7) continue;
            const z = l1 * az + l2 * bz + l3 * cz, o = j * n + k;
            if (!(buf[o] >= z)) buf[o] = z;
          }
        }
      }
    });
    if (!any) continue;
    const present: number[] = [];
    // Cracks are holes at most CRACK_MAX_M wide (bounded by covered samples along a row or a column); wider voids are no ground to draw.
    const cov = new Uint8Array(nn);
    for (let o = 0; o < nn; o++) for (let li = 0; li < rasterLayers.length; li++) if (buf_ok(bufs[li][o])) { cov[o] = 1; break; }
    const narrow = new Uint8Array(nn), maxRun = Math.round(AUDIT.crackMaxM / res);
    for (let a = 0; a < n; a++) for (const byRow of [true, false]) {
      let run = -1;
      for (let b = 0; b < n; b++) {
        const o = byRow ? a * n + b : b * n + a;
        if (cov[o]) {
          if (run >= 0 && b - run - 1 <= maxRun) for (let q = run + 1; q < b; q++) narrow[byRow ? a * n + q : q * n + a] = 1;
          run = b;
        }
      }
    }
    for (let j = 0; j < n; j++) {
      const py = oy + (j + 0.5) * res;
      if (py < ry0 || py >= ry1) continue;
      for (let k = 0; k < n; k++) {
        const px = ox + (k + 0.5) * res;
        if (px < rx0 || px >= rx1) continue;
        const o = j * n + k;
        present.length = 0;
        let covered = false, raised = false;
        for (let li = 0; li < rasterLayers.length; li++) {
          if (buf_ok(bufs[li][o])) { covered = true; if (li < nSurface) present.push(li); if (RAISED.has(rasterLayers[li].layer)) raised = true; }
        }
        if (!covered) { record(narrow[o] ? 'crack' : 'void', 'none', px, py, sample); continue; }
        // Poke and z-fight: every pair of surface layers at the sample.
        let flagged = false;
        for (let a = 0; a < present.length; a++) for (let b = a + 1; b < present.length; b++) {
          const la = rasterLayers[present[a]], lb = rasterLayers[present[b]], za = bufs[present[a]][o], zb = bufs[present[b]][o];
          if (Math.abs(za - zb) <= AUDIT.zfightM) { record('zfight', la.rank <= lb.rank ? la.layer : lb.layer, px, py, sample); pair(la.rank <= lb.rank ? `zfight:${la.layer}<${lb.layer}` : `zfight:${lb.layer}<${la.layer}`, px, py, sample); flagged = true; continue; }
          if (la.rank === lb.rank) continue;
          const [lo, hi, zlo, zhi] = la.rank < lb.rank ? [la, lb, za, zb] : [lb, la, zb, za];
          const up = zlo - zhi;
          if (up > AUDIT.pokeM && up <= AUDIT.pokeMaxM) { record('poke', lo.layer, px, py, sample); pair(`poke:${lo.layer}<${hi.layer}`, px, py, sample); if (up > 0.05) record('pokeS', lo.layer, px, py, sample); flagged = true; }
        }
        if (!flagged && !raised) {
          // Float: the natural layer on top more than 0.10 m over the DTM.
          for (const li of present) {
            if (!NATURAL_LAYERS.has(rasterLayers[li].layer)) continue;
            if (bufs[li][o] - dtm(px, py) > AUDIT.floatM) { record('float', rasterLayers[li].layer, px, py, sample); if (bufs[li][o] - dtm(px, py) > 0.3) record('floatS', rasterLayers[li].layer, px, py, sample); break; }
          }
        }
      }
    }
  }
  const tj: TJunctions = input.noTJunctions ? { n: 0, lengthM: 0, worstDzM: 0, hits: [] } : tJunctions(cell);
  for (const h of tj.hits) {
    if (h.x < rx0 || h.x >= rx1 || h.y < ry0 || h.y >= ry1) continue;
    for (const t of tallies(h.x, h.y)) { t.d.tjN++; if (h.dz >= 0.05) t.d.tjSevereN++; }
  }
  tj.hits = [];
  return { key: cell.key, triangles, tiles, total, windows: win, tjunctions: tj };
}
const buf_ok = (z: number) => z === z;

/**
 * T-junction cracks: a vertex of a layer lying on the interior of a boundary edge of the same layer's mesh, with a height
 * that differs from the edge's there by 5 mm or more. Neighbouring pieces refined to different depths leave these.
 */
export function tJunctions(cell: BuiltCell): TJunctions {
  const out: TJunctions = { n: 0, lengthM: 0, worstDzM: 0, hits: [] };
  const Q = 100, OFF = 1 << 21, M = 2 ** 26, B = 4;
  for (const layer of SURFACE_LAYERS) {
    const m = cell.layers[layer]; if (!m) continue;
    const p = m.positions, ix = m.indices;
    const ids = new Map<number, number>(), vx: number[] = [], vy: number[] = [], vz: number[] = [], remap = new Int32Array(p.length / 3).fill(-1);
    const vid = (v: number): number => {
      let r = remap[v]; if (r >= 0) return r;
      const key = (Math.round(p[v * 3] * Q) + OFF) * M + (Math.round(p[v * 3 + 1] * Q) + OFF);
      r = ids.get(key) ?? -1;
      if (r < 0) { r = vx.length; ids.set(key, r); vx.push(p[v * 3]); vy.push(p[v * 3 + 1]); vz.push(p[v * 3 + 2]); }
      remap[v] = r; return r;
    };
    const edges = new Map<number, number>();
    for (let i = 0; i < ix.length; i += 3) {
      const a = vid(ix[i]), b = vid(ix[i + 1]), c = vid(ix[i + 2]);
      for (const [u, v] of [[a, b], [b, c], [c, a]]) { if (u === v) continue; const k = Math.min(u, v) * M + Math.max(u, v); edges.set(k, (edges.get(k) ?? 0) + 1); }
    }
    const grid = new Map<number, number[]>();
    for (let v = 0; v < vx.length; v++) { const k = Math.floor(vx[v] / B) * 1e6 + Math.floor(vy[v] / B); (grid.get(k) ?? grid.set(k, []).get(k)!).push(v); }
    for (const [k, cnt] of edges) {
      if (cnt !== 1) continue;
      const u = Math.floor(k / M), v = k - u * M, ax = vx[u], ay = vy[u], bx = vx[v], by = vy[v], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
      if (len < 0.3) continue;
      for (let gx = Math.floor((Math.min(ax, bx) - 0.05) / B); gx <= Math.floor((Math.max(ax, bx) + 0.05) / B); gx++) for (let gy = Math.floor((Math.min(ay, by) - 0.05) / B); gy <= Math.floor((Math.max(ay, by) + 0.05) / B); gy++) {
        for (const w of grid.get(gx * 1e6 + gy) ?? []) {
          if (w === u || w === v) continue;
          const t = ((vx[w] - ax) * dx + (vy[w] - ay) * dy) / (len * len);
          if (t <= 0.01 || t >= 0.99) continue;
          if (Math.abs((vx[w] - ax) * dy - (vy[w] - ay) * dx) / len > AUDIT.tJoinM) continue;
          const dz = Math.abs(vz[w] - (vz[u] + (vz[v] - vz[u]) * t));
          if (dz < AUDIT.tJoinDzM) continue;
          out.n++; out.lengthM += len; if (dz > out.worstDzM) out.worstDzM = dz; out.hits.push({ x: vx[w], y: vy[w], dz });
        }
      }
    }
  }
  return out;
}

/** Plain-JSON form of a tally, rounded. */
export function tallyJson(t: Tally): unknown {
  const r = (v: number) => Math.round(v * 10) / 10;
  const d = t.d;
  const byLayer: Record<string, Record<string, number>> = {};
  for (const [l, row] of Object.entries(t.byLayer)) { const o: Record<string, number> = {}; for (const k of DEFECTS) if (row[k]) o[k] = r(row[k]); if (Object.keys(o).length) byLayer[l] = o; }
  return { sliverN: d.sliverN, sliverM2: r(d.sliverM2), thinM2: r(d.thinM2), pokeM2: r(d.pokeM2), zfightM2: r(d.zfightM2), crackM2: r(d.crackM2), floatM2: r(d.floatM2), voidM2: r(d.voidM2), pokeSevereM2: r(d.pokeSevereM2), floatSevereM2: r(d.floatSevereM2), tjN: d.tjN, tjSevereN: d.tjSevereN, shardM2: r(d.shardM2), openGroundShardM2: r(t.openGroundShardM2), byLayer, ...(t.pairs ? { pairs: Object.fromEntries(Object.entries(t.pairs).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, r(v)])) } : {}) };
}
