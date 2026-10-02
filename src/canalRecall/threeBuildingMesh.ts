// Merged wall meshes for the three.js building layer (spike, 2026-10-02).
//
// Takes streamed building features and returns typed arrays for ONE
// BufferGeometry per group of buildings: wall quads only (roofs, cornices and
// everything else stay with MapLibre's extrusions), with
//   - UVs counted in bays (u) and storeys (v), for a REPEAT-wrapped cell
//     texture array, so texture filtering needs no `fract` in the shader;
//   - a texture-array layer per quad (style x cell kind);
//   - a per-vertex tint (wall colour x directional shade x per-building jitter);
//   - an id -> vertex range map, so one building (the answer) can be lit or
//     hidden by touching a few bytes instead of rebuilding the mesh.
// Positions are metres east / north / up from a caller-supplied origin.

import { CELL_VARIANTS, cellLayer } from './facadeCells.js';
import { groundRuns, layoutWall } from './facadeLayout.js';
import { FACADE_CORNICE_M, type FacadeStyle } from './genericFacades.js';

export type MeshBuilding = {
  id: string;
  /** Rings of [lng, lat]; outer first, holes after. One polygon per entry. */
  polygons: number[][][][];
  heightM: number;
  minHeightM: number;
  style: FacadeStyle;
  wallHex: string;
};

export type Origin = { lng: number; lat: number };
export type VertexRange = { id: string; start: number; count: number };

export type Chunk = {
  positions: Float32Array;
  uvs: Float32Array;
  /** Texture-array layer, one byte per vertex. */
  layers: Uint8Array;
  /** RGBA, alpha unused (kept for 4-byte alignment). */
  tints: Uint8Array;
  indices: Uint32Array;
  ranges: VertexRange[];
  vertexCount: number;
  quadCount: number;
  wallCount: number;
  buildingCount: number;
};

const M_PER_DEG_LAT = 110_540;
const mPerDegLng = (lat: number) => 111_320 * Math.cos(lat * Math.PI / 180);

/** Top of the facade (and bottom of the plain cornice band above it). */
export const facadeTopM = (wallTopM: number) => wallTopM - FACADE_CORNICE_M;

/**
 * The wall top MapLibre's plain layer uses (`wallTopHeightExpression`):
 * pyramidal and tagged-tip roofs end the wall at their eaves. Ported to
 * plain code so the mesh stops where the extrusion does; the check script
 * evaluates the real expression on the same properties to prove it.
 */
export function wallTopHeightM(p: Record<string, unknown>): number {
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  const height = num(p.height, 5), minHeight = num(p.minHeight, 0);
  const exposed = height - minHeight;
  const inventedTip = Math.max(3, Math.min(12, 0.35 * exposed));
  const tagged = num(p.roofHeight, 0);
  const pyramidalTip = tagged > 0 ? tagged : inventedTip;
  const eaves = (tip: number) => Math.max(minHeight, height - tip);
  if (typeof p.roofEavesHeightM === 'number' && p.roofEavesHeightM > 0) return Math.min(height, p.roofEavesHeightM);
  if (p.roofShape === 'pyramidal') return eaves(pyramidalTip);
  const flatOrUntagged = p.roofShape === undefined || p.roofShape === '' || p.roofShape === 'flat';
  const hasRoofColour = p.roofColour !== undefined && p.roofColour !== null;
  const distinct = hasRoofColour && !(p.colour !== undefined && p.colour !== null && p.roofColour === p.colour);
  if (tagged > 0 && flatOrUntagged && distinct) return eaves(tagged);
  return height;
}

function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

const parseHex = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [200, 190, 175];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

/** Fixed light from the north-west, so walls facing it read lighter. */
export function wallShade(nx: number, ny: number): number {
  const d = nx * -0.45 + ny * 0.89;
  return 0.8 + 0.2 * (0.5 + 0.5 * d);
}

type Edge = { x0: number; y0: number; x1: number; y1: number; len: number; nx: number; ny: number; hole: boolean };

function ringEdges(ring: number[][], origin: Origin, hole: boolean): Edge[] {
  const kx = mPerDegLng(origin.lat);
  const pts = ring.map(([lng, lat]) => [(lng - origin.lng) * kx, (lat - origin.lat) * M_PER_DEG_LAT]);
  // GeoJSON closes the ring; drop the repeat.
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  if (pts.length < 3) return [];
  let area2 = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area2 += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  // The solid must lie on the left of travel for an outer ring (CCW), and on
  // the left of travel for a hole too once the hole runs clockwise.
  const wantCcw = !hole;
  if ((area2 > 0) !== wantCcw) pts.reverse();
  const edges: Edge[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    // Outward from the solid is the right-hand side of travel.
    edges.push({ x0, y0, x1, y1, len, nx: dy / len, ny: -dx / len, hole });
  }
  return edges;
}

const edgeKey = (x: number, y: number) => `${Math.round(x * 10)},${Math.round(y * 10)}`;

/**
 * Build one chunk. Walls shared exactly with a taller-or-equal neighbour in
 * the same chunk (party walls between terraced houses, the bulk of a canal
 * belt's edges) are skipped: nobody sees them, and they are about half the
 * vertices of a naive mesh.
 */
