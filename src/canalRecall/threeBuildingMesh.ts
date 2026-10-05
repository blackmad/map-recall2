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

import { recipeBayOpenings, type Openings } from './facadeOpenings.js';
import { streetWallBuilding, frontageLayoutScale, type StreetFacadeContext } from './streetFacadeRendering.js';
import type { ArchitecturalRecipe } from './streetAppearance.js';
import { streetCrown, type StreetCrownFront, type StreetCrownTri } from './streetCrown.js';
import { CELL_VARIANTS, cellLayer } from './facadeCells.js';
import { edgeGroundPieces, edgeLayout, layoutRun } from './facadeLayout.js';
import { FALLBACK_REACH_M, SegmentGrid, streetDistance } from './streetFronts.js';
import { FACADE_CORNICE_M, type FacadeStyle } from './genericFacades.js';
import type { KitPartGeometry } from './landmarkKits.js';
import type { ChainLook } from './shopfronts.js';
import { wordRuns } from './blockLetters.js';
import earcut from 'earcut';
import { ExtraSink, EXTRA_BUDGET, roofExtras, buildingWallExtras, type ExtraContext } from './facadeExtras.js';
import { fitRect, roofTrianglesForOutline, type RoofDims, type RoofPlan, type RoofTri } from './roofMesh.js';

