// The far ring of the own ground (pure, DOM-free; built in the ground
// worker): beyond the resident cells (the 2,000 m aerial cap, residency.ts)
// the ground used to end in an edge against the recoloured basemap, seen from
// the air over Nieuw-West and Noord (lane belt audit 2026-10-14). A far block
// is 2 km square (2 × 2 streamed cells) and draws, in one vertex-coloured mesh
// per 1 km sub-cell (so the game hides a sub-cell the resident ring covers):
//
//   land     the relief on a FAR_GRID_M grid
//   water    the elevation-v1 water polygons, simplified
//   green    OSM parks, grass and woods, simplified
//   streets  carriageways and cycle paths as flat bands of their mapped width
//
// Everything lies FAR_LIFT over the relief (water, green and streets a few
// decimetres up, so a coarse grid never pokes through): from 2 km away
// decimetres do not show and nothing z-fights. Budget FAR_BLOCK_BUDGET
// triangles per block; streets are dropped by class until it fits.

import earcut from 'earcut';
import { emptyMesh, ribbon, vertex, type MeshArrays } from './drape.js';
import { prepareWays, roadExtent, type LocalWay } from './streets.js';
import { packMesh, type PackedMesh } from './groundCell.js';
import type { OsmGroundExtract } from './osmGround.js';
import type { WaterGeometry } from './water.js';
import type { HeightFn, Vec2 } from './surface.js';
import type { Rect } from './groundStore.js';
import { groundPalette, type GroundPalette } from './groundLook.js';

/** Far blocks are this many streamed cells on a side. */
export const FAR_BLOCK_CELLS = 2;
/** Land grid step, metres. */
export const FAR_GRID_M = 50;
/** Triangle budget per 2 km block. */
export const FAR_BLOCK_BUDGET = 20000;
/** Lift over the relief per layer, metres. */
export const FAR_LIFT = { land: 0, green: 0.3, water: 0.4, street: 0.5, cycle: 0.55 } as const;
/** Douglas–Peucker tolerance for outlines and centrelines, metres. */
export const FAR_SIMPLIFY_M = 3;

type RGB = [number, number, number];
const rgb = (c: readonly number[]): RGB => [c[0] / 255, c[1] / 255, c[2] / 255];
const hex = (h: string): RGB => { const v = parseInt(h.slice(1), 16); return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]; };
/** The near ring's flat tones (its textures' base colours) for a ground palette (groundLook.ts). */
export function farColours({ street, tones: G }: GroundPalette) {
  return {
    land: rgb(G.land.base), water: hex(G.water), park: rgb(G.park), wood: rgb(G.wood),
    asphalt: rgb(street.asphalt.base), klinker: rgb(street.klinker.base), cycle: rgb(street.cycle.base),
  } as const;
}
export type FarColours = ReturnType<typeof farColours>;
/** Today's palette. */
export const FAR_COLOURS: FarColours = farColours(groundPalette('default'));

/** Street classes in the order they are dropped when a block is over budget (last dropped first). */
const STREET_TIERS: readonly (readonly string[])[] = [
  ['motorway', 'trunk', 'primary', 'secondary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link'],
  ['tertiary', 'tertiary_link', 'busway'],
  ['cycleway'],
  ['residential', 'unclassified', 'living_street', 'pedestrian'],
];

export interface FarSubCell { key: string; rect: Rect; water: WaterGeometry | null; osm: OsmGroundExtract | null }
export interface FarBlockInput { key: string; rect: Rect; cells: readonly FarSubCell[]; ground: HeightFn | null; project: (lngLat: [number, number]) => Vec2 }
export interface BuiltFar {
  key: string;
  rect: Rect;
  /** One mesh per sub-cell (vertex colours), so the game can hide the ones the resident ring draws. */
  parts: { key: string; mesh: PackedMesh }[];
  stats: { triangles: number; bytes: number; buildMs: number; tiers: number; byLayer: Record<string, number> };
}

/** Far block key of a streamed cell key. */
export function farBlockOf(cellKey: string): string {
  const [cx, cy] = cellKey.split('_').map(Number);
  return `${Math.floor(cx / FAR_BLOCK_CELLS)}_${Math.floor(cy / FAR_BLOCK_CELLS)}`;
}
/** The streamed cell keys of a far block. */
export function farBlockCells(blockKey: string): string[] {
  const [bx, by] = blockKey.split('_').map(Number), out: string[] = [];
  for (let dy = 0; dy < FAR_BLOCK_CELLS; dy++) for (let dx = 0; dx < FAR_BLOCK_CELLS; dx++) out.push(`${bx * FAR_BLOCK_CELLS + dx}_${by * FAR_BLOCK_CELLS + dy}`);
  return out;
}

