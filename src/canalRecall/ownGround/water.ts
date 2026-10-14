// Water for the own ground (pure): a signed-distance mask that cuts the land
// out of the canals, the water surface at canal level, and quay walls whose
// top follows the relief.
//
// No stencil: the land mesh's fragment shader discards where the mask says
// water, so everything else (water plane, walls, deck undersides) is drawn
// with the ordinary depth test. The mask stores the exact distance to the
// nearest true shoreline (signed: + on land), so bilinear filtering puts the
// cut within centimetres of the quay line even at a 1 m texel.

import earcut from 'earcut';
import { emptyMesh, vertex, densify, type MeshArrays } from './drape.js';
import type { HeightFn, Vec2 } from './surface.js';

/** Polygons as rings of scene coords (outer then holes), shorelines with water on their left. */
export interface WaterGeometry {
  polygons: Vec2[][][]; shores: Vec2[][];
  /** Water surface (scene z) per polygon / per shore (polder levels, water-levels.json); absent: the caller's default. */
  levels?: readonly number[]; shoreLevels?: readonly number[];
}

/** Scene z of the water polygon containing (x, y) (even-odd over its rings), else `fallback`. */
export function waterZAt(geos: readonly WaterGeometry[], x: number, y: number, fallback: number): number {
  for (const g of geos) {
    if (!g.levels) continue;
    for (let k = 0; k < g.polygons.length; k++) {
      let inside = false;
      for (const ring of g.polygons[k]) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) return g.levels[k] ?? fallback;
    }
  }
  return fallback;
}

export interface WaterMask {
  x0: number; y0: number; res: number; width: number; height: number;
  /** Signed distance to shore, metres, clamped to ±range (+ = land). Cuts the land. */
  sdf: Float32Array;
  /**
   * The same for water *minus bridge decks*: + on land and on a deck. Cuts the
   * street bands, so a bridge's sidewalks stop at the deck edge instead of
   * overhanging the canal, while the land under the deck is still cut away.
   */
  sdfStreets: Float32Array;
  range: number;
}

/**
 * Scanline fill: 1 inside water. Even-odd within each polygon (its holes), OR
 * across polygons, so an opening laid over the water either side of a
 * footbridge (openUnderFootbridges) does not cancel where they overlap.
 */
function rasterInside(geo: WaterGeometry, x0: number, y0: number, res: number, w: number, h: number): Uint8Array {
  const inside = new Uint8Array(w * h);
  const edges: [number, number, number, number, number][] = [];
  geo.polygons.forEach((poly, pi) => { for (const ring of poly) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (a[1] !== b[1]) edges.push([a[0], a[1], b[0], b[1], pi]);
  } });
  // Bucket edges by row span for speed.
  const rows: number[][] = Array.from({ length: h }, () => []);
  edges.forEach((e, k) => {
    const lo = Math.max(0, Math.floor((Math.min(e[1], e[3]) - y0) / res - 0.5)), hi = Math.min(h - 1, Math.ceil((Math.max(e[1], e[3]) - y0) / res - 0.5));
    for (let j = lo; j <= hi; j++) rows[j].push(k);
  });
  const xs: [number, number][] = [];
  for (let j = 0; j < h; j++) {
    const y = y0 + (j + 0.5) * res;
    xs.length = 0;
    for (const k of rows[j]) {
      const [ax, ay, bx, by, pi] = edges[k];
      if ((ay <= y) !== (by <= y)) xs.push([pi, ax + (y - ay) * (bx - ax) / (by - ay)]);
    }
    xs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      if (xs[k][0] !== xs[k + 1][0]) { k--; continue; } // an odd crossing count (a ring clipped open): resync on the next polygon
      const i0 = Math.max(0, Math.ceil((xs[k][1] - x0) / res - 0.5)), i1 = Math.min(w - 1, Math.floor((xs[k + 1][1] - x0) / res - 0.5));
      for (let i = i0; i <= i1; i++) inside[j * w + i] = 1;
    }
  }
  return inside;
}

