// Ground v2 cell files (GRD2): encode and decode, shared by the bake (scripts/own-ground/bake-ground.ts) and the
// runtime loader (groundWorker.ts, `?groundV2=1`). Lane G2a #372; design docs/handoffs/ground-v2-design-20261110.md,
// "The cell format (GRD2)".
//
// Coordinates. The bake works in the game's local frame (groundStore toLocal: equirectangular metres about
// GAME_ORIGIN), not RD. Every file therefore records the frame it was baked in: the origin (lng, lat), the metres per
// degree (kx, ky), the transform id and the format version. A runtime whose frame differs refuses the file
// (`frameMismatch`) and the cell falls back to the worker build: offset ground is never drawn (judgement ruling 2,
// 2026-11-10). x and y are u16 normalised to the cell rect (0 and 65535 decode to the rect's edges exactly, so seam
// vertices are bitwise equal in both neighbours); z is mm above a per-cell base; normals are octahedral i8.
//
// Pure: no THREE, no DOM. The meshopt codec is passed in (meshoptimizer's in Node, three's decoder in the browser),
// so this module adds no dependency to the runtime bundle.

import type { GroundLayer } from './groundCell.js';
import { GROUND_LAYERS } from './groundCell.js';
import type { Rect } from './groundStore.js';

export const GRD2_MAGIC = 0x32445247; // 'GRD2' little-endian
export const GRD2_VERSION = 1;
/** x/y quantum: a cell's width is GRID_Q steps. */
export const GRID_Q = 65535;
/** Transform ids: 1 = equirectangular lng/lat → metres, x = (lng − lng0)·kx, y = (lat − lat0)·ky. */
export const TRANSFORM_EQUIRECT = 1;
export const FLAG_DEBUG = 1, FLAG_OVERLAYS = 2, FLAG_MESHOPT = 4;
/** Bytes per vertex in the vertex stream: x u16, y u16, z u16, normal oct i8×2. */
export const VERTEX_BYTES = 8;
const HEADER_BYTES = 168, GROUP_BYTES = 12;

/** The frame a file was baked in (and the runtime's own, `runtimeFrame` in groundStore terms). */
export interface GroundFrame { originLng: number; originLat: number; kx: number; ky: number; transform: number }

/** A draw range: triangles [first, first + count) of the index stream, one layer, one 3×3 tile. */
export interface Grd2Group {
  layer: GroundLayer;
  /**
   * 0 surface, 1 step strip (kerb face, wall), 2 floor cap: surface under a reviewed crossing's deck (crossings.ts,
   * lane G3) held at the street level the record measured, not the relief's saddle (round 2). Readers that know only
   * 0 and 1 draw a cap as surface.
   */
  kind: 0 | 1; tile: number; first: number; count: number;
}
/** Surface groups: what the rider stands on (kind 0; step strips are kind 1). */
export const isSurfaceGroup = (g: Pick<Grd2Group, 'kind'>): boolean => g.kind !== 1;

export interface Grd2Header {
  version: number; flags: number; cx: number; cy: number; lod: 0 | 1; levels: number;
  frame: GroundFrame; rect: Rect; zBaseMm: number;
  vertices: number; triangles: number; groups: number; stepTriangles: number;
  inputsHash: Uint8Array; codeHash: Uint8Array;
}

/** What the bake hands the encoder: quantised vertices, triangles in draw order, groups over them, seam vertex ids. */
export interface Grd2Content {
  key: string; lod: 0 | 1; levels: number; frame: GroundFrame; rect: Rect;
  /** Per vertex: u, v in 0..GRID_Q; z in mm (scene); oct normal as two i8. */
  u: Uint16Array; v: Uint16Array; zMm: Int32Array; oct: Int8Array;
  /** 3 per triangle, already sorted by group (groups cover them in order). */
  indices: Uint32Array;
  groups: Grd2Group[];
  /** Vertex ids on each side, in order along it: west (u = 0), east (u = Q), south (v = 0), north (v = Q). */
  seams: [Uint32Array, Uint32Array, Uint32Array, Uint32Array];
  inputsHash?: Uint8Array; codeHash?: Uint8Array; flags?: number;
}