/** Douglas–Peucker on an open polyline. */
export function simplify(pts: readonly Vec2[], tol: number): Vec2[] {
  if (pts.length < 3) return [...pts];
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1e-9;
    let worst = -1, at = -1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / l; if (d > worst) { worst = d; at = i; } }
    if (worst > tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/** The point halfway along a polyline. */
function midpoint(pts: readonly Vec2[]): Vec2 {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let left = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (l >= left && l > 0) { const t = left / l; return [pts[i - 1][0] + t * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1])]; }
    left -= l;
  }
  return pts[pts.length >> 1];
}

const inRect = (r: Rect, x: number, y: number) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3];

/** Polygons (outer + holes) flat, earcut, vertices at height + lift. */
function polygon(m: MeshArrays, rings: readonly (readonly Vec2[])[], height: HeightFn, lift: number, colour: RGB): void {
  const coords: number[] = [], holes: number[] = [];
  const simple = rings.map(r => simplify(r, FAR_SIMPLIFY_M));
  if (!simple.length || simple[0].length < 3) return;
  simple.forEach((s, i) => {
    if (s.length < 3) return;
    if (i) holes.push(coords.length / 2);
    for (const p of s) coords.push(p[0], p[1]);
  });
  const tris = earcut(coords, holes);
  const base = m.positions.length / 3;
  for (let i = 0; i < coords.length; i += 2) vertex(m, coords[i], coords[i + 1], height(coords[i], coords[i + 1]) + lift, colour);
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t + 1], c = tris[t + 2];
    const ccw = (coords[b * 2] - coords[a * 2]) * (coords[c * 2 + 1] - coords[a * 2 + 1]) - (coords[b * 2 + 1] - coords[a * 2 + 1]) * (coords[c * 2] - coords[a * 2]) > 0;
    m.indices.push(base + a, base + (ccw ? b : c), base + (ccw ? c : b));
  }
}

/** Build one far block (all four sub-cells), within FAR_BLOCK_BUDGET. */
export function buildFarBlock(input: FarBlockInput, FAR: FarColours = FAR_COLOURS): BuiltFar {
  const t0 = Date.now();
  const height: HeightFn = input.ground ?? (() => 0);
  // Ways of the whole block once (a way lives in the cell of its midpoint), drawn by the sub-cell holding it.
  const seen = new Set<number>(), ways: LocalWay[] = [];
  for (const c of input.cells) for (const w of c.osm ? prepareWays(c.osm.ways, input.project) : []) if (!seen.has(w.id)) { seen.add(w.id); ways.push(w); }
  // The sub-cell holding a point, else the nearest one (a way's midpoint may sit on the block's far edge).
  const subOf = (p: Vec2) => {
    const i = input.cells.findIndex(c => inRect(c.rect, p[0], p[1]));
    if (i >= 0) return i;
    const d = input.cells.map(({ rect: r }) => Math.hypot(Math.max(r[0] - p[0], 0, p[0] - r[2]), Math.max(r[1] - p[1], 0, p[1] - r[3])));
    const best = d.indexOf(Math.min(...d));
    return d[best] <= FAR_GRID_M ? best : -1;
  };
  for (let tiers = STREET_TIERS.length; tiers >= 0; tiers--) {
    const wanted = new Set(STREET_TIERS.slice(0, tiers).flat());
    const meshes = input.cells.map(() => emptyMesh(true));
    const byLayer: Record<string, number> = { land: 0, water: 0, green: 0, street: 0 };
    const count = (k: string, m: MeshArrays, before: number) => { byLayer[k] += (m.indices.length - before) / 3; };
    input.cells.forEach((c, i) => {
      const m = meshes[i], [x0, y0, x1, y1] = c.rect;
      let n = m.indices.length;
      // Land: the relief grid over the sub-cell.
      const nx = Math.ceil((x1 - x0) / FAR_GRID_M), ny = Math.ceil((y1 - y0) / FAR_GRID_M), base = m.positions.length / 3;
      for (let j = 0; j <= ny; j++) for (let k = 0; k <= nx; k++) { const x = Math.min(x1, x0 + k * FAR_GRID_M), y = Math.min(y1, y0 + j * FAR_GRID_M); vertex(m, x, y, height(x, y) + FAR_LIFT.land, FAR.land); }
      for (let j = 0; j < ny; j++) for (let k = 0; k < nx; k++) { const a = base + j * (nx + 1) + k, b = a + 1, d = a + nx + 1, e = d + 1; m.indices.push(a, b, e, a, e, d); }
      count('land', m, n); n = m.indices.length;
      // Green.
      for (const a of c.osm?.areas ?? []) {
        if (a.kind !== 'park' && a.kind !== 'grass' && a.kind !== 'wood') continue;
        for (const r of a.rings) polygon(m, [r.slice(0, -1).map(input.project)], height, FAR_LIFT.green, a.kind === 'wood' ? FAR.wood : FAR.park);
      }
      count('green', m, n); n = m.indices.length;
      // Water (elevation-v1 clips its polygons per cell already).
      for (const poly of c.water?.polygons ?? []) polygon(m, poly, height, FAR_LIFT.water, FAR.water);
      count('water', m, n);
    });
    // Streets, by the sub-cell of their midpoint.
    for (const w of ways) {
      const hw = w.tags.highway ?? '';
      if (!wanted.has(hw) || w.tags.tunnel === 'yes' || w.tags.area === 'yes') continue;
      const cycle = hw === 'cycleway', ext = roadExtent(w.section);
      const width = cycle ? Math.max(1.5, w.section.halfWidth * 2) : ext.left + ext.right;
      if (width <= 0) continue;
      const i = subOf(midpoint(w.points));
      if (i < 0) continue;
      const m = meshes[i], n = m.indices.length;
      const own = w.section.bands[0]?.surface, colour = cycle || own === 'cycle' ? FAR.cycle : own === 'klinker' ? FAR.klinker : FAR.asphalt;
      ribbon(m, simplify(w.points, FAR_SIMPLIFY_M), cycle ? 0 : (ext.left - ext.right) / 2, width, height, cycle ? FAR_LIFT.cycle : FAR_LIFT.street, { step: 1e9, colour });
      count('street', m, n);
    }
    const triangles = meshes.reduce((t, m) => t + m.indices.length / 3, 0);
    if (triangles > FAR_BLOCK_BUDGET && tiers > 0) continue;
    const parts = input.cells.map((c, i) => ({ key: c.key, mesh: packMesh(meshes[i]) })).filter(p => p.mesh.indices.length);
    const bytes = parts.reduce((b, p) => b + p.mesh.positions.byteLength + p.mesh.normals.byteLength + p.mesh.uvs.byteLength + p.mesh.indices.byteLength + (p.mesh.colors?.byteLength ?? 0), 0);
    return { key: input.key, rect: input.rect, parts, stats: { triangles, bytes, buildMs: Date.now() - t0, tiers, byLayer } };
  }
  throw new Error('unreachable');
}