/** `decks`: bridge deck footprints (closed rings, scene coords) that street bands may cross. */
export function buildWaterMask(geo: WaterGeometry, x0: number, y0: number, x1: number, y1: number, res = 1, range = 4, decks: readonly (readonly Vec2[])[] = []): WaterMask {
  const width = Math.ceil((x1 - x0) / res), height = Math.ceil((y1 - y0) / res);
  const inside = rasterInside(geo, x0, y0, res, width, height);
  const dist = new Float32Array(width * height).fill(range);
  segmentDistances(dist, geo.shores, false, x0, y0, res, width, height, range);
  const sdf = new Float32Array(width * height);
  for (let k = 0; k < sdf.length; k++) sdf[k] = inside[k] ? -dist[k] : dist[k];
  let sdfStreets = sdf;
  if (decks.length) {
    // Each deck rasterised on its own: overlapping footprints must not cancel under even-odd.
    const onDeck = new Uint8Array(width * height);
    for (const ring of decks) {
      const r = rasterInside({ polygons: [[ring as Vec2[]]], shores: [] }, x0, y0, res, width, height);
      for (let k = 0; k < r.length; k++) onDeck[k] |= r[k];
    }
    const d2 = dist.slice();
    segmentDistances(d2, decks, true, x0, y0, res, width, height, range);
    sdfStreets = new Float32Array(width * height);
    for (let k = 0; k < sdf.length; k++) sdfStreets[k] = inside[k] && !onDeck[k] ? -d2[k] : d2[k];
  }
  return { x0, y0, res, width, height, sdf, sdfStreets, range };
}

/** Exact distance (clamped to `range`) from texel centres to polyline segments, min-accumulated into `dist`. */
function segmentDistances(dist: Float32Array, lines: readonly (readonly Vec2[])[], closed: boolean, x0: number, y0: number, res: number, width: number, height: number, range: number): void {
  for (const line of lines) for (let s = 0; s + 1 < line.length + (closed ? 1 : 0); s++) {
    const [ax, ay] = line[s], [bx, by] = line[(s + 1) % line.length], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - range - x0) / res)), i1 = Math.min(width - 1, Math.ceil((Math.max(ax, bx) + range - x0) / res));
    const j0 = Math.max(0, Math.floor((Math.min(ay, by) - range - y0) / res)), j1 = Math.min(height - 1, Math.ceil((Math.max(ay, by) + range - y0) / res));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = x0 + (i + 0.5) * res, py = y0 + (j + 0.5) * res;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
      const d = Math.hypot(ax + dx * t - px, ay + dy * t - py);
      const k = j * width + i;
      if (d < dist[k]) dist[k] = d;
    }
  }
}

/** Bilinear signed distance at a scene point (+ land, − water). Outside the mask: land. */
export function maskDistance(m: WaterMask, x: number, y: number): number {
  const fx = (x - m.x0) / m.res - 0.5, fy = (y - m.y0) / m.res - 0.5;
  const i = Math.floor(fx), j = Math.floor(fy);
  if (i < 0 || j < 0 || i + 1 >= m.width || j + 1 >= m.height) return m.range;
  const u = fx - i, v = fy - j, s = m.sdf, w = m.width;
  return (s[j * w + i] * (1 - u) + s[j * w + i + 1] * u) * (1 - v) + (s[(j + 1) * w + i] * (1 - u) + s[(j + 1) * w + i + 1] * u) * v;
}

/** Mask as RG8 texels: R cuts the land, G cuts street bands; 0.5 + d / (2·range), water < 0.5. */
export function maskTexels(m: WaterMask): Uint8Array {
  const out = new Uint8Array(m.width * m.height * 2);
  const enc = (d: number) => Math.round(255 * Math.max(0, Math.min(1, 0.5 + d / (2 * m.range))));
  for (let k = 0; k < m.sdf.length; k++) { out[k * 2] = enc(m.sdf[k]); out[k * 2 + 1] = enc(m.sdfStreets[k]); }
  return out;
}