export interface MeshoptEncoderLike {
  encodeVertexBuffer(source: Uint8Array, count: number, size: number): Uint8Array;
  encodeIndexBuffer(source: Uint8Array, count: number, size: number): Uint8Array;
}
export interface MeshoptDecoderLike {
  decodeVertexBuffer(target: Uint8Array, count: number, size: number, source: Uint8Array, filter?: string): void;
  decodeIndexBuffer(target: Uint8Array, count: number, size: number, source: Uint8Array): void;
}

// ------------------------------------------------------------------ quantisation (shared with the bake)

/** u in 0..GRID_Q → game x, as every decoder computes it (0 and GRID_Q land on the rect's edges exactly). */
export const unitX = (rect: Rect, u: number): number => (u === GRID_Q ? rect[2] : u === 0 ? rect[0] : rect[0] + (u / GRID_Q) * (rect[2] - rect[0]));
export const unitY = (rect: Rect, v: number): number => (v === GRID_Q ? rect[3] : v === 0 ? rect[1] : rect[1] + (v / GRID_Q) * (rect[3] - rect[1]));

/** Octahedral encode of a unit normal into two i8. */
export function octEncode(nx: number, ny: number, nz: number): [number, number] {
  const l = Math.abs(nx) + Math.abs(ny) + Math.abs(nz) || 1;
  let x = nx / l, y = ny / l;
  if (nz < 0) { const ox = x; x = (1 - Math.abs(y)) * (ox >= 0 ? 1 : -1); y = (1 - Math.abs(ox)) * (y >= 0 ? 1 : -1); }
  return [Math.round(Math.max(-1, Math.min(1, x)) * 127), Math.round(Math.max(-1, Math.min(1, y)) * 127)];
}
export function octDecode(a: number, b: number): [number, number, number] {
  let x = a / 127, y = b / 127; const z = 1 - Math.abs(x) - Math.abs(y);
  if (z < 0) { const ox = x; x = (1 - Math.abs(y)) * (ox >= 0 ? 1 : -1); y = (1 - Math.abs(ox)) * (y >= 0 ? 1 : -1); }
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

/** The runtime's frame, from groundStore's constants (passed in so this module does not import the store). */
export const frameOf = (origin: { lng: number; lat: number }, scale: { kx: number; ky: number }): GroundFrame => ({ originLng: origin.lng, originLat: origin.lat, kx: scale.kx, ky: scale.ky, transform: TRANSFORM_EQUIRECT });

/**
 * Why a file must not be drawn by this runtime, or null when it may. The origin and transform must match exactly; the
 * scales within 1e-6 m/° (Math.cos may differ in the last bit between engines: 1e-6 m/° is 1e-7 m over the city);
 * the rect within 1 mm of the runtime's own cellRect.
 */
export function frameMismatch(h: Pick<Grd2Header, 'frame' | 'rect' | 'version'>, runtime: GroundFrame, runtimeRect?: Rect): string | null {
  if (h.version !== GRD2_VERSION) return `version ${h.version} ≠ ${GRD2_VERSION}`;
  if (h.frame.transform !== runtime.transform) return `transform ${h.frame.transform} ≠ ${runtime.transform}`;
  if (h.frame.originLng !== runtime.originLng || h.frame.originLat !== runtime.originLat) return `origin ${h.frame.originLng},${h.frame.originLat} ≠ ${runtime.originLng},${runtime.originLat}`;
  if (Math.abs(h.frame.kx - runtime.kx) > 1e-6 || Math.abs(h.frame.ky - runtime.ky) > 1e-6) return `scale ${h.frame.kx},${h.frame.ky} ≠ ${runtime.kx},${runtime.ky}`;
  if (runtimeRect && h.rect.some((r, i) => Math.abs(r - runtimeRect[i]) > 1e-3)) return `rect ${h.rect.join(',')} ≠ ${runtimeRect.join(',')}`;
  return null;
}

/** The 3×3 tile (cellTiles grid, row-major j·3 + i) holding a point in u/v units. */
export const tileOfUnits = (u: number, v: number): number => Math.min(2, Math.floor(v / (GRID_Q / 3))) * 3 + Math.min(2, Math.floor(u / (GRID_Q / 3)));

// ------------------------------------------------------------------ encode

const keyParts = (key: string): [number, number] => { const [a, b] = key.split('_').map(Number); return [a, b]; };

/** Encode a cell. With `encoder` the vertex and index streams are meshopt-coded (FLAG_MESHOPT); else raw. */
export function encodeGrd2(c: Grd2Content, encoder?: MeshoptEncoderLike): Uint8Array {
  const V = c.u.length, T = c.indices.length / 3;
  let zMin = Infinity, zMax = -Infinity;
  for (let i = 0; i < V; i++) { if (c.zMm[i] < zMin) zMin = c.zMm[i]; if (c.zMm[i] > zMax) zMax = c.zMm[i]; }
  if (!V) zMin = zMax = 0;
  if (zMax - zMin > 65535) throw new Error(`${c.key}: z range ${zMax - zMin} mm exceeds u16`);
  const vb = new Uint8Array(V * VERTEX_BYTES), dv = new DataView(vb.buffer);
  for (let i = 0; i < V; i++) {
    const o = i * VERTEX_BYTES;
    dv.setUint16(o, c.u[i], true); dv.setUint16(o + 2, c.v[i], true); dv.setUint16(o + 4, c.zMm[i] - zMin, true);
    dv.setInt8(o + 6, c.oct[2 * i]); dv.setInt8(o + 7, c.oct[2 * i + 1]);
  }
  const ib = new Uint8Array(c.indices.buffer, c.indices.byteOffset, c.indices.byteLength);
  const vEnc = encoder ? encoder.encodeVertexBuffer(vb, V, VERTEX_BYTES) : vb;
  const iEnc = encoder && T ? encoder.encodeIndexBuffer(ib, c.indices.length, 4) : ib.slice();
  const seamBytes = c.seams.reduce((s, a) => s + a.length * 4, 0);
  const total = HEADER_BYTES + c.groups.length * GROUP_BYTES + vEnc.length + iEnc.length + seamBytes;
  const out = new Uint8Array(total), d = new DataView(out.buffer);
  const [cx, cy] = keyParts(c.key);
  const stepTriangles = c.groups.filter(g => g.kind === 1).reduce((s, g) => s + g.count, 0);
  d.setUint32(0, GRD2_MAGIC, true); d.setUint16(4, GRD2_VERSION, true); d.setUint16(6, (c.flags ?? 0) | (encoder ? FLAG_MESHOPT : 0), true);
  d.setInt16(8, cx, true); d.setInt16(10, cy, true); d.setUint8(12, c.lod); d.setUint8(13, c.levels);
  d.setFloat64(16, c.frame.originLng, true); d.setFloat64(24, c.frame.originLat, true); d.setFloat64(32, c.frame.kx, true); d.setFloat64(40, c.frame.ky, true);
  d.setUint8(48, c.frame.transform);
  for (let i = 0; i < 4; i++) d.setFloat64(56 + 8 * i, c.rect[i], true);
  d.setInt32(88, zMin, true); d.setUint32(92, V, true); d.setUint32(96, T, true); d.setUint16(100, c.groups.length, true); d.setUint32(104, stepTriangles, true);
  if (c.inputsHash) out.set(c.inputsHash.subarray(0, 16), 108);
  if (c.codeHash) out.set(c.codeHash.subarray(0, 16), 124);
  d.setUint32(140, vEnc.length, true); d.setUint32(144, iEnc.length, true);
  for (let s = 0; s < 4; s++) d.setUint32(148 + 4 * s, c.seams[s].length, true);
  let o = HEADER_BYTES;
  for (const g of c.groups) {
    const li = GROUND_LAYERS.indexOf(g.layer);
    if (li < 0) throw new Error(`unknown layer ${g.layer}`);
    d.setUint8(o, li); d.setUint8(o + 1, g.kind); d.setUint8(o + 2, g.tile); d.setUint32(o + 4, g.first, true); d.setUint32(o + 8, g.count, true); o += GROUP_BYTES;
  }
  out.set(vEnc, o); o += vEnc.length; out.set(iEnc, o); o += iEnc.length;
  for (const s of c.seams) for (let i = 0; i < s.length; i++) { d.setUint32(o, s[i], true); o += 4; }
  return out;
}

// ------------------------------------------------------------------ decode

export function readGrd2Header(bytes: Uint8Array): Grd2Header {
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < HEADER_BYTES || d.getUint32(0, true) !== GRD2_MAGIC) throw new Error('not a GRD2 file');
  const rect = [0, 1, 2, 3].map(i => d.getFloat64(56 + 8 * i, true)) as Rect;
  return {
    version: d.getUint16(4, true), flags: d.getUint16(6, true), cx: d.getInt16(8, true), cy: d.getInt16(10, true), lod: d.getUint8(12) as 0 | 1, levels: d.getUint8(13),
    frame: { originLng: d.getFloat64(16, true), originLat: d.getFloat64(24, true), kx: d.getFloat64(32, true), ky: d.getFloat64(40, true), transform: d.getUint8(48) },
    rect, zBaseMm: d.getInt32(88, true), vertices: d.getUint32(92, true), triangles: d.getUint32(96, true), groups: d.getUint16(100, true), stepTriangles: d.getUint32(104, true),
    inputsHash: bytes.slice(108, 124), codeHash: bytes.slice(124, 140),
  };
}

