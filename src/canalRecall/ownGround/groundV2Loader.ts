// Ground v2 runtime loader, phase 1 A/B (lane G2a #372; `?groundV2=1`, default off: G2b makes it the fast path).
//
// The worker builds the cell as today, then this swaps the surface layers for the baked GRD2 surface: every worker
// surface triangle the baked surface covers at the same height is dropped (so bridge-deck road tops over the water or
// over land, which v2 leaves to the overlays in phase 1, stay), and the baked layers are appended. Overlays (paint,
// tram, bollards, water, quays, decks, rails, hedges, furniture) are untouched. A file baked in another frame, version
// or rect is refused and the cell keeps the worker build (judgement ruling 2: never offset ground). This saves no
// worker CPU yet; it lets the look be judged ride by ride. G2b replaces it with buildCell({ surface: false }).
//
// Pure: no THREE, no DOM. The meshopt decoder is passed in (three's meshopt_decoder.module.js in the worker).

import type { BuiltCell, GroundLayer, PackedMesh } from './groundCell.js';
import type { Rect } from './groundStore.js';
import { sourceOfCode, type GroundSource } from './sourceTrace.js';
import { decodeGrd2, frameMismatch, grd2Layers, readGrd2Header, unitX, unitY, type GroundFrame, type MeshoptDecoderLike } from './groundV2Format.js';

/** Layers the baked surface owns in phase 1 (the partition's materials plus the kerb band and faces). */
export const V2_SURFACE_LAYERS: ReadonlySet<GroundLayer> = new Set<GroundLayer>(['land', 'park', 'wood', 'square', 'parking', 'lawn', 'bed', 'shrub', 'bark', 'sand', 'parkGravel', 'parkPath', 'pond', 'asphalt', 'klinker', 'brick', 'cycle', 'paving', 'gravel', 'garden', 'bare', 'kerb']);
/**
 * Worker triangle sources the bake owns (sourceTrace.ts). With the cell's sources traced, a covered worker triangle
 * is dropped only when it came from one of these; OSM street bands, junction fills, lane ribbons, paint, rails, water,
 * quays and decks stay (the partition reads no OSM ways in phase 1).
 */
export const V2_OWNED_SOURCES: ReadonlySet<GroundSource> = new Set<GroundSource>(['land', 'osmArea', 'park', 'bgtCarriage', 'bgtParking', 'bgtFoot', 'bgtPedestrian', 'bgtCycle', 'bgtDriveway', 'bgtIsland', 'bgtBerm', 'bgtVerge', 'bgtSquare', 'fietsstraat', 'bgtKerb', 'pocket']);
/** A worker surface triangle within this height of the baked surface under it is replaced by it (decks stand higher). */
export const V2_REPLACE_DZ_M = 0.6;
const RES_M = 1;

export interface GroundV2Result { cell: BuiltCell; used: boolean; reason?: string; dropped?: number; /** Covered worker triangles kept for their source (bands, fills, paint). */ kept?: number; triangles?: number }

