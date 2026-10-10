// One streamed cell of the own ground (pure, DOM-free; built in the ground
// worker). The same layers as the prototype page (main.ts), restricted to
// what the cell owns so neighbouring cells never draw anything twice:
//
//   land grid     the cell rectangle exactly (grid aligned to global multiples
//                 of the step, so seams share vertices' heights)
//   water, quays  the cell's water polygons and shores (elevation-v1 clips them per cell)
//   decks         measured/flat decks whose first station lies in the cell
//   streets       OSM ways whose midpoint lies in the cell (the junction graph
//                 sees the 3×3 neighbourhood, so kerbs are trimmed at seams too)
//   areas         parks/squares/parking whose bbox centre lies in the cell
//
// LOD 0 is the prototype's detail. LOD 1 (the far ring) is a 10 m land grid,
// carriageways only (no kerbs, sidewalks or paint), coarser drape and walls.
//
// The water mask (signed distance, R = water, G = water minus decks) covers
// the cell plus what its streets and areas reach past it (capped), at 1 m
// (LOD 0) or 2 m (LOD 1).

import earcut from 'earcut';
import { buildWaterMask, maskDistance, maskTexels, quayWallMesh, waterSurfaceMesh, type WaterGeometry } from './water.js';
import { drapeTriangles, emptyMesh, merge, reliefGrid, type MeshArrays } from './drape.js';
import { buildStreets, isBridgeWay, prepareWays, LIFT, type LocalWay } from './streets.js';
import { flatDeckBody, measuredDeckBody } from './decks.js';
import type { OsmGroundExtract } from './osmGround.js';
import type { DeckSurface, GroundSurface, Vec2 } from './surface.js';
import type { Rect } from './groundStore.js';

export type GroundLayer =
  | 'land' | 'park' | 'wood' | 'square' | 'parking'
  | 'asphalt' | 'klinker' | 'cycle' | 'paving' | 'gravel' | 'kerb' | 'paint'
  | 'water' | 'quay' | 'deckBody' | 'deckTop';

export const GROUND_LAYERS: readonly GroundLayer[] = ['land', 'park', 'wood', 'square', 'parking', 'asphalt', 'klinker', 'cycle', 'paving', 'gravel', 'kerb', 'paint', 'water', 'quay', 'deckBody', 'deckTop'];

/** Transferable mesh arrays. Colours are sRGB 0..1 when present. */
export interface PackedMesh { positions: Float32Array; normals: Float32Array; uvs: Float32Array; indices: Uint32Array; colors?: Float32Array }

export interface GroundMask { x0: number; y0: number; res: number; width: number; height: number; texels: Uint8Array }

export interface BuiltCell {
  key: string;
  lod: 0 | 1;
  rect: Rect;
  layers: Partial<Record<GroundLayer, PackedMesh>>;
  mask: GroundMask | null;
  stats: { triangles: number; byLayer: Record<string, number>; ways: number; areas: number; decks: number; flatDecks: number; buildMs: number; bytes: number };
}

export interface CellInput {
  key: string;
  lod: 0 | 1;
  rect: Rect;
  surface: GroundSurface;
  water: WaterGeometry | null;
  /** Water of the 3×3 neighbourhood (for the mask's distances at seams). */
  waterAround: WaterGeometry[];
  decks: readonly DeckSurface[];
  /** Every placed deck's footprint near the cell (street mask exceptions). */
  deckRingsAround: readonly Vec2[][];
  flatDecks: readonly Vec2[][];
  osm: OsmGroundExtract | null;
  osmAround: OsmGroundExtract[];
  project: (lngLat: [number, number]) => Vec2;
}

/** How far the mask may extend past the cell, metres. */
const MASK_REACH_M = 150;
/** Signed-distance range of the water mask (texels saturate at ±this), metres. */
export const MASK_RANGE_M = 4;
/** Coping cap on every quay wall, reaching this far inland over the land's cut edge (water.ts). */
export const QUAY_CAP_M = 0.35;