/** Transfer list for postMessage. */
export function farTransferables(b: BuiltFar): ArrayBuffer[] {
  return b.parts.flatMap(p => [p.mesh.positions.buffer, p.mesh.normals.buffer, p.mesh.uvs.buffer, p.mesh.indices.buffer, ...(p.mesh.colors ? [p.mesh.colors.buffer] : [])] as ArrayBuffer[]);
}

// ------------------------------------------------------------------ residency (pure)

/** The far ring reaches at most this far from the rider, metres (the aerial view's horizon over the city). */
export const FAR_MAX_M = 7000;
/** Far radius steps, metres (whole steps, so a zoom ease does not re-plan on every frame). */
export const FAR_STEP_M = 1000;
/** Far blocks farther than the far radius by this much are dropped (hysteresis). */
export const FAR_KEEP_M = 2000;

/** Far radius for a view reaching `reachM`, with the resident ring at `residentM`: 0 while the resident ring reaches it. */
export function farRadiusM(reachM: number, residentM: number): number {
  if (reachM <= residentM) return 0;
  return Math.min(FAR_MAX_M, Math.ceil(reachM / FAR_STEP_M) * FAR_STEP_M);
}

/** A far block's rectangle from its streamed cells' rectangles. */
export function farBlockRect(blockKey: string, cellRect: (key: string) => Rect): Rect {
  const rs = farBlockCells(blockKey).map(cellRect);
  return [Math.min(...rs.map(r => r[0])), Math.min(...rs.map(r => r[1])), Math.max(...rs.map(r => r[2])), Math.max(...rs.map(r => r[3]))];
}

/** Far blocks within `radiusM` of `centre` (to their nearest edge), nearest first. */
export function farBlocksWithin(centre: Vec2, centreCell: string, radiusM: number, cellSizeM: number, cellRect: (key: string) => Rect): { key: string; d: number }[] {
  if (radiusM <= 0) return [];
  const [bx, by] = farBlockOf(centreCell).split('_').map(Number), span = Math.ceil(radiusM / (cellSizeM * FAR_BLOCK_CELLS)) + 1, out: { key: string; d: number }[] = [];
  for (let dy = -span; dy <= span; dy++) for (let dx = -span; dx <= span; dx++) {
    const key = `${bx + dx}_${by + dy}`, r = farBlockRect(key, cellRect);
    const d = Math.hypot(Math.max(r[0] - centre[0], 0, centre[0] - r[2]), Math.max(r[1] - centre[1], 0, centre[1] - r[3]));
    if (d <= radiusM) out.push({ key, d });
  }
  return out.sort((a, b) => a.d - b.d);
}
