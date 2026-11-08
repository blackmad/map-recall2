/**
 * Flat-roof surface (lane R5-E, #265; the user's U1 shot "roofs look too bright/flat/unfinished", 2026-11-08).
 *
 * A flat lid drew on the shared flat cell (roofCells.ts `flat`: mean 0.9, faint 12 cm mottling), the same cell the trim,
 * shutters and shed lids use, so from the air a roof was one smooth slab. With `?flatRoofSurface=1` (the default; `=0`
 * restores) lids sample their own layer instead: a gravel/membrane grain and a membrane seam every 2 m, at the flat
 * cell's mean so the lid's tone (flatRoofTone.ts) is unchanged where the mips average it out. The layer is appended
 * after the slot layers (`flatRoofSurfaceLayer`), so no existing layer ordinal moves (baked shells store ordinals).
 *
 * The parapet lip (`parapetLip`) and the generic roof box (`stairCoreBox`) are the rest of the surface: a 0.3 m lip of
 * wall colour around flat roofs of 100 m² and more, and a lift-house box at the roof's stair core on 400 m² roofs with
 * no measured furniture.
 */
import { CELL_PX } from '../facadeCells.js';
import { BAY_LAYER_COUNT } from '../bayLook.js';

/**
 * The surface layer's ordinal in a bay-cell look's array: after the bay cells, the four roof cells, the glass block
 * and the city look's slot layers (look/paintLookAtlas.ts lookAtlasLayers; `SURFACE_SLOT_LAYERS` is cityLook.ts
 * SLOT_LAYER_COUNT, pinned by flatRoofSurface.test.ts, kept literal so the chunk worker does not load the city look).
 * The procedural cell set already fills 256 byte-addressed layers: it keeps the flat cell (null).
 */
export const SURFACE_SLOT_LAYERS = 12;
export const SURFACE_ROOF_LAYERS = 4;
export function flatRoofSurfaceLayer(cells: string): number | null {
  return cells === 'procedural' ? null : BAY_LAYER_COUNT + SURFACE_ROOF_LAYERS + 1 + SURFACE_SLOT_LAYERS;
}

/** `?flatRoofSurface=0` restores the shared flat cell, no lip and no generic box. */
export function flatRoofSurfaceEnabled(search: string = typeof location !== 'undefined' ? location.search : ''): boolean {
  try { return new URLSearchParams(search).get('flatRoofSurface') !== '0'; } catch { return true; }
}

/** The lid's metres per cell repeat (threeBuildingMesh lid UVs are xy / 4). */
export const LID_CELL_M = 4;
/** Membrane seam spacing (m): rolls are laid 1–2 m wide; one seam every 2 m reads from 100 m without moiré at 4 m cells. */
export const SEAM_EVERY_M = 2;
/** The flat cell's mean (roofCells.ts `flat`, 0.9): the surface keeps it, so the far (mean) mip draws the lid's tone. */
export const SURFACE_MEAN = 0.9;
/** Grain amplitude (± of the mean): low, so the tint reads first. */
export const GRAIN_AMPLITUDE = 0.05;
/** Seam darkening (fraction of the mean) over `SEAM_PX` texels of the 256 px cell (~3 cm). */
export const SEAM_DARKEN = 0.18;
export const SEAM_PX = 2;