/** Area-weighted vertex normals (three's computeVertexNormals), here so the main thread need not. */
export function vertexNormals(positions: Float32Array, indices: Uint32Array): Float32Array {
  const n = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { n[k] += nx; n[k + 1] += ny; n[k + 2] += nz; }
  }
  for (let k = 0; k < n.length; k += 3) {
    const l = Math.hypot(n[k], n[k + 1], n[k + 2]);
    if (l > 0) { n[k] /= l; n[k + 1] /= l; n[k + 2] /= l; } else n[k + 2] = 1;
  }
  return n;
}

export function packMesh(m: MeshArrays): PackedMesh {
  const positions = Float32Array.from(m.positions), indices = Uint32Array.from(m.indices);
  return { positions, normals: vertexNormals(positions, indices), uvs: Float32Array.from(m.uvs), indices, ...(m.colors ? { colors: Float32Array.from(m.colors) } : {}) };
}

export const packedTriangles = (m: PackedMesh) => m.indices.length / 3;
export const packedBytes = (m: PackedMesh) => m.positions.byteLength + m.normals.byteLength + m.uvs.byteLength + m.indices.byteLength + (m.colors?.byteLength ?? 0);

/** Transfer list for postMessage. */
export function cellTransferables(cell: BuiltCell): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  for (const m of Object.values(cell.layers)) if (m) { out.push(m.positions.buffer as ArrayBuffer, m.normals.buffer as ArrayBuffer, m.uvs.buffer as ArrayBuffer, m.indices.buffer as ArrayBuffer); if (m.colors) out.push(m.colors.buffer as ArrayBuffer); }
  if (cell.mask) out.push(cell.mask.texels.buffer as ArrayBuffer);
  return out;
}

/** Carriageways only, no paint: the far ring's cross-section. */
function farSection(w: LocalWay): LocalWay | null {
  const bands = w.section.bands.filter(b => b.kind === 'carriageway');
  if (!bands.length) return null;
  return { ...w, section: { ...w.section, bands, paint: [] } };
}