/** Flat water at `z` (canal level). */
export function waterSurfaceMesh(geo: WaterGeometry, z: number): MeshArrays {
  const m = emptyMesh();
  geo.polygons.forEach((poly, pi) => {
    const coords: number[] = [], holes: number[] = [];
    const pz = geo.levels?.[pi] ?? z;
    poly.forEach((ring, i) => { if (i) holes.push(coords.length / 2); for (const p of ring) coords.push(p[0], p[1]); });
    const base = m.positions.length / 3;
    for (let i = 0; i < coords.length; i += 2) vertex(m, coords[i], coords[i + 1], pz);
    const tris = earcut(coords, holes, 2);
    for (let i = 0; i < tris.length; i += 3) {
      const a = tris[i], b = tris[i + 1], c = tris[i + 2];
      const ccw = (coords[b * 2] - coords[a * 2]) * (coords[c * 2 + 1] - coords[a * 2 + 1]) - (coords[b * 2 + 1] - coords[a * 2 + 1]) * (coords[c * 2] - coords[a * 2]) > 0;
      m.indices.push(base + a, base + (ccw ? b : c), base + (ccw ? c : b));
    }
  });
  return m;
}

export const QUAY = { coping: [0.64, 0.61, 0.56] as [number, number, number], brick: [0.48, 0.35, 0.29] as [number, number, number], algae: [0.24, 0.29, 0.25] as [number, number, number] };

/**
 * Quay walls along every shoreline (water on the left), facing the water, from
 * the relief at the bank down past the water plane: coping, brick, algae band.
 * Banks that are not above the water (beaches, reed edges) get no wall.
 */
export function quayWallMesh(geo: WaterGeometry, ground: HeightFn, defaultWaterZ: number, step = 2, capM = 0): MeshArrays {
  const m = emptyMesh(true);
  for (let li = 0; li < geo.shores.length; li++) {
    const line = geo.shores[li], waterZ = geo.shoreLevels?.[li] ?? defaultWaterZ;
    const pts = densify(line, step);
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      if (len < 1e-3) continue;
      // Sample the bank half a metre inland (right of a→b), so a filled canal never lowers the top.
      const nx = dy / len, ny = -dx / len;
      const ta = Math.max(ground(a[0] + nx * 0.5, a[1] + ny * 0.5), ground(a[0], a[1])), tb = Math.max(ground(b[0] + nx * 0.5, b[1] + ny * 0.5), ground(b[0], b[1]));
      if (Math.max(ta, tb) < waterZ + 0.15) continue;
      const rows = (t: number) => {
        const coping = Math.max(t - 0.25, waterZ + 0.36), algae = waterZ + 0.35;
        return [t, Math.min(t, coping), Math.min(t, algae), waterZ - 0.25];
      };
      // Coping cap: a strip on top of the wall reaching QUAY_CAP_M inland, a
      // centimetre over the land. The land's cut at the shore is a per-pixel
      // discard (no MSAA), which left a stair-stepped seam between land and
      // wall top that showed the clear colour through it (phones, DPR 1.5);
      // the cap covers that seam with real geometry, smooth at any zoom.
      if (capM > 0) {
        const ia: Vec2 = [a[0] + nx * capM, a[1] + ny * capM], ib: Vec2 = [b[0] + nx * capM, b[1] + ny * capM];
        const za = Math.max(ta, ground(ia[0], ia[1])) + 0.012, zb = Math.max(tb, ground(ib[0], ib[1])) + 0.012;
        const c0 = vertex(m, a[0], a[1], ta + 0.012, QUAY.coping), c1 = vertex(m, b[0], b[1], tb + 0.012, QUAY.coping);
        const c2 = vertex(m, ib[0], ib[1], zb, QUAY.coping), c3 = vertex(m, ia[0], ia[1], za, QUAY.coping);
        // Facing up: land (and the cap) lies right of a→b, so a, b, ib, ia runs clockwise from above.
        m.indices.push(c0, c2, c1, c0, c3, c2);
      }
      const ra = rows(ta + (capM > 0 ? 0.012 : 0)), rb = rows(tb + (capM > 0 ? 0.012 : 0)), colours = [QUAY.coping, QUAY.brick, QUAY.algae];
      for (let r = 0; r < 3; r++) {
        if (ra[r] - ra[r + 1] < 1e-3 && rb[r] - rb[r + 1] < 1e-3) continue;
        const v0 = vertex(m, a[0], a[1], ra[r], colours[r]), v1 = vertex(m, b[0], b[1], rb[r], colours[r]);
        const v2 = vertex(m, b[0], b[1], rb[r + 1], colours[r]), v3 = vertex(m, a[0], a[1], ra[r + 1], colours[r]);
        // Facing left of a→b (into the water).
        m.indices.push(v0, v2, v3, v0, v1, v2);
      }
    }
  }
  return m;
}