export type MeshBuilding = {
  streetAppearance?: StreetFacadeContext;
  recipe?: ArchitecturalRecipe;
  /** Exact opening positions of the active texture, shared with 3D entrance details. */
  openings?: Openings;
  id: string;
  /** Rings of [lng, lat]; outer first, holes after. One polygon per entry. */
  polygons: number[][][][];
  heightM: number;
  minHeightM: number;
  style: FacadeStyle;
  /** The building's real period when the look lays it out as another style (facadeExtras: 19th-century dressing on a bay-look canal layout). */
  period?: FacadeStyle;
  wallHex: string;
  /** A bay look's own layers and accent colour; absent means the procedural cells. */
  layers?: { upper: number; ground: number; door: number };
  accentHex?: string;
  /** Paint of a shop's ground floor (bay looks): tints the shop bays' painted surface instead of the wall colour. */
  groundHex?: string;
  /** A shopfront on the street-level bays (procedural cells; the bay looks choose their own layer). */
  shop?: boolean;
  /** The ground floor is a shopfront (either look): it takes the whole frontage, no house door beside it. */
  shopfront?: boolean;
  /**
   * A signature storefront for a business the map labels: a projecting blade sign and a 3D
   * awning in the business's colour, on the wall nearest its OSM point ([lng, lat]).
   */
  signature?: { at: [number, number]; hex: string };
  /** A supermarket chain's own shopfront (fascia, logo panel, brand word) at its OSM point; replaces the signature. */
  chain?: { at: [number, number]; look: ChainLook };
  /** Draw the facade extras (hoist beams, stoops, balconies, bikes, roof terraces): facadeExtras.ts. */
  extras?: boolean;
  /** Texture layer for bare wall: gable faces, chimneys, cornices. */
  plainLayer?: number;
  /** Bare walls only (a church): every row uses the plain layer and there are no doors. */
  plainWalls?: boolean;
  /** No facade at all (a shed, a landmark part, a building with no style): one plain quad per wall. */
  bare?: boolean;
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

type LidMesh = { xy: number[]; index: number[] };
/** An upward face's shade under the fixed light (matches the roof shading formula for n = up). */
const LID_SHADE = 0.58 + 0.42 * 0.8;

/** A flat lid over every polygon (courtyards kept open) at the wall top, as shared vertices plus earcut indices facing up. */
function lidMesh(b: MeshBuilding, origin: Origin): LidMesh | null {
  const kx = mPerDegLng(origin.lat), xy: number[] = [], index: number[] = [];
  for (const polygon of b.polygons) {
    const flat: number[] = [], holes: number[] = [];
    for (const [i, ring] of polygon.entries()) {
      const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
      if (pts.length < 3) { if (i === 0) break; continue; }
      if (i > 0) holes.push(flat.length / 2);
      for (const [lng, lat] of pts) flat.push((lng - origin.lng) * kx, (lat - origin.lat) * M_PER_DEG_LAT);
    }
    if (flat.length < 6) continue;
    const offset = xy.length / 2, tri = earcut(flat, holes.length ? holes : undefined, 2);
    for (let i = 0; i < tri.length; i += 3) {
      const [a, c, d] = [tri[i], tri[i + 1], tri[i + 2]];
      const cross = (flat[c * 2] - flat[a * 2]) * (flat[d * 2 + 1] - flat[a * 2 + 1]) - (flat[c * 2 + 1] - flat[a * 2 + 1]) * (flat[d * 2] - flat[a * 2]);
      // Counter-clockwise from above, so the face points up.
      if (cross >= 0) index.push(offset + a, offset + c, offset + d); else index.push(offset + a, offset + d, offset + c);
    }
    xy.push(...flat);
  }
  return index.length ? { xy, index } : null;
}

/** `lit`: lit signage (a chain's fascia and lettering), barely dimmed on a wall facing away from the sun. */
type SignTri = { p: [number, number, number][]; hex: string; n: [number, number, number]; lit?: boolean };

/** One flat quad (corners in order) as two triangles wound to face `n`. */
function faceTris(q: [number, number, number][], n: [number, number, number], hex: string, out: SignTri[]) {
  const [A, B, C, D] = q, cr = (u: number[], w: number[]) => [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  const c = cr([B[0] - A[0], B[1] - A[1], B[2] - A[2]], [C[0] - A[0], C[1] - A[1], C[2] - A[2]]);
  const flip = c[0] * n[0] + c[1] * n[1] + c[2] * n[2] < 0;
  out.push({ p: flip ? [A, C, B] : [A, B, C], hex, n }, { p: flip ? [A, D, C] : [A, C, D], hex, n });
}

/** Box faces (no bottom unless asked) with outward normals; frame: x along the wall, y outward, z up. */
function boxTris(e: { x0: number; y0: number; ux: number; uy: number; nx: number; ny: number }, a0: number, a1: number, o0: number, o1: number, z0: number, z1: number, hex: string, out: SignTri[], bottom = false) {
  const P = (a: number, o: number, z: number): [number, number, number] => [e.x0 + e.ux * a + e.nx * o, e.y0 + e.uy * a + e.ny * o, z];
  const face = (q: [number, number, number][], n: [number, number, number]) => faceTris(q, n, hex, out);
  const N = (a: number, o: number, z: number): [number, number, number] => [e.ux * a + e.nx * o, e.uy * a + e.ny * o, z];
  face([P(a0, o1, z0), P(a1, o1, z0), P(a1, o1, z1), P(a0, o1, z1)], N(0, 1, 0));
  face([P(a0, o0, z0), P(a1, o0, z0), P(a1, o0, z1), P(a0, o0, z1)], N(0, -1, 0));
  face([P(a0, o0, z0), P(a0, o1, z0), P(a0, o1, z1), P(a0, o0, z1)], N(-1, 0, 0));
  face([P(a1, o0, z0), P(a1, o1, z0), P(a1, o1, z1), P(a1, o0, z1)], N(1, 0, 0));
  face([P(a0, o0, z1), P(a1, o0, z1), P(a1, o1, z1), P(a0, o1, z1)], [0, 0, 1]);
  if (bottom) face([P(a0, o0, z0), P(a1, o0, z0), P(a1, o1, z0), P(a0, o1, z0)], [0, 0, -1]);
}

/**
 * A signature storefront on the wall nearest the business's point: an awning slab over the
 * ground floor across the frontage, and a blade sign sticking out from the wall above it,
 * both in the business's colour (the sign framed in dark iron), so the label on the map and
 * the building on the street match.
 */
function signatureTris(sig: { at: [number, number]; hex: string }, edges: readonly Edge[], base: number, origin: Origin): SignTri[] {
  const kx = mPerDegLng(origin.lat), px = (sig.at[0] - origin.lng) * kx, py = (sig.at[1] - origin.lat) * M_PER_DEG_LAT;
  let best: Edge | null = null, bestD = Infinity;
  for (const e of edges) {
    if (e.hole || e.len < 2.5) continue;
    const dx = e.x1 - e.x0, dy = e.y1 - e.y0, t = Math.max(0, Math.min(1, ((px - e.x0) * dx + (py - e.y0) * dy) / (e.len * e.len)));
    const d = Math.hypot(px - e.x0 - dx * t, py - e.y0 - dy * t);
    if (d < bestD) { bestD = d; best = e; }
  }
  if (!best) return [];
  const e = { x0: best.x0, y0: best.y0, ux: (best.x1 - best.x0) / best.len, uy: (best.y1 - best.y0) / best.len, nx: best.nx, ny: best.ny };
  const out: SignTri[] = [], L = best.len, z = base;
  // Awning: the frontage less 0.4 m each side, 0.9 m deep, a thin band at 3.0-3.2 m. A 1.2 m deep,
  // 0.45 m thick slab read as a heavy black box on dark brands (user 2026-10-03).
  boxTris(e, 0.4, L - 0.4, 0.05, 0.95, z + 3.0, z + 3.2, sig.hex, out, true);
  // Blade sign near the end of the frontage closest to the point: iron bracket and a 0.9 m board.
  const along = Math.max(0.6, Math.min(L - 0.6, (px - e.x0) * e.ux + (py - e.y0) * e.uy));
  const at = along < L / 2 ? 0.6 : L - 0.6;
  boxTris(e, at - 0.04, at + 0.04, 0.05, 1.2, z + 4.3, z + 4.38, '#2a2a2a', out, true);
  boxTris(e, at - 0.07, at + 0.07, 0.25, 1.15, z + 3.45, z + 4.3, sig.hex, out, true);
  return out;
}

/**
 * A supermarket chain's shopfront on the street wall nearest its OSM point: a fascia board in
 * the chain's colour across the frontage (at most 24 m of a long block) just under the first
 * floor, a square logo panel with its inner mark at the end nearest the entrance point, and the
 * brand word in blocky capitals on the board. Walls run CCW with the outward normal on the
 * right of travel, so increasing distance along the wall reads left to right from the street.
 */
export function chainFrontTris(chain: NonNullable<MeshBuilding['chain']>, candidates: readonly Edge[], base: number, groundM: number, origin: Origin): SignTri[] {
  const kx = mPerDegLng(origin.lat), px = (chain.at[0] - origin.lng) * kx, py = (chain.at[1] - origin.lat) * M_PER_DEG_LAT;
  let best: Edge | null = null, bestD = Infinity;
  for (const e of candidates) {
    if (e.hole || e.len < 2.5) continue;
    const dx = e.x1 - e.x0, dy = e.y1 - e.y0, t = Math.max(0, Math.min(1, ((px - e.x0) * dx + (py - e.y0) * dy) / (e.len * e.len)));
    const d = Math.hypot(px - e.x0 - dx * t, py - e.y0 - dy * t);
    if (d < bestD) { bestD = d; best = e; }
  }
  if (!best) return [];
  const e = { x0: best.x0, y0: best.y0, ux: (best.x1 - best.x0) / best.len, uy: (best.y1 - best.y0) / best.len, nx: best.nx, ny: best.ny };
  const L = best.len, look = chain.look, out: SignTri[] = [];
  const along = Math.max(0, Math.min(L, (px - e.x0) * e.ux + (py - e.y0) * e.uy));
  const half = Math.min((L - 0.6) / 2, 12), s0 = Math.max(0.3, Math.min(L - 0.3 - 2 * half, along - half)), s1 = s0 + 2 * half;
  const top = base + Math.max(2.6, groundM) - 0.05, bottom = top - 0.7;
  boxTris(e, s0, s1, 0.02, 0.2, bottom, top, look.fascia, out, true);
  // Logo panel at the end of the board nearer the entrance, standing proud of it.
  const logoW = Math.min(1.0, (s1 - s0) * 0.3), atStart = along - s0 < s1 - along;
  const l0 = atStart ? s0 + 0.15 : s1 - 0.15 - logoW, l1 = l0 + logoW;
  const lc = (l0 + l1) / 2, zc = top - 0.35, m = logoW * 0.27;
  boxTris(e, l0, l1, 0.2, 0.3, zc - logoW / 2, zc + logoW / 2, look.logo, out, true);
  boxTris(e, lc - m, lc + m, 0.3, 0.32, zc - m, zc + m, look.mark, out);
  // The brand word, centred on the rest of the board, as flat quads just in front of it.
  const free0 = atStart ? l1 + 0.2 : s0 + 0.2, free1 = atStart ? s1 - 0.2 : l0 - 0.2;
  const { runs, width } = wordRuns(look.word);
  const cell = Math.min(0.065, (free1 - free0) / Math.max(1, width));
  if (cell >= 0.035 && runs.length) {
    const w0 = (free0 + free1) / 2 - (width * cell) / 2, zMid = (top + bottom) / 2, o = 0.205;
    const n: [number, number, number] = [e.nx, e.ny, 0];
    const P = (a: number, z: number): [number, number, number] => [e.x0 + e.ux * a + e.nx * o, e.y0 + e.uy * a + e.ny * o, z];
    for (const r of runs) {
      const a0 = w0 + r.c0 * cell, a1 = w0 + r.c1 * cell, z1 = zMid + (3.5 - r.row) * cell, z0 = z1 - cell;
      faceTris([P(a0, z0), P(a1, z0), P(a1, z1), P(a0, z1)], n, look.letters, out);
    }
  }
  for (const t of out) t.lit = true;
  return out;
}

const edgeKey = (x: number, y: number) => `${Math.round(x * 10)},${Math.round(y * 10)}`;

/** Edges whose directions differ by less than this read as one wall (a curve or a slight kink). */
export const RUN_TURN_DEG = 25;
const COS_RUN = Math.cos(RUN_TURN_DEG * Math.PI / 180);

/**
 * A ring's visible walls grouped into runs: consecutive exposed edges that meet end to end
 * and turn by less than RUN_TURN_DEG, laid out as one facade. A hidden (party) wall or a
 * real corner ends a run.
 */
export function wallRuns(rings: readonly (readonly Edge[])[], hidden: (e: Edge) => boolean): Array<Array<{ e: Edge }>> {
  const runs: Array<Array<{ e: Edge }>> = [];
  for (const ring of rings) {
    const n = ring.length;
    if (!n) continue;
    const joins = (a: Edge, b: Edge) => !hidden(a) && !hidden(b) && Math.hypot(a.x1 - b.x0, a.y1 - b.y0) < 0.05
      && ((a.x1 - a.x0) * (b.x1 - b.x0) + (a.y1 - a.y0) * (b.y1 - b.y0)) / (a.len * b.len) >= COS_RUN;
    // Start at an edge that does not join its predecessor, so no run wraps round the ring's start.
    // A ring that joins all the way round (a round building) is one run from edge 0.
    const start = Math.max(0, ring.findIndex((e, i) => !joins(ring[(i - 1 + n) % n], e)));
    let run: Array<{ e: Edge }> = [];
    for (let k = 0; k < n; k++) {
      const e = ring[(start + k) % n];
      if (hidden(e)) { if (run.length) runs.push(run); run = []; continue; }
      if (run.length && !joins(run[run.length - 1].e, e)) { runs.push(run); run = []; }
      run.push({ e });
    }
    if (run.length) runs.push(run);
  }
  return runs;
}

/**
 * Build one chunk. Walls shared exactly with a taller-or-equal neighbour in
 * the same chunk (party walls between terraced houses, the bulk of a canal
 * belt's edges) are skipped: nobody sees them, and they are about half the
 * vertices of a naive mesh.
 */
/**
 * `mode: 'extras'` builds only the facade extras (facadeExtras.ts) of these buildings: they are a
 * separate, near-camera chunk, too many triangles to draw across the whole resident city.
 */
export function buildChunk(buildings: readonly MeshBuilding[], origin: Origin, mode: 'walls' | 'extras' = 'walls', streets?: Float32Array): Chunk {
  type Prepared = { b: MeshBuilding; edges: Edge[]; top: number };
  const prepared: Prepared[] = [];
  const rings: Edge[][][] = [];
  const shared = new Map<string, { top: number; base: number }[]>();
  for (const b of buildings) {
    // A lidded building owns its top, so its facade rows run to the full height (no band to leave room for).
    const top = b.lid ? b.heightM : facadeTopM(b.heightM);
    const own: Edge[][] = [];
    for (const polygon of b.polygons) polygon.forEach((ring, i) => own.push(ringEdges(ring, origin, i > 0)));
    const edges = own.flat();
    rings.push(own);
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

  // Street side: with the streets near this chunk, a door goes only on a wall that sees a street
  // before it sees another building (streetFronts.ts). Without them, any outer wall may carry one.
  const streetGrid = streets && streets.length ? new SegmentGrid(streets) : null;
  let wallGrid: SegmentGrid | null = null;
  if (streetGrid) {
    const segs: number[] = [], owners: number[] = [];
    prepared.forEach(({ edges }, i) => { for (const e of edges) { segs.push(e.x0, e.y0, e.x1, e.y1); owners.push(i); } });
    wallGrid = new SegmentGrid(segs, 25, owners);
  }
  const doorWalls = (bi: number): Set<Edge> => {
    const { b, edges } = prepared[bi];
    const outer = edges.filter(e => !e.hole && e.len >= 2.4 && !hiddenByNeighbour(e, b));
    if (!streetGrid) return new Set(outer);
    const facing = new Set(outer.filter(e => streetDistance(e, streetGrid, wallGrid, bi) < Infinity));
    if (facing.size || !outer.length) return facing;
    // Set back from every street (an inner-block house): one door, on the wall nearest a street.
    let best: Edge | null = null, bestD = Infinity;
    for (const e of outer) { const d = streetDistance(e, streetGrid, null, bi, FALLBACK_REACH_M); if (d < bestD) { bestD = d; best = e; } }
    return new Set(best ? [best] : []);
  };

  const CORNICE_STYLES = new Set<string>(['canal', 'c19', 'school']);
  type Quad = { accent: [number, number, number]; e: Edge; u0: number; u1: number; v1: number; layer: number; z0: number; z1: number; tint: [number, number, number, number]; along0: number; along1: number };
  const quadsByBuilding: Array<{ b: MeshBuilding; quads: Quad[]; walls: number; roof: StreetCrownTri[]; lid: LidMesh | null; sign: SignTri[] }> = [];
  let signTotal = 0;
  let quadTotal = 0, wallTotal = 0, roofTotal = 0, lidVerts = 0, lidIndices = 0;
  const kxLocal = mPerDegLng(origin.lat);
  for (const [bi, { b, edges, top }] of prepared.entries()) {
    const quads: Quad[] = [];
    const base = b.minHeightM;
    const wallRGB = parseHex(b.wallHex), wallAccent = parseHex(b.accentHex ?? '#ffffff');
    const groundPaint = b.groundHex && b.layers ? parseHex(b.groundHex) : null;
    const variant = Math.floor(hash01(`${b.id}:look`) * CELL_VARIANTS);
    // No two neighbours share a rhythm: bay width, storey and ground-floor height vary per building.
    const scale = { bay: 0.88 + hash01(`${b.id}:bay`) * 0.3, storey: 0.93 + hash01(`${b.id}:storey`) * 0.16, ground: 0.92 + hash01(`${b.id}:ground`) * 0.2 };
    const jitter = 0.9 + hash01(`${b.id}:tone`) * 0.2;
    let walls = 0;
    const extraSink = mode === 'extras' && b.extras ? new ExtraSink(EXTRA_BUDGET.building) : null;
    const wallExtraContexts: ExtraContext[] = [];
    const cornice: RoofTri[] = [];
    const doorAllowed = doorWalls(bi);
    let groundSeen = Infinity;
    const streetEdges = [...doorAllowed];
    const streetCorner = !!streetGrid && streetEdges.some((a, i) => streetEdges.slice(i + 1).some(c => a.nx * c.nx + a.ny * c.ny < .5));
    const fallbackBuilding = b.streetAppearance ? { ...b, streetAppearance: { ...b.streetAppearance, streetCorner } } : b;
    const crownFronts: StreetCrownFront[] = [];
    for (const run of wallRuns(rings[bi], e => hiddenByNeighbour(e, fallbackBuilding))) {
      const first = run[0].e;
      const b = fallbackBuilding.streetAppearance ? streetWallBuilding(fallbackBuilding, {
        ...first, x1: run[run.length - 1].e.x1, y1: run[run.length - 1].e.y1,
      }, origin, run.some(({ e }) => doorAllowed.has(e))) : fallbackBuilding;
      const runScale = frontageLayoutScale(b.recipe, scale, b.style, run.reduce((sum,r)=>sum+r.e.len,0));
      const [r, g, bl] = b === fallbackBuilding ? wallRGB : parseHex(b.wallHex);
      const accent = b === fallbackBuilding ? wallAccent : parseHex(b.accentHex ?? '#ffffff');
      if (b.recipe) crownFronts.push({ start:[first.x0,first.y0],end:[run[run.length-1].e.x1,run[run.length-1].e.y1],normal:[first.nx,first.ny],tint:[r*jitter,g*jitter,bl*jitter],plainLayer:b.plainLayer,recipe:b.recipe,frameHex:b.recipe.frameHex??'#e6e1d4',glassHex:b.streetAppearance?.look==='cartoon'?'#68a2bf':'#35464f' });
      const paintTint = b === fallbackBuilding ? groundPaint : b.groundHex && b.layers ? parseHex(b.groundHex) : null;
      const layout = b.bare ? null : layoutRun(b.style, run.map(r => r.e.len), top - base, hash01(`${b.id}:${edgeKey(first.x0, first.y0)}`), base < 0.5, runScale, run.map(r => doorAllowed.has(r.e)));
      if(layout&&b.recipe?.facadeAssembly==='stacked-open-balcony'&&base<.5){
        const center=(layout.bays-1)/2;
        const eligible=Array.from({length:layout.bays},(_,i)=>i).filter(i=>{
          const x=(i+.5)*layout.bayWidthM;
          return run.some((r,k)=>doorAllowed.has(r.e)&&x>=layout.edgeStartM[k]&&x<=layout.edgeStartM[k]+r.e.len);
        });
        // The same street-facing access module owns its door and vertical balcony stack.
        layout.doorBays=eligible.length?[eligible.reduce((a,c)=>Math.abs(c-center)<Math.abs(a-center)?c:a)]:[];
      }
      if (!layout) {
        // With the top owned here, a wall too short for a layout (a corner chamfer) is still walled, in bare wall.
        if (b.lid && b.plainLayer !== undefined && b.heightM > base + 0.01) for (const { e } of run) {
          quads.push({ e, u0: 0, u1: Math.max(1, e.len / 5), v1: 1, layer: b.plainLayer, accent, z0: base, z1: b.heightM, tint: [Math.min(255, r * jitter), Math.min(255, g * jitter), Math.min(255, bl * jitter), wallShade(e.nx, e.ny) * 255], along0: 0, along1: 1 });
        }
        continue;
      }
      // Doors first, so the stoops and pediments the extras hang on a door follow them.
      if (b.plainWalls && b.plainLayer !== undefined) layout.doorBays.length = 0;
      // A shop fills its ground floor; only a wide front keeps a separate door to the floors above.
      if (b.shopfront && layout.bays < 3) layout.doorBays.length = 0;
      const bw = layout.bayWidthM, groundTop = base + layout.groundM;
      groundSeen = Math.min(groundSeen, layout.groundM);
      // Polygon vertices do not create additional observed stacks: one eligible facet owns
      // each continuous facade. Keep relief contained on that facet, without seam matching.
      const assemblyOwnerEdge = extraSink && b.recipe?.facadeAssembly ? run.reduce((best, { e }, k) =>
        !e.hole && e.len >= 2.5 && doorAllowed.has(e) && (best < 0 || e.len > run[best].e.len + 1e-6) ? k : best, -1) : -1;
      run.forEach(({ e }, k) => {
        walls++;
        const s = layout.edgeStartM[k];
        if (extraSink && !b.plainWalls && !e.hole && (b.recipe?.openingGroup ? k === 0 && layout.lengthM >= 2.5 : e.len >= 2.5)) wallExtraContexts.push({ id: b.id, style: b.style, wallKey: edgeKey(e.x0, e.y0), f: { x0: e.x0, y0: e.y0, ux: (e.x1 - e.x0) / e.len, uy: (e.y1 - e.y0) / e.len, nx: e.nx, ny: e.ny, len: b.recipe?.openingGroup ? layout.lengthM : e.len }, base, top, layout: b.recipe?.openingGroup ? layout : edgeLayout(layout, k, e.len), wallHex: b.wallHex, accentHex: b.accentHex ?? '#ffffff', groundLevel: base < 0.5, period: b.period, recipe: b.recipe, runStart: k === 0, runEnd: k === run.length - 1, assemblyOwner: b.recipe?.facadeAssembly ? k === assemblyOwnerEdge : undefined, openings: b.recipe ? recipeBayOpenings(b.id, b.recipe, b.streetAppearance?.look === 'procedural' ? 'photo' : b.streetAppearance?.look ?? 'photo') : b.openings, streetSide: b.recipe?.openingGroup ? run.some(r=>doorAllowed.has(r.e)) : doorAllowed.has(e), shopfront: !!(b.shopfront || b.shop), roofKind: b.roof ? b.roof.plan.kind : 'flat' });
        // A projecting cornice under the flat lid: one sloped strip that catches the light and throws a shadow line.
        if (!b.roof && b.plainLayer !== undefined && CORNICE_STYLES.has(b.style) && e.len >= 3.5 && !e.hole) {
          const z = top - 0.05, out = 0.26, drop = 0.22, nx = e.nx * out, ny = e.ny * out;
          const A: [number, number, number] = [e.x0, e.y0, z], B: [number, number, number] = [e.x1, e.y1, z];
          const C: [number, number, number] = [e.x1 + nx, e.y1 + ny, z - drop], D: [number, number, number] = [e.x0 + nx, e.y0 + ny, z - drop];
          const n: [number, number, number] = [e.nx * drop, e.ny * drop, out], l = Math.hypot(...n);
          const nn: [number, number, number] = [n[0] / l, n[1] / l, n[2] / l], u1 = e.len / 5;
          cornice.push({ p: [A, D, C], uv: [[0, 0], [0, 0.1], [u1, 0.1]], part: 'plate', n: nn }, { p: [A, C, B], uv: [[0, 0], [u1, 0.1], [u1, 0]], part: 'plate', n: nn });
        }
        const tint: [number, number, number, number] = [Math.min(255, r * jitter), Math.min(255, g * jitter), Math.min(255, bl * jitter), wallShade(e.nx, e.ny) * 255];
        const paint = paintTint ? [paintTint[0], paintTint[1], paintTint[2], tint[3]] as [number, number, number, number] : tint;
        // u counts bays along the whole run, so the bay grid carries on round a kink.
        for (const piece of edgeGroundPieces(layout, k, e.len)) {
          quads.push({ e, u0: piece.a0 / bw, u1: piece.a1 / bw, v1: 1, tint: (piece.door && !b.recipe?.groundWallHex) || b.plainWalls ? tint : paint, layer: b.plainWalls && b.plainLayer !== undefined ? b.plainLayer : b.layers ? (piece.door ? b.layers.door : b.layers.ground) : cellLayer(b.style, piece.door ? 'door' : b.shop ? 'shop' : 'ground', variant), accent, z0: base, z1: groundTop, along0: (piece.a0 - s) / e.len, along1: (piece.a1 - s) / e.len });
        }
        if (layout.storeys > 0) quads.push({ e, u0: s / bw, u1: (s + e.len) / bw, v1: layout.storeys, layer: b.plainWalls && b.plainLayer !== undefined ? b.plainLayer : b.layers ? b.layers.upper : cellLayer(b.style, 'upper', variant), accent, z0: groundTop, z1: top, tint, along0: 0, along1: 1 });
      });
    }
    let roof: StreetCrownTri[] = cornice;
    if (b.roof) {
      roof = roofTrianglesForOutline(b.polygons[0]?.[0] ?? [], origin, b.roof.plan, b.heightM, b.roof.dims, kxLocal);
      if (crownFronts.length) roof = streetCrown(roof,crownFronts,b.heightM,['gable','pitched','halfHipped'].includes(b.roof.plan.kind)&&!b.roof.plan.shutters);
    }
    const walled = mode === 'walls';
    const lid = walled && b.lid && (!b.roof || !roof.length || b.roof.plan.keepLid) ? lidMesh(b, origin) : null;
    // Walls mode carries the signature storefront; extras mode only the extras.
    const sign: SignTri[] = walled && b.signature && b.lid ? signatureTris(b.signature, edges, b.minHeightM, origin) : [];
    // A chain supermarket's fascia goes on a street wall (else any exposed wall) nearest its point.
    if (walled && b.chain && b.lid) {
      const exposed = edges.filter(e => !e.hole && !hiddenByNeighbour(e, b));
      const street = exposed.filter(e => doorAllowed.has(e));
      sign.push(...chainFrontTris(b.chain, street.length ? street : exposed.length ? exposed : edges, b.minHeightM, groundSeen < Infinity ? groundSeen : 3.2, origin));
    }
    if (extraSink) {
      buildingWallExtras(wallExtraContexts, extraSink);
      // Roof extras on a flat roof only (a pitched roof has its own chimneys and dormers).
      if (!b.roof || b.roof.plan.kind === 'parapet') {
        const outer = b.polygons[0]?.[0] ?? [];
        const rect = fitRect(outer.map(([lng, lat]) => [(lng - origin.lng) * kxLocal, (lat - origin.lat) * M_PER_DEG_LAT] as [number, number]), 40);
        if (rect && rect.coverage > 0.75 && rect.len > 4 && rect.wid > 4) roofExtras({ id: b.id, style: b.style, rect, z: b.heightM, wallHex: b.wallHex }, extraSink);
      }
      sign.push(...extraSink.tris);
    }
    if (!walled) { quads.length = 0; roof = []; }
    signTotal += sign.length;
    quadsByBuilding.push({ b, quads, walls, roof, lid, sign });
    quadTotal += quads.length; wallTotal += walls; roofTotal += roof.length;
    if (lid) { lidVerts += lid.xy.length / 2; lidIndices += lid.index.length; }
  }

  const vertexCount = quadTotal * 4 + roofTotal * 3 + lidVerts + signTotal * 3;
  const positions = new Float32Array(vertexCount * 3), uvs = new Float32Array(vertexCount * 2);
  const layers = new Uint8Array(vertexCount), tints = new Uint8Array(vertexCount * 4), accents = new Uint8Array(vertexCount * 4);
  const indices = new Uint32Array(quadTotal * 6 + roofTotal * 3 + lidIndices + signTotal * 3);
  const ranges: VertexRange[] = [];
  let v = 0, q = 0, ti = quadTotal * 6;
  for (const { b, quads, roof, lid, sign } of quadsByBuilding) {
    if (!quads.length && !roof.length && !lid && !sign.length) continue;
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
      const defaultWallTint = [wr*jitter,wg*jitter,wb*jitter];
      for (const t of roof) {
        const shade = Math.max(0.5, Math.min(1, 0.58 + 0.42 * Math.max(0, t.n[0] * -0.35 + t.n[1] * 0.5 + t.n[2] * 0.8)));
        const wall = t.part === 'plate' || t.part === 'dormerFace', flat = t.part === 'trim' || t.part === 'decal';
        // Trim and decals (white stone, cornices, shutters) are flat colour on the lid's flat layer.
        const layer = flat ? (b.lid?.flatLayer ?? b.roof!.layers.slope) : t.part === 'plate' ? (t.facadeLayer ?? b.plainLayer ?? b.roof!.layers.plain) : t.part === 'dormerFace' ? b.roof!.layers.dormer : b.roof!.layers.slope;
        const tint = t.hex ? parseHex(t.hex) : flat ? white : wall ? t.facadeTint ?? defaultWallTint : [rr, rg, rb];
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
    if (lid) {
      // Indexed: earcut shares the ring's vertices, a third of the cost of loose triangles.
      const [lr, lg, lb] = parseHex(b.lid!.hex), base = v, z = b.heightM;
      for (let k = 0; k < lid.xy.length; k += 2) {
        positions[v * 3] = lid.xy[k]; positions[v * 3 + 1] = lid.xy[k + 1]; positions[v * 3 + 2] = z;
        uvs[v * 2] = lid.xy[k] / 4; uvs[v * 2 + 1] = lid.xy[k + 1] / 4;
        layers[v] = b.lid!.flatLayer;
        tints[v * 4] = lr; tints[v * 4 + 1] = lg; tints[v * 4 + 2] = lb; tints[v * 4 + 3] = LID_SHADE * 255;
        accents[v * 4] = accents[v * 4 + 1] = accents[v * 4 + 2] = accents[v * 4 + 3] = 255;
        v++;
      }
      for (const k of lid.index) indices[ti++] = base + k;
    }
    for (const t of sign) {
      // Signature storefront boxes: flat colour on the flat layer, shaded by facing.
      const shade = Math.max(t.lit ? 0.9 : 0.55, Math.min(1, 0.58 + 0.42 * Math.max(0, t.n[0] * -0.35 + t.n[1] * 0.5 + t.n[2] * 0.8)));
      const [sr, sg, sb] = parseHex(t.hex);
      for (const q of t.p) {
        positions[v * 3] = q[0]; positions[v * 3 + 1] = q[1]; positions[v * 3 + 2] = q[2];
        uvs[v * 2] = 0.5; uvs[v * 2 + 1] = 0.5; layers[v] = b.lid!.flatLayer;
        tints[v * 4] = sr; tints[v * 4 + 1] = sg; tints[v * 4 + 2] = sb; tints[v * 4 + 3] = shade * 255;
        accents[v * 4] = accents[v * 4 + 1] = accents[v * 4 + 2] = accents[v * 4 + 3] = 255;
        indices[ti++] = v; v++;
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