export function buildChunk(buildings: readonly MeshBuilding[], origin: Origin): Chunk {
  type Prepared = { b: MeshBuilding; edges: Edge[]; top: number };
  const prepared: Prepared[] = [];
  const shared = new Map<string, { top: number; base: number }[]>();
  for (const b of buildings) {
    const top = facadeTopM(b.heightM);
    const edges: Edge[] = [];
    for (const polygon of b.polygons) polygon.forEach((ring, i) => edges.push(...ringEdges(ring, origin, i > 0)));
    prepared.push({ b, edges, top });
    for (const e of edges) {
      const key = `${edgeKey(e.x0, e.y0)}>${edgeKey(e.x1, e.y1)}`;
      let list = shared.get(key);
      if (!list) shared.set(key, list = []);
      list.push({ top: b.heightM, base: b.minHeightM });
    }
  }
  const hiddenByNeighbour = (e: Edge, b: MeshBuilding) => {
    const others = shared.get(`${edgeKey(e.x1, e.y1)}>${edgeKey(e.x0, e.y0)}`);
    return !!others && others.some(o => o.top >= b.heightM && o.base <= b.minHeightM);
  };

  type Quad = { e: Edge; u0: number; u1: number; v1: number; layer: number; z0: number; z1: number; tint: [number, number, number]; along0: number; along1: number };
  const quadsByBuilding: Array<{ b: MeshBuilding; quads: Quad[]; walls: number }> = [];
  let quadTotal = 0, wallTotal = 0;
  for (const { b, edges, top } of prepared) {
    const quads: Quad[] = [];
    const base = b.minHeightM;
    const [r, g, bl] = parseHex(b.wallHex);
    const variant = Math.floor(hash01(`${b.id}:look`) * CELL_VARIANTS);
    const jitter = 0.94 + hash01(`${b.id}:tone`) * 0.12;
    let walls = 0;
    for (const e of edges) {
      if (hiddenByNeighbour(e, b)) continue;
      const layout = layoutWall(b.style, e.len, top - base, hash01(`${b.id}:${edgeKey(e.x0, e.y0)}`), base < 0.5);
      if (!layout) continue;
      walls++;
      const shade = wallShade(e.nx, e.ny) * jitter;
      const tint: [number, number, number] = [Math.min(255, r * shade), Math.min(255, g * shade), Math.min(255, bl * shade)];
      const groundTop = base + layout.groundM;
      for (const run of groundRuns(layout)) {
        quads.push({ e, u0: 0, u1: run.to - run.from, v1: 1, layer: cellLayer(b.style, run.door ? 'door' : 'ground', variant), z0: base, z1: groundTop, tint, along0: run.from / layout.bays, along1: run.to / layout.bays });
      }
      if (layout.storeys > 0) quads.push({ e, u0: 0, u1: layout.bays, v1: layout.storeys, layer: cellLayer(b.style, 'upper', variant), z0: groundTop, z1: top, tint, along0: 0, along1: 1 });
    }
    quadsByBuilding.push({ b, quads, walls });
    quadTotal += quads.length; wallTotal += walls;
  }

  const vertexCount = quadTotal * 4;
  const positions = new Float32Array(vertexCount * 3), uvs = new Float32Array(vertexCount * 2);
  const layers = new Uint8Array(vertexCount), tints = new Uint8Array(vertexCount * 4);
  const indices = new Uint32Array(quadTotal * 6);
  const ranges: VertexRange[] = [];
  let v = 0, q = 0;
  for (const { b, quads } of quadsByBuilding) {
    if (!quads.length) continue;
    const start = v;
    for (const quad of quads) {
      const { e } = quad;
      // Sub-span of the wall this quad covers (a ground run is a slice).
      const ax = e.x0 + (e.x1 - e.x0) * quad.along0, ay = e.y0 + (e.y1 - e.y0) * quad.along0;
      const bx = e.x0 + (e.x1 - e.x0) * quad.along1, by = e.y0 + (e.y1 - e.y0) * quad.along1;
      const corners: Array<[number, number, number, number, number]> = [
        [ax, ay, quad.z0, quad.u0, 0], [bx, by, quad.z0, quad.u1, 0], [bx, by, quad.z1, quad.u1, quad.v1], [ax, ay, quad.z1, quad.u0, quad.v1],
      ];
      for (const [x, y, z, u, vv] of corners) {
        positions[v * 3] = x; positions[v * 3 + 1] = y; positions[v * 3 + 2] = z;
        uvs[v * 2] = u; uvs[v * 2 + 1] = vv;
        layers[v] = quad.layer;
        tints[v * 4] = quad.tint[0]; tints[v * 4 + 1] = quad.tint[1]; tints[v * 4 + 2] = quad.tint[2]; tints[v * 4 + 3] = 255;
        v++;
      }
      const i = v - 4;
      indices.set([i, i + 1, i + 2, i, i + 2, i + 3], q * 6);
      q++;
    }
    ranges.push({ id: b.id, start, count: v - start });
  }
  return { positions, uvs, layers, tints, indices, ranges, vertexCount, quadCount: quadTotal, wallCount: wallTotal, buildingCount: ranges.length };
}
