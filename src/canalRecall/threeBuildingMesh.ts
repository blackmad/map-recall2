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
import type { KitPartGeometry } from './landmarkKits.js';
import earcut from 'earcut';
import { fitRect, roofTriangles, type RoofDims, type RoofPlan, type RoofTri } from './roofMesh.js';

export type MeshBuilding = {
  id: string;
  /** Rings of [lng, lat]; outer first, holes after. One polygon per entry. */
  polygons: number[][][][];
  heightM: number;
  minHeightM: number;
  style: FacadeStyle;
  wallHex: string;
  /** A bay look's own layers and accent colour; absent means the procedural cells. */
  layers?: { upper: number; ground: number; door: number };
  accentHex?: string;
  /** A shopfront on the street-level bays (procedural cells; the bay looks choose their own layer). */
  shop?: boolean;
  /** Texture layer for bare wall: gable faces, chimneys, cornices. */
  plainLayer?: number;
  /** Bare walls only (a church): every row uses the plain layer and there are no doors. */
  plainWalls?: boolean;
  /**
   * The mesh owns this building's top: walls run to the full height (no MapLibre
   * cornice band) and a flat roof gets a lid in this colour on the flat layer.
   * Without it, MapLibre drew band and lid as separate extrusions that hung in
   * mid-air whenever the walls were rebuilt (user report 2026-10-02).
   */
  lid?: { hex: string; flatLayer: number };
  /** A real roof for this building; its walls already stop at the eaves. */
  roof?: { plan: RoofPlan; layers: { slope: number; plain: number; dormer: number }; roofHex: string; dims: RoofDims };
};

export type Origin = { lng: number; lat: number };
export type VertexRange = { id: string; start: number; count: number };