function hash2(a: number, b: number, seed: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The lid surface cell: 256² RGBA, grey luminance, alpha 255 (fully tintable), tiling. Fine grain (per texel and per
 * 4-texel stone), a soft 0.5 m blotch (weathering), seams every `SEAM_EVERY_M` along x with a lapped edge highlight;
 * then shifted so its mean is exactly `SURFACE_MEAN`.
 */
export function paintFlatRoofSurfaceCell(): Uint8ClampedArray {
  const n = CELL_PX, v = new Float32Array(n * n);
  const seamPeriod = n * SEAM_EVERY_M / LID_CELL_M;
  // A blotch field on a 32-texel (0.5 m) lattice, bilinear and wrapping.
  const blotch = (x: number, y: number) => {
    const s = 32, gx = x / s, gy = y / s, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0, m = n / s;
    const at = (i: number, j: number) => hash2(((i % m) + m) % m, ((j % m) + m) % m, 17) - 0.5;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy;
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let g = SURFACE_MEAN;
    g += (hash2(x, y, 23) - 0.5) * GRAIN_AMPLITUDE;
    g += (hash2(x >> 2, y >> 2, 29) - 0.5) * GRAIN_AMPLITUDE;
    g += blotch(x, y) * GRAIN_AMPLITUDE * 0.8;
    const sx = x % seamPeriod;
    if (sx < SEAM_PX) g *= 1 - SEAM_DARKEN;
    else if (sx < SEAM_PX + 1) g *= 1 + SEAM_DARKEN * 0.35;
    v[y * n + x] = g;
  }
  let mean = 0; for (const g of v) mean += g; mean /= v.length;
  const out = new Uint8ClampedArray(n * n * 4);
  for (let i = 0; i < v.length; i++) {
    const g = Math.round(Math.max(0, Math.min(1, v[i] - mean + SURFACE_MEAN)) * 255);
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = g; out[i * 4 + 3] = 255;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Parapet lip and the generic roof box (geometry, chunk metres)
// ---------------------------------------------------------------------------

type V3 = [number, number, number];
type V2 = [number, number];
/** A triangle as the chunk builder's roof list takes it (roofMesh.ts RoofTri, `trim`: flat colour on the flat layer). */
export type SurfaceTri = { p: [V3, V3, V3]; uv: [V2, V2, V2]; part: 'trim'; n: V3; hex: string };

/**
 * The surface's triangle budget per chunk, as a share of what the chunk draws without it (the brief: ≤ +4 % a detail
 * chunk, ≤ +8 % a coarse chunk and baked shell). The chunk builder spends it largest roof first.
 */
export const FLAT_SURFACE_BUDGET = { detail: 0.04, coarse: 0.08 } as const;

/** Lip height above the lid and width inward from the wall face (m). */
export const LIP_H_M = 0.3;
export const LIP_W_M = 0.25;
/** A lip on flat roofs of this many m² and more; a generic roof box on this many m² and more with no measured furniture. */
export const LIP_MIN_M2 = 100;
export const BOX_MIN_M2 = 400;
/** The generic lift-house / HVAC box: footprint (m), height (m), colour (roofFurniture.ts `overrun` grey). */
export const BOX_L_M = 3.2;
export const BOX_W_M = 2.4;
export const BOX_H_M = 2.2;
export const BOX_HEX = '#a7a49c';

const ringArea2 = (r: readonly V2[]) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return a; };

/** Push a quad (a, b, c, d in order around it) as two triangles facing `n`. */
function quad(out: SurfaceTri[], a: V3, b: V3, c: V3, d: V3, n: V3, hex: string): void {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const facing = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2];
  const [p0, p1, p2, p3] = facing >= 0 ? [a, b, c, d] : [a, d, c, b];
  const uv = (p: V3): V2 => [(p[0] + p[2]) / LID_CELL_M, (p[1] + p[2]) / LID_CELL_M];
  out.push({ p: [p0, p1, p2], uv: [uv(p0), uv(p1), uv(p2)], part: 'trim', n, hex }, { p: [p0, p2, p3], uv: [uv(p0), uv(p2), uv(p3)], part: 'trim', n, hex });
}

/** Consecutive lip edges turning less than this (degrees) are one lip segment (BAG rings carry many near-collinear vertices). */
export const LIP_MERGE_DEG = 12;
/** Lip segments shorter than this (m) are left out: a jog in the outline reads as nothing from the air and costs as much as a wall. */
export const LIP_MIN_EDGE_M = 2.5;

/**
 * A parapet lip around the rings of one flat roof (the outer ring first, then courtyards), in chunk metres: per edge
 * the outer face (the wall carried up `h`), the coping top and the inner face down to the lid at `z`, the inner edge
 * mitred at the corners (miters capped at 3 × `w`). By default 4 triangles an edge, the coping and the inner face: from
 * the air the far side shows its inner face and the near side its coping over the wall, where the outer face would be
 * the wall carried up 0.3 m (`outerFace` adds it: 6 triangles an edge). `exposed(a, b)` drops an edge (a party wall against a roof as high); consecutive kept edges that
 * turn less than LIP_MERGE_DEG are merged first. Rings closed or open, either winding.
 */
export function parapetLipTris(rings: ReadonlyArray<ReadonlyArray<readonly [number, number]>>, z: number, hex: string, opts: { outerCount?: number; h?: number; w?: number; exposed?: (a: V2, b: V2) => boolean; outerFace?: boolean; mergeDeg?: number; minEdgeM?: number } = {}): SurfaceTri[] {
  const { outerCount = 1, h = LIP_H_M, w = LIP_W_M, exposed, outerFace = false, mergeDeg = LIP_MERGE_DEG, minEdgeM = LIP_MIN_EDGE_M } = opts;
  const out: SurfaceTri[] = [], cosMerge = Math.cos(mergeDeg * Math.PI / 180);
  rings.forEach((raw, ri) => {
    let r = raw.map(p => [p[0], p[1]] as V2);
    if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r = r.slice(0, -1);
    r = r.filter((p, i) => { const q = r[(i + 1) % r.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.05; });
    if (r.length < 3) return;
    const keep0 = r.map((a, i) => !exposed || exposed(a, r[(i + 1) % r.length]));
    if (!keep0.some(Boolean)) return;
    // Merge: drop a vertex between two kept edges that barely turn (the kept flag of the merged edge stays true).
    const dir = (a: V2, b: V2) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
    const idx: number[] = [];
    for (let i = 0; i < r.length; i++) {
      const prev = (i + r.length - 1) % r.length, d0 = dir(r[prev], r[i]), d1 = dir(r[i], r[(i + 1) % r.length]);
      if (keep0[prev] && keep0[i] && d0[0] * d1[0] + d0[1] * d1[1] > cosMerge) continue;
      idx.push(i);
    }
    if (idx.length < 3) return;
    const v = idx.map(i => r[i]), keep = idx.map(i => keep0[i]), m = v.length;
    // Toward the roof: the ring's own interior for an outer ring, away from it for a courtyard.
    const s = (ringArea2(v) > 0 ? 1 : -1) * (ri < outerCount ? 1 : -1);
    const normal = (i: number): V2 => { const a = v[i], b = v[(i + 1) % m], l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [-s * (b[1] - a[1]) / l, s * (b[0] - a[0]) / l]; };
    const inset: V2[] = v.map((p, i) => {
      const n1 = normal((i + m - 1) % m), n2 = normal(i), d = 1 + n1[0] * n2[0] + n1[1] * n2[1];
      let mx = d > 0.1 ? (n1[0] + n2[0]) / d : n2[0], my = d > 0.1 ? (n1[1] + n2[1]) / d : n2[1];
      const k = Math.hypot(mx, my); if (k > 3) { mx *= 3 / k; my *= 3 / k; }
      return [p[0] + mx * w, p[1] + my * w];
    });
    for (let i = 0; i < m; i++) {
      if (!keep[i]) continue;
      const j = (i + 1) % m, [nx, ny] = normal(i), a = v[i], b = v[j], ai = inset[i], bi = inset[j];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < minEdgeM) continue;
      if (outerFace) quad(out, [a[0], a[1], z], [b[0], b[1], z], [b[0], b[1], z + h], [a[0], a[1], z + h], [-nx, -ny, 0], hex);
      quad(out, [a[0], a[1], z + h], [b[0], b[1], z + h], [bi[0], bi[1], z + h], [ai[0], ai[1], z + h], [0, 0, 1], hex);
      quad(out, [ai[0], ai[1], z + h], [bi[0], bi[1], z + h], [bi[0], bi[1], z], [ai[0], ai[1], z], [nx, ny, 0], hex);
    }
  });
  return out;
}

/** A closed box without a bottom (10 triangles) centred at (cx, cy), long axis along (ux, uy). */
export function roofBoxTris(cx: number, cy: number, ux: number, uy: number, l: number, w: number, z0: number, z1: number, hex: string): SurfaceTri[] {
  const out: SurfaceTri[] = [], vx = -uy, vy = ux;
  const c = (a: number, b: number, zz: number): V3 => [cx + ux * a * l / 2 + vx * b * w / 2, cy + uy * a * l / 2 + vy * b * w / 2, zz];
  quad(out, c(-1, -1, z1), c(1, -1, z1), c(1, 1, z1), c(-1, 1, z1), [0, 0, 1], hex);
  quad(out, c(-1, -1, z0), c(1, -1, z0), c(1, -1, z1), c(-1, -1, z1), [-vx, -vy, 0], hex);
  quad(out, c(1, 1, z0), c(-1, 1, z0), c(-1, 1, z1), c(1, 1, z1), [vx, vy, 0], hex);
  quad(out, c(1, -1, z0), c(1, 1, z0), c(1, 1, z1), c(1, -1, z1), [ux, uy, 0], hex);
  quad(out, c(-1, 1, z0), c(-1, -1, z0), c(-1, -1, z1), c(-1, 1, z1), [-ux, -uy, 0], hex);
  return out;
}

/**
 * Where a generic lift-house box stands: inside the roof, `LIP_W_M` + 1 m clear of every edge, nearest the fitted
 * rectangle's centre along its long axis (the stair core of a slab sits on its spine; the centre itself is often a
 * courtyard). Null when no candidate on the spine fits.
 */
export function stairCorePoint(rings: ReadonlyArray<ReadonlyArray<readonly [number, number]>>, outerCount: number, rect: { cx: number; cy: number; ux: number; uy: number; len: number }): V2 | null {
  const inside = (x: number, y: number) => {
    let depth = 0;
    rings.forEach((r, ri) => {
      let c = false;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
      if (c) depth += ri < outerCount ? 1 : -1;
    });
    return depth > 0;
  };
  const clear = (x: number, y: number, d: number) => {
    for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [ax, ay] = r[j], [bx, by] = r[i], dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0;
      if (Math.hypot(ax + t * dx - x, ay + t * dy - y) < d) return false;
    }
    return true;
  };
  const need = Math.hypot(BOX_L_M, BOX_W_M) / 2 + LIP_W_M + 1;
  for (let k = 0; k <= 20; k++) {
    const t = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * rect.len / 20, x = rect.cx + rect.ux * t, y = rect.cy + rect.uy * t;
    if (inside(x, y) && clear(x, y, need)) return [x, y];
  }
  // An L, a U or a courtyard block whose spine runs outside the roof: the clear point nearest the rect's centre on a
  // STAIR_GRID_M grid over the outer rings (U1: 9 of the 15 largest flat roofs had no spine point).
  let best: V2 | null = null, bestD = Infinity, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rings.slice(0, outerCount)) for (const [x, y] of r) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  if ((maxX - minX) * (maxY - minY) > STAIR_GRID_MAX_CELLS * STAIR_GRID_M * STAIR_GRID_M) return null;
  for (let x = minX + need; x <= maxX - need; x += STAIR_GRID_M) for (let y = minY + need; y <= maxY - need; y += STAIR_GRID_M) {
    const d = Math.hypot(x - rect.cx, y - rect.cy);
    if (d < bestD && inside(x, y) && clear(x, y, need)) { best = [x, y]; bestD = d; }
  }
  return best;
}
/** The stair-core fallback grid (m), and the most cells it scans (a 400 m x 400 m block at 2 m). */
export const STAIR_GRID_M = 2;
export const STAIR_GRID_MAX_CELLS = 40000;