export interface Grd2Decoded {
  header: Grd2Header;
  /** Per vertex, quantised: u, v (u16), z (mm, absolute), oct normal. */
  u: Uint16Array; v: Uint16Array; zMm: Int32Array; oct: Int8Array;
  indices: Uint32Array;
  groups: Grd2Group[];
  seams: [Uint32Array, Uint32Array, Uint32Array, Uint32Array];
}

/** Decode a whole file (gunzipped). `decoder` is required for meshopt-coded files. */
export function decodeGrd2(bytes: Uint8Array, decoder?: MeshoptDecoderLike): Grd2Decoded {
  const header = readGrd2Header(bytes);
  if (header.version !== GRD2_VERSION) throw new Error(`GRD2 version ${header.version} unsupported`);
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const V = header.vertices, T = header.triangles;
  const vLen = d.getUint32(140, true), iLen = d.getUint32(144, true);
  const seamCounts = [0, 1, 2, 3].map(s => d.getUint32(148 + 4 * s, true));
  let o = HEADER_BYTES;
  const groups: Grd2Group[] = [];
  for (let g = 0; g < header.groups; g++) { groups.push({ layer: GROUND_LAYERS[d.getUint8(o)], kind: d.getUint8(o + 1) as 0 | 1, tile: d.getUint8(o + 2), first: d.getUint32(o + 4, true), count: d.getUint32(o + 8, true) }); o += GROUP_BYTES; }
  const vSrc = bytes.subarray(o, o + vLen); o += vLen;
  const iSrc = bytes.subarray(o, o + iLen); o += iLen;
  const meshopt = (header.flags & FLAG_MESHOPT) !== 0;
  if (meshopt && !decoder) throw new Error('GRD2: meshopt-coded file needs a decoder');
  const vb = new Uint8Array(V * VERTEX_BYTES);
  if (meshopt) decoder!.decodeVertexBuffer(vb, V, VERTEX_BYTES, vSrc); else vb.set(vSrc);
  const indices = new Uint32Array(T * 3);
  if (meshopt && T) decoder!.decodeIndexBuffer(new Uint8Array(indices.buffer), T * 3, 4, iSrc); else new Uint8Array(indices.buffer).set(iSrc);
  const u = new Uint16Array(V), v = new Uint16Array(V), zMm = new Int32Array(V), oct = new Int8Array(2 * V), dv = new DataView(vb.buffer);
  for (let i = 0; i < V; i++) { const q = i * VERTEX_BYTES; u[i] = dv.getUint16(q, true); v[i] = dv.getUint16(q + 2, true); zMm[i] = header.zBaseMm + dv.getUint16(q + 4, true); oct[2 * i] = dv.getInt8(q + 6); oct[2 * i + 1] = dv.getInt8(q + 7); }
  const seams = seamCounts.map(n => { const a = new Uint32Array(n); for (let i = 0; i < n; i++) { a[i] = d.getUint32(o, true); o += 4; } return a; }) as Grd2Decoded['seams'];
  return { header, u, v, zMm, oct, indices, groups, seams };
}