export type Chunk = {
  positions: Float32Array;
  uvs: Float32Array;
  /** Texture-array layer, one byte per vertex. */
  layers: Uint8Array;
  /** RGB wall tint (colour x per-building tone); alpha is the directional shade. */
  tints: Uint8Array;
  /** RGBA accent colour (door leaf, shutters, awnings) for the bay looks; white otherwise. */
  accents: Uint8Array;
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

/** Which of a style's looks a building wears (shared with the roof plan so gable faces match the walls). */
export const lookVariant = (id: string) => Math.floor(hash01(`${id}:look`) * CELL_VARIANTS);

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

/** Marks a flat-roof lid triangle among a building's roof triangles. */
const LID_PART = 'lid' as RoofTri['part'];

/** A flat lid over every polygon (holes kept open) at the wall top. */
function lidTriangles(b: MeshBuilding, origin: Origin): RoofTri[] {
  const kx = mPerDegLng(origin.lat), out: RoofTri[] = [];
  for (const polygon of b.polygons) {
    const flat: number[] = [], holes: number[] = [];
    for (const [i, ring] of polygon.entries()) {
      const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
      if (pts.length < 3) { if (i === 0) break; continue; }
      if (i > 0) holes.push(flat.length / 2);
      for (const [lng, lat] of pts) flat.push((lng - origin.lng) * kx, (lat - origin.lat) * M_PER_DEG_LAT);
    }
    if (flat.length < 6) continue;
    const index = earcut(flat, holes.length ? holes : undefined, 2), z = b.heightM;
    for (let i = 0; i < index.length; i += 3) {
      const v = [index[i], index[i + 1], index[i + 2]].map(k => [flat[k * 2], flat[k * 2 + 1], z] as [number, number, number]);
      // Counter-clockwise from above, so the face points up.
      const cross = (v[1][0] - v[0][0]) * (v[2][1] - v[0][1]) - (v[1][1] - v[0][1]) * (v[2][0] - v[0][0]);
      if (cross < 0) v.reverse();
      out.push({ p: [v[0], v[1], v[2]], uv: [[v[0][0] / 4, v[0][1] / 4], [v[1][0] / 4, v[1][1] / 4], [v[2][0] / 4, v[2][1] / 4]], part: LID_PART, n: [0, 0, 1] });
    }
  }
  return out;
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

  const CORNICE_STYLES = new Set<string>(['canal', 'c19', 'school']);
  type Quad = { accent: [number, number, number]; e: Edge; u0: number; u1: number; v1: number; layer: number; z0: number; z1: number; tint: [number, number, number, number]; along0: number; along1: number };
  const quadsByBuilding: Array<{ b: MeshBuilding; quads: Quad[]; walls: number; roof: RoofTri[] }> = [];
  let quadTotal = 0, wallTotal = 0, roofTotal = 0;
  const kxLocal = mPerDegLng(origin.lat);
  for (const { b, edges, top } of prepared) {
    const quads: Quad[] = [];
    const base = b.minHeightM;
    const [r, g, bl] = parseHex(b.wallHex);
    const variant = Math.floor(hash01(`${b.id}:look`) * CELL_VARIANTS);
    // No two neighbours share a rhythm: bay width, storey and ground-floor height vary per building.
    const scale = { bay: 0.88 + hash01(`${b.id}:bay`) * 0.3, storey: 0.93 + hash01(`${b.id}:storey`) * 0.16, ground: 0.92 + hash01(`${b.id}:ground`) * 0.2 };
    const accent = parseHex(b.accentHex ?? '#ffffff');
    const jitter = 0.9 + hash01(`${b.id}:tone`) * 0.2;
    let walls = 0;
    const cornice: RoofTri[] = [];
    for (const e of edges) {
      if (hiddenByNeighbour(e, b)) continue;
      const layout = layoutWall(b.style, e.len, top - base, hash01(`${b.id}:${edgeKey(e.x0, e.y0)}`), base < 0.5, scale);
      const shadeTint = (): [number, number, number, number] => [Math.min(255, r * jitter), Math.min(255, g * jitter), Math.min(255, bl * jitter), wallShade(e.nx, e.ny) * 255];
      if (b.lid && b.plainLayer !== undefined) {
        // With the top owned here, the strip above the pattern (and any wall too short for a layout) is bare wall.
        // The strip is solid wall colour, a shade darker like a cornice: the plain cell texture
        // squeezed into 0.45 m read as a pale line between wall and roof (user report "roof gaps").
        const z0 = layout ? top : base, u1 = Math.max(1, e.len / 5), t = shadeTint();
        const tint: [number, number, number, number] = layout ? [t[0] * 0.82, t[1] * 0.82, t[2] * 0.82, t[3]] : t;
        if (b.heightM > z0 + 0.01) quads.push({ e, u0: 0, u1, v1: 1, layer: layout ? b.lid.flatLayer : b.plainLayer, accent, z0, z1: b.heightM, tint, along0: 0, along1: 1 });
      }
      if (!layout) continue;
      walls++;
      if (b.plainWalls && b.plainLayer !== undefined) layout.doorBays.length = 0;
      // A projecting cornice under the flat lid: one sloped strip that catches the light and throws a shadow line.
      if (!b.roof && b.plainLayer !== undefined && CORNICE_STYLES.has(b.style) && e.len >= 3.5 && !e.hole) {
        const z = top - 0.05, out = 0.26, drop = 0.22, nx = e.nx * out, ny = e.ny * out;
        const A: [number, number, number] = [e.x0, e.y0, z], B: [number, number, number] = [e.x1, e.y1, z];
        const C: [number, number, number] = [e.x1 + nx, e.y1 + ny, z - drop], D: [number, number, number] = [e.x0 + nx, e.y0 + ny, z - drop];
        const n: [number, number, number] = [e.nx * drop, e.ny * drop, out], l = Math.hypot(...n);
        const nn: [number, number, number] = [n[0] / l, n[1] / l, n[2] / l], u1 = e.len / 5;
        cornice.push({ p: [A, D, C], uv: [[0, 0], [0, 0.1], [u1, 0.1]], part: 'plate', n: nn }, { p: [A, C, B], uv: [[0, 0], [u1, 0.1], [u1, 0]], part: 'plate', n: nn });
      }
      const shade = wallShade(e.nx, e.ny);
      const tint: [number, number, number, number] = [Math.min(255, r * jitter), Math.min(255, g * jitter), Math.min(255, bl * jitter), shade * 255];
      const groundTop = base + layout.groundM;
      for (const run of groundRuns(layout)) {
        quads.push({ e, u0: 0, u1: run.to - run.from, v1: 1, layer: b.plainWalls && b.plainLayer !== undefined ? b.plainLayer : b.layers ? (run.door ? b.layers.door : b.layers.ground) : cellLayer(b.style, run.door ? 'door' : b.shop ? 'shop' : 'ground', variant), accent, z0: base, z1: groundTop, tint, along0: run.from / layout.bays, along1: run.to / layout.bays });
      }
      if (layout.storeys > 0) quads.push({ e, u0: 0, u1: layout.bays, v1: layout.storeys, layer: b.plainWalls && b.plainLayer !== undefined ? b.plainLayer : b.layers ? b.layers.upper : cellLayer(b.style, 'upper', variant), accent, z0: groundTop, z1: top, tint, along0: 0, along1: 1 });
    }
    let roof: RoofTri[] = cornice;
    if (b.roof) {
      const outer = b.polygons[0]?.[0] ?? [];
      const rect = fitRect(outer.map(([lng, lat]) => [(lng - origin.lng) * kxLocal, (lat - origin.lat) * M_PER_DEG_LAT] as [number, number]));
      if (rect) roof = roofTriangles(rect, b.roof.plan, b.heightM, b.roof.dims);
      if (!rect) roof = [];
    }
    if (b.lid && (!b.roof || !roof.length)) roof = [...roof, ...lidTriangles(b, origin)];
    quadsByBuilding.push({ b, quads, walls, roof });
    quadTotal += quads.length; wallTotal += walls; roofTotal += roof.length;
  }

  const vertexCount = quadTotal * 4 + roofTotal * 3;
  const positions = new Float32Array(vertexCount * 3), uvs = new Float32Array(vertexCount * 2);
  const layers = new Uint8Array(vertexCount), tints = new Uint8Array(vertexCount * 4), accents = new Uint8Array(vertexCount * 4);
  const indices = new Uint32Array(quadTotal * 6 + roofTotal * 3);
  const ranges: VertexRange[] = [];
  let v = 0, q = 0, ti = quadTotal * 6;
  for (const { b, quads, roof } of quadsByBuilding) {
    if (!quads.length && !roof.length) continue;
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
        tints[v * 4] = quad.tint[0]; tints[v * 4 + 1] = quad.tint[1]; tints[v * 4 + 2] = quad.tint[2]; tints[v * 4 + 3] = quad.tint[3];
        accents[v * 4] = quad.accent[0]; accents[v * 4 + 1] = quad.accent[1]; accents[v * 4 + 2] = quad.accent[2]; accents[v * 4 + 3] = 255;
        v++;
      }
      const i = v - 4;
      indices.set([i, i + 1, i + 2, i, i + 2, i + 3], q * 6);
      q++;
    }
    if (roof.length) {
      const [wr, wg, wb] = parseHex(b.wallHex), [rr, rg, rb] = parseHex(b.roof?.roofHex ?? b.wallHex);
      const jitter = 0.9 + hash01(`${b.id}:tone`) * 0.2, white: [number, number, number] = [255, 255, 255];
      for (const t of roof) {
        const shade = Math.max(0.5, Math.min(1, 0.58 + 0.42 * Math.max(0, t.n[0] * -0.35 + t.n[1] * 0.5 + t.n[2] * 0.8)));
        const wall = t.part === 'plate' || t.part === 'dormerFace', lid = t.part === LID_PART;
        const layer = lid ? b.lid!.flatLayer : t.part === 'plate' ? (b.plainLayer ?? b.roof!.layers.plain) : t.part === 'dormerFace' ? b.roof!.layers.dormer : b.roof!.layers.slope;
        const tint = lid ? parseHex(b.lid!.hex) : wall ? [wr * jitter, wg * jitter, wb * jitter] : [rr, rg, rb];
        for (let k = 0; k < 3; k++) {
          positions[v * 3] = t.p[k][0]; positions[v * 3 + 1] = t.p[k][1]; positions[v * 3 + 2] = t.p[k][2];
          uvs[v * 2] = t.uv[k][0]; uvs[v * 2 + 1] = t.uv[k][1];
          layers[v] = layer;
          tints[v * 4] = Math.min(255, tint[0]); tints[v * 4 + 1] = Math.min(255, tint[1]); tints[v * 4 + 2] = Math.min(255, tint[2]); tints[v * 4 + 3] = shade * 255;
          const acc = b.accentHex ? parseHex(b.accentHex) : white;
          accents[v * 4] = acc[0]; accents[v * 4 + 1] = acc[1]; accents[v * 4 + 2] = acc[2]; accents[v * 4 + 3] = 255;
          indices[ti++] = v; v++;
        }
      }
    }
    ranges.push({ id: b.id, start, count: v - start });
  }
  return { positions, uvs, layers, tints, accents, indices, ranges, vertexCount, quadCount: quadTotal + Math.ceil(roofTotal / 2), wallCount: wallTotal, buildingCount: ranges.length };
}