/** The part of a measured deck the openings rule reads (elevation/bridgeDeck.ts DeckProfile). */
export interface OpeningDeck { id: string; x: ArrayLike<number>; y: ArrayLike<number>; s: ArrayLike<number>; halfWidth: ArrayLike<number>; deck: readonly [number, number] }

/** Footbridges only: a deck at most this wide (median over the span) may get water opened under it. */
export const OPENING_MAX_WIDTH_M = 6;
/** How far beside the deck edge the water must be found, metres. */
export const OPENING_REACH_M = 6;
/** The opening reaches this far into the water found beside the deck (overlap, so no land strip is left). */
export const OPENING_OVERLAP_M = 0.5;

const inPolygon = (poly: readonly (readonly Vec2[])[], x: number, y: number) => {
  let c = false;
  for (const ring of poly) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; }
  return c;
};

/** Clip a ring to an axis-aligned rectangle (Sutherland–Hodgman). */
export function clipRing(ring: readonly Vec2[], rect: readonly [number, number, number, number]): Vec2[] {
  let out: Vec2[] = [...ring];
  const edges: [(p: Vec2) => boolean, (a: Vec2, b: Vec2) => Vec2][] = [
    [p => p[0] >= rect[0], (a, b) => { const t = (rect[0] - a[0]) / (b[0] - a[0]); return [rect[0], a[1] + t * (b[1] - a[1])]; }],
    [p => p[0] <= rect[2], (a, b) => { const t = (rect[2] - a[0]) / (b[0] - a[0]); return [rect[2], a[1] + t * (b[1] - a[1])]; }],
    [p => p[1] >= rect[1], (a, b) => { const t = (rect[1] - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), rect[1]]; }],
    [p => p[1] <= rect[3], (a, b) => { const t = (rect[3] - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), rect[3]]; }],
  ];
  for (const [inside, cut] of edges) {
    const src = out; out = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[(i + src.length - 1) % src.length], b = src[i];
      if (inside(b)) { if (!inside(a)) out.push(cut(a, b)); out.push(b); } else if (inside(a)) out.push(cut(a, b));
    }
    if (!out.length) break;
  }
  return out;
}

/**
 * Water under footbridges whose water polygon stops at the bridge (lane belt
 * audit 2026-10-14, the Melkmeisjesbrug BRU0016 over the Brouwersgracht: the
 * OpenFreeMap water ends at both deck edges, so a land strip and two quay
 * walls crossed the canal under the footbridge). Along a measured deck's
 * span, where the centreline is land but water lies within OPENING_REACH_M
 * beside both edges, the strip between that water is opened: a water polygon
 * (overlapping the water either side by OPENING_OVERLAP_M, at its level,
 * clipped to the cell) and the shore pieces inside it dropped (no quay walls
 * across the canal). Decks wider than OPENING_MAX_WIDTH_M are left alone (a
 * road on a dam is not a bridge with the water cut). Returns a new geometry
 * and the decks it opened.
 */