export function buildCell(input: CellInput): BuiltCell {
  const t0 = Date.now();
  const { key, lod, rect, surface } = input;
  const [x0, y0, x1, y1] = rect;
  const parts: Partial<Record<GroundLayer, MeshArrays[]>> = {};
  const add = (layer: GroundLayer, m: MeshArrays) => { if (m.indices.length) (parts[layer] ??= []).push(m); };

  // Streets: the cell's own ways, with the neighbourhood in the junction graph.
  const seen = new Set<number>(), all: LocalWay[] = [], own = new Set<number>();
  for (const extract of [input.osm, ...input.osmAround]) if (extract) for (const w of prepareWays(extract.ways, input.project)) {
    if (seen.has(w.id)) continue;
    seen.add(w.id); all.push(w);
  }
  for (const w of input.osm?.ways ?? []) own.add(w.id);
  const ways = lod === 0 ? all : all.map(farSection).filter((w): w is LocalWay => !!w);
  const areas = input.osm?.areas ?? [];

  // Mask extent: the cell plus what its ways and areas reach (capped).
  let mx0 = x0, my0 = y0, mx1 = x1, my1 = y1;
  const grow = (p: Vec2) => { mx0 = Math.min(mx0, p[0] - 8); my0 = Math.min(my0, p[1] - 8); mx1 = Math.max(mx1, p[0] + 8); my1 = Math.max(my1, p[1] + 8); };
  for (const w of ways) if (own.has(w.id)) w.points.forEach(grow);
  for (const a of areas) for (const r of a.rings) for (const p of r) grow(input.project(p));
  for (const d of input.decks) { grow([d.profile.bbox[0], d.profile.bbox[1]]); grow([d.profile.bbox[2], d.profile.bbox[3]]); }
  mx0 = Math.max(mx0, x0 - MASK_REACH_M); my0 = Math.max(my0, y0 - MASK_REACH_M); mx1 = Math.min(mx1, x1 + MASK_REACH_M); my1 = Math.min(my1, y1 + MASK_REACH_M);
  const res = lod === 0 ? 1 : 2;
  const geoAround: WaterGeometry = { polygons: input.waterAround.flatMap(g => g.polygons), shores: input.waterAround.flatMap(g => g.shores) };
  const hasWater = geoAround.polygons.length > 0;
  const mask = hasWater ? buildWaterMask(geoAround, mx0, my0, mx1, my1, res, MASK_RANGE_M, input.deckRingsAround) : null;
  const overWater = (x: number, y: number) => !!mask && maskDistance(mask, x, y) < 0;

  // Land: the relief grid over the rectangle; quads deep inside a canal skipped.
  const step = lod === 0 ? 5 : 10;
  const gx0 = Math.floor(x0 / step) * step, gy0 = Math.floor(y0 / step) * step;
  // Grid on global multiples of the step, clipped to the cell by whole quads
  // whose centre is inside, so two cells never both draw a quad.
  const inCell = (x: number, y: number) => x >= x0 && x < x1 && y >= y0 && y < y1;
  const keepLand = (x: number, y: number) => inCell(x, y) && (!mask || maskDistance(mask, x, y) > -(step * 0.71 + 0.2));
  add('land', reliefGrid(gx0, gy0, Math.ceil(x1 / step) * step, Math.ceil(y1 / step) * step, step, surface.ground, keepLand));

  // Areas.
  const areaLayer: Record<string, GroundLayer> = { park: 'park', grass: 'park', wood: 'wood', square: 'square', paved: 'square', parking: 'parking' };
  for (const a of areas) {
    const layer = areaLayer[a.kind];
    if (!layer) continue;
    const m = emptyMesh();
    for (const r of a.rings) {
      const pts = r.slice(0, -1).map(input.project);
      if (pts.length < 3) continue;
      const flat = pts.flatMap(p => [p[0], p[1]]);
      drapeTriangles(m, flat, earcut(flat), surface.height, LIFT.area + (layer === 'square' ? 0.004 : 0), lod === 0 ? 8 : 16);
    }
    add(layer, m);
  }

  // Streets: bridge ways sampled finer (decks hump over metres).
  const only = (bridge: boolean) => (w: LocalWay) => own.has(w.id) && isBridgeWay(w) === bridge;
  const streets = buildStreets(ways, surface.height, { step: lod === 0 ? 3 : 6, only: only(false) });
  const onBridges = buildStreets(ways, surface.height, { step: lod === 0 ? 1.5 : 3, only: only(true) });
  for (const s of ['paving', 'klinker', 'asphalt', 'cycle', 'gravel', 'kerb', 'paint'] as const) { add(s, streets[s]); add(s, onBridges[s]); }

  // Water, quays, decks.
  if (input.water) {
    add('water', waterSurfaceMesh(input.water, -1.77));
    add('quay', quayWallMesh({ polygons: [], shores: input.water.shores }, surface.height, -1.77, lod === 0 ? 4 : 8, QUAY_CAP_M));
  }
  for (const deck of input.decks) add('deckBody', measuredDeckBody(deck, surface.ground, overWater, -1.77));
  for (const ring of input.flatDecks) {
    const { top, body } = flatDeckBody(ring, surface.height, overWater);
    add('deckTop', top); add('deckBody', body);
  }

  const packed: Partial<Record<GroundLayer, PackedMesh>> = {};
  const byLayer: Record<string, number> = {};
  let triangles = 0, bytes = 0;
  for (const layer of GROUND_LAYERS) {
    const list = parts[layer];
    if (!list?.length) continue;
    const m = list.length === 1 ? list[0] : merge(list);
    const p = packMesh(m);
    packed[layer] = p;
    byLayer[layer] = packedTriangles(p);
    triangles += byLayer[layer];
    bytes += packedBytes(p);
  }
  const maskOut: GroundMask | null = mask ? { x0: mask.x0, y0: mask.y0, res: mask.res, width: mask.width, height: mask.height, texels: maskTexels(mask) } : null;
  if (maskOut) bytes += maskOut.texels.byteLength;
  return {
    key, lod, rect, layers: packed, mask: maskOut,
    stats: { triangles, byLayer, ways: [...own].length, areas: areas.length, decks: input.decks.length, flatDecks: input.flatDecks.length, buildMs: Date.now() - t0, bytes },
  };
}