/** Swap a worker-built cell's surface for the baked one; `bytes` gunzipped. */
export function applyGroundV2(built: BuiltCell, bytes: Uint8Array, decoder: MeshoptDecoderLike, frame: GroundFrame, rect: Rect): GroundV2Result {
  let header;
  try { header = readGrd2Header(bytes); } catch (e) { return { cell: built, used: false, reason: String(e) }; }
  const why = frameMismatch(header, frame, rect);
  if (why) return { cell: built, used: false, reason: `refused: ${why}` };
  const dec = decodeGrd2(bytes, decoder), v2 = grd2Layers(dec);
  // Coverage raster of the baked surface: the highest z per 1 m texel (NaN: not covered, the water).
  const nx = Math.ceil((rect[2] - rect[0]) / RES_M), ny = Math.ceil((rect[3] - rect[1]) / RES_M);
  const zTex = new Float32Array(nx * ny).fill(NaN);
  for (const g of dec.groups) {
    if (g.kind !== 0) continue;
    for (let t = g.first; t < g.first + g.count; t++) for (let j = 0; j < 3; j++) {
      const i = dec.indices[3 * t + j], x = unitX(rect, dec.u[i]), y = unitY(rect, dec.v[i]);
      const k = Math.min(ny - 1, Math.floor((y - rect[1]) / RES_M)) * nx + Math.min(nx - 1, Math.floor((x - rect[0]) / RES_M));
      const z = dec.zMm[i] / 1000; if (!(zTex[k] >= z)) zTex[k] = z;
    }
    // Fill each triangle's centroid texel too (large triangles span texels no vertex lands in).
    for (let t = g.first; t < g.first + g.count; t++) {
      const a = dec.indices[3 * t], b = dec.indices[3 * t + 1], c = dec.indices[3 * t + 2];
      const ax = unitX(rect, dec.u[a]), ay = unitY(rect, dec.v[a]), bx = unitX(rect, dec.u[b]), by = unitY(rect, dec.v[b]), cx = unitX(rect, dec.u[c]), cy = unitY(rect, dec.v[c]);
      const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay); if (!d) continue;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - rect[0]) / RES_M)), i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - rect[0]) / RES_M));
      const j0 = Math.max(0, Math.floor((Math.min(ay, by, cy) - rect[1]) / RES_M)), j1 = Math.min(ny - 1, Math.floor((Math.max(ay, by, cy) - rect[1]) / RES_M));
      const za = dec.zMm[a] / 1000, zb = dec.zMm[b] / 1000, zc = dec.zMm[c] / 1000;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = rect[0] + (i + 0.5) * RES_M, py = rect[1] + (j + 0.5) * RES_M;
        const w1 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / d, w2 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / d, w3 = 1 - w1 - w2;
        if (w1 < 0 || w2 < 0 || w3 < 0) continue;
        const k = j * nx + i, z = w1 * za + w2 * zb + w3 * zc; if (!(zTex[k] >= z)) zTex[k] = z;
      }
    }
  }
  const covered = (x: number, y: number, z: number): boolean => {
    const i = Math.floor((x - rect[0]) / RES_M), j = Math.floor((y - rect[1]) / RES_M);
    if (i < 0 || j < 0 || i >= nx || j >= ny) return false; // outside the cell: the worker's overhang stays (its neighbour's v2 covers it there)
    const zt = zTex[j * nx + i];
    return zt === zt && z < zt + V2_REPLACE_DZ_M;
  };
  const layers: BuiltCell['layers'] = {};
  let dropped = 0, kept = 0;
  for (const [name, m] of Object.entries(built.layers) as [GroundLayer, PackedMesh][]) {
    if (!m) continue;
    if (!V2_SURFACE_LAYERS.has(name)) { layers[name] = m; continue; }
    const p = m.positions, keep: number[] = [];
    // Traced sources, when they line up with the packed mesh (tunnel clipping can re-split triangles after tracing).
    const src = built.sources?.[name], traced = !!src && src.length === m.indices.length / 3;
    for (let t = 0; t < m.indices.length; t += 3) {
      const a = m.indices[t] * 3, b = m.indices[t + 1] * 3, c = m.indices[t + 2] * 3;
      if (covered((p[a] + p[b] + p[c]) / 3, (p[a + 1] + p[b + 1] + p[c + 1]) / 3, (p[a + 2] + p[b + 2] + p[c + 2]) / 3)) {
        const from = traced ? sourceOfCode(src![t / 3]) : null;
        if (!traced || (from !== null && V2_OWNED_SOURCES.has(from))) { dropped++; continue; }
        kept++;
      }
      keep.push(m.indices[t], m.indices[t + 1], m.indices[t + 2]);
    }
    if (keep.length) layers[name] = { ...m, indices: Uint32Array.from(keep) };
  }
  // Append the baked layers: one packed mesh per layer over the vertices it uses (float normals, uv = x, y).
  let triangles = 0;
  for (const [name, l] of Object.entries(v2.layers) as [GroundLayer, { indices: Uint32Array }][]) {
    const map = new Map<number, number>(), pos: number[] = [], nor: number[] = [], uv: number[] = [], idx = new Uint32Array(l.indices.length);
    for (let i = 0; i < l.indices.length; i++) {
      const v = l.indices[i]; let n = map.get(v);
      if (n === undefined) { n = pos.length / 3; map.set(v, n); pos.push(v2.positions[3 * v], v2.positions[3 * v + 1], v2.positions[3 * v + 2]); nor.push(v2.normals[3 * v] / 127, v2.normals[3 * v + 1] / 127, v2.normals[3 * v + 2] / 127); uv.push(v2.positions[3 * v], v2.positions[3 * v + 1]); }
      idx[i] = n;
    }
    triangles += idx.length / 3;
    const mesh: PackedMesh = { positions: Float32Array.from(pos), normals: Float32Array.from(nor), uvs: Float32Array.from(uv), indices: idx };
    const prev = layers[name];
    if (prev && prev.positions.length) {
      const off = prev.positions.length / 3, cat = (a: Float32Array, b: Float32Array) => { const o = new Float32Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };
      const ind = new Uint32Array(prev.indices.length + idx.length); ind.set(prev.indices); for (let i = 0; i < idx.length; i++) ind[prev.indices.length + i] = idx[i] + off;
      // A layer with vertex colours (kerb) pads the baked vertices white.
      const colors = prev.colors ? cat(prev.colors, new Float32Array(pos.length).fill(1)) : undefined;
      layers[name] = { positions: cat(prev.positions, mesh.positions), normals: cat(prev.normals, mesh.normals), uvs: cat(prev.uvs, mesh.uvs), indices: ind, ...(colors ? { colors } : {}) };
    } else layers[name] = name === 'kerb' ? { ...mesh, colors: new Float32Array(pos.length).fill(1) } : mesh;
  }
  const { sources: _sources, ...rest } = built;
  return { cell: { ...rest, layers }, used: true, dropped, kept, triangles };
}