/** Per layer, the arrays a ground mesh needs (game frame floats; one shared vertex buffer, an index list per layer). */
export interface Grd2Layers {
  positions: Float32Array; normals: Int8Array;
  layers: Partial<Record<GroundLayer, { indices: Uint32Array; groups: Grd2Group[] }>>;
}

/** Dequantise into one Float32 position array and Int8 normals (3 per vertex), with one index list per layer. */
export function grd2Layers(dec: Grd2Decoded): Grd2Layers {
  const { rect } = dec.header, V = dec.u.length;
  const positions = new Float32Array(V * 3), normals = new Int8Array(V * 3);
  for (let i = 0; i < V; i++) {
    positions[3 * i] = unitX(rect, dec.u[i]); positions[3 * i + 1] = unitY(rect, dec.v[i]); positions[3 * i + 2] = dec.zMm[i] / 1000;
    const n = octDecode(dec.oct[2 * i], dec.oct[2 * i + 1]);
    normals[3 * i] = Math.round(n[0] * 127); normals[3 * i + 1] = Math.round(n[1] * 127); normals[3 * i + 2] = Math.round(n[2] * 127);
  }
  const byLayer = new Map<GroundLayer, Grd2Group[]>();
  for (const g of dec.groups) { const l = byLayer.get(g.layer); if (l) l.push(g); else byLayer.set(g.layer, [g]); }
  const layers: Grd2Layers['layers'] = {};
  for (const [layer, gs] of byLayer) {
    const n = gs.reduce((s, g) => s + g.count, 0), idx = new Uint32Array(n * 3);
    let o = 0;
    for (const g of gs) { idx.set(dec.indices.subarray(g.first * 3, (g.first + g.count) * 3), o); o += g.count * 3; }
    layers[layer] = { indices: idx, groups: gs };
  }
  return { positions, normals, layers };
}