/** Polygon-offset rank of coplanar layers (gameGround.ts OFFSET): later wins a tie. */
const DRAW_RANK: Partial<Record<GroundLayer, number>> = { park: 1, wood: 1, square: 1, parking: 1, klinker: 2, asphalt: 2, gravel: 3, cycle: 3, paving: 3, paint: 4 };
/** Mask channel that cuts a layer (gameGround.ts CUT): 0 = R (water), 1 = G (water minus decks). */
const CUT_CHANNEL: Partial<Record<GroundLayer, 0 | 1>> = { land: 0, park: 0, wood: 0, square: 0, parking: 0, asphalt: 1, klinker: 1, cycle: 1, paving: 1, gravel: 1, kerb: 1, paint: 1 };

/**
 * What a camera straight above sees at (x, y) in one built cell: every
 * triangle under the point, the mask discard applied as the shader does
 * (bilinear, < 0.5 discards), topmost first, ties within 2 cm to the higher
 * draw rank. For named regressions (walks every triangle).
 */
export function layersAt(cell: BuiltCell, x: number, y: number): { top: GroundLayer | null; hits: { layer: GroundLayer; z: number; cut: boolean }[] } {
  const hits: { layer: GroundLayer; z: number; cut: boolean; rank: number }[] = [];
  for (const layer of GROUND_LAYERS) {
    const m = cell.layers[layer];
    if (!m) continue;
    const pos = m.positions, idx = m.indices;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      if (Math.max(pos[a], pos[b], pos[c]) < x || Math.min(pos[a], pos[b], pos[c]) > x || Math.max(pos[a + 1], pos[b + 1], pos[c + 1]) < y || Math.min(pos[a + 1], pos[b + 1], pos[c + 1]) > y) continue;
      const d = (pos[b + 1] - pos[c + 1]) * (pos[a] - pos[c]) + (pos[c] - pos[b]) * (pos[a + 1] - pos[c + 1]);
      if (Math.abs(d) < 1e-12) continue;
      const u = ((pos[b + 1] - pos[c + 1]) * (x - pos[c]) + (pos[c] - pos[b]) * (y - pos[c + 1])) / d;
      const v = ((pos[c + 1] - pos[a + 1]) * (x - pos[c]) + (pos[a] - pos[c]) * (y - pos[c + 1])) / d;
      if (u < 0 || v < 0 || u + v > 1) continue;
      const ch = CUT_CHANNEL[layer];
      const cut = ch !== undefined && !!cell.mask && maskChannelAt(cell.mask, x, y, ch) < 0.5;
      hits.push({ layer, z: u * pos[a + 2] + v * pos[b + 2] + (1 - u - v) * pos[c + 2], cut, rank: DRAW_RANK[layer] ?? 0 });
    }
  }
  hits.sort((p, q) => (Math.abs(p.z - q.z) > 0.02 ? q.z - p.z : q.rank - p.rank));
  return { top: hits.find(h => !h.cut && h.layer !== 'water')?.layer ?? null, hits: hits.map(({ layer, z, cut }) => ({ layer, z: +z.toFixed(3), cut })) };
}

/** Bilinear mask channel (0..1) at a scene point, as the GPU's LinearFilter samples it; 1 (land) outside. */
export function maskChannelAt(m: GroundMask, x: number, y: number, ch: 0 | 1): number {
  const fx = (x - m.x0) / m.res - 0.5, fy = (y - m.y0) / m.res - 0.5;
  if (fx <= -0.5 || fy <= -0.5 || fx >= m.width - 0.5 || fy >= m.height - 0.5) return 1;
  const i = Math.max(0, Math.min(m.width - 2, Math.floor(fx))), j = Math.max(0, Math.min(m.height - 2, Math.floor(fy)));
  const u = Math.max(0, Math.min(1, fx - i)), v = Math.max(0, Math.min(1, fy - j)), t = m.texels, w = m.width;
  const at = (a: number, b: number) => t[(b * w + a) * 2 + ch] / 255;
  return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
}