export function openUnderFootbridges(geo: WaterGeometry, decks: readonly OpeningDeck[], rect: readonly [number, number, number, number], fallbackZ: number): { geo: WaterGeometry; opened: string[] } {
  const inWater = (x: number, y: number) => geo.polygons.findIndex(p => inPolygon(p, x, y));
  const added: Vec2[][] = [], addedLevels: number[] = [], opened: string[] = [];
  for (const d of decks) {
    const idx: number[] = [];
    for (let i = 0; i < d.s.length; i++) if (d.s[i] >= d.deck[0] && d.s[i] <= d.deck[1]) idx.push(i);
    if (idx.length < 3) continue;
    const widths = idx.map(i => 2 * d.halfWidth[i]).sort((a, b) => a - b);
    if (widths[widths.length >> 1] > OPENING_MAX_WIDTH_M) continue;
    const rows: { i: number; l: number; r: number; poly: number }[] = [];
    for (const i of idx) {
      const a = Math.max(0, i - 2), b = Math.min(d.s.length - 1, i + 2), dx = d.x[b] - d.x[a], dy = d.y[b] - d.y[a], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      const cx = d.x[i], cy = d.y[i];
      if (inWater(cx, cy) >= 0) continue;
      // First water beside each edge, searched outward in 0.25 m steps.
      const find = (sg: number) => { for (let o = d.halfWidth[i] * 0.5; o <= d.halfWidth[i] + OPENING_REACH_M; o += 0.25) { const k = inWater(cx + nx * o * sg, cy + ny * o * sg); if (k >= 0) return { o, k }; } return null; };
      const L = find(1), R = find(-1);
      if (L && R) rows.push({ i, l: L.o + OPENING_OVERLAP_M, r: R.o + OPENING_OVERLAP_M, poly: L.k });
    }
    if (rows.length < 3) continue;
    // The longest run of consecutive stations.
    let best: typeof rows = [], run: typeof rows = [];
    for (const r of rows) { if (run.length && r.i !== run[run.length - 1].i + 1) run = []; run.push(r); if (run.length > best.length) best = [...run]; }
    if (best.length < 3) continue;
    const left: Vec2[] = [], right: Vec2[] = [];
    for (const r of best) {
      const i = r.i, a = Math.max(0, i - 2), b = Math.min(d.s.length - 1, i + 2), dx = d.x[b] - d.x[a], dy = d.y[b] - d.y[a], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      left.push([d.x[i] + nx * r.l, d.y[i] + ny * r.l]); right.push([d.x[i] - nx * r.r, d.y[i] - ny * r.r]);
    }
    const ring = clipRing([...left, ...right.reverse()], rect);
    if (ring.length < 3) continue;
    added.push(ring);
    addedLevels.push(geo.levels?.[best[best.length >> 1].poly] ?? fallbackZ);
    opened.push(d.id);
  }
  if (!added.length) return { geo, opened };
  // Shores: drop the pieces whose midpoint lies in an opening (the walls that crossed the canal).
  const shores: Vec2[][] = [], shoreLevels: number[] = [];
  geo.shores.forEach((line, k) => {
    let cur: Vec2[] = [];
    const flush = () => { if (cur.length >= 2) { shores.push(cur); shoreLevels.push(geo.shoreLevels?.[k] ?? fallbackZ); } cur = []; };
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i], b = line[i + 1], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (added.some(r => inPolygon([r], mx, my))) { flush(); continue; }
      if (!cur.length) cur.push(a);
      cur.push(b);
    }
    flush();
  });
  return {
    geo: { polygons: [...geo.polygons, ...added.map(r => [r])], shores, ...(geo.levels ? { levels: [...geo.levels, ...addedLevels] } : {}), ...(geo.shoreLevels ? { shoreLevels } : {}) },
    opened,
  };
}