/**
 * A chunk for landmark kits: pre-built triangles per part, with the layer chosen
 * by material kind (bare wall, flat colour, roof tiles) and the colour per
 * triangle. One range per part id, so a part can be hidden with the answer.
 */
export function buildKitChunk(parts: readonly KitPartGeometry[], layers: { plain: number; flat: number; slope: number }): Chunk {
  let tris = 0;
  for (const part of parts) tris += part.tris.length;
  const vertexCount = tris * 3;
  const positions = new Float32Array(vertexCount * 3), uvs = new Float32Array(vertexCount * 2);
  const layerArr = new Uint8Array(vertexCount), tints = new Uint8Array(vertexCount * 4), accents = new Uint8Array(vertexCount * 4).fill(255);
  const indices = new Uint32Array(vertexCount);
  const ranges: VertexRange[] = [];
  let v = 0;
  for (const part of parts) {
    if (!part.tris.length) continue;
    const start = v;
    for (const t of part.tris) {
      const [r, g, b] = parseHex(t.hex);
      const shade = Math.max(0.5, Math.min(1, 0.58 + 0.42 * Math.max(0, t.n[0] * -0.35 + t.n[1] * 0.5 + t.n[2] * 0.8)));
      for (let k = 0; k < 3; k++) {
        positions[v * 3] = t.p[k][0]; positions[v * 3 + 1] = t.p[k][1]; positions[v * 3 + 2] = t.p[k][2];
        uvs[v * 2] = t.uv[k][0]; uvs[v * 2 + 1] = t.uv[k][1];
        layerArr[v] = layers[t.layer];
        tints[v * 4] = r; tints[v * 4 + 1] = g; tints[v * 4 + 2] = b; tints[v * 4 + 3] = shade * 255;
        indices[v] = v; v++;
      }
    }
    ranges.push({ id: part.id, start, count: v - start });
  }
  return { positions, uvs, layers: layerArr, tints, accents, indices, ranges, vertexCount, quadCount: Math.ceil(tris / 2), wallCount: 0, buildingCount: ranges.length };
}