/** One 3×3 tile of a decoded cell as GPU arrays: its own vertices (Float32 xyz, Int8 normals), u16 indices when they fit. */
export interface Grd2TileMesh { tile: number; positions: Float32Array; normals: Int8Array; indices: Uint16Array | Uint32Array; groups: Grd2Group[] }

/**
 * The GPU layout G2b uploads (design "The cell format": Float32 positions, the materials reading uv = position.xy,
 * Int8 normals, u16 or u32 indices): one mesh per 3×3 tile (the groups' `tile`), each over the vertices it uses, so its
 * indices are u16 (a tile holds about a ninth of the cell's vertices; u32 only past 65,535). Groups are renumbered
 * into the tile's index stream. A vertex used by two tiles is in both.
 */
export function grd2TileMeshes(dec: Grd2Decoded): Grd2TileMesh[] {
  const { rect } = dec.header, out: Grd2TileMesh[] = [];
  const byTile = new Map<number, Grd2Group[]>();
  for (const g of dec.groups) { const l = byTile.get(g.tile); if (l) l.push(g); else byTile.set(g.tile, [g]); }
  for (const tile of [...byTile.keys()].sort((a, b) => a - b)) {
    const gs = byTile.get(tile)!, map = new Map<number, number>(), order: number[] = [];
    let n = 0; for (const g of gs) n += g.count;
    const idx = new Uint32Array(n * 3), groups: Grd2Group[] = [];
    let o = 0;
    for (const g of gs) {
      groups.push({ ...g, first: o / 3 });
      for (let k = g.first * 3; k < (g.first + g.count) * 3; k++) { const v = dec.indices[k]; let m = map.get(v); if (m === undefined) { m = order.length; map.set(v, m); order.push(v); } idx[o++] = m; }
    }
    const V = order.length, positions = new Float32Array(V * 3), normals = new Int8Array(V * 3);
    order.forEach((i, m) => {
      positions[3 * m] = unitX(rect, dec.u[i]); positions[3 * m + 1] = unitY(rect, dec.v[i]); positions[3 * m + 2] = dec.zMm[i] / 1000;
      const nn = octDecode(dec.oct[2 * i], dec.oct[2 * i + 1]);
      normals[3 * m] = Math.round(nn[0] * 127); normals[3 * m + 1] = Math.round(nn[1] * 127); normals[3 * m + 2] = Math.round(nn[2] * 127);
    });
    out.push({ tile, positions, normals, indices: V <= 65536 ? Uint16Array.from(idx) : idx, groups });
  }
  return out;
}

/** GPU bytes of a tile layout (vertex buffers + index buffers). */
export const tileMeshBytes = (tiles: readonly Grd2TileMesh[]): number => tiles.reduce((s, t) => s + t.positions.byteLength + t.normals.byteLength + t.indices.byteLength, 0);
